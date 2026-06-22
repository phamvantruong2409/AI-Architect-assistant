import { generateTextLLM } from "@/lib/ai";
import type {
  DossierFormData,
  DossierResult,
  DossierDocType,
  DossierLength,
} from "@/lib/dossier-types";

const DOC_TYPE_GUIDE: Record<DossierDocType, string> = {
  phuong_an:
    "Đây là THUYẾT MINH PHƯƠNG ÁN KIẾN TRÚC. Trình bày đầy đủ, mạch lạc các giải pháp thiết kế. Các mục đề xuất: Giới thiệu chung, Ý tưởng thiết kế, Giải pháp quy hoạch – tổng mặt bằng, Giải pháp kiến trúc & mặt đứng, Giải pháp công năng – dây chuyền sử dụng, Vật liệu & màu sắc, Giải pháp kỹ thuật sơ bộ (kết cấu, điện nước, thông gió chiếu sáng), Kết luận.",
  concept:
    "Đây là THUYẾT MINH Ý TƯỞNG CONCEPT. Văn phong giàu hình ảnh, kể câu chuyện và tinh thần thiết kế. Các mục đề xuất: Bối cảnh & cảm hứng, Câu chuyện thiết kế, Ngôn ngữ kiến trúc, Không gian & trải nghiệm, Vật liệu & ánh sáng, Thông điệp tổng thể.",
  xin_phep:
    "Đây là THUYẾT MINH PHỤC VỤ HỒ SƠ XIN PHÉP XÂY DỰNG. Văn phong trang trọng, chính xác, bám sát quy chuẩn QCVN 01:2021/BXD và các tiêu chuẩn hiện hành. Các mục đề xuất: Căn cứ lập thuyết minh, Giới thiệu chung công trình, Giải pháp quy hoạch – kiến trúc, Chỉ tiêu kinh tế kỹ thuật (mật độ xây dựng, hệ số sử dụng đất, tầng cao, khoảng lùi), Giải pháp kết cấu & hạ tầng kỹ thuật, Phòng cháy chữa cháy & môi trường, Kết luận – kiến nghị.",
};

const LENGTH_GUIDE: Record<DossierLength, string> = {
  ngan: "Mỗi mục 1–2 đoạn ngắn, tổng độ dài khoảng 400–600 từ.",
  tieu_chuan: "Mỗi mục 2–3 đoạn, tổng độ dài khoảng 800–1200 từ.",
  chi_tiet: "Mỗi mục 3–4 đoạn giàu chi tiết chuyên môn, tổng độ dài khoảng 1500–2200 từ.",
};

function line(label: string, value: string): string {
  const v = value?.trim();
  return v ? `${label}: ${v}\n` : "";
}

export async function generateDossier(form: DossierFormData): Promise<DossierResult> {
  const info =
    line("Tên công trình", form.projectName) +
    line("Loại công trình", form.buildingType) +
    line("Địa điểm", form.location) +
    line("Diện tích lô đất", form.landArea ? `${form.landArea} m²` : "") +
    line("Tổng diện tích sàn", form.floorArea ? `${form.floorArea} m²` : "") +
    line("Số tầng", form.floors) +
    line("Phong cách kiến trúc", form.style) +
    line("Chủ đầu tư / đối tượng sử dụng", form.client) +
    line("Ý tưởng & yêu cầu chủ đạo", form.concept) +
    line("Vật liệu & giải pháp nổi bật", form.materials);

  const prompt = `Bạn là kiến trúc sư trưởng giàu kinh nghiệm tại Việt Nam, chuyên viết thuyết minh thiết kế chuyên nghiệp.
Hãy viết một bản thuyết minh hoàn chỉnh, văn phong chuẩn mực ngành kiến trúc Việt Nam, dựa trên thông tin dưới đây.

=== THÔNG TIN CÔNG TRÌNH ===
${info}
=== LOẠI THUYẾT MINH ===
${DOC_TYPE_GUIDE[form.docType]}

=== ĐỘ DÀI ===
${LENGTH_GUIDE[form.length]}

=== YÊU CẦU ===
- Viết bằng tiếng Việt, chính xác về chuyên môn, mạch lạc, thuyết phục.
- Suy luận hợp lý để bổ sung những nội dung chuyên môn còn thiếu (đừng bịa số liệu cụ thể nếu không được cung cấp; nói ở mức định hướng/nguyên tắc).
- Trong nội dung được phép dùng **in đậm** cho thuật ngữ quan trọng, và danh sách gạch đầu dòng "- " khi liệt kê.
- KHÔNG dùng tiêu đề markdown (#) bên trong nội dung; tiêu đề mục để ở trường "heading".

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề thuyết minh, ví dụ: THUYẾT MINH THIẾT KẾ KIẾN TRÚC – <tên công trình>",
  "sections": [
    { "heading": "Tên mục", "content": "Nội dung mục (các đoạn cách nhau bằng dòng trống)." }
  ]
}
Chỉ trả về JSON.`;

  const text = (await generateTextLLM({ model: form.model, prompt })).trim();
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as DossierResult;
  if (!parsed.title || !Array.isArray(parsed.sections)) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }
  return parsed;
}
