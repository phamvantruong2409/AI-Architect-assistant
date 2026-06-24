"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import {
  RENDER_MODELS,
  DEFAULT_RENDER_MODEL,
  modelResolutions,
  renderModelLabel,
  MAX_IMAGE_BYTES,
  MAX_RENDER_IMAGES,
  type RenderModelId,
} from "@/lib/render-types";
import { addHistory, type RenderHistoryItem } from "@/lib/render-history";
import { QUICK_STYLES, type QuickMode, type QuickIdeaResult } from "@/lib/quick-idea-types";

const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";
const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const CUSTOM_STYLE = "__custom__";

interface ImageState {
  preview: string | null; // dataURL đầy đủ
  base64: string | null; // base64 thuần (không tiền tố)
  mime: string;
}
const EMPTY_IMG: ImageState = { preview: null, base64: null, mime: "image/jpeg" };

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function downloadImage(src: string, name: string) {
  try {
    const blob = await (await fetch(src)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(src, "_blank");
  }
}

/** Ô tải ảnh dùng chung (mặt bằng / SketchUp). */
function Uploader({
  value,
  onPick,
  onClear,
  label,
  hint,
}: {
  value: ImageState;
  onPick: (file: File | null | undefined) => void;
  onClear: () => void;
  label: string;
  hint: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <label className={labelClass + " mb-0"}>{label}</label>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onPick(e.dataTransfer.files?.[0]);
        }}
        className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-dashed border-border bg-surface-muted p-3 text-center transition-colors hover:border-accent/50"
      >
        {value.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.preview} alt={label} className="max-h-[260px] w-auto rounded-card object-contain" />
        ) : (
          <>
            <span className="text-sm text-foreground">Kéo thả ảnh hoặc bấm để chọn</span>
            <span className="text-xs text-foreground-soft">{hint}</span>
          </>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {value.preview && (
        <button
          className="text-xs text-foreground-soft underline-offset-2 hover:text-foreground hover:underline"
          onClick={onClear}
        >
          Chọn ảnh khác
        </button>
      )}
    </div>
  );
}

