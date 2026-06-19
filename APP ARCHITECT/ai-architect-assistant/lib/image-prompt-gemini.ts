import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type {
  ImagePromptEngine,
  ImagePromptRequest,
  ImagePromptResult,
} from "@/lib/image-prompt-types";

const ENGINE_GUIDE: Record<ImagePromptEngine, string> = {
  d5: "D5 Render (real-time path tracing). Prompt tiếng Anh, tập trung vật liệu PBR, ánh sáng tự nhiên, HDRI, depth of field. KHÔNG dùng negative prompt — trả negativePrompt là chuỗi rỗng.",
  corona: "Corona Renderer (physically-based, ảnh thật). Prompt tiếng Anh, vật liệu PBR chính xác, GI thực tế, ánh sáng tự nhiên/HDRI, độ phơi sáng nhiếp ảnh, DoF. KHÔNG dùng negative prompt — negativePrompt rỗng.",
  vray: "V-Ray. Prompt tiếng Anh, mô tả vật lý ánh sáng chính xác, GI, vật liệu PBR, camera (ISO/shutter/f-stop). KHÔNG dùng negative prompt — negativePrompt rỗng.",
  realistic:
    "Ảnh CHÂN THỰC như chụp bằng máy ảnh thật (không phải render). Prompt tiếng Anh mô tả như một bức ảnh kiến trúc thực tế: cảm giác ống kính & tiêu cự, ánh sáng tự nhiên, phơi sáng, chi tiết vật liệu thật, không khí, hậu cảnh đời thường. KHÔNG dùng negative prompt — negativePrompt rỗng.",
  sketch:
    "Bản KÝ HOẠ / diễn hoạ tay kiến trúc. Prompt tiếng Anh mô tả nét vẽ tay, mực hoặc bút chì hoặc marker, hatching, line weight, phối cảnh phác, nền giấy, cảm giác bản vẽ tay. KHÔNG dùng negative prompt — negativePrompt rỗng.",
  midjourney:
    "Midjourney v6+. Prompt tiếng Anh súc tích, giàu từ khóa thị giác, kết thúc bằng tham số như --ar 16:9 --style raw --v 6.1. negativePrompt rỗng (dùng --no trong prompt nếu cần).",
  stable_diffusion:
    "Stable Diffusion / ComfyUI (SDXL). Prompt tiếng Anh dạng từ khóa phân tách bằng dấu phẩy, có trọng số. negativePrompt PHẢI có nội dung (liệt kê lỗi cần tránh: blurry, distorted, lowres, watermark, bad architecture...).",
};

/**
 * "Đọc ngược" một ảnh kiến trúc/nội thất ra prompt tái tạo (reverse-prompt),
 * theo lối forensic reconstruction: bám vào bằng chứng thị giác, không bịa.
 */
