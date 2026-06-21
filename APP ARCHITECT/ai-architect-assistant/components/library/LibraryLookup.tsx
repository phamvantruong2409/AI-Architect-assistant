"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

/** Một ảnh kết quả trong thư viện. Khi nối thư viện thật, map dữ liệu về dạng này. */
export interface LibraryResult {
  id: string;
  /** URL ảnh (Supabase Storage / public). */
  url: string;
  title: string;
  /** Mô tả ngắn / tag để hiện dưới ảnh. */
  caption?: string;
}

export interface LibraryLookupConfig {
  /** Khoá phân loại, gửi kèm khi gọi API sau này (cong-nang | cau-tao | phong-cach). */
  category: string;
  title: string;
  subtitle: string;
  /** Emoji/biểu tượng lớn ở hero. */
  glyph: string;
  /** Gradient cho vầng sáng hero, vd "from-teal-500/30 to-cyan-500/10". */
  glow: string;
  /** Câu hỏi gợi ý để người dùng bấm nhanh. */
  examples: string[];
  /** Placeholder ô nhập. */
  placeholder: string;
}

/** Render **đậm** kiểu markdown tối giản cho lời tư vấn. */
function renderBold(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-accent">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
};

export function LibraryLookup({ config }: { config: LibraryLookupConfig }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [advice, setAdvice] = useState("");
  const [results, setResults] = useState<LibraryResult[]>([]);
  const [zoomed, setZoomed] = useState<LibraryResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text || searching) return;
    setSearching(true);
    setSearchedFor(text);
    setAdvice("");
    setResults([]);

    try {
      const res = await fetch("/api/library/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: config.category, query: text }),
      });
      const json = (await res.json()) as { advice?: string; results?: LibraryResult[] };
      setAdvice(json.advice ?? "");
      setResults(json.results ?? []);
    } catch {
      setAdvice("");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function download(r: LibraryResult) {
    try {
      const res = await fetch(r.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${r.id}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(r.url, "_blank");
    }
  }

  function onPickExample(ex: string) {
    setQuery(ex);
    inputRef.current?.focus();
    runSearch(ex);
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6"
    >
      {/* HERO */}
      <motion.div variants={item} className="relative text-center">
        <div
          className={`pointer-events-none absolute left-1/2 top-0 -z-10 h-48 w-[28rem] -translate-x-1/2 -translate-y-10 rounded-full bg-gradient-to-b ${config.glow} blur-3xl`}
        />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-3xl shadow-lg">
          <motion.span
            initial={{ rotate: -8, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            {config.glyph}
          </motion.span>
        </div>
        <h1 className="font-display text-3xl">{config.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-foreground-soft">
          {config.subtitle}
        </p>
      </motion.div>

      {/* Ô NHẬP */}
      <motion.div variants={item} className="mt-8">
        <div className="group relative rounded-card border border-border bg-surface p-1.5 shadow-sm transition focus-within:border-accent/60 focus-within:shadow-[0_0_24px_rgba(20,184,166,0.18)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runSearch(query);
                }
              }}
              rows={1}
              placeholder={config.placeholder}
              className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-soft/70"
            />
            <button
              type="button"
              onClick={() => runSearch(query)}
              disabled={!query.trim() || searching}
              className="mb-0.5 mr-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.7rem] bg-accent text-accent-foreground transition hover:bg-accent/90 disabled:opacity-40"
              aria-label="Tra cứu"
            >
              {searching ? (
                <motion.span
                  className="block h-4 w-4 rounded-full border-2 border-accent-foreground/40 border-t-accent-foreground"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* GỢI Ý */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground-soft">Gợi ý:</span>
          {config.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPickExample(ex)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KẾT QUẢ */}
      <div className="mt-10">
        <AnimatePresence mode="wait">
          {searching && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] animate-pulse rounded-card border border-border bg-surface-muted"
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </motion.div>
          )}

          {!searching && searchedFor && results.length > 0 && (
            <motion.div
              key="results"
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-6"
            >
              {advice && (
                <motion.div
                  variants={item}
                  className="flex gap-3 rounded-card border border-accent/30 bg-accent/5 p-4"
                >
                  <span className="mt-0.5 text-lg">💡</span>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {renderBold(advice)}
                  </p>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {results.map((r) => (
                  <motion.figure
                    key={r.id}
                    variants={item}
                    className="group overflow-hidden rounded-card border border-border bg-surface"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setZoomed(r)}
                        className="block h-full w-full cursor-zoom-in"
                        aria-label="Phóng to ảnh"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.url}
                          alt={r.title}
                          className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => download(r)}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface/90 text-foreground-soft opacity-0 backdrop-blur transition hover:text-accent group-hover:opacity-100"
                        aria-label="Tải ảnh"
                        title="Tải ảnh xuống"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                        </svg>
                      </button>
                    </div>
                    <figcaption className="p-3">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      {r.caption && (
                        <p className="mt-0.5 text-xs text-foreground-soft">{r.caption}</p>
                      )}
                    </figcaption>
                  </motion.figure>
                ))}
              </div>
            </motion.div>
          )}

          {/* Đã tìm nhưng thư viện chưa có dữ liệu */}
          {!searching && searchedFor && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-card border border-dashed border-border bg-surface-muted/40 px-6 py-12 text-center"
            >
              <div className="text-3xl">🗂️</div>
              <p className="mt-3 font-medium text-foreground">
                Thư viện đang được cập nhật
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-foreground-soft">
                Bạn đã tra: “{searchedFor}”. Khi thư viện {config.title.toLowerCase()} được
                nạp vào, kết quả phù hợp sẽ hiện ngay tại đây.
              </p>
            </motion.div>
          )}

          {/* Chưa tra lần nào */}
          {!searching && !searchedFor && (
            <motion.div
              key="idle"
              variants={item}
              className="rounded-card border border-dashed border-border bg-surface-muted/30 px-6 py-14 text-center"
            >
              <p className="text-sm text-foreground-soft">
                Nhập nhu cầu của bạn ở trên — AI sẽ tư vấn và đưa ra hình ảnh tham khảo phù hợp.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {zoomed && (
          <Lightbox item={zoomed} onClose={() => setZoomed(null)} onDownload={download} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Phóng ảnh ra giữa màn hình, làm mờ nền; bấm nền/Esc để đóng. */
function Lightbox({
  item,
  onClose,
  onDownload,
}: {
  item: LibraryResult;
  onClose: () => void;
  onDownload: (r: LibraryResult) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8">
      {/* Nền mờ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      {/* Ảnh phóng to */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative z-10 flex max-h-full max-w-3xl flex-col overflow-hidden rounded-card border border-white/10 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.title}
          className="max-h-[78vh] w-auto object-contain"
        />
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            {item.caption && (
              <p className="truncate text-xs text-foreground-soft">{item.caption}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDownload(item)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-card bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition hover:bg-accent/90"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Tải ảnh
          </button>
        </div>

        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition hover:bg-black/60"
          aria-label="Đóng"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}
