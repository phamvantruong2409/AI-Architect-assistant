"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import {
  IMAGE_PROMPT_ENGINES,
  MAX_IMAGE_BYTES,
  type ImagePromptEngine,
  type ImagePromptResult,
} from "@/lib/image-prompt-types";
import {
  addHistory,
  clearHistory,
  loadHistory,
  removeHistory,
  type ImagePromptHistoryEntry,
} from "@/lib/image-prompt-history";
import { makeItem, putItem } from "@/lib/prompt-library-store";

const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";

function CopyButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Đã sao chép" : label}
    </Button>
  );
}

/** Thu nhỏ ảnh để lưu lịch sử (giữ nguyên tỉ lệ; đủ lớn để khi lưu trữ vẫn nét). */
function makeThumb(dataUrl: string, max = 1024): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

export default function ImageToPromptPage() {
  const [model, setModel] = useChatModel(GEMINI_MODELS);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [engine, setEngine] = useState<ImagePromptEngine>("midjourney");
  const [result, setResult] = useState<ImagePromptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ImagePromptHistoryEntry[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Đọc lịch sử từ localStorage một lần khi mount (SSR-safe; lazy initializer sẽ gây hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một tệp ảnh");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Ảnh quá lớn (tối đa 8MB). Vui lòng nén lại.");
      return;
    }
    setError(null);
    setResult(null);
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  // Dán ảnh trực tiếp bằng Ctrl+V (ảnh đã copy từ web, máy tính...).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      if (item) {
        e.preventDefault();
        handleFile(item.getAsFile());
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function clearImage() {
    setPreview(null);
    setImageBase64(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleExtract() {
    if (!imageBase64) {
      setError("Vui lòng đưa ảnh vào để tạo prompt");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(8);
    const timer = setInterval(() => {
      // Tăng dần tới ~92% trong khi chờ AI; chốt 100% khi xong.
      setProgress((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(1, Math.round((94 - p) * 0.1)))));
    }, 250);
    try {
      const res = await fetch("/api/image-to-prompt/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, engine, model }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(model);
        throw new Error(json.error || "Tạo prompt thất bại");
      }
      recordAiCall(model, 258 + estimateTokens(JSON.stringify(json)));
      setResult(json);

      const thumb = preview ? await makeThumb(preview) : null;
      const entry: ImagePromptHistoryEntry = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: Date.now(),
        engineValue: engine,
        engineLabel: IMAGE_PROMPT_ENGINES.find((e) => e.value === engine)?.label ?? engine,
        thumb,
        result: json as ImagePromptResult,
      };
      setHistory(addHistory(entry));

      setProgress(100);
      await new Promise((r) => setTimeout(r, 450));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo prompt thất bại");
    } finally {
      clearInterval(timer);
      setLoading(false);
      setProgress(0);
    }
  }

  // Lưu trữ: chuyển prompt + ảnh sang kho "Lưu trữ Prompt", rồi xoá khỏi lịch sử.
  async function archive(h: ImagePromptHistoryEntry) {
    const r = h.result;
    const j = r.json;
    const parts: string[] = [];
    // Ưu tiên nội dung tiếng Việt lên trước (đa số người dùng là người Việt).
    if (r.promptVi.trim()) parts.push(`📝 PROMPT THUẦN VIỆT:\n${r.promptVi.trim()}`);
    const breakdown = [
      j.subject && `• Chủ thể: ${j.subject}`,
      j.lighting && `• Ánh sáng: ${j.lighting}`,
      j.composition && `• Bố cục & camera: ${j.composition}`,
      j.styleCamera && `• Phong cách / ống kính: ${j.styleCamera}`,
      j.environment && `• Môi trường / hậu cảnh: ${j.environment}`,
      j.materials.length && `• Vật liệu: ${j.materials.join(", ")}`,
      j.colors.length && `• Bảng màu: ${j.colors.join(", ")}`,
      j.aspectRatio && `• Tỉ lệ khung: ${j.aspectRatio}`,
    ].filter(Boolean);
    if (breakdown.length) parts.push(`🔎 PHÂN RÃ CHI TIẾT:\n${breakdown.join("\n")}`);
    if (r.notes.trim()) parts.push(`🗒️ GHI CHÚ:\n${r.notes.trim()}`);
    if (r.prompt.trim()) parts.push(`🎯 PROMPT (EN):\n${r.prompt.trim()}`);
    if (r.negativePrompt.trim()) parts.push(`🚫 NEGATIVE PROMPT:\n${r.negativePrompt.trim()}`);
    const text = parts.join("\n\n");
    try {
      await putItem(
        makeItem({
          title: r.title?.trim() || r.json.subject?.trim() || h.engineLabel,
          text,
          images: h.thumb ? [h.thumb] : [],
        })
      );
      setHistory(removeHistory(h.id));
      setFlash("Đã lưu trữ vào kho Lưu trữ Prompt");
      setTimeout(() => setFlash(null), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu trữ thất bại");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Ảnh → Prompt</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Đưa một ảnh tham khảo vào (kéo-thả, chọn file, hoặc dán <kbd className="rounded border border-border px-1">Ctrl</kbd>+
          <kbd className="rounded border border-border px-1">V</kbd>) — AI đọc ngược ra prompt tái tạo, kèm negative
          prompt, phân rã chi tiết và thẻ phong cách.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <label className={labelClass}>Ảnh tham khảo *</label>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-dashed border-border bg-surface-muted p-3 text-center transition-colors hover:border-accent/50"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Ảnh xem trước" className="max-h-[360px] w-auto rounded-card object-contain" />
            ) : (
              <>
                <span className="text-sm text-foreground">Kéo thả ảnh, bấm để chọn, hoặc dán Ctrl+V</span>
                <span className="text-xs text-foreground-soft">JPG, PNG, WEBP — tối đa 8MB</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {preview && (
            <button
              className="mt-2 text-xs text-foreground-soft underline-offset-2 hover:text-foreground hover:underline"
              onClick={clearImage}
            >
              Chọn ảnh khác
            </button>
          )}
        </div>

        <div className="rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-300/90">
          ⚠️ Lưu ý: prompt của ảnh này có thể không tối ưu cho ảnh khác mà bạn render. Prompt chỉ mang tính chất tham
          khảo — bạn cần hiểu rõ bối cảnh trước khi quyết định render ảnh nhé.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Engine đích (tối ưu cú pháp prompt)</label>
            <select
              className={inputClass}
              value={engine}
              onChange={(e) => setEngine(e.target.value as ImagePromptEngine)}
            >
              {IMAGE_PROMPT_ENGINES.map((eng) => (
                <option key={eng.value} value={eng.value}>{eng.label}</option>
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
              {GEMINI_MODELS.map((m) => (
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

        {loading && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-foreground-soft">
              <span>Đang đọc ảnh & tạo prompt...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleExtract} disabled={loading || !imageBase64}>
            {loading ? "Đang tạo prompt..." : "✨ Tạo prompt từ ảnh"}
          </Button>
        </div>
      </Card>

      {result && !loading && (
        <div className="space-y-5">
          {result.title.trim() && (
            <h2 className="font-display text-lg text-foreground">{result.title}</h2>
          )}

          {result.promptVi.trim() && (
            <Card className="space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base text-accent">Prompt thuần Việt 🇻🇳</h2>
                <CopyButton text={result.promptVi} />
              </div>
              <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-4 py-3 text-sm leading-relaxed text-foreground">
                {result.promptVi}
              </p>
            </Card>
          )}

          <Card className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base text-accent">Prompt thuần Anh (EN)</h2>
              <CopyButton text={result.prompt} />
            </div>
            <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
              {result.prompt}
            </p>
            {result.styleTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.styleTags.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground-soft"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {result.negativePrompt.trim() && (
            <Card className="space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base text-accent">Negative prompt</h2>
                <CopyButton text={result.negativePrompt} />
              </div>
              <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
                {result.negativePrompt}
              </p>
            </Card>
          )}

          <Card className="space-y-3 p-5 sm:p-6">
            <h2 className="font-display text-base text-accent">Phân rã chi tiết</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label="Chủ thể" value={result.json.subject} />
              <Field label="Ánh sáng" value={result.json.lighting} />
              <Field label="Bố cục & camera" value={result.json.composition} />
              <Field label="Phong cách / ống kính" value={result.json.styleCamera} />
              <Field label="Môi trường / hậu cảnh" value={result.json.environment} />
              <Field label="Tỉ lệ khung" value={result.json.aspectRatio} />
              <Field label="Vật liệu" value={result.json.materials.join(", ")} />
              <Field label="Bảng màu" value={result.json.colors.join(", ")} />
            </dl>
          </Card>

          {result.notes.trim() && (
            <Card className="space-y-2 p-5 sm:p-6">
              <h2 className="font-display text-base text-accent">Ghi chú</h2>
              <p className="text-sm leading-relaxed text-foreground-soft">{result.notes}</p>
            </Card>
          )}
        </div>
      )}

      {history.length > 0 && (
        <Card className="space-y-3 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base text-accent">Lịch sử ({history.length})</h2>
            <button
              className="text-xs text-foreground-soft underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => setHistory(clearHistory())}
            >
              Xoá tất cả
            </button>
          </div>

          {flash && (
            <div className="rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
              ✓ {flash}
            </div>
          )}
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    setResult(h.result);
                    setError(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {h.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.thumb} alt="" className="h-12 w-12 flex-none rounded-card object-cover" />
                  ) : (
                    <div className="h-12 w-12 flex-none rounded-card bg-surface-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {h.result.title?.trim() || h.result.json.subject?.trim() || "Prompt"}
                    </p>
                    <p className="text-xs text-foreground-soft">
                      {h.engineLabel} · {timeAgo(h.createdAt)}
                    </p>
                  </div>
                </button>
                <button
                  className="flex-none rounded-card border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                  onClick={() => void archive(h)}
                  title="Chuyển prompt và ảnh này sang kho Lưu trữ Prompt"
                >
                  Lưu trữ Prompt
                </button>
                <button
                  className="flex-none text-xs text-foreground-soft underline-offset-2 hover:text-red-400 hover:underline"
                  onClick={() => setHistory(removeHistory(h.id))}
                >
                  Xoá
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-foreground-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}
