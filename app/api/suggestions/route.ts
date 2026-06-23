// Gợi ý "đề bài thiết kế" cho thanh nhập ý tưởng — đổi MỖI NGÀY, bám bối cảnh hiện tại.
// Tạo sinh bằng DeepSeek, cache trong bộ nhớ theo ngày (chỉ gọi AI 1 lần/ngày). Lỗi → fallback tĩnh.

import { generateDailySuggestions } from "@/lib/suggestions-ai";
import { DEFAULT_SUGGESTIONS } from "@/lib/suggestions";

let cache: { date: string; suggestions: string[] } | null = null;

/** Khoá ngày theo giờ địa phương (YYYY-MM-DD). */
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export async function GET() {
  const date = todayKey();
  if (cache && cache.date === date) {
    return Response.json({ suggestions: cache.suggestions, date, cached: true });
  }

  try {
    const suggestions = await generateDailySuggestions(new Date());
    cache = { date, suggestions };
    return Response.json({ suggestions, date });
  } catch (error) {
    console.error("Daily suggestions error:", error);
    // Không chặn UI — trả gợi ý mặc định khi AI lỗi/offline/chưa có API key.
    return Response.json({ suggestions: DEFAULT_SUGGESTIONS, date, fallback: true });
  }
}
