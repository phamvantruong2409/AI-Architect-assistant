// API DeepSeek tương thích OpenAI. Key do NHÀ PHÁT TRIỂN cung cấp qua biến môi
// trường DEEPSEEK_API_KEY (đặt trong .env.local, được bundle theo bản .exe).
// Người dùng cuối KHÔNG nhập key DeepSeek — chi phí do nhà phát triển trả.
const BASE_URL = "https://api.deepseek.com/v1";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY || "";
  if (!key) {
    const err = new Error("Chưa cấu hình API key DeepSeek.") as Error & { code?: string };
    err.code = "NO_API_KEY";
    throw err;
  }
  return key;
}

/**
 * Gọi /chat/completions, tự thử lại với lỗi server tạm thời (5xx) và lỗi mạng.
 * Lỗi client (4xx) ném ngay kèm `status` để map thông báo cho người dùng.
 */
async function postChat(
  body: Record<string, unknown>,
  retries = 3
): Promise<Response> {
  const key = getApiKey();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      const detail = await res.text().catch(() => "");
      const err = new Error(
        `DeepSeek API ${res.status}: ${detail.slice(0, 300)}`
      ) as Error & { status?: number };
      err.status = res.status;
      throw err;
    } catch (e) {
      lastErr = e;
      if ((e as { status?: number })?.status) throw e; // lỗi HTTP đã rõ — không thử lại
      if (attempt === retries) throw e; // lỗi mạng — hết lượt thử
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Sinh văn bản một lần (không stream). Dùng cho thuyết minh, brief khảo sát. */
export async function deepseekGenerateText(opts: {
  model: string;
  prompt: string;
  system?: string;
}): Promise<string> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await postChat({ model: opts.model, messages, stream: false });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").toString();
}

/**
 * Stream câu trả lời (chỉ `delta.content`, bỏ qua `reasoning_content`) dưới dạng
 * text thuần — khớp với định dạng stream Gemini mà client chat đang đọc.
 */
export async function deepseekStreamText(opts: {
  model: string;
  system?: string;
  messages: DeepSeekMessage[];
}): Promise<ReadableStream<Uint8Array>> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push(...opts.messages);

  const res = await postChat({ model: opts.model, messages, stream: true });
  const body = res.body;
  if (!body) throw new Error("DeepSeek không trả về stream");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // giữ lại dòng chưa trọn vẹn cho lần sau
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const text = json.choices?.[0]?.delta?.content;
          if (text) controller.enqueue(encoder.encode(text));
        } catch {
          // bỏ qua dòng keep-alive / không phải JSON
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export function deepseekErrorCode(
  error: unknown
): "NO_API_KEY" | "QUOTA_EXCEEDED" | "AUTH_ERROR" | "UNKNOWN" {
  if ((error as { code?: string })?.code === "NO_API_KEY") return "NO_API_KEY";
  const status = (error as { status?: number })?.status;
  if (status === 429 || status === 402) return "QUOTA_EXCEEDED"; // 402: hết số dư
  if (status === 401 || status === 403) return "AUTH_ERROR";
  return "UNKNOWN";
}

export function deepseekErrorMessage(error: unknown): string {
  switch (deepseekErrorCode(error)) {
    case "NO_API_KEY":
      return "Chưa cấu hình API key DeepSeek (thiếu DEEPSEEK_API_KEY). Vui lòng thêm key hoặc chọn model Gemini.";
    case "QUOTA_EXCEEDED":
      return "DeepSeek đã hết hạn mức hoặc hết số dư tài khoản. Vui lòng nạp thêm hoặc thử lại sau.";
    case "AUTH_ERROR":
      return "API key DeepSeek không hợp lệ hoặc không có quyền truy cập model này.";
    default:
      return "Không thể kết nối với DeepSeek. Vui lòng thử lại.";
  }
}
