import { GoogleGenerativeAI, type GenerativeModel, type GenerateContentResult } from "@google/generative-ai";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, type GeminiModelId } from "@/lib/gemini-models";
import { getGeminiApiKey } from "@/lib/settings-store";

function getGenAI(): GoogleGenerativeAI {
  // Gemini ĐƯỢC KHOÁ theo key do NGƯỜI DÙNG nhập (lưu trong settings, KHÔNG nhúng
  // vào .exe). KHÔNG fallback về biến môi trường: tránh nguy cơ key của nhà phát triển
  // bị gói vào bản build và để mọi người xài ké quota. Chưa nhập key → mọi tính năng
  // Gemini báo "hãy nhập key" (xem lib/gemini-error.ts → NO_API_KEY).
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const err = new Error("Chưa có API key Gemini.") as Error & { code?: string };
    err.code = "NO_API_KEY";
    throw err;
  }
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiModel(modelId?: string) {
  const genAI = getGenAI();
  const id = GEMINI_MODELS.some((m) => m.id === modelId)
    ? (modelId as GeminiModelId)
    : DEFAULT_GEMINI_MODEL;

  // Tắt "thinking" cho Gemini 2.5 Flash (model phụ) để tiết kiệm token — budget 0.
  // Gemini 3 Flash (mặc định) giữ thinking: đo thực tế cho thấy nó nghĩ ít mà
  // vẫn nhanh hơn và trả lời chính xác hơn, nên không tắt.
  // thinkingConfig chưa có trong type của SDK 0.24.1 nhưng vẫn được gửi xuống REST API.
  const generationConfig = id.includes("2.5-flash")
    ? ({ thinkingConfig: { thinkingBudget: 0 } } as Record<string, unknown>)
    : undefined;

  return genAI.getGenerativeModel({ model: id, generationConfig });
}

export function getGeminiImageModel(
  modelId = "gemini-2.5-flash-image",
  generationConfig?: Record<string, unknown>
) {
  // imageConfig (chọn khổ/độ phân giải) chưa có trong type SDK 0.24.1 nhưng vẫn
  // được gửi xuống REST API — cast để truyền qua.
  return getGenAI().getGenerativeModel({
    model: modelId,
    generationConfig: generationConfig as Record<string, never> | undefined,
  });
}

export function getGeminiEmbeddingModel() {
  return getGenAI().getGenerativeModel({ model: "text-embedding-004" });
}

/**
 * Gọi generateContent có tự thử lại khi model trả lỗi server tạm thời
 * (503 "high demand", 500/502). KHÔNG thử lại lỗi 429 (hết quota) vì không phục hồi nhanh.
 */
export async function generateContentRetry(
  model: GenerativeModel,
  request: Parameters<GenerativeModel["generateContent"]>[0],
  retries = 3
): Promise<GenerateContentResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (!status || status < 500 || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}
