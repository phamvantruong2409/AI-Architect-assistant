"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MarkdownLite } from "@/components/chat/MarkdownLite";
import { DOC_MODELS } from "@/lib/ai-models";
import { useChatModel } from "@/hooks/useChatModel";
import { useFakeProgress } from "@/hooks/useFakeProgress";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import {
  BUILDING_TYPES,
  DOC_TYPE_OPTIONS,
  LENGTH_OPTIONS,
  type DossierFormData,
  type DossierResult,
} from "@/lib/dossier-types";

interface ProjectLite {
  id: string;
  name: string;
  type: string;
}

const EMPTY: Omit<DossierFormData, "model"> = {
  projectName: "",
  buildingType: BUILDING_TYPES[0],
  location: "",
  landArea: "",
  floorArea: "",
  floors: "",
  style: "",
  client: "",
  concept: "",
  materials: "",
  docType: "phuong_an",
  length: "tieu_chuan",
};

const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converts the constrained markdown (bold, "- " lists, blank-line paragraphs) to HTML for export. */
function contentToHtml(content: string): string {
  return content
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n").filter(Boolean);
      if (lines.length && lines.every((l) => /^[-*]\s/.test(l))) {
        const items = lines
          .map((l) => `<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.map((l) => inline(l)).join("<br/>")}</p>`;
    })
    .join("\n");
}

