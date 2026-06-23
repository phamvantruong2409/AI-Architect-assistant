import { getGeminiModel, generateContentRetry } from "./gemini";
import { getProvider } from "./ai-models";
import {
  deepseekGenerateText,
  deepseekErrorCode,
  deepseekErrorMessage,
} from "./deepseek";
import { geminiErrorCode, geminiErrorMessage } from "./gemini-error";

/**
 * Tạo sinh văn bản (không stream) qua provider tương ứng với model id.
 * Dùng cho các tác vụ chỉ-text: thuyết minh (dossier), phân tích brief khảo sát.
 */
export async function generateTextLLM(opts: {
  model?: string;
  prompt: string;
  system?: string;
}): Promise<string> {
  if (getProvider(opts.model) === "deepseek") {
    return deepseekGenerateText({
      model: opts.model as string,
      prompt: opts.prompt,
      system: opts.system,
    });
  }
  const model = getGeminiModel(opts.model);
  const fullPrompt = opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt;
  const result = await generateContentRetry(model, fullPrompt);
  return result.response.text();
}

/** Mã lỗi và thông báo theo đúng provider của model đang dùng. */
export function aiErrorCode(error: unknown, model?: string) {
  return getProvider(model) === "deepseek"
    ? deepseekErrorCode(error)
    : geminiErrorCode(error);
}

export function aiErrorMessage(error: unknown, model?: string): string {
  return getProvider(model) === "deepseek"
    ? deepseekErrorMessage(error)
    : geminiErrorMessage(error);
}
