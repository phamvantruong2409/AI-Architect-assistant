import { getGeminiModel } from "@/lib/gemini";
import type { Concept, ProjectBrief } from "@/types/concept";

export async function generateConcepts(
  brief: ProjectBrief,
  modelId?: string
): Promise<Concept[]> {
  const model = getGeminiModel(modelId);

  const styles = brief.styles.length ? brief.styles.join(", ") : "chưa xác định";
  const prompt = `Bạn là kiến trúc sư trưởng giàu kinh nghiệm tại Việt Nam, chuyên đề xuất hướng concept thiết kế phù hợp khí hậu nhiệt đới, văn hoá và quy chuẩn xây dựng Việt Nam.

Dựa trên brief dự án sau, hãy đề xuất ĐÚNG 3 hướng concept KHÁC BIỆT rõ rệt về phong cách và cách ứng xử không gian:

- Loại công trình: ${brief.type || "chưa xác định"}
- Diện tích đất: ${brief.landArea ? `${brief.landArea} m²` : "chưa xác định"}
- Số tầng dự kiến: ${brief.floors || "chưa xác định"}
- Ngân sách: ${brief.budget || "chưa xác định"}
- Phong cách mong muốn: ${styles}
- Mô tả thêm từ khách hàng: ${brief.description?.trim() || "không có"}

YÊU CẦU:
- Mỗi concept phải bám sát loại công trình, diện tích, ngân sách và mong muốn của khách hàng.
- "description" gồm 2-3 câu cụ thể về tổ chức không gian, hình khối và cách ứng xử với khí hậu/bối cảnh.
- "materials" là vật liệu hoàn thiện thực tế, phù hợp ngân sách.
- "colorPalette" gồm 4 mã màu HEX hợp gu với phong cách.
- "references" là công trình hoặc văn phòng kiến trúc tham khảo có thật.
- "reasoning" giải thích vì sao hướng này phù hợp với brief này.
- Viết toàn bộ bằng tiếng Việt chuyên ngành.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), là một MẢNG gồm đúng 3 phần tử theo cấu trúc:
[
  {
    "name": "Tên concept ngắn gọn",
    "tagline": "Câu mô tả ngắn 1 dòng",
    "description": "Mô tả chi tiết 2-3 câu.",
    "style": ["Từ khoá phong cách"],
    "materials": ["Vật liệu 1", "Vật liệu 2"],
    "colorPalette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
    "references": ["Công trình/văn phòng tham khảo"],
    "reasoning": "Lý do phù hợp với brief."
  }
]
Chỉ trả về JSON.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { concepts?: unknown[] })?.concepts)
      ? (parsed as { concepts: unknown[] }).concepts
      : [];

  if (list.length === 0) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }

  return list.map((raw, i) => {
    const c = raw as Partial<Concept>;
    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      id: `${brief.type || "concept"}-${i}-${Date.now()}`,
      name: typeof c.name === "string" ? c.name : `Hướng ${i + 1}`,
      tagline: typeof c.tagline === "string" ? c.tagline : "",
      description: typeof c.description === "string" ? c.description : "",
      style: toStringArray(c.style),
      materials: toStringArray(c.materials),
      colorPalette: toStringArray(c.colorPalette),
      references: toStringArray(c.references),
      reasoning: typeof c.reasoning === "string" ? c.reasoning : "",
    } satisfies Concept;
  });
}
