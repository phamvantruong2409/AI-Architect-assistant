"use client";

// Cho người dùng VẼ/GHI CHÚ trực tiếp lên ảnh mặt bằng (bút, đường, mũi tên, chữ nhật,
// chữ) để chỉ rõ ý cho AI: khoanh WC, mũi tên chiều mở cửa, ghi "tường 200"… Ảnh hiển thị
// dạng THUMBNAIL như cũ; BẤM vào sẽ mở MODAL toàn màn hình (nền xung quanh tối/mờ) kèm bộ
// công cụ để vẽ thoải mái + phóng to. Nét vẽ lưu dạng VECTOR (toạ độ chuẩn hoá 0..1) nên
// không vỡ khi đổi cỡ; khi phân tích, getAnnotated() DÁN PHẲNG nét vào ảnh ở độ phân giải
// gốc rồi trả base64 để gửi cho Gemini.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface AnnotatedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
}

export interface ImageAnnotatorHandle {
  /** Ảnh đã dán phẳng nét vẽ/chữ; null nếu CHƯA vẽ gì (gọi sẽ dùng ảnh gốc). */
  getAnnotated: () => Promise<AnnotatedImage | null>;
}

type Pt = [number, number]; // toạ độ CHUẨN HOÁ 0..1 theo khung ảnh

type Item =
  | { tool: "pen"; color: string; mul: number; pts: Pt[] }
  | { tool: "line"; color: string; mul: number; a: Pt; b: Pt }
  | { tool: "arrow"; color: string; mul: number; a: Pt; b: Pt }
  | { tool: "rect"; color: string; mul: number; a: Pt; b: Pt }
  | { tool: "text"; color: string; mul: number; pos: Pt; text: string };

type Tool = "pen" | "line" | "arrow" | "rect" | "text";

/** Công cụ kéo 2 điểm (a→b): đường thẳng, mũi tên, chữ nhật. */
type DragTool = "line" | "arrow" | "rect";

