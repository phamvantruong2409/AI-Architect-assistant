"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useChatModel } from "@/hooks/useChatModel";
import { recordAiCall, markRateLimited, estimateTokens } from "@/lib/ai-usage";
import {
  RENDER_MODELS,
  DEFAULT_RENDER_MODEL,
  VIEW_ANGLES,
  TIME_OF_DAY,
  modelResolutions,
  MAX_IMAGE_BYTES,
  MAX_RENDER_IMAGES,
  buildRenderPrompt,
  renderModelLabel,
  viewAngleLabel,
  isSkySuggestion,
  isEntourageSuggestion,
  isSceneSuggestion,
  SCENE_CONTEXTS,
  type RenderModelId,
  type RenderAnalysis,
} from "@/lib/render-types";
import {
  addHistory,
  clearHistory,
  deleteHistory,
  loadHistory,
  type RenderHistoryItem,
} from "@/lib/render-history";

const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";
const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Hai biến thể dùng chung pipeline phân tích → đề xuất → tạo prompt → render:
 *  - "sketchup": Render AI — ảnh SketchUp thô → render thực tế.
 *  - "optimize": Render Optimizer — ảnh render/ảnh thật đã có → render lại đẹp & thật hơn.
 */
export type RenderVariant = "sketchup" | "optimize";

const VARIANT_COPY: Record<
  RenderVariant,
  {
    title: string;
    subtitle: string;
    uploadLabel: string;
    uploadAlt: string;
    analyzingLabel: string;
    reanalyzeLabel: string;
    basePromptLabel: string;
    renderLabel: (n: number) => string;
  }
> = {
  sketchup: {
    title: "Render AI",
    subtitle:
      "Ném ảnh thô SketchUp vào — AI tự phân tích, đề xuất prompt giữ đúng khối, rồi render ra ảnh thực tế. Bạn chỉ việc chỉnh nhẹ và bấm Render.",
    uploadLabel: "Ảnh SketchUp thô *",
    uploadAlt: "Ảnh SketchUp",
    analyzingLabel: "Đang phân tích ảnh & đề xuất prompt…",
    reanalyzeLabel: "Phân tích lại",
    basePromptLabel: "Prompt phân tích (giữ đúng khối — có thể sửa)",
    renderLabel: (n) => `Render ${n} ảnh`,
  },
  optimize: {
    title: "Render Optimizer",
    subtitle:
      "Đưa một ảnh render (hoặc ảnh thật) đã có vào — AI đóng vai KTS 20 năm kinh nghiệm ĐÁNH GIÁ ảnh (thừa/thiếu, ánh sáng, vật liệu, nên thêm gì). Bạn sửa lại phần đánh giá, rồi bấm “Tạo Prompt cải thiện” để render lại đẹp & thật hơn. Giữ nguyên thiết kế.",
    uploadLabel: "Ảnh render cần tối ưu *",
    uploadAlt: "Ảnh render gốc",
    analyzingLabel: "Đang đánh giá ảnh như một KTS 20 năm…",
    reanalyzeLabel: "Đánh giá lại",
    basePromptLabel: "Prompt cải thiện (liền mạch — giữ đúng thiết kế, có thể sửa)",
    renderLabel: (n) => `Render lại ${n} ảnh`,
  },
};

