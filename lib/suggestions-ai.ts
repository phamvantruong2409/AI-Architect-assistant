import { deepseekGenerateText } from "@/lib/deepseek";
import { SUGGESTION_COUNT, CHAT_QUESTION_COUNT } from "@/lib/suggestions";

/** Model dùng để tạo sinh gợi ý — DeepSeek Flash (nhanh, đã tắt suy luận). */
const SUGGESTIONS_MODEL = "deepseek-v4-flash";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * Tạo sinh các gợi ý "đề bài thiết kế" ngắn cho thanh nhập ý tưởng — bám bối cảnh
 * NGÀY HÔM NAY (mùa, thời tiết, dịp trong năm, xu hướng kiến trúc/nội thất gần đây).
 * Dùng DeepSeek (text-only). Trả về mảng cụm từ tiếng Việt; ném lỗi nếu phản hồi
 * không hợp lệ (caller tự fallback).
 */
export async function generateDailySuggestions(today: Date): Promise<string[]> {
  const dateStr = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const prompt = `Hôm nay là ${dateStr}.
Bạn là chuyên gia kiến trúc & nội thất. Hãy đề xuất ĐÚNG ${SUGGESTION_COUNT} "gợi ý" để hiển thị thành các chip bấm nhanh trên thanh nhập ý tưởng của một app trợ lý AI cho kiến trúc sư VIỆT NAM.

YÊU CẦU:
- Mỗi gợi ý là MỘT cụm từ NGẮN (3–7 từ), giống một đề bài/brief thiết kế cụ thể, hấp dẫn để người dùng bấm vào bắt đầu (ví dụ: "Thiết kế villa 2 tầng 10x20m", "Nhà chống nóng miền Tây", "Resort sinh thái Phú Quốc").
- BÁM bối cảnh thời điểm hiện tại (${dateStr}): mùa trong năm và thời tiết ở Việt Nam, dịp/lễ đang tới gần, và những xu hướng kiến trúc – nội thất đang được quan tâm gần đây trên thế giới (vd vật liệu bền vững, kiến trúc xanh/tiết kiệm năng lượng, phong cách đang thịnh hành...).
- ĐA DẠNG thể loại giữa các gợi ý: nhà ở, nghỉ dưỡng, thương mại/văn phòng, công cộng hoặc nội thất — không trùng thể loại.
- Viết TIẾNG VIỆT, súc tích, KHÔNG đánh số, KHÔNG dấu chấm cuối, KHÔNG giải thích.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`): một mảng ${SUGGESTION_COUNT} chuỗi, ví dụ:
["Gợi ý 1", "Gợi ý 2", "Gợi ý 3", "Gợi ý 4"]
Chỉ trả về JSON.`;

  const raw = await deepseekGenerateText({ model: SUGGESTIONS_MODEL, prompt });
  const parsed = JSON.parse(stripFence(raw.trim())) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  const list = parsed
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim())
    .slice(0, SUGGESTION_COUNT);
  if (list.length === 0) {
    throw new Error("AI không trả về gợi ý nào");
  }
  return list;
}

/**
 * Tạo sinh các CÂU HỎI gợi ý cho AI Chat — đổi mỗi ngày, bám xu hướng kiến trúc/nội
 * thất & quy chuẩn hiện hành. Đây là câu hỏi kiến thức (thuật ngữ, quy chuẩn,
 * vật liệu, phong cách), KHÁC với brief thiết kế. Trả mảng tiếng Việt; ném lỗi
 * nếu phản hồi không hợp lệ (caller tự fallback).
 */
export async function generateDailyChatQuestions(today: Date): Promise<string[]> {
  const dateStr = today.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const prompt = `Hôm nay là ${dateStr}.
Bạn là chuyên gia kiến trúc & nội thất. Hãy đề xuất ĐÚNG ${CHAT_QUESTION_COUNT} "câu hỏi gợi ý" để hiển thị thành các chip bấm nhanh ở màn hình trống của một AI Chat dành cho kiến trúc sư VIỆT NAM.

YÊU CẦU:
- Mỗi mục là MỘT câu hỏi/yêu cầu kiến thức NGẮN (4–10 từ) mà KTS muốn hỏi trợ lý, ví dụ: "Gợi ý vật liệu chống nóng cho mặt tiền hướng Tây", "Quy định khoảng lùi xây dựng nhà phố theo QCVN 01:2021", "So sánh phong cách Indochine và Nhiệt đới hiện đại", "Thông thủy cầu thang tối thiểu là bao nhiêu?".
- Đây là HỎI–ĐÁP kiến thức (thuật ngữ, quy chuẩn/tiêu chuẩn VN, vật liệu, kết cấu, kỹ thuật, phong cách), KHÔNG phải đề bài thiết kế.
- BÁM xu hướng kiến trúc – nội thất ĐANG được quan tâm gần đây (vd vật liệu bền vững/tái chế, kiến trúc xanh & tiết kiệm năng lượng, nhà thông minh, chống nóng/chống ngập theo mùa hiện tại ở Việt Nam, phong cách đang thịnh hành) và quy chuẩn/tiêu chuẩn còn hiệu lực.
- ĐA DẠNG chủ đề giữa các câu: vật liệu, quy chuẩn pháp lý, phong cách, kỹ thuật/thông số — không trùng chủ đề.
- Viết TIẾNG VIỆT, súc tích, KHÔNG đánh số, KHÔNG giải thích.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`): một mảng ${CHAT_QUESTION_COUNT} chuỗi, ví dụ:
["Câu hỏi 1", "Câu hỏi 2", "Câu hỏi 3", "Câu hỏi 4"]
Chỉ trả về JSON.`;

  const raw = await deepseekGenerateText({ model: SUGGESTIONS_MODEL, prompt });
  const parsed = JSON.parse(stripFence(raw.trim())) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  const list = parsed
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim())
    .slice(0, CHAT_QUESTION_COUNT);
  if (list.length === 0) {
    throw new Error("AI không trả về câu hỏi nào");
  }
  return list;
}
