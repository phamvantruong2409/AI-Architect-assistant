"use client";

import { useEffect, useState } from "react";
import { useNotifications, type NotifItem } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/chat-sessions";
import { BellIcon } from "./icons";

/** Mở link CTA: link nội bộ (/...) điều hướng trong app, link ngoài (http) mở
 *  bằng trình duyệt hệ thống khi chạy Electron, ngược lại mở tab mới. */
function openCta(url: string) {
  if (url.startsWith("/")) {
    window.location.assign(url);
    return;
  }
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const KIND_DOT: Record<NotifItem["kind"], string> = {
  update: "bg-teal-500",
  release: "bg-indigo-500",
  marketing: "bg-amber-500",
  news: "bg-sky-500",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, loading, unreadCount, markAllRead } = useNotifications();

  // Mở chuông = đã xem hết → tắt chấm đỏ.
  useEffect(() => {
    if (open && unreadCount > 0) markAllRead();
  }, [open, unreadCount, markAllRead]);

  // Đóng bằng phím Esc + khoá cuộn nền khi mở modal.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-foreground-soft transition-colors hover:bg-sidebar-surface hover:text-sidebar-foreground"
        aria-label="Thông báo"
      >
        <BellIcon className="h-[17px] w-[17px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Nền mờ xung quanh */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Hộp thông báo ở giữa màn hình */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">Thông báo</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="flex h-7 w-7 items-center justify-center rounded-full text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto">
              {loading ? (
                <p className="px-5 py-10 text-center text-xs text-foreground-soft">Đang tải…</p>
              ) : items.length === 0 ? (
                <p className="px-5 py-12 text-center text-xs text-foreground-soft">
                  Chưa có thông báo nào.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((it) => (
                    <li key={it.id} className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[it.kind]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-foreground">{it.title}</p>
                          {it.body && (
                            <p className="mt-1 text-xs leading-relaxed text-foreground-soft">{it.body}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-[11px] text-foreground-soft/70">
                              {formatRelativeTime(Date.parse(it.date))}
                            </span>
                            {it.ctaUrl && (
                              <button
                                onClick={() => openCta(it.ctaUrl!)}
                                className="text-[11px] font-medium text-teal-500 hover:underline"
                              >
                                {it.ctaLabel || "Xem ngay"} →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
