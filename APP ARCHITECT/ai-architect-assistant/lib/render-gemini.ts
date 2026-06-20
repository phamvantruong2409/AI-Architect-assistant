import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import {
  VIEW_ANGLES,
  type RenderAnalysis,
  type RenderAnalyzeRequest,
  type RenderSuggestion,
} from "@/lib/render-types";

/**
 * Phân tích một ảnh SketchUp THÔ (chưa render) để:
 *  - dựng prompt nền (EN + VI) bám sát hình khối / bố cục / góc của bản vẽ,
 *  - đề xuất các prompt nâng cấp (toggle được) giúp ảnh giống thực tế,
 *  - chấm các góc view phù hợp.
 * Một lần gọi vision duy nhất — không tốn thêm lượt.
 */
export async function analyzeForRender(
  req: RenderAnalyzeRequest
): Promise<RenderAnalysis> {
  const model = getGeminiModel(req.model);

  const angleList = VIEW_ANGLES.map((a) => `"${a.id}" = ${a.label}`).join("; ");

  const prompt = `Bạn là chuyên gia diễn họa kiến trúc, chuyên biến model 3D THÔ (SketchUp/clay, chưa vật liệu, chưa ánh sáng) thành ảnh render thực tế.

NHIỆM VỤ: phân tích ẢNH đính kèm (một bản dựng SketchUp thô) và chuẩn bị dữ liệu để render ra ảnh thực tế nhất, NHƯNG phải GIỮ NGUYÊN hình khối, số tầng, vị trí cửa, mái, góc camera và bố cục của bản vẽ. Không bịa thêm/bớt khối.

QUAN TRỌNG: TẤT CẢ nội dung trả về phải viết bằng TIẾNG VIỆT (kể cả prompt, đề xuất, negative prompt) — không lẫn tiếng Anh. Người dùng là kiến trúc sư Việt và sẽ đọc/sửa trực tiếp các prompt này.

NGUYÊN TẮC:
- Bám sát những gì NHÌN THẤY: loại công trình, phong cách, số tầng, tỉ lệ, hướng nhìn, bối cảnh.
- "analysisPrompt": một đoạn prompt TIẾNG VIỆT liền mạch (~100–150 từ) CHỈ mô tả công trình & bố cục đúng như bản vẽ, để dùng làm GỐC render. Tập trung vào: loại công trình, hình khối, số tầng, tỉ lệ, cách bố trí cửa/ban công/mái, và góc nhìn (trực diện/góc/cao...). TUYỆT ĐỐI KHÔNG mô tả bầu trời, thời tiết, ánh sáng, thời điểm trong ngày, hay vật liệu — những thứ đó để cho "suggestions" lo. Không suy đoán màu trời hay mây.
- "suggestions": 4–6 prompt nâng cấp NGẮN (mỗi cái 1 câu TIẾNG VIỆT) để người dùng BẬT/TẮT, mỗi nhóm một khía cạnh khác nhau: (1) vật liệu hoàn thiện thực tế — NẾU công trình có cửa kính / mặt kính / gương thì TẢ LUÔN trong ô này phần phản xạ kính chân thực (kính phản chiếu bầu trời và cảnh xung quanh, độ trong và độ bóng đúng vật lý, thoáng thấy nội thất bên trong, khung kính sắc nét, tránh kính phẳng lì vô hồn), (2) ánh sáng & không khí — tả CHẤT ánh sáng đẹp (hướng nắng, độ mềm và độ dài bóng đổ, không khí, độ tương phản) làm công trình nổi bật; KHÔNG cố định một giờ cụ thể trong câu này vì người dùng sẽ TỰ CHỌN GIỜ riêng — chỉ tả chất sáng để ăn nhập với giờ họ chọn, (3) bầu trời / thời tiết — ĐỪNG mặc định luôn trời trong vắt hoặc ít mây; đề xuất bầu trời ĐẸP, có chiều sâu và hợp công trình (vd mây tích có khối, ráng chiều cam-hồng, trời quang có dải mây mỏng, hoặc trời sau mưa trong trẻo) — chọn loại ăn nhập với ánh sáng, (4) BAO CẢNH — nhãn ĐÚNG là "Bao cảnh". Ưu tiên CÂY XANH đẹp, thực tế, hợp khí hậu VN; nếu model thô đã có cây thì làm đẹp hơn nhưng GIỮ NGUYÊN vị trí/dáng/tỉ lệ cây đó. Bao cảnh phải nhất quán với công trình, không mâu thuẫn ảnh: nhà phố liền kề thật (mặt tiền hẹp, không sân/cổng) → phố VN, nhà sát hai bên, vỉa hè; biệt thự/công trình lớn có sân–cổng → giữ độc lập trong khuôn viên, thêm HÀNG RÀO hợp phong cách (cổ điển: sắt mỹ thuật + trụ xây; hiện đại: tối giản/lam), không nhà áp sát, không dây điện/xe máy; nông thôn → cảnh quan tự nhiên + hàng rào. Render mặt tiền/mặt bên thì KHÔNG thêm đường phố phía xa. Tôn trọng sân/cổng/hàng rào đã có trong ảnh. (5) người-xe-nội thất phụ, (6) hậu kỳ / chất ảnh. "label" là nhãn NGẮN tiếng Việt; "text" là nội dung prompt TIẾNG VIỆT sẽ ghép vào.
- "recommendedAngleIds": chọn 2–3 góc view phù hợp nhất từ danh sách sau (chỉ trả về id): ${angleList}. Luôn cân nhắc "keep" (giữ nguyên góc) nếu góc bản vẽ đã đẹp.
- "negativePrompt": TIẾNG VIỆT, liệt kê lỗi cần tránh (méo hình khối, sai số tầng, đổi bố cục, mờ nhòe, vỡ nét, watermark, chữ...).
- "title": tiêu đề NGẮN tiếng Việt 3–6 từ.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt",
  "analysisPrompt": "Prompt nền mô tả hình khối & bố cục, viết thuần tiếng Việt ...",
  "suggestions": [
    { "label": "Vật liệu hoàn thiện", "text": "vật liệu thực tế: ..." }
  ],
  "recommendedAngleIds": ["keep", "corner"],
  "negativePrompt": "méo hình khối, sai số tầng, ..."
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

  const parsed = JSON.parse(cleaned) as Partial<RenderAnalysis>;
  if (typeof parsed.analysisPrompt !== "string" || !parsed.analysisPrompt.trim()) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }

  const validAngleIds = new Set(VIEW_ANGLES.map((a) => a.id));
  const rawSuggestions: unknown[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const suggestions = rawSuggestions
    .map((raw, i) => {
      const s = raw as { label?: unknown; text?: unknown };
      if (typeof s.text !== "string" || !s.text.trim()) return null;
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `sug-${i}-${Date.now()}`,
        label: typeof s.label === "string" && s.label.trim() ? s.label : `Đề xuất ${i + 1}`,
        text: s.text,
      } satisfies RenderSuggestion;
    })
    .filter((x): x is RenderSuggestion => x !== null);

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    analysisPrompt: parsed.analysisPrompt,
    suggestions,
    recommendedAngleIds: Array.isArray(parsed.recommendedAngleIds)
      ? parsed.recommendedAngleIds.filter((x): x is string => typeof x === "string" && validAngleIds.has(x))
      : [],
    negativePrompt: typeof parsed.negativePrompt === "string" ? parsed.negativePrompt : "",
  };
}