/** Một prompt đề xuất ở trạng thái UI (toggle + sửa được). */
interface EditableSuggestion {
  id: string;
  label: string;
  text: string;
  enabled: boolean;
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Thu nhỏ ảnh để lưu thumbnail lịch sử. */
function makeThumb(dataUrl: string, max = 512): Promise<string | null> {
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

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

function CopyButton({ text, label = "Sao chép prompt" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-8 px-2.5 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Đã chép" : label}
    </Button>
  );
}

export function RenderStudio({ variant = "sketchup" }: { variant?: RenderVariant } = {}) {
  const router = useRouter();
  const copy = VARIANT_COPY[variant];
  const [analysisModel, setAnalysisModel] = useChatModel(GEMINI_MODELS);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("render");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analysis, setAnalysis] = useState<RenderAnalysis | null>(null);

  // Render Optimizer (variant "optimize") — bước 1: đánh giá của KTS, người dùng sửa được.
  const [critique, setCritique] = useState("");
  const [critiqueTitle, setCritiqueTitle] = useState("");
  // Bước 2: đang gọi AI tạo prompt cải thiện từ bài đánh giá.
  const [buildingPrompt, setBuildingPrompt] = useState(false);

  // Trạng thái có thể sửa, dẫn xuất từ phân tích.
  const [basePrompt, setBasePrompt] = useState("");
  const [suggestions, setSuggestions] = useState<EditableSuggestion[]>([]);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [angle, setAngle] = useState("keep");
  const [timeOfDay, setTimeOfDay] = useState("auto");

  const [model, setModel] = useState<RenderModelId>(DEFAULT_RENDER_MODEL);
  const [resolution, setResolution] = useState(modelResolutions(DEFAULT_RENDER_MODEL)[0]);
  const [count, setCount] = useState(2);

  // Đổi model → đặt lại khổ ảnh về mặc định của model đó.
  function selectModel(id: RenderModelId) {
    setModel(id);
    setResolution(modelResolutions(id)[0]);
  }

  const [rendering, setRendering] = useState(false);
  const [sceneEditing, setSceneEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<RenderHistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Lưu lại nội dung ô "Bầu trời" do AI gợi ý, để khôi phục khi chọn "Tự động".
  const aiSkyRef = useRef("");
  // Lưu lại nội dung ô "Bao cảnh" do AI gợi ý, để dùng cho lựa chọn "Theo AI gợi ý".
  const aiSceneRef = useRef("");

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => {});
  }, []);

  // Dán ảnh trực tiếp bằng Ctrl+V.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisModel]);

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
    setResults([]);
    setAnalysis(null);
    setCritique("");
    setCritiqueTitle("");
    setMimeType(file.type);
    setFileName(file.name.replace(/\.[^.]+$/, "") || "render");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const b64 = dataUrl.split(",")[1] ?? null;
      setImageBase64(b64);
      if (b64) void runFirstPass(b64, file.type);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setPreview(null);
    setImageBase64(null);
    setAnalysis(null);
    setCritique("");
    setCritiqueTitle("");
    setResults([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** Bước đầu sau khi có ảnh: sketchup → phân tích thẳng; optimize → KTS đánh giá trước. */
  function runFirstPass(b64: string, mime: string) {
    return variant === "optimize" ? critiqueImage(b64, mime) : analyze(b64, mime);
  }

  /** Đưa RenderAnalysis vào các ô sửa được (prompt nền, đề xuất, negative, góc). */
  function applyAnalysis(a: RenderAnalysis) {
    setAnalysis(a);
    setBasePrompt(a.analysisPrompt);
    // Mặc định bật tất cả, RIÊNG "người-xe phụ" để TẮT (người dùng tự bật nếu muốn).
    const baseSugg = a.suggestions.map((s) => ({ ...s, enabled: !isEntourageSuggestion(s.label) }));
    // Ghi nhớ ô "Bầu trời" gốc do AI gợi ý (dùng khi quay lại "Tự động").
    aiSkyRef.current = baseSugg.find((s) => isSkySuggestion(s.label))?.text ?? "";
    // Ghi nhớ ô "Bao cảnh" gốc do AI gợi ý (dùng cho lựa chọn "Theo AI gợi ý").
    aiSceneRef.current = baseSugg.find((s) => isSceneSuggestion(s.label))?.text ?? "";
    // Nếu đang chọn một giờ cụ thể, đồng bộ luôn ô bầu trời theo giờ đó.
    setSuggestions(applySky(baseSugg, timeOfDay));
    setNegativePrompt(a.negativePrompt);
    setAngle(a.recommendedAngleIds[0] ?? "keep");
  }

  async function analyze(b64: string, mime: string) {
    setAnalyzing(true);
    setError(null);
    setAnalyzeProgress(8);
    const timer = setInterval(() => {
      setAnalyzeProgress((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(1, Math.round((94 - p) * 0.1)))));
    }, 250);
    try {
      const res = await fetch("/api/render/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime, model: analysisModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(analysisModel);
        throw new Error(json.error || "Phân tích ảnh thất bại");
      }
      const a = json as RenderAnalysis;
      recordAiCall(analysisModel, 300 + estimateTokens(JSON.stringify(a)));
      applyAnalysis(a);
      setAnalyzeProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phân tích ảnh thất bại");
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
      setTimeout(() => setAnalyzeProgress(0), 400);
    }
  }

  /** Render Optimizer — bước 1: gọi KTS đánh giá ảnh, đổ vào ô đánh giá sửa được. */
  async function critiqueImage(b64: string, mime: string) {
    setAnalyzing(true);
    setError(null);
    setAnalyzeProgress(8);
    const timer = setInterval(() => {
      setAnalyzeProgress((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(1, Math.round((94 - p) * 0.1)))));
    }, 250);
    try {
      const res = await fetch("/api/render/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mimeType: mime, model: analysisModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(analysisModel);
        throw new Error(json.error || "Đánh giá ảnh thất bại");
      }
      recordAiCall(analysisModel, 300 + estimateTokens(JSON.stringify(json)));
      setCritique(typeof json.critique === "string" ? json.critique : "");
      setCritiqueTitle(typeof json.title === "string" ? json.title : "");
      setAnalyzeProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đánh giá ảnh thất bại");
    } finally {
      clearInterval(timer);
      setAnalyzing(false);
      setTimeout(() => setAnalyzeProgress(0), 400);
    }
  }

  /** Render Optimizer — bước 2: từ bài đánh giá (đã sửa) tạo prompt cải thiện + đề xuất. */
  async function buildImprovePrompt() {
    if (!imageBase64 || !critique.trim()) {
      setError("Chưa có ảnh hoặc phần đánh giá để tạo prompt");
      return;
    }
    setBuildingPrompt(true);
    setError(null);
    try {
      const res = await fetch("/api/render/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, model: analysisModel, critique }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(analysisModel);
        throw new Error(json.error || "Tạo prompt cải thiện thất bại");
      }
      const a = json as RenderAnalysis;
      recordAiCall(analysisModel, 300 + estimateTokens(JSON.stringify(a)));
      applyAnalysis(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo prompt cải thiện thất bại");
    } finally {
      setBuildingPrompt(false);
    }
  }

  function finalPrompt(): string {
    // Render Optimizer chỉ bám theo prompt cải thiện — KHÔNG ghép khung hình (góc view) hay thời điểm.
    if (variant === "optimize") {
      return buildRenderPrompt({ analysisPrompt: basePrompt, enabledSuggestions: [] });
    }
    const angleHint = VIEW_ANGLES.find((a) => a.id === angle)?.promptHint;
    const timeHint = TIME_OF_DAY.find((t) => t.id === timeOfDay)?.promptHint;
    return buildRenderPrompt({
      analysisPrompt: basePrompt,
      enabledSuggestions: suggestions.filter((s) => s.enabled),
      angleHint,
      timeHint,
    });
  }

  /** Đồng bộ ô "Bầu trời" theo giờ đã chọn (giờ cụ thể → trời khớp; "Tự động" → trả về bản AI). */
  function applySky(list: EditableSuggestion[], timeId: string): EditableSuggestion[] {
    const time = TIME_OF_DAY.find((t) => t.id === timeId);
    if (!time) return list;
    return list.map((s) => {
      if (!isSkySuggestion(s.label)) return s;
      const text = timeId === "auto" ? aiSkyRef.current || s.text : time.sky || s.text;
      return { ...s, text };
    });
  }

  /** Chọn thời điểm trong ngày + tự động cập nhật ô bầu trời cho khớp. */
  function selectTime(timeId: string) {
    setTimeOfDay(timeId);
    setSuggestions((list) => applySky(list, timeId));
  }

  async function render() {
    if (!preview) {
      setError("Chưa có ảnh đầu vào");
      return;
    }
    if (!basePrompt.trim()) {
      setError("Chưa có prompt phân tích — hãy phân tích ảnh trước");
      return;
    }
    setRendering(true);
    setError(null);
    setResults([]);
    const prompt = finalPrompt();
    try {
      const res = await fetch("/api/render/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, prompt, negativePrompt, model, count, resolution }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "QUOTA_EXCEEDED") markRateLimited(model);
        throw new Error(json.error || "Render thất bại");
      }
      const images = (json.images as string[]) ?? [];
      if (images.length === 0) throw new Error("AI không trả về ảnh");
      recordAiCall(model, estimateTokens(prompt) * count);
      setResults(images);

      // Lưu vào thư viện.
      const thumb = await makeThumb(preview);
      const modelLabel = renderModelLabel(model);
      const angleLabel = variant === "optimize" ? "Tối ưu render" : viewAngleLabel(angle);
      for (const image of images) {
        const item: RenderHistoryItem = {
          id: newId("render"),
          sourceThumb: thumb,
          image,
          prompt,
          modelLabel,
          angleLabel,
          createdAt: Date.now(),
        };
        try {
          await addHistory(item);
        } catch {
          /* bỏ qua nếu lưu lỗi */
        }
      }
      loadHistory().then(setHistory).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render thất bại");
    } finally {
      setRendering(false);
    }
  }

  async function sendToUpscale(image: string) {
    // Upscale cần data:image/ URL. Ảnh Flux là URL từ xa → chuyển sang dataURL trước.
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
        setError("Không tải được ảnh để chuyển qua Upscale. Hãy tải ảnh về rồi tự tải lên.");
        return;
      }
    }
    try {
      sessionStorage.setItem(
        "upscale-incoming",
        JSON.stringify({ image: dataUrl, fileName: `${fileName}-render` })
      );
    } catch {
      /* ignore */
    }
    router.push("/upscale");
  }

  async function removeFromHistory(id: string) {
    try {
      await deleteHistory(id);
    } catch {
      /* vẫn gỡ khỏi UI */
    }
    setHistory((h) => h.filter((it) => it.id !== id));
  }

  async function clearAll() {
    if (!confirm("Xoá tất cả ảnh đã render?")) return;
    try {
      await clearHistory();
    } catch {
      /* vẫn xoá khỏi UI */
    }
    setHistory([]);
  }

  function toggleSuggestion(id: string) {
    setSuggestions((list) => list.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }
  /** Chọn bao cảnh từ dropdown: "off" tắt, "ai" dùng bản AI gợi ý, còn lại lấy preset. */
  function selectScene(id: string, optionId: string) {
    setSuggestions((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        if (optionId === "off") return { ...s, enabled: false };
        if (optionId === "ai") return { ...s, enabled: true, text: aiSceneRef.current };
        const opt = SCENE_CONTEXTS.find((o) => o.id === optionId);
        return opt ? { ...s, enabled: true, text: opt.text } : s;
      })
    );
  }
  function editSuggestion(id: string, text: string) {
    setSuggestions((list) => list.map((s) => (s.id === id ? { ...s, text } : s)));
  }
  function removeSuggestion(id: string) {
    setSuggestions((list) => list.filter((s) => s.id !== id));
  }
  function addSuggestion() {
    setSuggestions((list) => [
      ...list,
      { id: newId("sug"), label: "Prompt tùy chỉnh", text: "", enabled: true },
    ]);
  }

  const recommendedAngles = new Set(analysis?.recommendedAngleIds ?? []);
  const selectedModelInfo = RENDER_MODELS.find((m) => m.id === model);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-display text-2xl">{copy.title}</h1>
        <p className="mt-1 text-sm text-foreground-soft">{copy.subtitle}</p>
      </header>

      {/* Vùng tải ảnh */}
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <label className={labelClass + " mb-0"}>{copy.uploadLabel}</label>
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
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-dashed border-border bg-surface-muted p-3 text-center transition-colors hover:border-accent/50"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={copy.uploadAlt} className="max-h-[360px] w-auto rounded-card object-contain" />
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
          <div className="flex gap-3">
            <button
              className="text-xs text-foreground-soft underline-offset-2 hover:text-foreground hover:underline"
              onClick={clearImage}
            >
              Chọn ảnh khác
            </button>
            {!analyzing && imageBase64 && (
              <button
                className="text-xs text-accent underline-offset-2 hover:underline"
                onClick={() => void runFirstPass(imageBase64, mimeType)}
              >
                {copy.reanalyzeLabel}
              </button>
            )}
          </div>
        )}
        {analyzing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="animate-progress-flow bg-gradient-to-r from-accent via-cyan-300 to-accent bg-clip-text font-semibold text-transparent">
                  {copy.analyzingLabel}
                </span>
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-accent">
                {analyzeProgress}%
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full border border-accent/15 bg-surface-muted shadow-inner">
              <div
                className="animate-progress-flow relative h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${analyzeProgress}%`, boxShadow: "0 0 12px rgba(20,184,166,0.55)" }}
              >
                {/* Vệt sáng quét qua thanh */}
                <div className="absolute inset-0 -skew-x-12">
                  <div className="animate-progress-shimmer h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Render Optimizer — bước 1: đánh giá của KTS (sửa được) → bước 2: tạo prompt cải thiện */}
      {variant === "optimize" && critique && !analyzing && (
        <Card className="space-y-3 p-4 sm:p-5">
          {critiqueTitle.trim() && (
            <h2 className="font-display text-lg text-foreground">{critiqueTitle}</h2>
          )}
          <div>
            <label className={labelClass}>
              Đánh giá của KTS 20 năm kinh nghiệm — đọc & chỉnh lại theo ý bạn trước khi tạo prompt
            </label>
            <textarea
              className={inputClass + " min-h-[260px] resize-y leading-relaxed"}
              value={critique}
              onChange={(e) => setCritique(e.target.value)}
              placeholder="AI sẽ điền bài đánh giá vào đây…"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-relaxed text-foreground-soft">
              {analysis
                ? "Đã tạo prompt cải thiện bên dưới. Sửa đánh giá rồi bấm lại để tạo prompt mới."
                : "Khi ưng phần đánh giá, bấm “Tạo Prompt cải thiện” để dựng prompt render lại."}
            </p>
            <Button onClick={() => void buildImprovePrompt()} disabled={buildingPrompt || !critique.trim()}>
              {buildingPrompt ? "Đang tạo prompt…" : "✨ Tạo Prompt cải thiện"}
            </Button>
          </div>
        </Card>
      )}

      {/* Kết quả phân tích + điều khiển render */}
      {analysis && !analyzing && (
        <div className="space-y-6">
          {variant === "sketchup" && analysis.title.trim() && (
            <h2 className="font-display text-lg text-foreground">{analysis.title}</h2>
          )}

          {/* Prompt phân tích (sửa được) */}
          <Card className="space-y-2 p-4 sm:p-5">
            <label className={labelClass}>{copy.basePromptLabel}</label>
            <textarea
              className={inputClass + " min-h-[110px] resize-y leading-relaxed"}
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
            />
          </Card>

          {/* Prompt đề xuất — toggle/sửa/bỏ (chỉ Render AI; Render Optimizer dùng prompt liền mạch) */}
          {variant === "sketchup" && (
          <Card className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <label className={labelClass + " mb-0"}>Prompt đề xuất (bật/tắt, sửa, hoặc bỏ)</label>
              <button
                className="text-xs text-accent underline-offset-2 hover:underline"
                onClick={addSuggestion}
              >
                + Thêm prompt
              </button>
            </div>
            {suggestions.length === 0 && (
              <p className="text-xs text-foreground-soft">Chưa có đề xuất nào. Bấm “+ Thêm prompt”.</p>
            )}
            <div className="space-y-2.5">
              {suggestions.map((s) => {
                // Ô "Bao cảnh" → dropdown chọn sẵn thay vì checkbox + gõ tay.
                if (isSceneSuggestion(s.label)) {
                  // Xác định mục đang chọn: tắt / theo AI / một preset / đã sửa tay.
                  const current = !s.enabled
                    ? "off"
                    : SCENE_CONTEXTS.find((o) => o.text === s.text)?.id ??
                      (aiSceneRef.current && s.text === aiSceneRef.current ? "ai" : "custom");
                  const isCustom = current === "custom";
                  const showEditor = s.enabled && (sceneEditing || isCustom);
                  return (
                    <div
                      key={s.id}
                      className={`rounded-card border p-2.5 transition-colors ${
                        s.enabled ? "border-accent/40 bg-accent/5" : "border-border bg-surface-muted opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-sm font-medium text-foreground">{s.label}</span>
                        <select
                          className={inputClass + " h-9 min-w-0 flex-1 py-0 text-xs"}
                          value={current}
                          onChange={(e) => selectScene(s.id, e.target.value)}
                        >
                          <option value="off">— Không thêm bao cảnh —</option>
                          {aiSceneRef.current && <option value="ai">Theo AI gợi ý</option>}
                          {SCENE_CONTEXTS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                          {isCustom && <option value="custom">Tùy chỉnh (đã sửa tay)</option>}
                        </select>
                        {s.enabled && !isCustom && (
                          <button
                            className="shrink-0 text-xs text-accent underline-offset-2 hover:underline"
                            onClick={() => setSceneEditing((v) => !v)}
                          >
                            {sceneEditing ? "Thu gọn" : "Sửa tay"}
                          </button>
                        )}
                      </div>
                      {showEditor && (
                        <textarea
                          className={inputClass + " mt-2 min-h-[52px] resize-y text-xs"}
                          value={s.text}
                          onChange={(e) => editSuggestion(s.id, e.target.value)}
                          placeholder="Gõ mô tả bao cảnh tùy ý…"
                        />
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={s.id}
                    className={`rounded-card border p-2.5 transition-colors ${
                      s.enabled ? "border-accent/40 bg-accent/5" : "border-border bg-surface-muted opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={() => toggleSuggestion(s.id)}
                          className="accent-accent"
                        />
                        {s.label}
                      </label>
                      <button
                        className="text-xs text-foreground-soft hover:text-red-400"
                        onClick={() => removeSuggestion(s.id)}
                      >
                        Bỏ
                      </button>
                    </div>
                    <textarea
                      className={inputClass + " mt-2 min-h-[52px] resize-y text-xs"}
                      value={s.text}
                      onChange={(e) => editSuggestion(s.id, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
          )}

          {/* Thời điểm & Góc view — chỉ Render AI; Render Optimizer giữ nguyên khung hình & bối cảnh ảnh gốc */}
          {variant === "sketchup" && (
          <>
          <Card className="space-y-2 p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <label className={labelClass + " mb-0"}>Thời điểm trong ngày (quyết định ánh sáng & bầu trời)</label>
              <span className="group relative inline-flex">
                <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-accent/60 text-[10px] font-semibold text-accent">
                  i
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-60 -translate-x-1/2 rounded-card border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  Prompt bầu trời sẽ tự động thay đổi theo giờ bạn chọn.
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIME_OF_DAY.map((t) => {
                const active = timeOfDay === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTime(t.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border bg-surface text-foreground-soft hover:border-accent/40"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Góc view */}
          <Card className="space-y-2 p-4 sm:p-5">
            <label className={labelClass}>Góc view</label>
            <div className="flex flex-wrap gap-2">
              {VIEW_ANGLES.map((a) => {
                const active = angle === a.id;
                const rec = recommendedAngles.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => setAngle(a.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "border-accent bg-accent/15 text-foreground"
                        : "border-border bg-surface text-foreground-soft hover:border-accent/40"
                    }`}
                  >
                    {a.label}
                    {rec && (
                      <span className="ml-1.5 rounded bg-teal-500/20 px-1 py-0.5 text-[9px] font-medium text-teal-400">
                        AI gợi ý
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          </>
          )}

          {/* Negative prompt — luôn hiển thị, sửa được */}
          <Card className="space-y-2 p-4 sm:p-5">
            <label className={labelClass}>
              Negative prompt — những thứ cần TRÁNH khi render
            </label>
            <textarea
              className={inputClass + " min-h-[64px] resize-y text-xs"}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="vd: méo hình khối, sai số tầng, đổi bố cục, mờ nhòe, vỡ nét, watermark, chữ..."
            />
          </Card>

          {/* Chọn model render */}
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
                Engine cloud cần <code className="font-mono">REPLICATE_API_TOKEN</code> trong <code className="font-mono">.env.local</code>. Chưa có token sẽ báo lỗi khi render.
              </p>
            )}

            {/* Số ảnh */}
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

            {/* Khổ ảnh / độ phân giải (theo model) */}
            <div>
              <label className={labelClass}>
                Khổ ảnh{" "}
                <span className="text-foreground-soft/70">
                  (tỉ lệ theo ảnh gốc · độ phân giải theo model)
                </span>
              </label>
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
                {model === "gemini-image" && (
                  <span className="self-center text-[11px] text-foreground-soft">
                    Bản Flash chỉ 1K — cần lớn hơn hãy chọn Pro hoặc dùng Upscale.
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowPreview(true)}
                disabled={!basePrompt.trim()}
                className="shrink-0"
              >
                👁 Xem trước prompt
              </Button>
              <Button
                onClick={render}
                disabled={rendering}
                className={`group relative flex-1 overflow-hidden border-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 bg-[length:200%_100%] text-white shadow-[0_0_18px_rgba(20,184,166,0.45)] transition-all duration-300 hover:shadow-[0_0_28px_rgba(20,184,166,0.75)] disabled:opacity-100 ${
                  rendering ? "animate-progress-flow cursor-wait" : "hover:bg-[position:100%_0]"
                }`}
              >
                {/* Vệt sáng quét qua nút khi hover */}
                {!rendering && (
                  <span className="pointer-events-none absolute inset-0 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                )}
                <span className="relative inline-flex items-center gap-2 uppercase tracking-wide">
                  {rendering ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Đang render…
                    </>
                  ) : (
                    <>{copy.renderLabel(count)}</>
                  )}
                </span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Skeleton khi đang render */}
      {rendering && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-card border border-border bg-surface-muted" />
          ))}
        </div>
      )}

      {/* Kết quả render lần này */}
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
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => downloadImage(src, `${fileName}-render-${i + 1}.png`)}>
                    Tải về
                  </Button>
                  <CopyButton text={finalPrompt()} />
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => void sendToUpscale(src)}>
                    Ném qua Upscale
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Thư viện đã render */}
      {history.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Thư viện đã render ({history.length})</h2>
            <button
              className="text-xs text-foreground-soft transition-colors hover:text-red-400"
              onClick={clearAll}
            >
              Xoá tất cả
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((it) => (
              <Card key={it.id} className="space-y-2 p-2.5">
                <div className="overflow-hidden rounded-card border border-border bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image} alt="" className="block w-full" />
                </div>
                <p className="text-[11px] text-foreground-soft">
                  {it.modelLabel} · {it.angleLabel} · {timeAgo(it.createdAt)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => downloadImage(it.image, "render.png")}>
                    Tải
                  </Button>
                  <CopyButton text={it.prompt} />
                  <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => void sendToUpscale(it.image)}>
                    Upscale
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs hover:text-red-400" onClick={() => removeFromHistory(it.id)}>
                    Xoá
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Popup xem trước prompt cuối sẽ gửi cho AI */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <Card
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-display text-base text-foreground">Prompt cuối gửi cho AI</h2>
              <button
                className="text-foreground-soft hover:text-foreground"
                onClick={() => setShowPreview(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass + " mb-0"}>Prompt</label>
                  {(() => {
                    const words = finalPrompt().trim().split(/\s+/).filter(Boolean).length;
                    const ok = words <= 300;
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          ok ? "bg-accent/10 text-accent" : "bg-amber-500/15 text-amber-500"
                        }`}
                      >
                        {words} từ · không quá 300
                      </span>
                    );
                  })()}
                </div>
                <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
                  {finalPrompt()}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-soft">
                  Mẹo: prompt <span className="font-medium text-foreground">không nên quá 300 từ</span> — dài hơn dễ loãng và mâu thuẫn, khiến AI bỏ bớt chi tiết. Nếu lố, hãy tắt bớt vài prompt đề xuất.
                </p>
              </div>
              {negativePrompt.trim() && (
                <div>
                  <label className={labelClass}>Negative prompt (những thứ cần tránh)</label>
                  <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
                    {negativePrompt}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
              <CopyButton text={finalPrompt()} label="Sao chép prompt" />
              <Button size="sm" onClick={() => setShowPreview(false)}>
                Đóng
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
