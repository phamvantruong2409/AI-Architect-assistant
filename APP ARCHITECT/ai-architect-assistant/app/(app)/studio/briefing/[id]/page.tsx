"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { MarkdownLite } from "@/components/chat/MarkdownLite";
import { SURVEY_SECTIONS } from "@/lib/briefing-survey";
import type { BriefRecord } from "@/lib/briefing-store";

export default function BriefingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<BriefRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/briefing/brief/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setRecord(d);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function generateBrief() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/briefing/brief/${id}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Tạo brief thất bại");
      setRecord((r) => (r ? { ...r, brief: d.brief } : r));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Tạo brief thất bại");
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
        <p className="text-foreground-soft">{error ?? "Không tìm thấy brief"}</p>
        <Link href="/studio/briefing" className="text-sm text-accent hover:underline">
          Quay lại
        </Link>
      </div>
    );
  }

  const answers = record.answers ?? {};

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

      {record.brief ? (
        <div className="rounded-card border border-border bg-surface p-5 sm:p-6 text-sm leading-relaxed text-foreground">
          <MarkdownLite content={record.brief} />
        </div>
      ) : record.status !== "completed" || Object.keys(record.answers ?? {}).length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-5 text-sm text-foreground-soft">
          Khách hàng chưa hoàn thành khảo sát nên chưa có dữ liệu để tạo brief.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-5">
          <p className="text-sm text-foreground-soft">
            Khách hàng đã hoàn thành khảo sát. Tạo bản brief thiết kế bằng AI từ các đáp án bên dưới.
          </p>
          <button
            onClick={generateBrief}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Đang tạo brief..." : "Tạo brief bằng AI"}
          </button>
          {genError && <p className="text-sm text-red-400">{genError}</p>}
        </div>
      )}

      {/* Tóm tắt đáp án khảo sát */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-base text-accent">Đáp án khảo sát của khách hàng</h2>
        <div className="space-y-5">
          {SURVEY_SECTIONS.map((section) => {
            const rows = section.questions
              .map((q) => ({ q, a: answers[q.id] }))
              .filter(({ a }) => a && (!Array.isArray(a) || a.length > 0));
            if (rows.length === 0) return null;
            return (
              <div key={section.id} className="rounded-card border border-border bg-surface p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-soft">
                  {section.icon} {section.title}
                </p>
                <dl className="space-y-1.5">
                  {rows.map(({ q, a }) => (
                    <div key={q.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                      <dt className="shrink-0 text-sm text-foreground-soft sm:w-56">{q.label}</dt>
                      <dd className="text-sm text-foreground">{Array.isArray(a) ? a.join(", ") : a}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
