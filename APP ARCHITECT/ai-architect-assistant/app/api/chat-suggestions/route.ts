// Câu hỏi gợi ý cho AI Chat — đổi MỖI NGÀY, bám xu hướng & quy chuẩn hiện hành.
// Sinh bằng DeepSeek, cache trong bộ nhớ theo ngày (chỉ gọi AI 1 lần/ngày). Lỗi → fallback tĩnh.

import { generateDailyChatQuestions } from "@/lib/suggestions-ai";
import { DEFAULT_CHAT_QUESTIONS } from "@/lib/suggestions";

let cache: { date: string; questions: string[] } | null = null;

/** Khoá ngày theo giờ địa phương (YYYY-MM-DD). */
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export async function GET() {
  const date = todayKey();
  if (cache && cache.date === date) {
    return Response.json({ suggestions: cache.questions, date, cached: true });
  }

  try {
    const questions = await generateDailyChatQuestions(new Date());
    cache = { date, questions };
    return Response.json({ suggestions: questions, date });
  } catch (error) {
    console.error("Daily chat questions error:", error);
    // Không chặn UI — trả câu hỏi mặc định khi AI lỗi/offline/chưa có API key.
    return Response.json({ suggestions: DEFAULT_CHAT_QUESTIONS, date, fallback: true });
  }
}
