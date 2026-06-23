// Kiểu & hằng dùng chung cho module Render AI (SketchUp thô → ảnh thực tế).
// Hai backend: Gemini Image (miễn phí, đã wired) và Flux + ControlNet (cloud, giữ khối).

import type { GeminiModelId } from "@/lib/gemini-models";

/** Tối đa 8MB cho ảnh đầu vào. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Số ảnh tối đa cho một lần render. */
export const MAX_RENDER_IMAGES = 4;

/** Backend tạo sinh ảnh. */
export type RenderModelId = "gemini-image-pro" | "gemini-image" | "flux-controlnet";

export interface RenderModelInfo {
  id: RenderModelId;
  label: string;
  badge: string; // "Pro" | "Nhanh" | "Cloud"
  description: string;
  recommended?: boolean;
  /** Model id thật của Gemini image (chỉ với backend Gemini). */
  geminiModel?: string;
  /** true = engine cloud cần REPLICATE_API_TOKEN. */
  cloud?: boolean;
  /** Các khổ/độ phân giải hỗ trợ; phần tử đầu là mặc định. */
  resolutions: string[];
}

export const RENDER_MODELS: RenderModelInfo[] = [
  {
    id: "gemini-image-pro",
    label: "Nano Banana Pro (Gemini 3 Pro Image)",
    badge: "Pro",
    description:
      "Chất lượng render cao nhất của Gemini — giữ khối/bố cục sát, vật liệu & ánh sáng thực, độ phân giải cao. Là model trả phí (preview), chậm & tốn hơn bản Flash.",
    geminiModel: "gemini-3-pro-image-preview",
    recommended: true,
    resolutions: ["2K", "4K"],
  },
  {
    id: "gemini-image",
    label: "Nano Banana (Gemini 2.5 Flash Image)",
    badge: "Nhanh",
    description:
      "Bản nháp nhanh, rẻ — hợp để thử nhiều phương án trước khi render bản đẹp bằng Pro.",
    geminiModel: "gemini-2.5-flash-image",
    resolutions: ["1K"],
  },
  {
    id: "flux-controlnet",
    label: "Flux + ControlNet (giữ khối)",
    badge: "Cloud",
    description:
      "ControlNet khóa hình học từ nét/độ sâu của bản vẽ → giữ đúng khối nhất. Chạy cloud (Replicate), cần token & tốn credit/ảnh.",
    cloud: true,
    resolutions: ["2K", "4K", "8K"],
  },
];

export const DEFAULT_RENDER_MODEL: RenderModelId = "gemini-image-pro";

