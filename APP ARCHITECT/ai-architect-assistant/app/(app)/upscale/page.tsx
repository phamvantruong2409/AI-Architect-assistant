"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  MAX_UPSCALE_BYTES,
  REALESRGAN_MODELS,
  UPSCALE_COMPARISON,
  UPSCALE_ENGINES,
  UPSCALE_SCALES,
  type UpscaleEngine,
} from "@/lib/upscale-types";
import {
  addHistory,
  clearHistory,
  deleteHistory,
  loadHistory,
  type UpscaleHistoryItem,
} from "@/lib/upscale-history";

const engineLabel = (id: string) => UPSCALE_ENGINES.find((e) => e.id === id)?.label ?? id;

const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";
const selectClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Thanh trượt so sánh ảnh gốc (trái) ↔ ảnh sau upscale (phải). */
function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative select-none overflow-hidden rounded-card border border-border bg-black/40">
      <img src={after} alt="Sau khi upscale" className="block w-full" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <img
          src={before}
          alt="Ảnh gốc"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: `${100 / (pos / 100)}%`, maxWidth: "none" }}
          draggable={false}
        />
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Gốc
        </span>
      </div>
      <span className="absolute right-2 top-2 rounded bg-accent/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
        Sau
      </span>
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
        style={{ left: `${pos}%` }}
      />
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-x-0 bottom-3 mx-auto block w-[90%] cursor-ew-resize accent-accent"
      />
    </div>
  );
}

