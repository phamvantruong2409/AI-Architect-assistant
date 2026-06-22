// Sinh 2 PHƯƠNG ÁN sửa đổi hình khối từ ảnh người dùng (img2img Gemini, khổ 1K).
// Cả hai phương án đều áp dụng các đề xuất cải thiện từ bước phân tích, khác nhau ở
// cách triển khai khối (tinh chỉnh vs. mạnh dạn). Dùng model Flash image (1K, nhanh & rẻ).

import { getGeminiImageModel } from "@/lib/gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import {
  MASSING_VARIANT_DIRECTIONS,
  type MassingVariant,
  type MassingVariantsRequest,
} from "@/lib/massing-types";

export const maxDuration = 300;

const IMAGE_MODEL = "gemini-2.5-flash-image"; // Flash image → khổ 1K

/** Tách dataURL "data:<mime>;base64,<data>" → { mimeType, data }. */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function buildVariantPrompt(directionHint: string, suggestions: string[], context: string): string {
  const sugBlock = suggestions.length
    ? `\nCÁC ĐỀ XUẤT CẢI THIỆN cần áp dụng (đã chốt ở bước phân tích):\n${suggestions
        .map((s) => `- ${s}`)
        .join("\n")}\n`
    : "";
  return `Bạn là kiến trúc sư chỉnh sửa HÌNH KHỐI cho công trình trong ẢNH đính kèm.
NHIỆM VỤ: tạo MỘT phương án hình khối MỚI bằng cách SỬA ĐỔI khối của công trình trong ảnh — GIỮ đây vẫn là CÙNG MỘT công trình (cùng công năng, số tầng, phong cách, góc nhìn và khung hình như ảnh gốc), chỉ thay đổi TẠO HÌNH KHỐI (tỉ lệ, giật cấp, lệch khối, quan hệ đặc–rỗng, điểm nhấn).
${sugBlock}
HƯỚNG XỬ LÝ CHO PHƯƠNG ÁN NÀY: ${directionHint}
${context.trim() ? `\nBối cảnh/mong muốn của người dùng: ${context.trim()}\n` : ""}
YÊU CẦU ẢNH: giữ phong cách thể hiện khối giống ảnh gốc (mô hình khối/clay), nền gọn gàng, góc nhìn như ảnh gốc, thể hiện rõ thay đổi hình khối. KHÔNG thêm chữ/watermark.`;
}

async function generateOne(
  image: { mimeType: string; data: string },
  prompt: string
): Promise<string | null> {
  const model = getGeminiImageModel(IMAGE_MODEL); // không truyền imageConfig → mặc định 1K
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: image.mimeType, data: image.data } },
  ]);
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData) return null;
  const { mimeType, data } = imagePart.inlineData;
  return `data:${mimeType};base64,${data}`;
}

export async function POST(req: Request) {
  let body: MassingVariantsRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
    return Response.json({ error: "Thiếu ảnh hình khối đầu vào hợp lệ" }, { status: 400 });
  }
  const parsed = parseDataUrl(body.image);
  if (!parsed) {
    return Response.json({ error: "Ảnh đầu vào không hợp lệ" }, { status: 400 });
  }

  const suggestions = Array.isArray(body.suggestions)
    ? body.suggestions.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : [];
  const context = typeof body.context === "string" ? body.context : "";

  try {
    const results = await Promise.all(
      MASSING_VARIANT_DIRECTIONS.map((d) =>
        generateOne(parsed, buildVariantPrompt(d.hint, suggestions, context))
      )
    );
    const variants: MassingVariant[] = [];
    results.forEach((image, i) => {
      if (image) variants.push({ label: MASSING_VARIANT_DIRECTIONS[i].label, image });
    });

    if (variants.length === 0) {
      return Response.json(
        { error: "AI không trả về phương án nào. Vui lòng thử lại." },
        { status: 502 }
      );
    }
    return Response.json({ variants });
  } catch (error) {
    console.error("Massing variants error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }
}
