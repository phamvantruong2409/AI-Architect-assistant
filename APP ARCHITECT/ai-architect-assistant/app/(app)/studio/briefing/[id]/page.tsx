"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, Check } from "lucide-react";
import { MarkdownLite } from "@/components/chat/MarkdownLite";
import type { BriefRecord } from "@/lib/briefing-store";
import { DOC_MODELS } from "@/lib/ai-models";
import { useChatModel } from "@/hooks/useChatModel";

const DETAIL_PLACEHOLDER = `Mô tả tự do về dự án: loại công trình, diện tích, số tầng, hướng nhà; gia đình & lối sống; công năng cần có; phong cách & tông màu mong muốn; vật liệu ưa thích; ngân sách & tiến độ; điều nhất định muốn có / muốn tránh...`;

export default function BriefingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<BriefRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [model, setModel] = useChatModel(DOC_MODELS);

  useEffect(() => {
    fetch(`/api/briefing/brief/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRecord(d);
        const savedDetail =
          typeof d.detail === "string" ? d.detail
          : typeof d.answers?.detail === "string" ? d.answers.detail
          : "";
        setDetail(savedDetail);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveDetail() {
    setSaving(true);
    setSaved(false);
    setGenError(null);
    try {
      const res = await fetch(`/api/briefing/brief/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Lưu thất bại");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function generateBrief() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/briefing/brief/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, detail }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Đề xuất thất bại");
      setRecord((r) => (r ? { ...r, brief: d.brief, status: "completed" } : r));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Đề xuất thất bại");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-foreground-soft" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-foreground-soft">{error ?? "Không tìm thấy nhiệm vụ"}</p>
        <Link href="/studio/briefing" className="text-sm text-accent hover:underline">
          Quay lại
        </Link>
      </div>
    );
  }

  const canGenerate = detail.trim().length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/studio/briefing"
          className="rounded-lg p-2 text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground">{record.project_name}</h1>
          <p className="text-xs text-foreground-soft">Khách hàng: {record.client_name}</p>
        </div>
      </div>

      {/* Thông tin chi tiết do KTS tự điền */}
      <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-1 font-display text-base text-foreground">Thông tin chi tiết</h2>
        <p className="mb-3 text-xs text-foreground-soft">
          Tự điền mọi thông tin bạn nắm về dự án. Càng chi tiết, AI đề xuất càng sát.
        </p>
        <textarea
          rows={12}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={DETAIL_PLACEHOLDER}
          className="w-full resize-y rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder-foreground-soft/60 focus:border-stone-500 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={saveDetail}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-emerald-400" /> : null}
            {saved ? "Đã lưu" : "Lưu thông tin"}
          </button>
          <span className="flex-1" />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            disabled={generating}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            {DOC_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={generateBrief}
            disabled={generating || !canGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Đang đề xuất..." : record.brief ? "Đề xuất lại" : "AI đề xuất nhiệm vụ thiết kế"}
          </button>
        </div>
        {genError && <p className="mt-3 text-sm text-red-400">{genError}</p>}
      </div>

      {/* Nhiệm vụ thiết kế do AI đề xuất */}
      {record.brief && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-base text-accent">Nhiệm vụ thiết kế (AI đề xuất)</h2>
          <div className="rounded-card border border-border bg-surface p-5 sm:p-6 text-sm leading-relaxed text-foreground">
            <MarkdownLite content={record.brief} />
          </div>
        </div>
      )}
    </div>
  );
}
