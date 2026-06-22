"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import { startTask, dismissTask } from "@/lib/tasks";
import { useTask } from "@/hooks/useTasks";
import { MAX_IMAGE_BYTES, type MassingResult, type MassingVariant } from "@/lib/massing-types";

const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return "text-emerald-400";
  if (pct >= 0.55) return "text-amber-400";
  return "text-red-400";
}

export default function MassingPage() {
  const [model, setModel] = useChatModel(GEMINI_MODELS);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<MassingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<MassingVariant[] | null>(null);
  const [variantsError, setVariantsError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Phân tích & dựng phương án chạy như TÁC VỤ NỀN → rời trang vẫn xong, quay
  // lại đọc tiến trình/ kết quả live.
  const analyzeTask = useTask("massing:analyze");
  const variantsTask = useTask("massing:variants");
  const loading = analyzeTask?.status === "running";
  const analyzePct = analyzeTask?.progress ?? 0;
  const variantsLoading = variantsTask?.status === "running";
  const variantsPct = variantsTask?.progress ?? 0;

  useEffect(() => {
    if (analyzeTask?.status === "done") {
      setResult(analyzeTask.result as MassingResult);
      setError(null);
      dismissTask("massing:analyze");
    } else if (analyzeTask?.status === "error") {
      setError(analyzeTask.error ?? "Phân tích thất bại");
      dismissTask("massing:analyze");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzeTask?.status]);

  useEffect(() => {
    if (variantsTask?.status === "done") {
      setVariants(variantsTask.result as MassingVariant[]);
      setVariantsError(null);
      dismissTask("massing:variants");
    } else if (variantsTask?.status === "error") {
      setVariantsError(variantsTask.error ?? "Tạo phương án thất bại");
      dismissTask("massing:variants");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsTask?.status]);

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
    setVariants(null);
    setVariantsError(null);
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  function handleAnalyze() {
    if (!imageBase64) {
      setError("Vui lòng tải lên ảnh hình khối cần phân tích");
      return;
    }
    setError(null);
    setResult(null);
    setVariants(null);
    setVariantsError(null);

    const payload = { imageBase64, mimeType, context, model };
    const curModel = model;
    const curContext = context;
    startTask({
      id: "massing:analyze",
      type: "analyze",
      label: "Đang phân tích hình khối…",
      route: "/massing",
      fakeProgress: true,
      run: async () => {
        const res = await fetch("/api/massing/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.code === "QUOTA_EXCEEDED") markRateLimited(curModel);
          throw new Error(json.error || "Phân tích thất bại");
        }
        // ảnh ~258 token + bối cảnh + kết quả
        recordAiCall(curModel, 258 + estimateTokens(curContext) + estimateTokens(JSON.stringify(json)));
        return json as MassingResult;
      },
    });
  }

  function handleVariants() {
    if (!preview || !result) return;
    setVariantsError(null);
    setVariants(null);

    const curImage = preview;
    const curSuggestions = result.suggestions;
    const curContext = context;
    const curModel = model;
    startTask({
      id: "massing:variants",
      type: "massing",
      label: "Đang dựng phương án hình khối…",
      route: "/massing",
      fakeProgress: true,
      run: async () => {
        const res = await fetch("/api/massing/variants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: curImage, suggestions: curSuggestions, context: curContext }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.code === "QUOTA_EXCEEDED") markRateLimited(curModel);
          throw new Error(json.error || "Tạo phương án thất bại");
        }
        // 2 ảnh img2img ~ mỗi ảnh tốn đáng kể; ước lượng thô theo số phương án
        recordAiCall(curModel, 258 * (json.variants?.length ?? 0));
        return (json.variants ?? []) as MassingVariant[];
      },
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Phân tích hình khối</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Tải lên ảnh hình khối kiến trúc (mô hình khối, dựng SketchUp thô, phác thảo hoặc ảnh công
          trình). AI sẽ phân tích kỹ theo từng mục — điểm đẹp, điểm chưa đạt và cách cải thiện — để
          bạn biết và chỉnh sửa.
        </p>
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <label className={labelClass}>Ảnh hình khối *</label>
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
              <img src={preview} alt="Ảnh hình khối xem trước" className="max-h-[360px] w-auto rounded-card object-contain" />
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
                setVariants(null);
                setVariantsError(null);
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
            placeholder="Ví dụ: biệt thự hiện đại 3 tầng trên đất vuông, muốn khối khoẻ khoắn nhưng nhẹ nhàng; cần góp ý về tỉ lệ và đặc–rỗng mặt chính..."
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
            {loading ? `Đang phân tích hình khối... ${analyzePct}%` : "🧱 Phân tích hình khối"}
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="space-y-3 p-6">
          <ProgressBar percent={analyzePct} label="AI đang phân tích hình khối" />
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
            <div className="flex-1">
              {result.title && <h2 className="font-display text-base text-foreground">{result.title}</h2>}
              <p className="mt-1 text-sm leading-relaxed text-foreground">{result.summary}</p>
            </div>
          </Card>

          {result.criteria.length > 0 && (
            <div className="space-y-5">
              {result.criteria.map((c, i) => (
                <Card key={i} className="space-y-4 p-5 sm:p-6">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display text-base text-accent">{c.name}</h2>
                      <span className={`text-sm font-semibold ${scoreColor(c.score, 10)}`}>{c.score}/10</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.max(0, Math.min(10, c.score)) * 10}%` }}
                      />
                    </div>
                    {c.comment && <p className="mt-2 text-sm text-foreground-soft">{c.comment}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {c.pros.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-emerald-400">Điểm đẹp</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                          {c.pros.map((s, j) => <li key={j}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {c.cons.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-red-400">Điểm chưa đạt</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                          {c.cons.map((s, j) => <li key={j}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {c.improvements.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-amber-400">Cần cải thiện</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                          {c.improvements.map((s, j) => <li key={j}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {result.suggestions.length > 0 && (
            <Card className="space-y-3 p-5 sm:p-6">
              <h2 className="font-display text-base text-amber-400">Đề xuất sửa đổi ưu tiên</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
                {result.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </Card>
          )}

          {/* 2 phương án sửa đổi hình khối (ảnh 1K) */}
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base text-accent">Phương án sửa đổi hình khối</h2>
                <p className="mt-0.5 text-xs text-foreground-soft">
                  AI dựng 2 phương án (ảnh 1K) sửa lại khối theo các đề xuất ở trên — để bạn so sánh và chỉnh tiếp.
                </p>
              </div>
              <Button onClick={handleVariants} disabled={variantsLoading}>
                {variantsLoading
                  ? `Đang dựng phương án... ${variantsPct}%`
                  : variants
                    ? "🔄 Dựng lại"
                    : "🧩 Dựng 2 phương án"}
              </Button>
            </div>

            {variantsError && (
              <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {variantsError}
              </div>
            )}

            {variantsLoading && (
              <div className="space-y-3">
                <ProgressBar percent={variantsPct} label="AI đang dựng phương án hình khối" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="aspect-[4/3] animate-pulse rounded-card bg-surface-muted" />
                  ))}
                </div>
              </div>
            )}

            {variants && variants.length > 0 && !variantsLoading && (
              <div className="grid gap-4 sm:grid-cols-2">
                {variants.map((v, i) => (
                  <div key={i} className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{v.label}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.image}
                      alt={v.label}
                      className="w-full rounded-card border border-border object-contain"
                    />
                    <a
                      href={v.image}
                      download={`phuong-an-hinh-khoi-${i + 1}.png`}
                      className="inline-block text-xs text-accent underline-offset-2 hover:underline"
                    >
                      Tải ảnh
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
