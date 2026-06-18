import { getGeminiModel, generateContentRetry } from "./gemini";
import { SURVEY_SECTIONS } from "./briefing-survey";
import type { SurveyAnswers } from "./briefing-store";

function buildPrompt(projectName: string, clientName: string, answersText: string): string {
  return `Bạn là kiến trúc sư trưởng giàu kinh nghiệm tại Việt Nam. Dưới đây là kết quả KHẢO SÁT NHU CẦU của khách hàng "${clientName}" cho dự án "${projectName}". Hãy tổng hợp thành một BẢN BRIEF THIẾT KẾ chuyên nghiệp, súc tích, đủ để kiến trúc sư bắt tay vào concept.

=== DỮ LIỆU KHẢO SÁT ===
${answersText || "(khách hàng chưa điền nhiều thông tin)"}

=== YÊU CẦU ===
Viết bằng tiếng Việt, định dạng Markdown với các mục (dùng tiêu đề "## "):
## Tổng quan & chân dung khách hàng
(2-3 câu nắm bắt khách hàng và mục tiêu dự án)
## Phong cách & định hướng thẩm mỹ
(phong cách chủ đạo, tông màu, cảm giác không gian, vật liệu chủ đạo)
## Yêu cầu công năng
(liệt kê phòng/không gian cần có + lưu ý bố trí, ưu tiên)
## Ràng buộc & lưu ý đặc biệt
(suy luận từ khảo sát: người già → tiếp cận an toàn; trẻ nhỏ → an toàn; hướng nắng; ngân sách; kỹ thuật...)
## Bảng màu & vật liệu gợi ý
(gợi ý cụ thể, phù hợp ngân sách)
## Khuyến nghị của kiến trúc sư
(3-5 gạch đầu dòng định hướng concept tiếp theo)

Chỉ trả về nội dung Markdown của bản brief, không thêm lời mở đầu hay kết luận thừa.`;
}

function formatAnswers(answers: SurveyAnswers): string {
  const blocks: string[] = [];
  for (const section of SURVEY_SECTIONS) {
    const lines: string[] = [];
    for (const q of section.questions) {
      const a = answers[q.id];
      if (a == null || a === "" || (Array.isArray(a) && a.length === 0)) continue;
      lines.push(`- ${q.label}: ${Array.isArray(a) ? a.join(", ") : a}`);
    }
    if (lines.length) blocks.push(`### ${section.title}\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}

export async function generateBriefFromSurvey(
  projectName: string,
  clientName: string,
  answers: SurveyAnswers,
  modelId?: string
): Promise<string> {
  const model = getGeminiModel(modelId);
  const result = await generateContentRetry(model, buildPrompt(projectName, clientName, formatAnswers(answers)));
  return result.response.text().trim();
}