const COLORS = ["#ef4444", "#2563eb", "#16a34a", "#111827"];
/** Cỡ cọ: hệ số nhân áp cho bề rộng nét & cỡ chữ. */
const SIZES: { label: string; mul: number }[] = [
  { label: "S", mul: 0.5 },
  { label: "M", mul: 1 },
  { label: "L", mul: 2 },
  { label: "XL", mul: 3.5 },
];
const PEN_W = 0.006; // bề rộng nét bút = 0.6% đường chéo (× mul)
const ARROW_W = 0.007;
const TEXT_H = 0.045; // cỡ chữ = 4.5% chiều cao ảnh (× mul)
const MAX_SIDE = 2000; // giới hạn cạnh dài khi dán phẳng gửi AI (giữ ảnh < 8MB)
const THUMB_SIDE = 900; // cạnh dài bản xem trước trên thumbnail

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Vẽ toàn bộ item lên ctx có kích thước w×h (px). Toạ độ item là 0..1. */
function drawItems(ctx: CanvasRenderingContext2D, w: number, h: number, items: (Item | null)[]) {
  const diag = Math.hypot(w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const it of items) {
    if (!it) continue;
    const mul = it.mul || 1;
    if (it.tool === "pen") {
      if (it.pts.length < 1) continue;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = PEN_W * diag * mul;
      ctx.beginPath();
      it.pts.forEach(([nx, ny], i) => {
        const x = nx * w;
        const y = ny * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (it.tool === "rect") {
      const ax = it.a[0] * w;
      const ay = it.a[1] * h;
      const bx = it.b[0] * w;
      const by = it.b[1] * h;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = ARROW_W * diag * mul;
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    } else if (it.tool === "line" || it.tool === "arrow") {
      const ax = it.a[0] * w;
      const ay = it.a[1] * h;
      const bx = it.b[0] * w;
      const by = it.b[1] * h;
      ctx.strokeStyle = it.color;
      ctx.lineWidth = ARROW_W * diag * mul;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (it.tool === "arrow") {
        const ang = Math.atan2(by - ay, bx - ax);
        const head = Math.max(diag * 0.022 * mul, ARROW_W * diag * mul * 3);
        for (const s of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(
            bx - head * Math.cos(ang - s * 0.45),
            by - head * Math.sin(ang - s * 0.45)
          );
          ctx.stroke();
        }
      }
    } else {
      const x = it.pos[0] * w;
      const y = it.pos[1] * h;
      const fontPx = TEXT_H * h * mul;
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      // Viền trắng cho dễ đọc trên nền bản vẽ, rồi tô màu.
      ctx.lineWidth = fontPx * 0.18;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(it.text, x, y);
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, x, y);
    }
  }
}

interface Props {
  src: string;
  className?: string;
}

export const ImageAnnotator = forwardRef<ImageAnnotatorHandle, Props>(
  function ImageAnnotator({ src, className }, ref) {
    const [items, setItems] = useState<Item[]>([]);
    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState<string>(COLORS[0]);
    const [sizeMul, setSizeMul] = useState<number>(1); // cỡ cọ (hệ số nhân)
    const [zoom, setZoom] = useState(1); // 1 = vừa bề rộng khung; >1 = phóng to (có cuộn)
    const [open, setOpen] = useState(false); // modal toàn màn hình
    const [size, setSize] = useState({ w: 0, h: 0 }); // cỡ canvas vẽ (px) trong modal
    const [previewUrl, setPreviewUrl] = useState<string | null>(null); // thumbnail có nét
    const [textBox, setTextBox] = useState<
      { x: number; y: number; nx: number; ny: number; value: string } | null
    >(null);

    const wrapRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const draftRef = useRef<Item | null>(null);
    const itemsRef = useRef<Item[]>([]);
    itemsRef.current = items;
    // Gương của textBox để commit đọc giá trị mới nhất & chặn commit 2 lần (Enter + blur).
    const textRef = useRef<typeof textBox>(null);
    textRef.current = textBox;
    // Mốc thời gian vừa đặt ô nhập — để bỏ qua cú blur tức thì do click đặt gây ra.
    const placedAtRef = useRef(0);

    // Đổi ảnh → xoá hết chú thích cũ.
    useEffect(() => {
      setItems([]);
      setPreviewUrl(null);
      setOpen(false);
      draftRef.current = null;
      setTextBox(null);
    }, [src]);

    // Dán phẳng nét vẽ vào ảnh (ở độ phân giải gốc, cap maxSide) → AnnotatedImage.
    const flattenTo = useCallback(
      async (maxSide: number): Promise<AnnotatedImage | null> => {
        if (itemsRef.current.length === 0) return null;
        const img = await loadImage(src);
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        drawItems(ctx, w, h, itemsRef.current);
        const dataUrl = c.toDataURL("image/jpeg", 0.9);
        return { dataUrl, base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" };
      },
      [src]
    );

    useImperativeHandle(ref, () => ({ getAnnotated: () => flattenTo(MAX_SIDE) }), [flattenTo]);

    // Đóng modal: cập nhật ảnh xem trước (thumbnail) cho thấy nét đã vẽ.
    const closeModal = useCallback(async () => {
      setOpen(false);
      setTextBox(null);
      const p = await flattenTo(THUMB_SIDE);
      setPreviewUrl(p?.dataUrl ?? null);
    }, [flattenTo]);

    // Theo dõi cỡ hiển thị của ảnh trong modal để canvas phủ khít.
    useEffect(() => {
      if (!open) return;
      const el = imgRef.current;
      if (!el) return;
      const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, [open, zoom]);

    // Khoá cuộn nền + Esc để đóng khi mở modal.
    useEffect(() => {
      if (!open) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !textBox) void closeModal();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }, [open, textBox, closeModal]);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawItems(ctx, canvas.width, canvas.height, [...itemsRef.current, draftRef.current]);
    }, []);

    useEffect(() => {
      if (open) redraw();
    }, [items, size, open, redraw]);

    // Khi vừa mở ô nhập chữ → focus chắc chắn (autoFocus đôi khi không ăn trong webview).
    const typing = !!textBox;
    useEffect(() => {
      if (typing) requestAnimationFrame(() => inputRef.current?.focus());
    }, [typing]);

    const norm = (e: React.PointerEvent): Pt => {
      const r = canvasRef.current!.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      return [nx, ny];
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (textBox) return; // đang gõ chữ
      const p = norm(e);
      if (tool === "text") {
        e.preventDefault(); // tránh canvas/nền giành focus khi đặt ô nhập
        const r = canvasRef.current!.getBoundingClientRect();
        placedAtRef.current = performance.now();
        setTextBox({ x: e.clientX - r.left, y: e.clientY - r.top, nx: p[0], ny: p[1], value: "" });
        return;
      }
      canvasRef.current?.setPointerCapture(e.pointerId);
      draftRef.current =
        tool === "pen"
          ? { tool: "pen", color, mul: sizeMul, pts: [p] }
          : { tool: tool as DragTool, color, mul: sizeMul, a: p, b: p };
      redraw();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const d = draftRef.current;
      if (!d) return;
      const p = norm(e);
      if (d.tool === "pen") d.pts.push(p);
      else if (d.tool === "line" || d.tool === "arrow" || d.tool === "rect") d.b = p;
      redraw();
    };

    const onPointerUp = () => {
      const d = draftRef.current;
      draftRef.current = null;
      if (!d) return;
      if (d.tool === "pen") {
        if (d.pts.length < 2) return redraw();
      } else if (d.tool === "line" || d.tool === "arrow" || d.tool === "rect") {
        // Bỏ nét quá nhỏ (lỡ tay click) — ngưỡng ~1% khung.
        if (Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < 0.01) return redraw();
      }
      setItems((prev) => [...prev, d]);
    };

    const commitText = () => {
      const tb = textRef.current;
      if (!tb) return; // đã commit (Enter rồi blur) → bỏ qua lần sau
      textRef.current = null; // chốt ngay để blur sau Enter không thêm lần 2
      setTextBox(null);
      if (tb.value.trim()) {
        setItems((prev) => [
          ...prev,
          { tool: "text", color, mul: sizeMul, pos: [tb.nx, tb.ny], text: tb.value.trim() },
        ]);
      }
    };

    const toolBtn = (t: Tool, label: string) => (
      <button
        type="button"
        onClick={() => setTool(t)}
        className={`rounded-card px-2.5 py-1 text-xs font-medium transition ${
          tool === t
            ? "bg-accent text-accent-foreground"
            : "border border-border text-foreground-soft hover:border-accent/50"
        }`}
      >
        {label}
      </button>
    );

    return (
      <div className={className}>
        {/* THUMBNAIL — giữ như cũ; bấm để mở modal vẽ. Nếu đã vẽ thì hiện ảnh có nét. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative inline-block max-w-full overflow-hidden rounded-card border border-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? src}
            alt="Ảnh mặt bằng"
            className="block max-h-72 max-w-full object-contain"
            draggable={false}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
            🔍 Bấm để phóng to &amp; ghi chú
          </span>
          {items.length > 0 && (
            <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              ✎ {items.length} ghi chú
            </span>
          )}
        </button>
        <p className="mt-1.5 text-xs text-foreground-soft">
          Mẹo: bấm ảnh để mở to, rồi khoanh/ghi chú (vd chỉ phòng WC, chiều mở cửa, ghi “tường
          200”) — AI sẽ đọc luôn nét bạn vẽ khi phân tích.
        </p>

        {/* MODAL toàn màn hình — nền xung quanh tối/mờ. */}
        {open && (
          <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-black/70 p-3 backdrop-blur-sm sm:p-6">
            {/* Thanh công cụ */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-surface p-2 shadow-lg">
              <div className="flex flex-wrap items-center gap-1.5">
                {toolBtn("pen", "✏️ Vẽ")}
                {toolBtn("line", "／ Đường")}
                {toolBtn("arrow", "➤ Mũi tên")}
                {toolBtn("rect", "▭ Chữ nhật")}
                {toolBtn("text", "🅣 Chữ")}
                <span className="mx-1 h-4 w-px bg-border" />
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Màu ${c}`}
                    className={`h-5 w-5 rounded-full border-2 transition ${
                      color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {/* Cỡ cọ — chấm tròn to dần để dễ nhận biết. */}
                {SIZES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSizeMul(s.mul)}
                    aria-label={`Cỡ cọ ${s.label}`}
                    title={`Cỡ ${s.label}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-card border transition ${
                      sizeMul === s.mul
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <span
                      className="rounded-full bg-foreground"
                      style={{ width: `${3 + s.mul * 3}px`, height: `${3 + s.mul * 3}px` }}
                    />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setItems((p) => p.slice(0, -1))}
                  disabled={items.length === 0}
                  className="rounded-card border border-border px-2.5 py-1 text-xs text-foreground-soft transition hover:border-accent/50 disabled:opacity-40"
                >
                  ↶ Hoàn tác
                </button>
                <button
                  type="button"
                  onClick={() => setItems([])}
                  disabled={items.length === 0}
                  className="rounded-card border border-border px-2.5 py-1 text-xs text-foreground-soft transition hover:border-accent/50 disabled:opacity-40"
                >
                  🗑 Xoá hết
                </button>
                <span className="mx-1 h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                  disabled={zoom <= 1}
                  aria-label="Thu nhỏ"
                  className="rounded-card border border-border px-2.5 py-1 text-xs text-foreground-soft transition hover:border-accent/50 disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-[3rem] text-center text-xs tabular-nums text-foreground-soft">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}
                  disabled={zoom >= 5}
                  aria-label="Phóng to"
                  className="rounded-card border border-border px-2.5 py-1 text-xs text-foreground-soft transition hover:border-accent/50 disabled:opacity-40"
                >
                  +
                </button>
                {zoom !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="rounded-card border border-border px-2.5 py-1 text-xs text-foreground-soft transition hover:border-accent/50"
                  >
                    Vừa khung
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => void closeModal()}
                className="rounded-card bg-accent px-3 py-1 text-xs font-medium text-accent-foreground transition hover:bg-accent/90"
              >
                ✓ Xong
              </button>
            </div>

            {/* Khung vẽ — cuộn được khi phóng to; ảnh lấp đầy bề rộng (× zoom). */}
            <div className="min-h-0 flex-1 overflow-auto rounded-card bg-surface-muted p-4 sm:p-8">
              <div
                ref={wrapRef}
                className="relative mx-auto"
                style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={src}
                  alt="Ảnh mặt bằng"
                  onLoad={() =>
                    imgRef.current &&
                    setSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight })
                  }
                  className="block w-full select-none rounded-card border border-border bg-white"
                  draggable={false}
                />
                <canvas
                  ref={canvasRef}
                  width={size.w}
                  height={size.h}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute inset-0 touch-none"
                  style={{ cursor: tool === "text" ? "text" : "crosshair" }}
                />
                {textBox && (
                  <input
                    ref={inputRef}
                    autoFocus
                    value={textBox.value}
                    onChange={(e) => setTextBox((tb) => (tb ? { ...tb, value: e.target.value } : tb))}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitText();
                      if (e.key === "Escape") {
                        textRef.current = null;
                        setTextBox(null);
                      }
                    }}
                    onBlur={() => {
                      const tb = textRef.current;
                      // Blur ngay sau khi đặt (do click đặt làm mất focus) → bỏ qua & focus lại.
                      if (tb && !tb.value.trim() && performance.now() - placedAtRef.current < 500) {
                        requestAnimationFrame(() => inputRef.current?.focus());
                        return;
                      }
                      commitText();
                    }}
                    placeholder="Nhập chữ rồi Enter"
                    className="absolute z-10 w-40 rounded border border-accent bg-white px-1 py-0.5 text-xs text-gray-900 shadow outline-none"
                    style={{ left: textBox.x, top: textBox.y, color: color }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