function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function buildDocumentHtml(result: DossierResult): string {
  const body = result.sections
    .map(
      (s) =>
        `<h2>${escapeHtml(s.heading)}</h2>${contentToHtml(s.content)}`
    )
    .join("\n");
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>${escapeHtml(
    result.title
  )}</title><style>
    body{font-family:'Times New Roman',serif;line-height:1.6;color:#111;max-width:780px;margin:40px auto;padding:0 24px;}
    h1{font-size:20px;text-align:center;text-transform:uppercase;margin-bottom:28px;}
    h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ccc;padding-bottom:4px;}
    p{margin:8px 0;text-align:justify;} ul{margin:8px 0;padding-left:22px;}
  </style></head><body><h1>${escapeHtml(result.title)}</h1>${body}</body></html>`;
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "thuyet-minh"
  );
}

export default function DossierPage() {
  const [model, setModel] = useChatModel(DOC_MODELS);
  const [form, setForm] = useState(EMPTY);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [result, setResult] = useState<DossierResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pct = useFakeProgress(loading);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setProjects(data))
      .catch(() => {});
  }, []);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function prefillFromProject(id: string) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setForm((prev) => ({ ...prev, projectName: p.name, style: prev.style || p.type }));
  }

  async function handleGenerate() {
    if (!form.projectName.trim()) { setError("Vui lòng nhập tên công trình"); return; }
    if (!form.concept.trim()) { setError("Vui lòng mô tả ý tưởng / yêu cầu chủ đạo"); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dossier/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, model } satisfies DossierFormData),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(model);
        throw new Error(json.error || "Tạo sinh thuyết minh thất bại");
      }
      recordAiCall(model, estimateTokens(JSON.stringify(form)) + estimateTokens(JSON.stringify(json)));
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo sinh thuyết minh thất bại");
    } finally {
      setLoading(false);
    }
  }

  function resultToPlainText(r: DossierResult): string {
    return (
      r.title +
      "\n\n" +
      r.sections.map((s) => `${s.heading.toUpperCase()}\n${s.content}`).join("\n\n")
    );
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(resultToPlainText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadWord() {
    if (!result) return;
    const blob = new Blob([buildDocumentHtml(result)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thuyet-minh-${slugify(form.projectName)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!result) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildDocumentHtml(result));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Thuyết minh AI</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tạo sinh thuyết minh thiết kế hoàn chỉnh từ thông tin công trình — xuất Word / PDF chỉ trong vài giây.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        {projects.length > 0 && (
          <div>
            <label className={labelClass}>Lấy nhanh từ dự án có sẵn (tuỳ chọn)</label>
            <select
              className={inputClass}
              defaultValue=""
              onChange={(e) => prefillFromProject(e.target.value)}
            >
              <option value="">— Chọn dự án để điền sẵn —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Tên công trình *</label>
            <input
              className={inputClass}
              value={form.projectName}
              onChange={(e) => update("projectName", e.target.value)}
              placeholder="Biệt thự nghỉ dưỡng Đà Lạt"
            />
          </div>
          <div>
            <label className={labelClass}>Loại công trình</label>
            <select
              className={inputClass}
              value={form.buildingType}
              onChange={(e) => update("buildingType", e.target.value)}
            >
              {BUILDING_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Địa điểm</label>
            <input
              className={inputClass}
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Phường 10, TP. Đà Lạt"
            />
          </div>
          <div>
            <label className={labelClass}>Phong cách kiến trúc</label>
            <input
              className={inputClass}
              value={form.style}
              onChange={(e) => update("style", e.target.value)}
              placeholder="Nhiệt đới hiện đại"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div>
              <label className={labelClass}>DT đất (m²)</label>
              <input className={inputClass} value={form.landArea} onChange={(e) => update("landArea", e.target.value)} inputMode="decimal" placeholder="300" />
            </div>
            <div>
              <label className={labelClass}>DT sàn (m²)</label>
              <input className={inputClass} value={form.floorArea} onChange={(e) => update("floorArea", e.target.value)} inputMode="decimal" placeholder="450" />
            </div>
            <div>
              <label className={labelClass}>Số tầng</label>
              <input className={inputClass} value={form.floors} onChange={(e) => update("floors", e.target.value)} inputMode="numeric" placeholder="2" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Chủ đầu tư / đối tượng sử dụng</label>
            <input
              className={inputClass}
              value={form.client}
              onChange={(e) => update("client", e.target.value)}
              placeholder="Gia đình 4 người, ưa thích không gian mở"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Ý tưởng & yêu cầu chủ đạo *</label>
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              value={form.concept}
              onChange={(e) => update("concept", e.target.value)}
              placeholder="Kết nối thiên nhiên, tận dụng tầm nhìn thung lũng, vật liệu địa phương, tiết kiệm năng lượng..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Vật liệu & giải pháp nổi bật (tuỳ chọn)</label>
            <textarea
              className={`${inputClass} min-h-[64px] resize-y`}
              value={form.materials}
              onChange={(e) => update("materials", e.target.value)}
              placeholder="Đá tự nhiên, gỗ, kính lớn, mái dốc, giếng trời..."
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Loại thuyết minh</label>
            <select
              className={inputClass}
              value={form.docType}
              onChange={(e) => update("docType", e.target.value as typeof form.docType)}
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Độ dài</label>
            <select
              className={inputClass}
              value={form.length}
              onChange={(e) => update("length", e.target.value as typeof form.length)}
            >
              {LENGTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Model AI</label>
            <select
              className={inputClass}
              value={model}
              onChange={(e) => setModel(e.target.value as typeof model)}
            >
              {DOC_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? `Đang soạn thuyết minh... ${pct}%` : "✨ Tạo sinh thuyết minh"}
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="space-y-4 p-6">
          <ProgressBar percent={pct} label="AI đang soạn thuyết minh" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-surface-muted" />
            </div>
          ))}
        </Card>
      )}

      {result && !loading && (
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
            <h2 className="font-display text-xl uppercase tracking-wide">{result.title}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDownloadWord}>
                Tải Word
              </Button>
              <Button size="sm" variant="secondary" onClick={handlePrint}>
                In / PDF
              </Button>
            </div>
          </div>

          <article className="space-y-7 text-sm leading-relaxed text-foreground">
            {result.sections.map((s, i) => (
              <section key={i}>
                <h3 className="font-display mb-2 text-base text-accent">{s.heading}</h3>
                <MarkdownLite content={s.content} />
              </section>
            ))}
          </article>
        </Card>
      )}
    </div>
  );
}
