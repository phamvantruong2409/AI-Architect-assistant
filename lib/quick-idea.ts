// Lõi server cho công cụ "Ý tưởng nhanh từ MB".
// Đọc ảnh mặt bằng (+ tuỳ chọn ảnh SketchUp) + phong cách + ghi chú → một lần gọi Gemini
// vision → trả về prompt render đầy đủ (tiếng Việt) sẵn để render.

import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import { quickStyleHint, type QuickIdeaRequest, type QuickIdeaResult } from "@/lib/quick-idea-types";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function parseResult(rawText: string): QuickIdeaResult {
  const parsed = JSON.parse(stripFence(rawText)) as Partial<QuickIdeaResult>;
  if (typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    spaceType: typeof parsed.spaceType === "string" ? parsed.spaceType : "",
    prompt: parsed.prompt,
    negativePrompt: typeof parsed.negativePrompt === "string" ? parsed.negativePrompt : "",
  };
}

/** Khung prompt hướng dẫn cho Gemini, khác nhau theo chế độ. */
function buildInstruction(req: QuickIdeaRequest): string {
  const styleText = quickStyleHint(req.style) || req.style.trim();
  const styleLine = styleText
    ? `PHONG CÁCH người dùng chọn: ${styleText}. Bám đúng phong cách này xuyên suốt.`
    : `PHONG CÁCH: người dùng chưa chọn — hãy tự chọn một phong cách đẹp, hợp công năng & khí hậu Việt Nam, rồi giữ nhất quán.`;
  const notesLine = req.notes?.trim()
    ? `GHI CHÚ của người dùng (diễn giải thành yêu cầu cụ thể, hợp lý, ĐẦY ĐỦ — đừng chỉ chép lại): "${req.notes.trim()}"`
    : `GHI CHÚ: người dùng không ghi chú gì thêm — hãy tự bổ sung những gì còn thiếu cho một bức render đẹp & thực tế.`;

  const modeBlock =
    req.mode === "fidelity"
      ? `BẠN NHẬN HAI ẢNH:
  (A) ẢNH MẶT BẰNG 2D — đọc để hiểu loại không gian, kích thước, bố trí nội thất, vị trí cửa & cửa sổ, lối đi.
  (B) ẢNH SKETCHUP THÔ — chính không gian đó dựng 3D (1 góc camera, chưa vật liệu/ánh sáng).
NHIỆM VỤ: dựng MỘT prompt để render ảnh (B) thành ảnh nội thất 3D thực tế.
QUY TẮC BẤT BIẾN: GIỮ NGUYÊN hình khối, tường/sàn/trần, vị trí cửa & cửa sổ, và GÓC CAMERA của ảnh (B). Không đổi khung hình, không xoay phòng, không dời tường. Bố trí nội thất bám theo mặt bằng (A).`
      : `BẠN NHẬN MỘT ẢNH:
  (A) ẢNH MẶT BẰNG 2D — đọc để hiểu loại không gian, kích thước, bố trí nội thất, vị trí cửa & cửa sổ, lối đi.
NHIỆM VỤ: dựng MỘT prompt để render ảnh phối cảnh nội thất 3D THỰC TẾ dựa trên bố cục của mặt bằng này.
QUAN TRỌNG: ảnh đầu vào là BẢN VẼ 2D — prompt phải nói rõ DỰNG MỘT PHỐI CẢNH NỘI THẤT 3D thực tế từ bố cục đó, KHÔNG tô màu lại bản vẽ 2D, KHÔNG render dạng nhìn từ trên xuống. Nếu trên mặt bằng có KÝ HIỆU HƯỚNG NHÌN/camera thì chọn đúng hướng đó; nếu không, tự chọn một góc nhìn ngang tầm mắt đẹp, thể hiện được không gian.`;

  return `Bạn là kiến trúc sư nội thất kiêm chuyên gia diễn họa. ${modeBlock}

${styleLine}
${notesLine}

YÊU CẦU PROMPT (rất quan trọng):
- Viết HOÀN TOÀN bằng TIẾNG VIỆT, một đoạn LIỀN MẠCH, tự nhiên, súc tích khoảng 120–200 TỪ.
- Đây là prompt ĐẦY ĐỦ và TỰ ĐỦ để render: neo loại không gian + phong cách, rồi mô tả nội thất chính (bám bố trí mặt bằng), vật liệu hoàn thiện thực tế (sàn/tường/trần), ánh sáng (tự nhiên qua cửa sổ + đèn, chất sáng đẹp), màu sắc chủ đạo, trang trí/cây xanh/rèm tiết chế cho có sức sống.
- Viết theo lối KHẲNG ĐỊNH (chỉ mô tả cái MUỐN CÓ). Mọi thứ cần tránh dồn vào "negativePrompt".
- KHÔNG bịa thêm không gian/phòng không có trong mặt bằng. KHÔNG kể lể từng chi tiết vụn vặt.
- Chốt bằng yêu cầu chất ảnh: ảnh render nội thất chân thực, độ chi tiết cao, màu chính xác, không cảm giác CGI giả.

Trả về JSON THUẦN (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "tiêu đề ngắn tiếng Việt 3–6 từ",
  "spaceType": "loại không gian nhận ra từ mặt bằng",
  "prompt": "đoạn prompt render đầy đủ, liền mạch, tiếng Việt ...",
  "negativePrompt": "lỗi cần tránh: sai bố cục mặt bằng, đổi vị trí cửa/cửa sổ, méo phối cảnh, lệch tỉ lệ, cảm giác CGI giả nhựa, mờ nhòe, vỡ nét, watermark, chữ ..."
}
Chỉ trả về JSON.`;
}

/** Gọi Gemini vision một lần → trả về prompt render đầy đủ. */
export async function analyzeQuickIdea(req: QuickIdeaRequest): Promise<QuickIdeaResult> {
  const model = getGeminiModel(req.model);

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: buildInstruction(req) },
    { text: "(A) ẢNH MẶT BẰNG:" },
    { inlineData: { mimeType: req.planMime, data: req.planImageBase64 } },
  ];
  if (req.mode === "fidelity" && req.sceneImageBase64) {
    parts.push({ text: "(B) ẢNH SKETCHUP:" });
    parts.push({ inlineData: { mimeType: req.sceneMime || "image/jpeg", data: req.sceneImageBase64 } });
  }

  const result = await generateContentRetry(model, parts);
  return parseResult(result.response.text().trim());
}
