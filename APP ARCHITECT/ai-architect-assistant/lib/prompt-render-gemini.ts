import { getGeminiModel } from "@/lib/gemini";
import type { PromptRenderFormData, PromptRenderResult, RenderEngine } from "@/lib/prompt-render-types";

const ENGINE_GUIDE: Record<RenderEngine, string> = {
  d5: "D5 Render (real-time path tracing). Prompt mô tả là tiếng Anh, tập trung vào vật liệu PBR, ánh sáng tự nhiên, HDRI, depth of field. KHÔNG có negative prompt — trả negativePrompt là chuỗi rỗng. Settings nên gợi ý: HDRI/Sky, exposure, GI/Path Tracing, DoF, vật liệu, hậu kỳ.",
  lumion: "Lumion. Prompt tiếng Anh, nhấn mạnh hiệu ứng khí quyển, cây cối, ánh sáng mặt trời, hiệu ứng Lumion Styles. KHÔNG có negative prompt — negativePrompt rỗng. Settings gợi ý: Sun position, Sky/Cloud, Color/Exposure, Effects (Volumetric, Bloom), vật liệu Reflection.",
  enscape: "Enscape (real-time). Prompt tiếng Anh, nhấn ánh sáng kiến trúc nội thất, Auto Exposure, Sky/Horizon. negativePrompt rỗng. Settings gợi ý: Time of day, Brightness/Exposure, Sky, Bloom, Depth of Field, vật liệu.",
  vray: "V-Ray. Prompt tiếng Anh, mô tả vật lý ánh sáng chính xác, GI, vật liệu PBR. negativePrompt rỗng. Settings gợi ý: Sun & Sky / Dome HDRI, Camera (ISO, shutter, f-stop), GI, Denoiser, vật liệu.",
  midjourney: "Midjourney v6+. Prompt tiếng Anh súc tích, giàu từ khóa thị giác, kết thúc bằng các tham số như --ar 16:9 --style raw --v 6.1. negativePrompt rỗng (dùng --no trong prompt nếu cần). Settings gợi ý: aspect ratio, stylize, chaos, quality.",
  stable_diffusion: "Stable Diffusion / ComfyUI (SDXL). Prompt tiếng Anh dạng từ khóa phân tách bằng dấu phẩy, có trọng số. negativePrompt PHẢI có nội dung (liệt kê lỗi cần tránh: blurry, distorted, lowres, watermark, bad architecture...). Settings gợi ý: model/checkpoint phù hợp kiến trúc, sampler, steps, CFG, resolution, LoRA.",
};

function line(label: string, value: string): string {
  const v = value?.trim();
  return v ? `${label}: ${v}\n` : "";
}

export async function generateRenderPrompt(
  form: PromptRenderFormData
): Promise<PromptRenderResult> {
  const model = getGeminiModel(form.model);

  const info =
    line("Đối tượng / công trình", form.subject) +
    line("Loại không gian", form.space) +
    line("Phong cách", form.style) +
    line("Thời điểm / ánh sáng", form.timeOfDay) +
    line("Tâm trạng / không khí", form.mood) +
    line("Chi tiết bổ sung", form.details);

  const prompt = `Bạn là chuyên gia diễn họa kiến trúc (archviz), thành thạo việc viết prompt cho các phần mềm render và AI tạo ảnh.
Dựa trên yêu cầu dưới đây, hãy tạo MỘT prompt render chất lượng cao, tối ưu cho engine được chọn.

=== YÊU CẦU CỦA NGƯỜI DÙNG ===
${info}
=== ENGINE MỤC TIÊU ===
${ENGINE_GUIDE[form.engine]}

=== NGUYÊN TẮC ===
- Prompt chính ("prompt") viết bằng TIẾNG ANH, chuyên nghiệp, đậm chất archviz, ultra realistic, 8K.
- Mô tả rõ: chủ thể, vật liệu, ánh sáng, bố cục camera, không khí, hậu cảnh.
- "settings" là mảng các dòng gợi ý thiết lập CỤ THỂ cho đúng engine (tiếng Việt ngắn gọn, mỗi phần tử là một ý).
- "notes" giải thích ngắn bằng tiếng Việt (2-4 câu) vì sao prompt được xây dựng như vậy.
- Nếu engine không hỗ trợ negative prompt thì "negativePrompt" để chuỗi rỗng "".

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "prompt": "English render prompt ...",
  "negativePrompt": "",
  "settings": ["gợi ý 1", "gợi ý 2"],
  "notes": "Giải thích ngắn bằng tiếng Việt."
}
Chỉ trả về JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as PromptRenderResult;
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  if (!Array.isArray(parsed.settings)) parsed.settings = [];
  if (typeof parsed.negativePrompt !== "string") parsed.negativePrompt = "";
  if (typeof parsed.notes !== "string") parsed.notes = "";
  return parsed;
}
