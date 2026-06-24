// Kiểu & hằng dùng chung cho công cụ "Ý tưởng nhanh từ MB".
// Từ ẢNH MẶT BẰNG (+ tuỳ chọn ảnh SketchUp) + phong cách + ghi chú → AI tự dựng
// prompt render đầy đủ. File này THUẦN dữ liệu (an toàn cho cả client & server).

import type { GeminiModelId } from "@/lib/gemini-models";

/**
 * Hai chế độ của công cụ:
 *  - "fidelity" (Bám thiết kế): có thêm ảnh SketchUp → render img2img trên khối 3D thật,
 *    giữ đúng hình học & góc camera. Cho ảnh sát thiết kế nhất.
 *  - "concept"  (Concept nhanh): chỉ ảnh mặt bằng → AI tự dựng phối cảnh 3D từ bố cục 2D.
 *    Nhanh, hợp lúc chưa có model SketchUp; chấp nhận sai số hình học.
 */
export type QuickMode = "fidelity" | "concept";

export interface QuickStyle {
  id: string;
  /** Nhãn hiển thị tiếng Việt. */
  label: string;
  /** Mô tả ngắn (tiếng Việt) ghép vào prompt để định hướng phong cách. */
  hint: string;
}

/** Phong cách dựng sẵn để bấm chọn nhanh (người dùng vẫn gõ tay được). */
export const QUICK_STYLES: QuickStyle[] = [
  {
    id: "modern",
    label: "Hiện đại",
    hint: "phong cách hiện đại, đường nét tối giản, vật liệu hoàn thiện cao cấp, gam màu trung tính",
  },
  {
    id: "contemporary",
    label: "Đương đại",
    hint: "phong cách đương đại, bố cục thoáng, vật liệu thật tinh tế, gam trung tính ấm có điểm nhấn",
  },
  {
    id: "indochine",
    label: "Đông Dương",
    hint: "phong cách Đông Dương (Indochine), gạch bông hoa văn, gỗ tự nhiên màu trầm, chi tiết cổ điển, quạt trần, gam trầm ấm hoài cổ",
  },
  {
    id: "neoclassic",
    label: "Tân cổ điển",
    hint: "phong cách tân cổ điển, phào chỉ trang nhã, bố cục đối xửng, vật liệu sang trọng, gam kem-trắng điểm vàng đồng",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    hint: "phong cách Scandinavian Bắc Âu, gỗ sáng màu, gam trắng chủ đạo, ấm cúng, nhiều ánh sáng tự nhiên",
  },
  {
    id: "minimal",
    label: "Tối giản",
    hint: "phong cách tối giản (minimalism), ít chi tiết, mặt phẳng sạch sẽ, gam đơn sắc, đề cao khoảng trống và ánh sáng",
  },
  {
    id: "japandi",
    label: "Japandi",
    hint: "phong cách Japandi (Nhật + Bắc Âu), mộc mạc tinh tế, gỗ ấm, gam tự nhiên, tối giản nhưng ấm áp",
  },
  {
    id: "luxury",
    label: "Sang trọng",
    hint: "phong cách sang trọng (luxury), đá marble vân lớn, kim loại mạ vàng/đồng, đèn trang trí pha lê, gam tương phản đẳng cấp",
  },
  {
    id: "industrial",
    label: "Industrial",
    hint: "phong cách công nghiệp (industrial), bê tông trần, gạch thô, đường ống lộ thiên, khung kim loại đen, gam xám-nâu",
  },
  {
    id: "tropical",
    label: "Nhiệt đới hiện đại",
    hint: "phong cách nhiệt đới hiện đại, nhiều cây xanh, gỗ và mây tre, không gian thông thoáng gần gũi thiên nhiên",
  },
  {
    id: "rustic",
    label: "Mộc mạc",
    hint: "phong cách mộc mạc (rustic), gỗ thô, đá tự nhiên, gam màu đất ấm, cảm giác đồng quê ấm cúng",
  },
  {
    id: "wabisabi",
    label: "Wabi-sabi",
    hint: "phong cách Wabi-sabi, mộc mạc thô ráp tự nhiên, vật liệu thật không hoàn hảo, gam màu đất, tĩnh lặng thiền vị",
  },
];

export function quickStyleHint(id: string): string {
  return QUICK_STYLES.find((s) => s.id === id)?.hint ?? "";
}

export interface QuickIdeaRequest {
  mode: QuickMode;
  /** Ảnh mặt bằng (bản vẽ 2D) — base64 thuần (không kèm tiền tố dataURL). */
  planImageBase64: string;
  planMime: string;
  /** Ảnh SketchUp — chỉ dùng ở chế độ "fidelity". */
  sceneImageBase64?: string;
  sceneMime?: string;
  /** Phong cách: id trong QUICK_STYLES, hoặc text tự gõ. */
  style: string;
  /** Ghi chú đơn giản của người dùng (vd "thêm đảo bếp", "tông ấm", "view ra cửa sổ lớn"). */
  notes?: string;
  model?: GeminiModelId;
}

/** Kết quả: một prompt render đầy đủ, sẵn để render (người dùng vẫn sửa được). */
export interface QuickIdeaResult {
  /** Tiêu đề ngắn tiếng Việt 3–6 từ. */
  title: string;
  /** Loại không gian AI nhận ra từ mặt bằng (vd "phòng khách", "bếp + ăn"). */
  spaceType: string;
  /** Prompt render đầy đủ bằng tiếng Việt — sẵn để đưa vào render. */
  prompt: string;
  /** Negative prompt (tiếng Việt). */
  negativePrompt: string;
}
