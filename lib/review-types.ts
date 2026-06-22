import type { GeminiModelId } from "@/lib/gemini-models";

export interface ReviewRequest {
  imageBase64: string;
  mimeType: string;
  context: string;
  model: GeminiModelId;
}

export interface ReviewCriterion {
  /** Tên tiêu chí, ví dụ: "Ánh sáng", "Vật liệu". */
  name: string;
  /** Điểm 0-10. */
  score: number;
  /** Nhận xét ngắn cho tiêu chí. */
  comment: string;
}

export interface ReviewResult {
  /** Điểm tổng 0-100. */
  overallScore: number;
  /** Tóm tắt 2-3 câu. */
  summary: string;
  criteria: ReviewCriterion[];
  strengths: string[];
  improvements: string[];
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
