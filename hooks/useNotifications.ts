"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAnnouncements } from "@/lib/announcements";

export type NotifKind = "update" | "news" | "marketing" | "release";

export interface NotifItem {
  id: string;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  kind: NotifKind;
  /** ISO date dùng để sắp xếp & so với mốc đã đọc. */
  date: string;
  read: boolean;
}

const LAST_READ_KEY = "notif-last-read";
const ACKED_VERSION_KEY = "notif-acked-version";

/**
 * Trung tâm thông báo cho cái chuông ở sidebar. Gộp 2 nguồn:
 *  1. Tin do admin đăng trên Supabase (bảng `announcements`).
 *  2. Thẻ "đã cập nhật lên vX" tạo sinh tự động khi version app đổi so với lần trước.
 *
 * Trạng thái đã đọc lưu ở localStorage (mốc thời gian + version đã xác nhận),
 * nên chấm đỏ tự tắt sau khi mở chuông.
 */
export function useNotifications() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const lastRead = localStorage.getItem(LAST_READ_KEY);
    const lastReadMs = lastRead ? Date.parse(lastRead) : 0;

    // --- Phát hiện vừa cập nhật app ---
    let updateItem: NotifItem | null = null;
    let version: string | null = null;
    try {
      version = (await window.electronAPI?.getAppVersion?.()) ?? null;
    } catch {
      version = null;
    }
    if (version) {
      const acked = localStorage.getItem(ACKED_VERSION_KEY);
      if (!acked) {
        // Lần chạy đầu sau khi có tính năng này → ghi nhận im lặng, không báo.
        localStorage.setItem(ACKED_VERSION_KEY, version);
      } else if (acked !== version) {
        updateItem = {
          id: `update-${version}`,
          title: `🎉 Đã cập nhật lên v${version}`,
          body: "Cảm ơn bạn đã cập nhật! Xem tính năng mới & tin tức bên dưới.",
          ctaLabel: null,
          ctaUrl: null,
          kind: "update",
          date: new Date().toISOString(),
          read: false,
        };
      }
    }

    // --- Tin từ Supabase ---
    const announcements = await fetchAnnouncements();
    const annItems: NotifItem[] = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      ctaLabel: a.cta_label,
      ctaUrl: a.cta_url,
      kind: (["news", "marketing", "release"].includes(a.kind) ? a.kind : "news") as NotifKind,
      date: a.created_at,
      read: Date.parse(a.created_at) <= lastReadMs,
    }));

    setItems([...(updateItem ? [updateItem] : []), ...annItems]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = items.filter((i) => !i.read).length;

  const markAllRead = useCallback(async () => {
    localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
    try {
      const version = await window.electronAPI?.getAppVersion?.();
      if (version) localStorage.setItem(ACKED_VERSION_KEY, version);
    } catch {
      /* web/dev: bỏ qua */
    }
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }, []);

  return { items, loading, unreadCount, markAllRead, reload: load };
}
