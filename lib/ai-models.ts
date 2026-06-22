import {
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  type GeminiModelId,
} from "./gemini-models";

// DeepSeek V4 (API tương thích OpenAI). Bản "pro" là model mạnh nhất, mặc định
// bật chế độ suy luận (thinking). Lưu ý: tên cũ deepseek-reasoner/deepseek-chat
// sẽ ngừng hỗ trợ 24/07/2026 — dùng tên v4 mới.
export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro (suy luận mạnh)" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash (nhanh)" },
] as const;

export type DeepSeekModelId = (typeof DEEPSEEK_MODELS)[number]["id"];

// Tất cả model text — dùng cho CHAT (đủ cả pro + flash) và để tra cứu provider/nhãn.
export const AI_MODELS = [...GEMINI_MODELS, ...DEEPSEEK_MODELS] as const;

// Model cho tác vụ tài liệu (thuyết minh): chỉ Gemini + DeepSeek Pro.
export const DOC_MODELS = [...GEMINI_MODELS, DEEPSEEK_MODELS[0]] as const;

// Model cho "Nhiệm vụ thiết kế" (sinh brief, chỉ-text): Gemini + cả DeepSeek Pro & Flash.
export const BRIEF_MODELS = [...GEMINI_MODELS, ...DEEPSEEK_MODELS] as const;

export type AiModelId = GeminiModelId | DeepSeekModelId;

/** Model mặc định cho khung CHAT — DeepSeek V4 Flash (nhanh). */
export const DEFAULT_CHAT_MODEL: AiModelId = "deepseek-v4-flash";

/** Xác định nhà cung cấp dựa trên model id để route đúng client. */
export function getProvider(modelId?: string): "gemini" | "deepseek" {
  return DEEPSEEK_MODELS.some((m) => m.id === modelId) ? "deepseek" : "gemini";
}

export { GEMINI_MODELS, DEFAULT_GEMINI_MODEL };
export type { GeminiModelId };
