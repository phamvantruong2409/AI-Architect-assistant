import type { GeminiModelId } from "@/lib/gemini-models";

/** Tối đa 8MB — đồng bộ với trang Đánh giá Render. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Engine đích cho tính năng Ảnh → Prompt (độc lập với trang Prompt Render). */
export type ImagePromptEngine =
  | "d5"
  | "corona"
  | "vray"
  | "realistic"
  | "sketch"
  | "midjourney"
  | "stable_diffusion";

export const IMAGE_PROMPT_ENGINES: { value: ImagePromptEngine; label: string }[] = [
  { value: "d5", label: "D5 Render" },
  { value: "corona", label: "Corona" },
  { value: "vray", label: "V-Ray" },
  { value: "realistic", label: "Thực tế" },
  { value: "sketch", label: "Sketch (Ký hoạ)" },
  { value: "midjourney", label: "Midjourney" },
  { value: "stable_diffusion", label: "Stable Diffusion / ComfyUI" },
];

export interface ImagePromptRequest {
  /** Ảnh dạng base64 (không kèm tiền tố data:). */
  imageBase64: string;
  mimeType: string;
  /** Engine đích để tối ưu cú pháp prompt. */
  engine: ImagePromptEngine;
  model: GeminiModelId;
}

/** Phân rã prompt theo từng nhóm thị giác (forensic). */
export interface ImagePromptJson {
  /** Chủ thể chính: loại công trình/không gian, số tầng, quy mô. */
  subject: string;
  /** Vật liệu & bề mặt nhìn thấy. */
  materials: string[];
  /** Ánh sáng: hướng, nguồn, độ tương phản, nhiệt màu, không khí. */
  lighting: string;
  /** Bố cục & camera: góc, tiêu cự, khoảng cách, đường dẫn mắt. */
  composition: string;
  /** Phong cách & cảm giác ống kính / chất liệu render. */
  styleCamera: string;
  /** Môi trường, hậu cảnh, cảnh quan, entourage. */
  environment: string;
  /** Bảng màu chủ đạo. */
  colors: string[];
  /** Tỉ lệ khung hình ước lượng, ví dụ "16:9". */
  aspectRatio: string;
}

export interface ImagePromptResult {
  /** Tiêu đề ngắn bằng tiếng Việt (3–6 từ) để hiển thị/đặt tên mục. */
  title: string;
  /** Prompt THUẦN tiếng Anh, dày đặc chi tiết, dùng trực tiếp để render. */
  prompt: string;
  /** Prompt THUẦN tiếng Việt (cùng nội dung, viết hẳn bằng tiếng Việt, dùng được như prompt). */
  promptVi: string;
  /** Negative prompt (rỗng với engine không hỗ trợ). */
  negativePrompt: string;
  /** Phân rã có cấu trúc. */
  json: ImagePromptJson;
  /** 4 thẻ phong cách ngắn (EN) cho UI dạng pill. */
  styleTags: string[];
  /** Ghi chú ngắn tiếng Việt: vì sao đọc ra prompt như vậy / điểm chưa chắc. */
  notes: string;
}