export default function UpscalePage() {
  const [engine, setEngine] = useState<UpscaleEngine>("realesrgan");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("anh");
  const [scale, setScale] = useState<number>(4);
  const [model, setModel] = useState<string>(REALESRGAN_MODELS[0].id);
  const [tile, setTile] = useState<number>(0);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localAvailable, setLocalAvailable] = useState<boolean | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [history, setHistory] = useState<UpscaleHistoryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Phát hiện môi trường Electron sau khi mount (SSR-safe; tránh hydration mismatch).
    const api = typeof window !== "undefined" ? window.electronAPI : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsElectron(!!api);
    if (api?.upscaleLocalAvailable) {
      api.upscaleLocalAvailable().then(setLocalAvailable).catch(() => setLocalAvailable(false));
    } else {
      setLocalAvailable(false);
    }
    const off = api?.onUpscaleProgress?.((p) => setProgress(p));
    loadHistory().then(setHistory).catch(() => {});

    // Handoff từ Render AI: nếu có ảnh được "ném qua Upscale", nạp sẵn vào.
    try {
      const raw = sessionStorage.getItem("upscale-incoming");
      if (raw) {
        sessionStorage.removeItem("upscale-incoming");
        const incoming = JSON.parse(raw) as { image?: string; fileName?: string };
        if (incoming.image) {
          setPreview(incoming.image);
          if (incoming.fileName) setFileName(incoming.fileName);
        }
      }
    } catch {
      /* bỏ qua nếu sessionStorage lỗi */
    }
    return () => off?.();
  }, []);

  async function saveToHistory(after: string) {
    if (!preview) return;
    const item: UpscaleHistoryItem = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      before: preview,
      after,
      fileName,
      scale,
      engine,
      createdAt: Date.now(),
    };
    try {
      await addHistory(item);
      setHistory((h) => [item, ...h].slice(0, 30));
    } catch {
      // Bỏ qua nếu lưu thất bại (vd hết dung lượng đĩa).
    }
  }

  async function removeHistory(id: string) {
    try {
      await deleteHistory(id);
    } catch {
      /* vẫn gỡ khỏi UI */
    }
    setHistory((h) => h.filter((it) => it.id !== id));
  }

  async function clearAllHistory() {
    if (!confirm("Xoá tất cả ảnh đã lưu?")) return;
    try {
      await clearHistory();
    } catch {
      /* vẫn xoá khỏi UI */
    }
    setHistory([]);
  }

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một tệp ảnh");
      return;
    }
    if (file.size > MAX_UPSCALE_BYTES) {
      setError("Ảnh quá lớn (tối đa 10MB). Vui lòng nén lại.");
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name.replace(/\.[^.]+$/, "") || "anh");
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function run() {
    if (!preview) {
      setError("Chưa có ảnh đầu vào");
      return;
    }
    setError(null);
    setResult(null);
    setProgress(0);
    setLoading(true);
    try {
      if (engine === "realesrgan") {
        if (!isElectron || !window.electronAPI?.upscaleLocal) {
          throw new Error(
            "Real-ESRGAN (Local) chỉ chạy trong ứng dụng desktop. Hãy mở app .exe để dùng."
          );
        }
        if (localAvailable === false) {
          throw new Error(
            "Chưa cài engine Real-ESRGAN. Mở terminal trong thư mục app và chạy: npm run fetch:realesrgan"
          );
        }
        const out = await window.electronAPI.upscaleLocal({ dataUrl: preview, scale, tile, model });
        setResult(out);
        setProgress(100);
        await saveToHistory(out);
      } else {
        // Engine cloud (SUPIR / SeedVR2) qua Replicate.
        const res = await fetch("/api/upscale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: preview, scale, engine }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upscale cloud thất bại");
        setResult(data.image);
        setProgress(100);
        await saveToHistory(data.image);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
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

  function download() {
    if (!result) return;
    downloadImage(result, `${fileName}-upscale-x${scale}.png`);
  }

  const isLocal = engine === "realesrgan";

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Upscale ảnh</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Phóng to ảnh nét hơn bằng AI — Real-ESRGAN chạy ngay trên máy, hoặc SUPIR chất lượng cao trên cloud.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Cột trái: tùy chọn */}
        <div className="space-y-4">
          {/* Chọn engine */}
          <div className="space-y-2">
            {UPSCALE_ENGINES.map((eng) => {
              const active = engine === eng.id;
              const disabled = !!eng.comingSoon;
              return (
                <div key={eng.id} className="group relative">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setEngine(eng.id);
                      setResult(null);
                    }}
                    className={`w-full rounded-card border p-3 text-left transition-colors ${
                      disabled
                        ? "cursor-not-allowed border-border bg-surface opacity-60"
                        : active
                          ? "border-accent bg-accent/10"
                          : "border-border bg-surface hover:border-accent/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{eng.label}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          eng.badge === "Local"
                            ? "bg-teal-500/15 text-teal-400"
                            : "bg-indigo-500/15 text-indigo-400"
                        }`}
                      >
                        {eng.badge}
                      </span>
                      {disabled && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                          Đang phát triển
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-soft">{eng.description}</p>
                  </button>
                  {disabled && eng.note && (
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-64 -translate-x-1/2 rounded-card border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      {eng.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cảnh báo engine local */}
          {isLocal && isElectron && localAvailable === false && (
            <p className="rounded-card border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500">
              Chưa cài engine. Chạy <code className="font-mono">npm run fetch:realesrgan</code> trong thư mục app rồi mở lại.
            </p>
          )}

          {/* Tùy chọn chung */}
          <Card className="space-y-3 p-3">
            <div>
              <label className={labelClass}>Mức phóng to</label>
              <select className={selectClass} value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                {UPSCALE_SCALES.map((s) => (
                  <option key={s} value={s}>
                    x{s}
                  </option>
                ))}
              </select>
            </div>

            {isLocal && (
              <>
                <div>
                  <label className={labelClass}>Mô hình</label>
                  <select className={selectClass} value={model} onChange={(e) => setModel(e.target.value)}>
                    {REALESRGAN_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Tile size {tile === 0 ? "(tự động)" : `(${tile})`} — card yếu chọn 64/32 để tránh tràn VRAM
                  </label>
                  <select className={selectClass} value={tile} onChange={(e) => setTile(Number(e.target.value))}>
                    <option value={0}>Tự động</option>
                    <option value={256}>256 (card mạnh)</option>
                    <option value={128}>128</option>
                    <option value={64}>64 (card yếu)</option>
                    <option value={32}>32 (rất yếu / iGPU)</option>
                  </select>
                </div>
              </>
            )}
          </Card>

          <Button onClick={run} disabled={loading || !preview} className="w-full">
            {loading ? `Đang xử lý… ${progress}%` : "Nâng cấp ảnh"}
          </Button>
          {loading && (
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && (
            <p className="rounded-card border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Cột phải: ảnh */}
        <div className="space-y-4">
          {!preview ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border bg-surface/50 text-center transition-colors hover:border-accent/50"
            >
              <div className="text-sm font-medium text-foreground">Kéo thả hoặc bấm để chọn ảnh</div>
              <div className="text-xs text-foreground-soft">PNG, JPG, WEBP — tối đa 10MB</div>
            </div>
          ) : result ? (
            <>
              <CompareSlider before={preview} after={result} />
              <div className="flex gap-2">
                <Button onClick={download}>Tải ảnh về</Button>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  Chọn ảnh khác
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-card border border-border bg-black/40">
                <img src={preview} alt="Ảnh gốc" className="block w-full" />
              </div>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                Chọn ảnh khác
              </Button>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Bảng so sánh 3 engine */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">So sánh 3 engine upscale</h2>
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-surface-muted">
                <th className="px-3 py-2.5 text-left font-medium text-foreground-soft" />
                <th className="px-3 py-2.5 text-left font-semibold text-teal-400">
                  Real-ESRGAN
                  <span className="ml-1 font-normal text-foreground-soft">(đang dùng)</span>
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-indigo-400">SUPIR</th>
                <th className="px-3 py-2.5 text-left font-semibold text-indigo-400">SeedVR2</th>
              </tr>
            </thead>
            <tbody>
              {UPSCALE_COMPARISON.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground-soft">{row.label}</td>
                  <td className="px-3 py-2 text-foreground">{row.realesrgan}</td>
                  <td className="px-3 py-2 text-foreground">{row.supir}</td>
                  <td className="px-3 py-2 text-foreground">{row.seedvr2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-foreground-soft">
          Mặc định dùng Real-ESRGAN (chạy ngay trên máy, miễn phí). SeedVR2 chạy cloud (cần token Replicate); SUPIR đang phát triển.
        </p>
      </section>

      {/* Ảnh đã upscale — lưu trữ kèm thanh trượt so sánh trước/sau */}
      {history.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Ảnh đã upscale ({history.length})
            </h2>
            <button
              type="button"
              onClick={clearAllHistory}
              className="text-xs text-foreground-soft transition-colors hover:text-red-400"
            >
              Xoá tất cả
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {history.map((it) => (
              <Card key={it.id} className="space-y-2 p-2.5">
                <CompareSlider before={it.before} after={it.after} />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{it.fileName}</p>
                    <p className="text-[11px] text-foreground-soft">
                      {engineLabel(it.engine)} · x{it.scale} ·{" "}
                      {new Date(it.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => downloadImage(it.after, `${it.fileName}-upscale-x${it.scale}.png`)}
                    >
                      Tải
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2.5 text-xs hover:text-red-400"
                      onClick={() => removeHistory(it.id)}
                    >
                      Xoá
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