export async function extractPromptFromImage(
  req: ImagePromptRequest
): Promise<ImagePromptResult> {
  const model = getGeminiModel(req.model);

  const prompt = `Bạn là chuyên gia phân tích ngược prompt (reverse-prompt) cho ảnh diễn họa kiến trúc, nội thất và cảnh quan.
Nhiệm vụ: tái dựng prompt gốc có khả năng đã tạo ra ẢNH đính kèm, chính xác và bám sát bằng chứng thị giác nhất có thể, để một model khác có thể tái tạo lại ảnh với độ trung thực cao.

=== ENGINE ĐÍCH ===
${ENGINE_GUIDE[req.engine]}

=== NGUYÊN TẮC ===
- Đây là tái dựng forensic, KHÔNG phải sáng tác. Bám sát những gì NHÌN THẤY được.
- KHÔNG bịa thương hiệu, logo, chữ cụ thể, tên KTS/hãng, model máy ảnh/ống kính, render engine, địa điểm chính xác hay vật thể bị che khuất nếu không rõ ràng.
- Nếu một chi tiết không chắc, dùng từ ngữ rộng hơn nhưng vẫn hữu ích; nêu điểm chưa chắc trong "notes".
- Tránh từ sáo rỗng ("highly detailed", "masterpiece") thay cho mô tả thị giác cụ thể.
- "title": tiêu đề NGẮN bằng TIẾNG VIỆT, 3–6 từ, gợi đúng nội dung ảnh (ví dụ "Biệt thự tân cổ điển về đêm").
- Có HAI prompt cùng nội dung & độ chi tiết, chỉ khác ngôn ngữ — mỗi cái 1 đoạn liền mạch ~130–200 từ, theo trật tự: chủ thể/loại công trình → vật liệu & bề mặt → ánh sáng & không khí → bố cục & góc camera → môi trường/hậu cảnh → phong cách/chất render → bảng màu → tỉ lệ khung. Tối ưu cú pháp cho engine đích ở trên:
  - "prompt": THUẦN TIẾNG ANH (không lẫn tiếng Việt), dùng để render trực tiếp.
  - "promptVi": THUẦN TIẾNG VIỆT (không lẫn tiếng Anh), là một prompt hoàn chỉnh viết bằng tiếng Việt — KHÔNG phải câu giải thích.
- Mô tả rõ: hướng & độ mềm bóng đổ, tương phản, nhiệt màu, không khí, chiều sâu, cảm giác ống kính, góc máy, khoảng cách, crop, tỉ lệ khung.
- Bắt đủ vật liệu, kết cấu bề mặt, độ hoàn thiện, entourage (cây cối, người, xe, nội thất) khi có.
- "json": phần phân rã chi tiết — TẤT CẢ giá trị viết bằng TIẾNG VIỆT (kể cả materials, colors). Riêng "aspectRatio" để dạng số như "16:9".
- "negativePrompt": tiếng Anh (đây là tham số kỹ thuật cho engine), loại bỏ lỗi thường gặp; để chuỗi rỗng "" nếu engine đích không dùng negative prompt.
- "styleTags": đúng 4 thẻ ngắn tiếng Anh (1–3 từ, dưới 24 ký tự), ví dụ "tropical modern", "golden hour", "wide angle".
- "notes": tiếng Việt.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt",
  "prompt": "Dense English reconstruction prompt in one line ...",
  "promptVi": "Prompt hoàn chỉnh viết thuần bằng tiếng Việt ...",
  "negativePrompt": "",
  "json": {
    "subject": "(tiếng Việt)",
    "materials": ["(tiếng Việt)", "(tiếng Việt)"],
    "lighting": "(tiếng Việt)",
    "composition": "(tiếng Việt)",
    "styleCamera": "(tiếng Việt)",
    "environment": "(tiếng Việt)",
    "colors": ["(tiếng Việt)", "(tiếng Việt)"],
    "aspectRatio": "16:9"
  },
  "styleTags": ["tag1", "tag2", "tag3", "tag4"],
  "notes": "Ghi chú tiếng Việt: điểm suy luận / chưa chắc."
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

  const parsed = JSON.parse(cleaned) as ImagePromptResult;
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }

  // Chuẩn hoá để UI luôn render an toàn.
  const j = (parsed.json ?? {}) as Partial<ImagePromptResult["json"]>;
  parsed.json = {
    subject: typeof j.subject === "string" ? j.subject : "",
    materials: Array.isArray(j.materials) ? j.materials.filter((x) => typeof x === "string") : [],
    lighting: typeof j.lighting === "string" ? j.lighting : "",
    composition: typeof j.composition === "string" ? j.composition : "",
    styleCamera: typeof j.styleCamera === "string" ? j.styleCamera : "",
    environment: typeof j.environment === "string" ? j.environment : "",
    colors: Array.isArray(j.colors) ? j.colors.filter((x) => typeof x === "string") : [],
    aspectRatio: typeof j.aspectRatio === "string" ? j.aspectRatio : "",
  };
  parsed.styleTags = Array.isArray(parsed.styleTags)
    ? parsed.styleTags.filter((x) => typeof x === "string").slice(0, 4)
    : [];
  if (typeof parsed.title !== "string") parsed.title = "";
  if (typeof parsed.promptVi !== "string") parsed.promptVi = "";
  if (typeof parsed.negativePrompt !== "string") parsed.negativePrompt = "";
  if (typeof parsed.notes !== "string") parsed.notes = "";
  return parsed;
}
