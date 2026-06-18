import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type { ReviewRequest, ReviewResult } from "@/lib/review-types";

export async function analyzeRender(req: ReviewRequest): Promise<ReviewResult> {
  const model = getGeminiModel(req.model);

  const prompt = `Bạn là giám đốc nghệ thuật (art director) kiêm chuyên gia diễn họa kiến trúc (archviz), giàu kinh nghiệm đánh giá ảnh render.
Hãy phân tích ẢNH RENDER đính kèm một cách chuyên nghiệp, thẳng thắn và mang tính xây dựng.
${req.context.trim() ? `\nBối cảnh do người dùng cung cấp: ${req.context.trim()}\n` : ""}
Đánh giá theo các tiêu chí (mỗi tiêu chí chấm điểm 0-10):
- Ánh sáng (light & shadow, exposure, mood, hướng nắng)
- Vật liệu & texture (độ chân thực, phản chiếu, tỉ lệ texture)
- Bố cục & góc camera (composition, tiêu cự, đường dẫn mắt, chiều sâu)
- Độ chân thực & chi tiết (realism, entourage, cây cối, con người, hậu cảnh)
- Hậu kỳ & màu sắc (color grading, contrast, white balance)

YÊU CẦU:
- Nhận xét bằng tiếng Việt, cụ thể, có tính chuyên môn cao, nêu rõ vì sao.
- "improvements" là các đề xuất chỉnh sửa CỤ THỂ, khả thi (về thiết lập render, ánh sáng, camera, vật liệu, hậu kỳ).
- "overallScore" là điểm tổng 0-100, phản ánh chất lượng tổng thể.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "overallScore": 0-100,
  "summary": "Tóm tắt 2-3 câu đánh giá chung.",
  "criteria": [
    { "name": "Ánh sáng", "score": 0-10, "comment": "Nhận xét." }
  ],
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "improvements": ["Đề xuất cải thiện cụ thể 1", "Đề xuất cải thiện cụ thể 2"]
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, [
    prompt,
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as ReviewResult;
  if (typeof parsed.overallScore !== "number" || !Array.isArray(parsed.criteria)) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  parsed.strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
  parsed.improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
  if (typeof parsed.summary !== "string") parsed.summary = "";
  return parsed;
}
