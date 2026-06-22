"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  MAX_IMAGES_PER_ITEM,
  deleteItem,
  getAllItems,
  newId,
  putItem,
  type PromptLibraryItem,
} from "@/lib/prompt-library-store";

const inputClass =
  "w-full rounded-card border border-border bg-surface-muted px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "mb-1.5 block text-xs font-medium text-foreground-soft";

/** Đọc + thu nhỏ ảnh về tối đa 1600px để lưu cho nhẹ. */
function fileToDataUrl(file: File, max = 1600): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function CopyButton({ text }: { text: string }) {
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
      {copied ? "Đã sao chép" : "Sao chép"}
    </Button>
  );
}

export default function PromptLibraryPage() {
  const [items, setItems] = useState<PromptLibraryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<PromptLibraryItem | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = editingId !== null;

  useEffect(() => {
    getAllItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được kho prompt"));
  }, []);

  async function addFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    const list = Array.from(files);
    const room = MAX_IMAGES_PER_ITEM - images.length;
    if (room <= 0) {
      setError(`Mỗi mục tối đa ${MAX_IMAGES_PER_ITEM} ảnh.`);
      return;
    }
    const picked = list.slice(0, room);
    const urls = (await Promise.all(picked.map((f) => fileToDataUrl(f)))).filter(
      (u): u is string => !!u
    );
    if (urls.length) {
      setError(null);
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES_PER_ITEM));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  // Dán ảnh Ctrl+V vào mục đang soạn.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const imgs = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (imgs.length) {
        e.preventDefault();
        void addFiles(imgs);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  function resetForm() {
    setEditingId(null);
    setCreatedAt(null);
    setTitle("");
    setText("");
    setImages([]);
    setError(null);
  }

  function startEdit(item: PromptLibraryItem) {
    setEditingId(item.id);
    setCreatedAt(item.createdAt);
    setTitle(item.title);
    setText(item.text);
    setImages(item.images);
    setError(null);
    setViewing(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!title.trim() && !text.trim() && images.length === 0) {
      setError("Mục trống — hãy nhập tiêu đề, nội dung prompt hoặc thêm ảnh.");
      return;
    }
    setSaving(true);
    setError(null);
    const now = Date.now();
    const item: PromptLibraryItem = {
      id: editingId ?? newId(),
      title: title.trim(),
      text: text.trim(),
      images,
      createdAt: createdAt ?? now,
      updatedAt: now,
    };
    try {
      await putItem(item);
      setItems(await getAllItems());
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteItem(id);
      setItems(await getAllItems());
      if (editingId === id) resetForm();
      setViewing((v) => (v?.id === id ? null : v));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xoá thất bại");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl">Lưu trữ Prompt</h1>
        <p className="mt-1 text-sm text-foreground-soft">
          Nơi cất giữ những prompt bạn muốn. Mỗi mục gồm tiêu đề, nội dung và tối đa {MAX_IMAGES_PER_ITEM} ảnh. Bấm lưu là
          giữ vĩnh viễn cho tới khi bạn xoá.
        </p>
      </div>

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base text-accent">
            {editing ? "Sửa mục" : "Mục mới"}
          </h2>
          {editing && (
            <button
              className="text-xs text-foreground-soft underline-offset-2 hover:text-foreground hover:underline"
              onClick={resetForm}
            >
              + Tạo mục mới
            </button>
          )}
        </div>

        <div>
          <label className={labelClass}>Tiêu đề</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Phối cảnh villa nhiệt đới — golden hour"
          />
        </div>

        <div>
          <label className={labelClass}>Nội dung prompt</label>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dán hoặc gõ prompt cần lưu vào đây..."
          />
        </div>

        <div>
          <label className={labelClass}>
            Ảnh ({images.length}/{MAX_IMAGES_PER_ITEM})
          </label>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-card border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="Bỏ ảnh này"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES_PER_ITEM && (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void addFiles(e.dataTransfer.files);
                }}
                className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-card border border-dashed border-border bg-surface-muted text-center text-[10px] text-foreground-soft transition-colors hover:border-accent/50"
              >
                <span className="text-base leading-none">+</span>
                <span>Thêm ảnh</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
          <p className="mt-1 text-xs text-foreground-soft">Kéo-thả, bấm ô, hoặc dán Ctrl+V để thêm ảnh.</p>
        </div>

        {error && (
          <div className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {editing && (
            <Button variant="secondary" onClick={resetForm} disabled={saving}>
              Huỷ
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : editing ? "💾 Cập nhật mục" : "💾 Lưu mục"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-base">Đã lưu ({items.length})</h2>
        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-foreground-soft">
            Chưa có mục nào. Tạo mục đầu tiên ở trên nhé.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setViewing(item)}
                className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface text-left transition-colors hover:border-accent/50"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
                  {item.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.images[0]}
                      alt={item.title || "Prompt"}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="absolute inset-0 line-clamp-5 overflow-hidden p-3 font-mono text-[11px] leading-snug text-foreground-soft">
                      {item.text || "(Không nội dung)"}
                    </span>
                  )}
                  {item.images.length > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {item.images.length} ảnh
                    </span>
                  )}
                </div>
                <div className="min-w-0 p-2.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.title || "(Không tiêu đề)"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-foreground-soft">
                    {new Date(item.updatedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewing(null);
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <h3 className="font-display text-lg text-foreground">
                  {viewing.title || "(Không tiêu đề)"}
                </h3>
                <p className="text-xs text-foreground-soft">
                  {new Date(viewing.updatedAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              {viewing.text.trim() && (
                <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-muted px-4 py-3 font-mono text-sm leading-relaxed text-foreground">
                  {viewing.text}
                </p>
              )}
              {viewing.images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {viewing.images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setLightbox(src)}
                      className="flex items-center justify-center overflow-hidden rounded-card border border-border bg-surface-muted transition-colors hover:border-accent/50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Ảnh ${i + 1}`}
                        className="max-h-56 w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
              {!viewing.text.trim() && viewing.images.length === 0 && (
                <p className="text-sm text-foreground-soft">(Mục trống)</p>
              )}
            </div>

            <div className="flex flex-none items-center justify-end gap-2 border-t border-border p-4">
              {viewing.text.trim() && <CopyButton text={viewing.text} />}
              <Button size="sm" variant="secondary" onClick={() => startEdit(viewing)}>
                Sửa
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void handleDelete(viewing.id)}>
                Xoá
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition-colors hover:bg-white/20"
            title="Đóng"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Ảnh phóng to"
            className="max-h-[90vh] max-w-[92vw] rounded-card object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
