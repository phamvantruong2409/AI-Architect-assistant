"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { useFakeProgress } from "@/hooks/useFakeProgress";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import { MAX_IMAGE_BYTES, type ReviewResult } from "@/lib/review-types";

const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return "text-emerald-400";
  if (pct >= 0.55) return "text-amber-400";
  return "text-red-400";
}

export default function ReviewPage() {
  const [model, setModel] = useChatModel(GEMINI_MODELS);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = useFakeProgress(loading);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
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

  async function handleAnalyze() {
    if (!imageBase64) {
      setError("Vui lòng tải lên ảnh render cần đánh giá");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/review/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, context, model }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(model);
        throw new Error(json.error || "Đánh giá thất bại");
      }
      // ảnh ~258 token + bối cảnh + kết quả
      recordAiCall(model, 258 + estimateTokens(context) + estimateTokens(JSON.stringify(json)));
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đánh giá thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Đánh giá Render</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tải lên ảnh render để AI nhận xét ánh sáng, vật liệu, bố cục camera và đề xuất cách cải thiện.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <label className={labelClass}>Ảnh render *</label>
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
              <img src={preview} alt="Ảnh render xem trước" className="max-h-[360px] w-auto rounded-card object-contain" />
            ) : (
              <>
                <span className="text-sm text-foreground">Kéo thả ảnh vào đây hoặc bấm để chọn</span>
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
              onClick={() => {
                setPreview(null);
                setImageBase64(null);
                setResult(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Chọn ảnh khác
            </button>
          )}
        </div>

        <div>
          <label className={labelClass}>Bối cảnh / mong muốn (tuỳ chọn)</label>
          <textarea
            className={`${inputClass} min-h-[64px] resize-y`}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ví dụ: phối cảnh ngoại thất ban đêm, muốn không khí ấm cúng sang trọng; cần góp ý về ánh sáng và vật liệu mặt đứng..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Button onClick={handleAnalyze} disabled={loading || !imageBase64}>
            {loading ? `Đang phân tích ảnh... ${pct}%` : "🔍 Đánh giá render"}
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="space-y-3 p-6">
          <ProgressBar percent={pct} label="AI đang đánh giá render" />
          <div className="h-16 w-1/3 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-surface-muted" />
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
            <div className="flex flex-col items-center">
              <span className={`font-display text-4xl ${scoreColor(result.overallScore, 100)}`}>
                {result.overallScore}
              </span>
              <span className="text-xs text-foreground-soft">/ 100</span>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-foreground">{result.summary}</p>
          </Card>

          {result.criteria.length > 0 && (
            <Card className="space-y-4 p-5 sm:p-6">
              <h2 className="font-display text-base text-accent">Chấm theo tiêu chí</h2>
              <div className="space-y-4">
                {result.criteria.map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <span className={`text-sm font-semibold ${scoreColor(c.score, 10)}`}>{c.score}/10</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(0, Math.min(10, c.score)) * 10}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-foreground-soft">{c.comment}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {result.strengths.length > 0 && (
              <Card className="space-y-3 p-5 sm:p-6">
                <h2 className="font-display text-base text-emerald-400">Điểm mạnh</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                  {result.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
            )}
            {result.improvements.length > 0 && (
              <Card className="space-y-3 p-5 sm:p-6">
                <h2 className="font-display text-base text-amber-400">Đề xuất cải thiện</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                  {result.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
