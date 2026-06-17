import type { GeminiModelId } from "@/lib/gemini-models";

export type RenderEngine =
  | "d5"
  | "lumion"
  | "enscape"
  | "vray"
  | "midjourney"
  | "stable_diffusion";

export interface PromptRenderFormData {
  subject: string;
  space: string;
  style: string;
  timeOfDay: string;
  mood: string;
  details: string;
  engine: RenderEngine;
  model: GeminiModelId;
}

export interface PromptRenderResult {
  /** Prompt chính bằng tiếng Anh, tối ưu cho engine đã chọn. */
  prompt: string;
  /** Negative prompt (rỗng với engine không hỗ trợ). */
  negativePrompt: string;
  /** Các thông số / mẹo thiết lập cho engine (mỗi mục 1 dòng). */
  settings: string[];
  /** Giải thích ngắn (tiếng Việt) vì sao prompt được xây như vậy. */
  notes: string;
}

export const RENDER_ENGINES: { value: RenderEngine; label: string; supportsNegative: boolean }[] = [
  { value: "d5", label: "D5 Render", supportsNegative: false },
  { value: "lumion", label: "Lumion", supportsNegative: false },
  { value: "enscape", label: "Enscape", supportsNegative: false },
  { value: "vray", label: "V-Ray", supportsNegative: false },
  { value: "midjourney", label: "Midjourney", supportsNegative: false },
  { value: "stable_diffusion", label: "Stable Diffusion / ComfyUI", supportsNegative: true },
];

export const SPACE_OPTIONS: string[] = [
  "Ngoại thất / Mặt đứng",
  "Phối cảnh tổng thể",
  "Phòng khách",
  "Phòng ngủ",
  "Bếp + ăn",
  "Phòng tắm",
  "Sảnh / Lobby",
  "Văn phòng",
  "Quán café / Nhà hàng",
  "Cảnh quan / Sân vườn",
];

export const TIME_OPTIONS: string[] = [
  "Bình minh",
  "Ban ngày nắng",
  "Hoàng hôn (golden hour)",
  "Xanh giờ (blue hour)",
  "Ban đêm",
  "Trời nhiều mây",
];

export const MOOD_OPTIONS: string[] = [
  "Sang trọng, ấm cúng",
  "Tối giản, tinh tế",
  "Nhiệt đới, tươi mát",
  "Hiện đại, mạnh mẽ",
  "Cinematic, kịch tính",
  "Yên tĩnh, thư giãn",
];
