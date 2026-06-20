import { createClient } from "@/lib/supabase/client";

/** Một mẩu tin hiển thị trong trung tâm thông báo (chuông).
 *  Nguồn: bảng Supabase `announcements` do admin (bạn) tự đăng. */
export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  /** Nhãn nút hành động (vd "Xem ngay"). */
  cta_label: string | null;
  /** Link cho nút hành động. */
  cta_url: string | null;
  /** Phân loại để hiển thị icon/màu: 'news' | 'marketing' | 'release'. */
  kind: string;
  created_at: string;
}

/**
 * Tải các tin đã xuất bản, mới nhất trước. Lỗi/ offline → trả mảng rỗng
 * (caller tự xử lý, không làm vỡ UI).
 */
export async function fetchAnnouncements(limit = 30): Promise<Announcement[]> {
  try {
    const { data, error } = await createClient()
      .from("announcements")
      .select("id, title, body, cta_label, cta_url, kind, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Announcement[];
  } catch {
    return [];
  }
}
