import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import {
  VIEW_ANGLES,
  type RenderAnalysis,
  type RenderAnalyzeRequest,
  type RenderCritique,
  type RenderCritiqueRequest,
  type RenderImproveRequest,
  type RenderSuggestion,
} from "@/lib/render-types";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/** Parse + chuẩn hoá JSON model trả về thành RenderAnalysis (đề xuất có id, lọc góc hợp lệ). */
function parseRenderAnalysis(rawText: string): RenderAnalysis {
  const parsed = JSON.parse(stripFence(rawText)) as Partial<RenderAnalysis>;
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

/**
 * Render AI — phân tích một ảnh SketchUp THÔ (chưa render):
 *  - dựng prompt nền tiếng Việt bám sát hình khối / bố cục / góc của bản vẽ,
 *  - đề xuất các prompt nâng cấp (toggle được) giúp ảnh giống thực tế,
 *  - chấm các góc view phù hợp.
 * Một lần gọi vision duy nhất — không tốn thêm lượt.
 */
export async function analyzeForRender(
  req: RenderAnalyzeRequest
): Promise<RenderAnalysis> {
  const model = getGeminiModel(req.model);
  const angleList = VIEW_ANGLES.map((a) => `"${a.id}" = ${a.label}`).join("; ");

  const result = await generateContentRetry(model, [
    buildSketchupPrompt(angleList),
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  return parseRenderAnalysis(result.response.text().trim());
}

/**
 * Render Optimizer — BƯỚC 1: đóng vai KTS 20 năm kinh nghiệm, ĐÁNH GIÁ ảnh render đã có
 * (thừa/thiếu, ánh sáng, vật liệu, bao cảnh, nên thêm gì). Trả về bài đánh giá để người dùng sửa.
 */
export async function critiqueForOptimize(
  req: RenderCritiqueRequest
): Promise<RenderCritique> {
  const model = getGeminiModel(req.model);

  const result = await generateContentRetry(model, [
    buildCritiquePrompt(),
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const parsed = JSON.parse(stripFence(result.response.text().trim())) as Partial<RenderCritique>;
  if (typeof parsed.critique !== "string" || !parsed.critique.trim()) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    critique: parsed.critique,
  };
}

/**
 * Render Optimizer — BƯỚC 2: từ bài ĐÁNH GIÁ (đã được người dùng sửa) + ảnh gốc,
 * dựng prompt cải thiện + đề xuất + negative để render lại. Giữ nguyên thiết kế.
 */
export async function improveForOptimize(
  req: RenderImproveRequest
): Promise<RenderAnalysis> {
  const model = getGeminiModel(req.model);

  const result = await generateContentRetry(model, [
    buildImprovePrompt(req.critique),
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  return parseRenderAnalysis(result.response.text().trim());
}

/** Prompt phân tích cho ảnh SketchUp THÔ → dựng render từ đầu (Render AI). */
function buildSketchupPrompt(angleList: string): string {
  return `Bạn là chuyên gia diễn họa kiến trúc, chuyên biến model 3D THÔ (SketchUp/clay, chưa vật liệu, chưa ánh sáng) thành ảnh render thực tế.

NHIỆM VỤ: phân tích ẢNH đính kèm (một bản dựng SketchUp thô) và chuẩn bị dữ liệu để render ra ảnh thực tế nhất, NHƯNG phải GIỮ NGUYÊN hình khối, số tầng, vị trí cửa, mái, góc camera và bố cục của bản vẽ. Không bịa thêm/bớt khối.

QUAN TRỌNG: TẤT CẢ nội dung trả về phải viết bằng TIẾNG VIỆT (kể cả prompt, đề xuất, negative prompt) — không lẫn tiếng Anh. Người dùng là kiến trúc sư Việt và sẽ đọc/sửa trực tiếp các prompt này.

NGÂN SÁCH ĐỘ DÀI (RẤT QUAN TRỌNG): prompt render cuối được ghép từ analysisPrompt + các đề xuất được bật + vài câu cố định khác. Hãy nhắm bản ghép cuối quanh 150–200 TỪ, nên viết SÚC TÍCH: tổng "analysisPrompt" + tất cả "text" của suggestions cộng lại nên quanh ~130 TỪ. Câu ngắn, đi thẳng vào ý, KHÔNG lặp ý, KHÔNG tính từ hoa mỹ thừa, KHÔNG liệt kê dài dòng từng ô cửa/chi tiết nhỏ. NGOẠI LỆ: ô "vật liệu" được phép dài hơn để kể đủ vật liệu của công trình nhiều chất liệu — khi đó tổng có thể nhỉnh lên ~210–230 từ, chấp nhận được.

NGUYÊN TẮC:
- Bám sát những gì NHÌN THẤY: loại công trình, phong cách, số tầng, tỉ lệ, hướng nhìn, bối cảnh.
- "analysisPrompt": một đoạn prompt TIẾNG VIỆT liền mạch, SÚC TÍCH (~60–90 từ, KHÔNG vượt 90) CHỈ mô tả công trình & bố cục đúng như bản vẽ, để dùng làm GỐC render. Tập trung vào: loại công trình, phong cách, hình khối tổng, số tầng, tỉ lệ, cách bố trí cửa/ban công/mái theo lối KHÁI QUÁT — KHÔNG kể lể từng tầng từng ô cửa một. TUYỆT ĐỐI KHÔNG mô tả góc camera/góc nhìn (người dùng chọn "Góc view" riêng), cũng KHÔNG mô tả bầu trời, thời tiết, ánh sáng, thời điểm trong ngày hay vật liệu — những thứ đó có phần chọn/đề xuất riêng. Không suy đoán màu trời hay mây.
- "suggestions": 4–5 prompt nâng cấp NGẮN (mỗi cái 1 câu TIẾNG VIỆT, tối đa ~20 từ) để người dùng BẬT/TẮT, mỗi nhóm một khía cạnh khác nhau: (1) vật liệu hoàn thiện thực tế — ô NÀY ĐƯỢC PHÉP DÀI HƠN (không bị giới hạn ~20 từ): hãy điểm qua TẤT CẢ các vật liệu chính NHÌN THẤY trên công trình, mỗi vật liệu tả ngắn gọn chất/màu/độ hoàn thiện thật (vd đá, gỗ, kim loại, bê tông, gạch, sơn...). Công trình càng nhiều vật liệu thì càng nên kể đủ (có thể tới ~40–50 từ); công trình ít vật liệu thì viết ngắn. NẾU có cửa kính / mặt kính / gương thì TẢ LUÔN phần phản xạ kính chân thực (kính phản chiếu bầu trời và cảnh xung quanh, độ trong và độ bóng đúng vật lý, thoáng thấy nội thất bên trong, khung kính sắc nét, tránh kính phẳng lì vô hồn), (2) ánh sáng & không khí — tả CHẤT ánh sáng đẹp (hướng nắng, độ mềm và độ dài bóng đổ, không khí, độ tương phản) làm công trình nổi bật; KHÔNG cố định một giờ cụ thể trong câu này vì người dùng sẽ TỰ CHỌN GIỜ riêng — chỉ tả chất sáng để ăn nhập với giờ họ chọn, (3) bầu trời / thời tiết — ĐỪNG mặc định luôn trời trong vắt hoặc ít mây; đề xuất bầu trời ĐẸP, có chiều sâu và hợp công trình (vd mây tích có khối, ráng chiều cam-hồng, trời quang có dải mây mỏng, hoặc trời sau mưa trong trẻo) — chọn loại ăn nhập với ánh sáng, (4) BAO CẢNH — nhãn ĐÚNG là "Bao cảnh". Ưu tiên CÂY XANH đẹp, thực tế, hợp khí hậu VN; nếu model thô đã có cây thì làm đẹp hơn nhưng GIỮ NGUYÊN vị trí/dáng/tỉ lệ cây đó. Bao cảnh phải nhất quán với công trình, không mâu thuẫn ảnh: nhà phố liền kề thật (mặt tiền hẹp, không sân/cổng) → phố VN, nhà sát hai bên, vỉa hè; biệt thự/công trình lớn có sân–cổng → giữ độc lập trong khuôn viên, thêm HÀNG RÀO hợp phong cách (cổ điển: sắt mỹ thuật + trụ xây; hiện đại: tối giản/lam), không nhà áp sát, không dây điện/xe máy; nông thôn → cảnh quan tự nhiên + hàng rào. Render mặt tiền/mặt bên thì KHÔNG thêm đường phố phía xa. Tôn trọng sân/cổng/hàng rào đã có trong ảnh; bao cảnh gọn gàng, cây xanh hợp lý. (5) NGƯỜI ĐI BỘ phụ — nhãn ĐÚNG là "Người đi bộ (có hoặc không)"; "text" CHỈ mô tả khẳng định việc THÊM vài người đi bộ tiết chế cho có sức sống (vd "vài người đi bộ thưa thớt, dáng tự nhiên, ăn mặc lịch sự"); TUYỆT ĐỐI KHÔNG viết câu kiểu "không có người/xe" hay lý do bỏ người, (6) hậu kỳ / chất ảnh. "label" là nhãn NGẮN tiếng Việt; "text" là nội dung prompt TIẾNG VIỆT sẽ ghép vào. Mỗi "text" viết theo lối KHẲNG ĐỊNH (chỉ mô tả cái MUỐN CÓ), TUYỆT ĐỐI không dùng câu phủ định kiểu "không/tránh/đừng" — mọi thứ cần tránh để dành cho "negativePrompt".
- "recommendedAngleIds": chọn 2–3 góc view phù hợp nhất từ danh sách sau (chỉ trả về id): ${angleList}. Luôn cân nhắc "keep" (giữ nguyên góc) nếu góc bản vẽ đã đẹp.
- "negativePrompt": TIẾNG VIỆT, liệt kê lỗi cần tránh (méo hình khối, sai số tầng, đổi bố cục, chậu cây vụn vặt trên vỉa hè, vật trang trí thừa, bố cục lộn xộn rườm rà, mờ nhòe, vỡ nét, watermark, chữ...).
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
}

/** BƯỚC 1 — Prompt cho KTS 20 năm kinh nghiệm ĐÁNH GIÁ ảnh render đã có (text sửa được). */
function buildCritiquePrompt(): string {
  return `Bạn là một KIẾN TRÚC SƯ kiêm chuyên gia diễn họa có 20 NĂM kinh nghiệm. Hãy nhìn ẢNH render (hoặc ảnh công trình) đính kèm và viết một bài ĐÁNH GIÁ chuyên môn, thẳng thắn và cụ thể như đang góp ý cho đồng nghiệp.

YÊU CẦU:
- Viết hoàn toàn bằng TIẾNG VIỆT, giọng chuyên gia, cụ thể vào CHI TIẾT NHÌN THẤY trong ảnh (đừng nói chung chung).
- Chỉ ra cả ĐIỂM TỐT và ĐIỂM CHƯA ĐẠT. Tập trung vào những thứ làm ảnh CHƯA THẬT/CHƯA ĐẸP và CÁCH khắc phục.
- Bao quát các khía cạnh sau, mỗi khía cạnh vài câu, theo đúng các mục dưới đây (giữ nguyên nhãn mục, mỗi mục một dòng tiêu đề rồi nội dung):

TỔNG QUAN: ấn tượng chung, ảnh đang ở mức nào, vấn đề lớn nhất cần xử lý.
HÌNH KHỐI & BỐ CỤC: có gì THỪA (chi tiết/vật thể rối, lặp), có gì THIẾU; bố cục/khung hình ổn chưa.
ÁNH SÁNG: hướng nắng, độ tương phản, bóng đổ, không khí — chỗ nào phẳng/giả/sai, nên chỉnh thế nào.
VẬT LIỆU: vật liệu nào trông giả/nhựa/phẳng (kính, đá, gỗ, sơn, kim loại…), cần chân thực hoá ra sao.
BAO CẢNH & CẢNH QUAN: cây xanh, sân vườn, hàng rào, người, xe, hậu cảnh — thừa/thiếu gì, nên thêm/bớt gì cho HỢP LÝ với loại công trình.
ĐỀ XUẤT CẢI THIỆN: 3–5 gạch đầu dòng ngắn, ưu tiên việc đáng làm nhất để render lại đẹp & thật hơn — TUYỆT ĐỐI không đổi thiết kế công trình.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt 3–6 từ",
  "critique": "TỔNG QUAN: ...\\nHÌNH KHỐI & BỐ CỤC: ...\\nÁNH SÁNG: ...\\nVẬT LIỆU: ...\\nBAO CẢNH & CẢNH QUAN: ...\\nĐỀ XUẤT CẢI THIỆN:\\n- ...\\n- ..."
}
Chỉ trả về JSON.`;
}

/**
 * BƯỚC 2 — Từ bài ĐÁNH GIÁ (đã được người dùng sửa) + ảnh gốc, dựng prompt cải thiện
 * để RENDER LẠI cho chân thực hơn (Render Optimizer). Giữ nguyên thiết kế & bố cục.
 */
function buildImprovePrompt(critique: string): string {
  return `Bạn là chuyên gia diễn họa & hậu kỳ kiến trúc, chuyên NÂNG CẤP một ảnh render đã có cho chân thực, sống động và ấn tượng hơn.

Dưới đây là BÀI ĐÁNH GIÁ của một KTS giàu kinh nghiệm về ảnh đính kèm (người dùng có thể đã chỉnh sửa). Hãy BÁM SÁT bài đánh giá này, biến các điểm cần cải thiện trong đó thành prompt render cụ thể:
"""
${critique.trim()}
"""

NHIỆM VỤ: dựa trên ẢNH đính kèm + bài đánh giá trên, dựng prompt để RENDER LẠI cho thực và đẹp hơn CHỈ bằng cách áp dụng các "ĐỀ XUẤT CẢI THIỆN" trong bài đánh giá. GIỮ NGUYÊN hình khối, THIẾT KẾ công trình, số tầng, vị trí cửa, mái, góc camera, khung hình và toàn bộ bối cảnh như ảnh gốc. KHÔNG đổi thiết kế, KHÔNG thêm/bớt khối, KHÔNG đổi khung hình/góc nhìn.

QUAN TRỌNG: TẤT CẢ nội dung trả về phải viết bằng TIẾNG VIỆT (kể cả prompt và negative prompt) — không lẫn tiếng Anh. Người dùng là kiến trúc sư Việt và sẽ đọc/sửa trực tiếp prompt này.

NGÂN SÁCH ĐỘ DÀI: viết "analysisPrompt" thành MỘT đoạn prompt LIỀN MẠCH, khoảng 150–220 TỪ. Súc tích, đi thẳng vào ý, KHÔNG lặp ý, KHÔNG tính từ hoa mỹ thừa, KHÔNG kể lể từng ô cửa/chi tiết nhỏ.

NGUYÊN TẮC:
- "analysisPrompt" là TOÀN BỘ prompt render cuối, viết LIỀN MẠCH thành một đoạn văn tự nhiên (KHÔNG gạch đầu dòng, KHÔNG tách mục, KHÔNG đánh số). Prompt CHỈ XOAY QUANH các cải thiện trong mục "ĐỀ XUẤT CẢI THIỆN" của bài đánh giá — bám đúng từng điểm đó, KHÔNG bịa thêm cải thiện mà bài đánh giá không nhắc tới.
- Mở đầu chỉ cần một mệnh đề NGẮN neo chủ thể (vd "căn biệt thự hiện đại trong ảnh") để giữ đúng công trình; KHÔNG mô tả lại chi tiết thiết kế, KHÔNG kể lể từng tầng/ô cửa.
- GIỮ NGUYÊN khung hình, góc nhìn, bố cục và TOÀN BỘ bối cảnh của ảnh gốc (bao cảnh, cây xanh, bầu trời, người, xe, hậu cảnh, đường phố). TUYỆT ĐỐI KHÔNG đổi khung hình/góc máy và KHÔNG thêm/đổi bao cảnh, cây xanh, bầu trời, người, xe... TRỪ KHI chính mục "ĐỀ XUẤT CẢI THIỆN" yêu cầu.
- Mỗi cải thiện diễn đạt cụ thể, đúng nghề (vd "đá ốp mặt tiền vân thật, độ nhám và phản xạ đúng vật lý"; "ánh sáng mềm, bóng đổ thật, tăng chiều sâu"; "ảnh nét, màu tự nhiên, khử cảm giác CGI giả nhựa"). Viết theo lối KHẲNG ĐỊNH (chỉ mô tả cái MUỐN CÓ), TUYỆT ĐỐI không dùng câu phủ định kiểu "không/tránh/đừng" — mọi thứ cần tránh để dành cho "negativePrompt".
- "suggestions": để MẢNG RỖNG []. KHÔNG tách thành các đề xuất riêng.
- "recommendedAngleIds": luôn trả về ["keep"] (render lại GIỮ NGUYÊN khung hình ảnh gốc).
- "negativePrompt": TIẾNG VIỆT, liệt kê lỗi cần tránh (đổi thiết kế công trình, méo hình khối, sai số tầng, đổi khung hình/góc máy, đổi bố cục & bối cảnh gốc, cảm giác CGI giả nhựa, mờ nhòe, vỡ nét, watermark, chữ...).
- "title": tiêu đề NGẮN tiếng Việt 3–6 từ.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt",
  "analysisPrompt": "đoạn prompt cải thiện LIỀN MẠCH, mô tả công trình + dệt sẵn các cải thiện theo bài đánh giá ...",
  "suggestions": [],
  "recommendedAngleIds": ["keep"],
  "negativePrompt": "đổi thiết kế, méo hình khối, sai số tầng, ..."
}
Chỉ trả về JSON.`;
}
