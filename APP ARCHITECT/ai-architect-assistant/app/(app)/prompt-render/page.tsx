"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import {
  RENDER_ENGINES,
  SPACE_OPTIONS,
  TIME_OPTIONS,
  MOOD_OPTIONS,
  type PromptRenderFormData,
  type PromptRenderResult,
} from "@/lib/prompt-render-types";

const EMPTY: Omit<PromptRenderFormData, "model"> = {
  subject: "",
  space: SPACE_OPTIONS[0],
  style: "",
  timeOfDay: TIME_OPTIONS[2],
  mood: MOOD_OPTIONS[0],
  details: "",
  engine: "d5",
};

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

export default function PromptRenderPage() {
  const [model, setModel] = useChatModel();
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<PromptRenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    if (!form.subject.trim()) {
      setError("Vui lòng mô tả đối tượng / công trình cần render");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prompt-render/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, model } satisfies PromptRenderFormData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sinh prompt thất bại");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sinh prompt thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Sinh Prompt Render</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tạo prompt tối ưu cho D5 Render, Lumion, Enscape, V-Ray, Midjourney hay Stable Diffusion —
          kèm gợi ý thiết lập cho đúng engine.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <label className={labelClass}>Đối tượng / công trình cần render *</label>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            placeholder="Biệt thự 2 tầng nhiệt đới hiện đại, hồ bơi tràn, sân vườn, vật liệu đá và gỗ..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Loại không gian</label>
            <select className={inputClass} value={form.space} onChange={(e) => update("space", e.target.value)}>
              {SPACE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Phong cách</label>
            <input
              className={inputClass}
              value={form.style}
              onChange={(e) => update("style", e.target.value)}
              placeholder="Nhiệt đới hiện đại, tối giản Nhật..."
            />
          </div>
          <div>
            <label className={labelClass}>Thời điểm / ánh sáng</label>
            <select className={inputClass} value={form.timeOfDay} onChange={(e) => update("timeOfDay", e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tâm trạng / không khí</label>
            <select className={inputClass} value={form.mood} onChange={(e) => update("mood", e.target.value)}>
              {MOOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Chi tiết bổ sung (tuỳ chọn)</label>
          <textarea
            className={`${inputClass} min-h-[64px] resize-y`}
            value={form.details}
            onChange={(e) => update("details", e.target.value)}
            placeholder="Góc camera thấp, người đi dạo, cây nhiệt đới, phản chiếu trên mặt nước, ống kính 24mm..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Engine render</label>
            <select
              className={inputClass}
              value={form.engine}
              onChange={(e) => update("engine", e.target.value as typeof form.engine)}
            >
              {RENDER_ENGINES.map((eng) => (
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

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Đang tạo prompt..." : "✨ Sinh prompt"}
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="space-y-3 p-6">
          <div className="h-4 w-1/4 animate-pulse rounded bg-surface-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-muted" />
          <div className="h-12 w-full animate-pulse rounded bg-surface-muted" />
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <Card className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base text-accent">Prompt chính (EN)</h2>
              <CopyButton text={result.prompt} />
            </div>
            <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
              {result.prompt}
            </p>
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

          {result.settings.length > 0 && (
            <Card className="space-y-3 p-5 sm:p-6">
              <h2 className="font-display text-base text-accent">Gợi ý thiết lập engine</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {result.settings.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
          )}

          {result.notes.trim() && (
            <Card className="space-y-2 p-5 sm:p-6">
              <h2 className="font-display text-base text-accent">Ghi chú</h2>
              <p className="text-sm leading-relaxed text-foreground-soft">{result.notes}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
