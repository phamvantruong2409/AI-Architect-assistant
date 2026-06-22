import { getGeminiModel, generateContentRetry } from "@/lib/gemini";
import type {
  BBox,
  TakeoffAnalyzeRequest,
  TakeoffItem,
  TakeoffResult,
} from "@/lib/material-takeoff-types";

/** Bỏ rào ```json ... ``` nếu model lỡ bọc markdown quanh JSON. */
function stripFence(text: string): string {
  return text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/** Chuẩn hoá box: 4 số trong [0,1000], thứ tự min<max; null nếu không hợp lệ. */
function normalizeBox(raw: unknown): BBox | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const n = raw.map((v) => Number(v));
  if (n.some((v) => !Number.isFinite(v))) return undefined;
  const clamp = (v: number) => Math.max(0, Math.min(1000, v));
  const ymin = clamp(Math.min(n[0], n[2]));
  const xmin = clamp(Math.min(n[1], n[3]));
  const ymax = clamp(Math.max(n[0], n[2]));
  const xmax = clamp(Math.max(n[1], n[3]));
  if (ymax - ymin < 1 || xmax - xmin < 1) return undefined;
  return [ymin, xmin, ymax, xmax];
}

/** Chuẩn hoá một mục model trả về (đủ trường, đúng kiểu); bỏ mục thiếu tên. */
function normalizeItem(raw: unknown): TakeoffItem | null {
  const c = raw as Partial<TakeoffItem> & { box?: unknown };
  if (typeof c.name !== "string" || !c.name.trim()) return null;
  return {
    name: c.name.trim(),
    description: typeof c.description === "string" ? c.description : "",
    isIndustrialWood: c.isIndustrialWood === true,
    searchHint: typeof c.searchHint === "string" && c.searchHint.trim() ? c.searchHint.trim() : c.name.trim(),
    box: normalizeBox(c.box),
  };
}

function normalizeList(value: unknown): TakeoffItem[] {
  return Array.isArray(value)
    ? value.map(normalizeItem).filter((x): x is TakeoffItem => x !== null)
    : [];
}

/**
 * Bốc Vật liệu AI — nhìn ẢNH render/thiết kế đính kèm, đóng vai KTS lập dự toán,
 * liệt kê các VẬT LIỆU hoàn thiện và các ĐỒ NỘI THẤT nhìn thấy, kèm KHUNG VÙNG (box)
 * của mỗi mục để client crop ảnh minh hoạ + lấy màu chủ đạo. Một lần gọi vision.
 */
export async function analyzeMaterials(req: TakeoffAnalyzeRequest): Promise<TakeoffResult> {
  const model = getGeminiModel();

  const prompt = `Bạn là KIẾN TRÚC SƯ kiêm chuyên gia lập DỰ TOÁN. Hãy nhìn ẢNH render/thiết kế đính kèm và BÓC TÁCH những gì nhìn thấy thành 2 nhóm để lập dự toán:

1) "materials" — VẬT LIỆU hoàn thiện: gỗ công nghiệp/tự nhiên, đá, gạch ốp/lát, sơn, kim loại, kính, tấm trang trí, trần, sàn... (CHẤT LIỆU bề mặt, tính theo m²).
2) "furniture" — ĐỒ NỘI THẤT rời: bàn, ghế, sofa, giường, tủ, kệ, đèn, tranh, thảm, rèm, cây/đồ decor... (MÓN ĐỒ, tính theo cái).

QUY TẮC:
- Chỉ liệt kê thứ THỰC SỰ NHÌN THẤY trong ảnh, không bịa. Gộp các bề mặt cùng loại làm 1 mục.
- Mỗi mục viết hoàn toàn bằng TIẾNG VIỆT, gồm:
  - "name": tên ngắn gọn (vd "Đá granite đen", "Sàn gỗ công nghiệp màu óc chó", "Sofa vải xám").
  - "description": 1 câu mô tả chất/màu/độ hoàn thiện để nhận ra.
  - "isIndustrialWood": true NẾU là bề mặt gỗ công nghiệp (MFC, MDF, HDF, laminate, melamine, acrylic, veneer phủ công nghiệp); còn lại false.
  - "searchHint": cụm từ khoá ngắn để TÌM MUA sản phẩm này (tên + đặc điểm chính).
  - "box": KHUNG bao quanh một vùng TIÊU BIỂU của mục này trong ảnh, dạng [ymin, xmin, ymax, xmax] với toạ độ CHUẨN HOÁ 0–1000 (gốc trên-trái). Với vật liệu bề mặt, chọn vùng bề mặt rõ nhất, ít bị che. Bắt buộc có box cho mọi mục.

Trả về JSON THUẦN TÚY (không markdown, không \`\`\`), đúng cấu trúc:
{
  "title": "Tiêu đề ngắn tiếng Việt 3–6 từ",
  "materials": [
    { "name": "...", "description": "...", "isIndustrialWood": false, "searchHint": "...", "box": [120, 30, 460, 380] }
  ],
  "furniture": [
    { "name": "...", "description": "...", "isIndustrialWood": false, "searchHint": "...", "box": [500, 200, 900, 640] }
  ]
}
Chỉ trả về JSON.`;

  const result = await generateContentRetry(model, [
    prompt,
    { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
  ]);

  const parsed = JSON.parse(stripFence(result.response.text().trim())) as Partial<TakeoffResult>;
  const materials = normalizeList(parsed.materials);
  const furniture = normalizeList(parsed.furniture);
  if (materials.length === 0 && furniture.length === 0) {
    throw new Error("Phản hồi AI không đúng định dạng");
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title : "Bóc tách vật liệu",
    materials,
    furniture,
  };
}