export default function QuickIdeaPage() {
  const router = useRouter();
  const [analysisModel, setAnalysisModel] = useChatModel(GEMINI_MODELS);

  const [mode, setMode] = useState<QuickMode>("concept");
  const [plan, setPlan] = useState<ImageState>(EMPTY_IMG);
  const [scene, setScene] = useState<ImageState>(EMPTY_IMG);

  const [styleId, setStyleId] = useState<string>("modern");
  const [customStyle, setCustomStyle] = useState("");
  const [notes, setNotes] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<QuickIdeaResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");

  const [model, setModel] = useState<RenderModelId>(DEFAULT_RENDER_MODEL);
  const [resolution, setResolution] = useState(modelResolutions(DEFAULT_RENDER_MODEL)[0]);
  const [count, setCount] = useState(2);
  const [rendering, setRendering] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [results, setResults] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  function selectModel(id: RenderModelId) {
    setModel(id);
    setResolution(modelResolutions(id)[0]);
  }

  function readFile(file: File | null | undefined, set: (s: ImageState) => void) {
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
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      set({ preview: dataUrl, base64: dataUrl.split(",")[1] ?? null, mime: file.type });
    };
    reader.readAsDataURL(file);
  }

  const effectiveStyle = styleId === CUSTOM_STYLE ? customStyle.trim() : styleId;

  async function analyze() {
    if (!plan.base64) {
      setError("Chưa có ảnh mặt bằng");
      return;
    }
    if (mode === "fidelity" && !scene.base64) {
      setError("Chế độ Bám thiết kế cần thêm ảnh SketchUp");
      return;
    }
    setError(null);
    setResults([]);
    setAnalyzing(true);
    const curModel = analysisModel;
    try {
      const res = await fetch("/api/quick-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          planImageBase64: plan.base64,
          planMime: plan.mime,
          sceneImageBase64: mode === "fidelity" ? scene.base64 : undefined,
          sceneMime: scene.mime,
          style: effectiveStyle,
          notes,
          model: curModel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(curModel);
        throw new Error(json.error || "Tạo prompt thất bại");
      }
      const r = json as QuickIdeaResult;
      recordAiCall(curModel, 300 + estimateTokens(JSON.stringify(r)));
      setResult(r);
      setPrompt(r.prompt);
      setNegativePrompt(r.negativePrompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo prompt thất bại");
    } finally {
      setAnalyzing(false);
    }
  }

  async function render() {
    const sourceImage = mode === "fidelity" ? scene.preview : plan.preview;
    if (!sourceImage) {
      setError("Chưa có ảnh đầu vào để render");
      return;
    }
    if (!prompt.trim()) {
      setError("Chưa có prompt — hãy tạo prompt trước");
      return;
    }
    setError(null);
    setResults([]);
    setRendering(true);
    setRenderPct(8);
    const timer = setInterval(() => setRenderPct((p) => Math.min(95, p + 4)), 1500);
    const curModel = model;
    try {
      const res = await fetch("/api/render/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: sourceImage, prompt, negativePrompt, model, count, resolution }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(curModel);
        throw new Error(json.error || "Render thất bại");
      }
      const images = (json.images as string[]) ?? [];
      if (images.length === 0) throw new Error("AI không trả về ảnh");
      recordAiCall(curModel, estimateTokens(prompt) * count);
      setResults(images);
      // Lưu vào thư viện render dùng chung.
      for (const image of images) {
        const item: RenderHistoryItem = {
          id: newId("quick"),
          sourceThumb: null,
          image,
          prompt,
          modelLabel: renderModelLabel(model),
          angleLabel: "Ý tưởng nhanh từ MB",
          createdAt: Date.now(),
        };
        try {
          await addHistory(item);
        } catch {
          /* bỏ qua nếu lưu lỗi */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render thất bại");
    } finally {
      clearInterval(timer);
      setRenderPct(100);
      setRendering(false);
    }
  }

  async function sendToUpscale(image: string) {
    let dataUrl = image;
    if (!image.startsWith("data:")) {
      try {
        const blob = await (await fetch(image)).blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
      } catch {
        setError("Không tải được ảnh để chuyển qua Upscale.");
        return;
      }
    }
    try {
      sessionStorage.setItem(
        "upscale-incoming",
        JSON.stringify({ image: dataUrl, fileName: "quick-idea-render" })
      );
    } catch {
      /* ignore */
    }
    router.push("/upscale");
  }

  const selectedModelInfo = RENDER_MODELS.find((m) => m.id === model);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-display text-2xl">Ý tưởng nhanh từ MB</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Đưa ảnh mặt bằng, chọn phong cách và ghi chú vài câu — AI tự dựng prompt đầy đủ rồi
          render ra ảnh 3D thực tế. Hai chế độ: bám thiết kế (kèm SketchUp) hoặc concept nhanh.
        </p>
      </header>

      {/* Chọn chế độ */}
      <Card className="space-y-3 p-4 sm:p-5">
        <label className={labelClass}>Chế độ</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                id: "concept" as QuickMode,
                title: "Concept nhanh",
                desc: "Chỉ cần ảnh mặt bằng. AI tự dựng phối cảnh 3D từ bố cục — nhanh, hợp lúc chưa có model SketchUp.",
              },
              {
                id: "fidelity" as QuickMode,
                title: "Bám thiết kế",
                desc: "Thêm ảnh SketchUp để giữ đúng hình khối & góc camera. Cho ảnh sát thiết kế nhất.",
              },
            ]
          ).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-card border p-3 text-left transition-colors ${
                  active ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{m.title}</span>
                  {m.id === "fidelity" && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                      Sát thiết kế
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-soft">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Tải ảnh */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">Ảnh đầu vào</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground-soft">Model phân tích</span>
            <select
              className="rounded-card border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent/50 focus:outline-none"
              value={analysisModel}
              onChange={(e) => setAnalysisModel(e.target.value as typeof analysisModel)}
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={`grid gap-4 ${mode === "fidelity" ? "sm:grid-cols-2" : ""}`}>
          <Uploader
            value={plan}
            onPick={(f) => readFile(f, setPlan)}
            onClear={() => setPlan(EMPTY_IMG)}
            label="Ảnh mặt bằng *"
            hint="Bản vẽ 2D — JPG, PNG, tối đa 8MB"
          />
          {mode === "fidelity" && (
            <Uploader
              value={scene}
              onPick={(f) => readFile(f, setScene)}
              onClear={() => setScene(EMPTY_IMG)}
              label="Ảnh SketchUp *"
              hint="Model 3D thô — giữ khối & camera"
            />
          )}
        </div>
      </Card>

      {/* Phong cách + ghi chú */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <label className={labelClass}>Phong cách</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_STYLES.map((s) => {
              const active = styleId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-border bg-surface text-foreground-soft hover:border-accent/40"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
            <button
              onClick={() => setStyleId(CUSTOM_STYLE)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                styleId === CUSTOM_STYLE
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-surface text-foreground-soft hover:border-accent/40"
              }`}
            >
              Khác…
            </button>
          </div>
          {styleId === CUSTOM_STYLE && (
            <input
              className={inputClass + " mt-2"}
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              placeholder="Gõ phong cách bạn muốn, vd: Bắc Âu pha công nghiệp, tông gỗ óc chó…"
            />
          )}
        </div>
        <div>
          <label className={labelClass}>Ghi chú (tùy chọn) — AI sẽ tự diễn giải đầy đủ</label>
          <textarea
            className={inputClass + " min-h-[72px] resize-y"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="vd: thêm đảo bếp, tông ấm, nhiều cây xanh, view ra cửa sổ lớn, ánh sáng buổi chiều…"
          />
        </div>
        <Button onClick={analyze} disabled={analyzing || !plan.base64}>
          {analyzing ? "Đang tạo prompt…" : "✨ Tạo prompt"}
        </Button>
      </Card>

      {error && (
        <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Prompt + điều khiển render */}
      {result && (
        <div className="space-y-6">
          {result.title.trim() && (
            <h2 className="font-display text-lg text-foreground">
              {result.title}
              {result.spaceType.trim() && (
                <span className="ml-2 text-sm font-normal text-foreground-soft">· {result.spaceType}</span>
              )}
            </h2>
          )}

          <Card className="space-y-2 p-4 sm:p-5">
            <label className={labelClass}>Prompt render (AI tạo — có thể sửa)</label>
            <textarea
              className={inputClass + " min-h-[140px] resize-y leading-relaxed"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </Card>

          <Card className="space-y-2 p-4 sm:p-5">
            <label className={labelClass}>Negative prompt — những thứ cần TRÁNH</label>
            <textarea
              className={inputClass + " min-h-[64px] resize-y text-xs"}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
            />
          </Card>

          {/* Model render */}
          <Card className="space-y-3 p-4 sm:p-5">
            <label className={labelClass}>Model render</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {RENDER_MODELS.map((m) => {
                const active = model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectModel(m.id)}
                    className={`rounded-card border p-3 text-left transition-colors ${
                      active ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{m.label}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.cloud ? "bg-indigo-500/15 text-indigo-400" : "bg-teal-500/15 text-teal-400"
                        }`}
                      >
                        {m.badge}
                      </span>
                      {m.recommended && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                          Khuyên dùng
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground-soft">{m.description}</p>
                  </button>
                );
              })}
            </div>
            {selectedModelInfo?.cloud && (
              <p className="rounded-card border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500">
                Engine cloud cần <code className="font-mono">REPLICATE_API_TOKEN</code> trong{" "}
                <code className="font-mono">.env.local</code>.
              </p>
            )}

            <div>
              <label className={labelClass}>Số ảnh render</label>
              <div className="flex gap-2">
                {Array.from({ length: MAX_RENDER_IMAGES }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`h-9 w-9 rounded-card border text-sm font-medium transition-colors ${
                      count === n
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border bg-surface text-foreground-soft hover:border-accent/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Khổ ảnh</label>
              <div className="flex gap-2">
                {modelResolutions(model).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    disabled={modelResolutions(model).length === 1}
                    className={`h-9 min-w-[3rem] rounded-card border px-3 text-sm font-medium transition-colors disabled:opacity-100 ${
                      resolution === r
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border bg-surface text-foreground-soft hover:border-accent/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={render}
              disabled={rendering}
              className="w-full border-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 text-white"
            >
              {rendering ? `Đang render… ${renderPct}%` : `Render ${count} ảnh`}
            </Button>
          </Card>
        </div>
      )}

      {rendering && (
        <div className="space-y-3">
          <ProgressBar percent={renderPct} label="AI đang render ảnh" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-card border border-border bg-surface-muted" />
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && !rendering && (
        <Card className="space-y-3 p-4 sm:p-5">
          <h2 className="font-display text-base text-accent">Kết quả render ({results.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((src, i) => (
              <div key={i} className="space-y-2">
                <div className="overflow-hidden rounded-card border border-border bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Render ${i + 1}`} className="block w-full" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => downloadImage(src, `quick-idea-${i + 1}.png`)}
                  >
                    Tải về
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => void sendToUpscale(src)}
                  >
                    Ném qua Upscale
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