export function renderModelLabel(id: string): string {
  return RENDER_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Các khổ ảnh hỗ trợ của một model render (phần tử đầu = mặc định). */
export function modelResolutions(id: string): string[] {
  return RENDER_MODELS.find((m) => m.id === id)?.resolutions ?? ["1K"];
}

/** Map backend Gemini → model id thật; trả null nếu không phải backend Gemini. */
export function geminiImageModelId(id: string): string | null {
  return RENDER_MODELS.find((m) => m.id === id)?.geminiModel ?? null;
}

/** Góc view preset — kèm gợi ý prompt (EN) để ghép vào prompt render. */
export interface ViewAngle {
  id: string;
  label: string;
  promptHint: string;
}

export const VIEW_ANGLES: ViewAngle[] = [
  {
    id: "keep",
    label: "Giữ nguyên góc bản vẽ",
    promptHint:
      "giữ y nguyên góc camera, khung hình và bố cục như ảnh model gốc",
  },
  {
    id: "eye-level",
    label: "Ngang tầm mắt (2 điểm tụ)",
    promptHint:
      "phối cảnh 2 điểm tụ ngang tầm mắt người, các đường đứng giữ thẳng",
  },
  {
    id: "corner",
    label: "Phối cảnh góc",
    promptHint:
      "phối cảnh góc 3/4 thấy được hai mặt đứng, hơi nhìn từ dưới lên, ống kính kiến trúc góc rộng",
  },
  {
    id: "aerial",
    label: "Trên cao / chim bay",
    promptHint:
      "góc nhìn từ trên cao như chim bay/flycam, thấy toàn bộ khu đất và bối cảnh xung quanh",
  },
  {
    id: "bokeh",
    label: "Cận cảnh xóa phông (bokeh)",
    promptHint:
      "cảnh cận chi tiết, độ sâu trường ảnh nông, hậu cảnh xóa phông mịn (bokeh), ống kính 85mm, lấy nét vào vật liệu và bề mặt",
  },
  {
    id: "balcony",
    label: "Zoom vào ban công",
    promptHint:
      "khung cận cảnh tập trung vào ban công của công trình, thấy rõ lan can, vật liệu và chi tiết, độ sâu trường ảnh nông làm nổi ban công",
  },
  {
    id: "best-corner",
    label: "Zoom góc đẹp nhất",
    promptHint:
      "tự chọn góc/điểm nhấn kiến trúc đẹp nhất của công trình và lấy khung cận cảnh ấn tượng vào đó, bố cục đẹp, lấy nét vào chi tiết, hậu cảnh hơi xóa phông",
  },
  {
    id: "cinematic",
    label: "Điện ảnh (cinematic)",
    promptHint:
      "khung hình rộng kiểu điện ảnh, cảm giác ống kính anamorphic, ánh sáng kịch tính giàu cảm xúc, sương mờ không khí, tông màu phim",
  },
];

export function viewAngleLabel(id: string): string {
  return VIEW_ANGLES.find((a) => a.id === id)?.label ?? id;
}

/** Thời điểm trong ngày — người dùng chọn giờ, quyết định ánh sáng & bầu trời. */
export interface TimeOption {
  id: string;
  label: string;
  /** Mô tả ÁNH SÁNG của thời điểm (đưa vào prompt). */
  promptHint: string;
  /** Mô tả BẦU TRỜI khớp thời điểm — dùng để tự động cập nhật ô "Bầu trời". */
  sky: string;
}

export const TIME_OF_DAY: TimeOption[] = [
  { id: "auto", label: "Tự động (AI chọn)", promptHint: "", sky: "" },
  {
    id: "7h",
    label: "7h sáng sớm",
    promptHint:
      "ánh sáng sáng sớm khoảng 7h, nắng vàng dịu xiên thấp, có chút sương sớm, bóng đổ dài và mềm",
    sky: "bầu trời sáng sớm trong trẻo, hửng hồng-cam nhẹ phía chân trời, vài dải mây mỏng",
  },
  {
    id: "9h",
    label: "9h sáng",
    promptHint:
      "ánh sáng buổi sáng khoảng 9h, nắng trong trẻo tươi sáng, bóng đổ vừa phải",
    sky: "bầu trời ban ngày xanh tươi sáng, có vài dải mây trắng",
  },
  {
    id: "12h",
    label: "12h trưa",
    promptHint:
      "ánh sáng giữa trưa khoảng 12h, nắng từ trên cao, bóng đổ ngắn và rõ, tương phản mạnh",
    sky: "bầu trời trưa xanh sáng, nắng gắt, ít mây",
  },
  {
    id: "15h",
    label: "15h chiều",
    promptHint:
      "ánh sáng buổi chiều khoảng 15h, nắng ấm xiên nhẹ, bóng đổ dài hơn, không khí ấm dễ chịu",
    sky: "bầu trời chiều xanh ấm, mây nhẹ, ánh nắng ngả vàng",
  },
  {
    id: "17h",
    label: "17h hoàng hôn",
    promptHint:
      "ánh sáng hoàng hôn khoảng 17h (giờ vàng), nắng cam ấm xiên thấp, bóng đổ rất dài",
    sky: "bầu trời hoàng hôn ráng cam-hồng-tím rực rỡ, mây bắt sáng vàng cam",
  },
  {
    id: "19h",
    label: "19h lên đèn",
    promptHint:
      "thời điểm khoảng 19h tối đã lên đèn (giờ xanh), trời tối, đèn nội thất và ngoại thất hắt sáng ấm, công trình sáng đèn",
    sky: "bầu trời đêm xanh thẫm chuyển tím, le lói ánh đèn thành phố phía xa — KHÔNG phải trời sáng ban ngày",
  },
];

export function timeLabel(id: string): string {
  return TIME_OF_DAY.find((t) => t.id === id)?.label ?? id;
}

/** Nhận diện ô đề xuất là về BẦU TRỜI để đồng bộ theo thời điểm. */
export function isSkySuggestion(label: string): boolean {
  const l = label.toLowerCase();
  return l.includes("trời") || l.includes("thời tiết");
}

/** Nhận diện ô "người-xe-nội thất phụ" (entourage) — mặc định BỎ tích. */
export function isEntourageSuggestion(label: string): boolean {
  const l = label.toLowerCase();
  return l.includes("người") || l.includes("entourage");
}

/** Nhận diện ô "Bao cảnh" — hiển thị dạng dropdown chọn sẵn thay vì gõ tay. */
export function isSceneSuggestion(label: string): boolean {
  return label.toLowerCase().includes("bao cảnh");
}

/** Một lựa chọn bao cảnh sẵn cho dropdown. */
export interface SceneContextOption {
  id: string;
  /** Nhãn hiển thị trong dropdown. */
  label: string;
  /** Nội dung prompt (TIẾNG VIỆT) ghép vào khi chọn. */
  text: string;
}

/** ~10 bao cảnh dựng sẵn để người dùng bấm chọn nhanh. */
export const SCENE_CONTEXTS: SceneContextOption[] = [
  {
    id: "urban-townhouse",
    label: "Phố nhà liền kề Việt Nam",
    text: "bối cảnh phố Việt Nam với dãy nhà phố liền kề sát hai bên, vỉa hè lát gạch sạch sẽ, vài cây xanh ven đường",
  },
  {
    id: "modern-urban",
    label: "Khu đô thị hiện đại",
    text: "bối cảnh khu đô thị hiện đại, đường rộng thoáng, các tòa nhà lân cận tiết chế, cây xanh và vỉa hè gọn gàng",
  },
  {
    id: "quiet-residential",
    label: "Khu dân cư yên tĩnh nhiều cây",
    text: "khu dân cư yên tĩnh, đường nội bộ rợp bóng cây xanh, không gian thoáng đãng, ít xe cộ",
  },
  {
    id: "villa-garden",
    label: "Biệt thự sân vườn riêng",
    text: "công trình độc lập trong khuôn viên sân vườn riêng, hàng rào hợp phong cách, thảm cỏ và cây cảnh được chăm chút",
  },
  {
    id: "commercial-street",
    label: "Phố thương mại sầm uất",
    text: "bối cảnh tuyến phố thương mại sầm uất, biển hiệu cửa hàng tiết chế, vỉa hè đông vui có sức sống",
  },
  {
    id: "seaside",
    label: "Ven biển",
    text: "bối cảnh ven biển, hàng dừa và cây nhiệt đới, nắng gió biển, đường ven biển thoáng đãng phía xa",
  },
  {
    id: "lakeside",
    label: "Ven hồ / sông nước",
    text: "bối cảnh ven hồ hoặc sông, mặt nước phẳng phản chiếu, cây xanh và lối đi dạo ven nước",
  },
  {
    id: "countryside",
    label: "Đồng quê / nông thôn",
    text: "bối cảnh đồng quê Việt Nam, cánh đồng và cây cối tự nhiên, hàng rào thấp, không gian rộng yên bình",
  },
  {
    id: "mountain",
    label: "Đồi núi / cao nguyên",
    text: "bối cảnh đồi núi cao nguyên, rừng cây và sườn đồi xanh phía sau, sương nhẹ lãng đãng, thiên nhiên khoáng đạt",
  },
  {
    id: "greenery-park",
    label: "Khuôn viên cây xanh rộng",
    text: "công trình giữa khuôn viên nhiều cây xanh kiểu công viên hoặc resort, thảm cỏ rộng, lối đi và cây bóng mát",
  },
  {
    id: "minimal-studio",
    label: "Phông tối giản (studio)",
    text: "nền phông tối giản kiểu studio, không bối cảnh đô thị, làm nổi bật riêng khối kiến trúc",
  },
];

/** Một prompt đề xuất (toggle/sửa được) do AI tạo sinh ra. */
export interface RenderSuggestion {
  id: string;
  /** Nhãn ngắn tiếng Việt (vd "Vật liệu hoàn thiện"). */
  label: string;
  /** Nội dung prompt (EN) sẽ ghép vào prompt render. */
  text: string;
}

/** Kết quả phân tích ảnh SketchUp thô. */
export interface RenderAnalysis {
  /** Tiêu đề ngắn tiếng Việt (3–6 từ). */
  title: string;
  /** Mô tả nền TIẾNG VIỆT bám sát hình khối/bố cục/góc của bản vẽ — dùng làm gốc prompt. */
  analysisPrompt: string;
  /** 4–6 prompt nâng cấp đề xuất (vật liệu, ánh sáng, bầu trời, cây cối, hậu kỳ...). */
  suggestions: RenderSuggestion[];
  /** Id góc view AI cho là phù hợp (tham chiếu VIEW_ANGLES). */
  recommendedAngleIds: string[];
  /** Negative prompt gợi ý (EN). */
  negativePrompt: string;
}

export interface RenderAnalyzeRequest {
  imageBase64: string;
  mimeType: string;
  model: GeminiModelId;
}

/**
 * Render Optimizer — bước 1: KTS 20 năm kinh nghiệm ĐÁNH GIÁ ảnh render đã có
 * (thừa/thiếu, ánh sáng, vật liệu, bao cảnh, nên thêm gì). Người dùng sửa được đánh giá này.
 */
export interface RenderCritiqueRequest {
  imageBase64: string;
  mimeType: string;
  model: GeminiModelId;
}

export interface RenderCritique {
  /** Tiêu đề ngắn tiếng Việt (3–6 từ). */
  title: string;
  /** Bài đánh giá kiến trúc bằng tiếng Việt, nhiều mục, dạng text sửa được. */
  critique: string;
}

/**
 * Render Optimizer — bước 2: từ bài ĐÁNH GIÁ (đã được người dùng sửa) + ảnh gốc,
 * dựng prompt cải thiện + đề xuất + negative để render lại. Trả về RenderAnalysis.
 */
export interface RenderImproveRequest {
  imageBase64: string;
  mimeType: string;
  model: GeminiModelId;
  /** Bài đánh giá đã được người dùng chỉnh sửa. */
  critique: string;
}

/** Ghép prompt render cuối cùng từ phân tích + đề xuất đã bật + góc view. */
export function buildRenderPrompt(opts: {
  analysisPrompt: string;
  enabledSuggestions: RenderSuggestion[];
  angleHint?: string;
  timeHint?: string;
}): string {
  const parts = [opts.analysisPrompt.trim()];
  for (const s of opts.enabledSuggestions) {
    if (s.text.trim()) parts.push(s.text.trim());
  }
  if (opts.timeHint?.trim()) parts.push(`Thời điểm & ánh sáng: ${opts.timeHint.trim()}.`);
  if (opts.angleHint?.trim()) parts.push(`Góc máy & khung hình: ${opts.angleHint.trim()}.`);
  parts.push("Ảnh render chân thực, chi tiết cao, màu tự nhiên.");
  return parts.filter(Boolean).join(" ");
}
