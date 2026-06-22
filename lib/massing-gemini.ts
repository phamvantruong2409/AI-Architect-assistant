import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type { MassingCriterion, MassingRequest, MassingResult } from "@/lib/massing-types";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

/** Chuẩn hoá một tiêu chí model trả về (đảm bảo đủ trường, đúng kiểu). */
function normalizeCriterion(raw: unknown): MassingCriterion | null {
  const c = raw as Partial<MassingCriterion>;
  if (typeof c.name !== "string" || !c.name.trim()) return null;
  return {
    name: c.name,
    score: typeof c.score === "number" ? c.score : 0,
    comment: typeof c.comment === "string" ? c.comment : "",
    pros: toStringArray(c.pros),
    cons: toStringArray(c.cons),
    improvements: toStringArray(c.improvements),
  };
}

/**
 * Phân tích hình khối — đóng vai KTS giàu kinh nghiệm, NHÌN ảnh hình khối kiến trúc
 * (mô hình khối, SketchUp thô, phác thảo, ảnh công trình…) và PHÂN TÍCH KỸ theo từng mục:
 * điểm đẹp, điểm chưa đạt và cần cải thiện — để người dùng biết cách chỉnh hình khối.
 * Một lần gọi vision duy nhất.
 */
export async function analyzeMassing(req: MassingRequest): Promise<MassingResult> {
  const model = getGeminiModel(req.model);

  const prompt = `Bạn là một KIẾN TRÚC SƯ kiêm chuyên gia thiết kế hình khối (massing) có nhiều năm kinh nghiệm.
Hãy nhìn ẢNH HÌNH KHỐI KIẾN TRÚC đính kèm (có thể là mô hình khối, dựng SketchUp thô, phác thảo hoặc ảnh công trình) và PHÂN TÍCH THẬT KỸ, chuyên môn, thẳng thắn và mang tính xây dựng. Với MỖI mục đánh giá, phải tách rõ: ĐIỂM ĐẸP, ĐIỂM CHƯA ĐẠT và CẦN CẢI THIỆN — để người dùng biết chính xác nên sửa gì.
${req.context.trim() ? `\nBối cảnh / mong muốn do người dùng cung cấp: ${req.context.trim()}\n` : ""}
Phân tích theo các MỤC sau (mỗi mục chấm điểm 0-10):
- Tỉ lệ & cân đối (proportion, tỉ lệ các khối, sự cân bằng tổng thể)
- Bố cục khối & nhịp điệu (composition, phân vị, nhịp điệu, tính phân cấp chính–phụ)
- Quan hệ đặc–rỗng (solid–void, mảng đặc và khoảng lùi/hốc/khoảng mở)
- Đường nét & phong cách (ngôn ngữ tạo hình, tính nhất quán, thẩm mỹ)
- Quan hệ bối cảnh & công năng (tỉ xích con người, hướng, gợi ý công năng, phù hợp địa hình/bối cảnh)

YÊU CẦU CHO MỖI MỤC:
- "comment": 1-2 câu nhận xét tổng quát cho mục đó.
- "pros": gạch đầu dòng các ĐIỂM ĐẸP / làm tốt (cụ thể vào chi tiết nhìn thấy). Nếu không có thì để mảng rỗng.
- "cons": gạch đầu dòng các ĐIỂM CHƯA ĐẠT / điểm yếu (nói rõ vì sao chưa ổn). Nếu không có thì để mảng rỗng.
- "improvements": gạch đầu dòng CÁCH CẢI THIỆN cụ thể, khả thi, dễ hình dung để người dùng tự chỉnh hình khối (ví dụ: "giật cấp khối tầng trên lùi vào 0.6–1m để giảm cảm giác nặng đầu", "khoét một khoảng rỗng/ô thông tầng ở mặt chính tạo điểm nhấn đặc–rỗng", "kéo dài khối ngang để cân với khối đứng bên trái").

YÊU CẦU CHUNG:
- Viết hoàn toàn bằng TIẾNG VIỆT, cụ thể vào CHI TIẾT NHÌN THẤY trong ảnh, có chuyên môn, nêu rõ vì sao.
- Chỉ bàn về HÌNH KHỐI (tạo hình, tỉ lệ, bố cục, đặc–rỗng) — KHÔNG bàn vật liệu/màu sắc/ánh sáng/chất lượng render.
- "suggestions" (cấp tổng): 3-5 đề xuất sửa đổi ƯU TIÊN nhất, sắp theo mức đáng làm trước, để người dùng biết nên chỉnh gì đầu tiên.
- "overallScore": điểm tổng 0-100 phản ánh chất lượng tổng thể của phương án hình khối.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt 3–6 từ",
  "overallScore": 0-100,
  "summary": "Tóm tắt 2-3 câu nhận xét chung về hình khối.",
  "criteria": [
    {
      "name": "Tỉ lệ & cân đối",
      "score": 0-10,
      "comment": "Nhận xét tổng quát.",
      "pros": ["Điểm đẹp 1"],
      "cons": ["Điểm chưa đạt 1"],
      "improvements": ["Cách cải thiện cụ thể 1"]
    }
  ],
  "suggestions": ["Đề xuất ưu tiên 1", "Đề xuất ưu tiên 2"]
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, [
    prompt,
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const parsed = JSON.parse(stripFence(result.response.text().trim())) as Partial<MassingResult>;
  if (typeof parsed.overallScore !== "number" || !Array.isArray(parsed.criteria)) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    overallScore: parsed.overallScore,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    criteria: parsed.criteria
      .map(normalizeCriterion)
      .filter((c): c is MassingCriterion => c !== null),
    suggestions: toStringArray(parsed.suggestions),
  };
}
