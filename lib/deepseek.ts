// API DeepSeek tương thích OpenAI. Chi phí do NHÀ PHÁT TRIỂN trả — người dùng cuối
// KHÔNG nhập key. Key được NHÚNG SẴN trong app (EMBEDDED_DEEPSEEK_KEY) nên mọi bản
// build/update đều có sẵn, build ở máy nào cũng kèm key. Vẫn ưu tiên biến môi trường
// DEEPSEEK_API_KEY (đặt trong .env.local) để đổi key mà không phải sửa code.
const BASE_URL = "https://api.deepseek.com/v1";

// Key nhúng mặc định — gắn liền với app qua mọi bản phát hành/cập nhật.
// LƯU Ý: key này nằm trong mã nguồn & trong file .exe phân phối, nên xem như công
// khai với người có app/repo. Nếu repo phát hành ở chế độ PUBLIC, key sẽ lộ công khai
// (GitHub/DeepSeek có thể tự thu hồi). Khi cần đổi key: sửa hằng này hoặc đặt
// DEEPSEEK_API_KEY trong .env.local.
const EMBEDDED_DEEPSEEK_KEY = "sk-dcf9407a0b53464eb48a60c8214cc6b9";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Tham số suy luận theo model. Bản "flash" = NHANH → TẮT thinking để trả lời ngay
 * (nếu bật, model V4 stream cả khối reasoning_content dài trước khi ra câu trả lời,
 * mà app bỏ qua phần này nên chat trông như bị treo vài giây). Bản "pro" giữ suy luận.
 */
function thinkingParams(model: string): Record<string, unknown> {
  return model.includes("flash") ? { thinking: { type: "disabled" } } : {};
}

function getApiKey(): string {
  // Ưu tiên env (dev đổi key nhanh), fallback về key nhúng sẵn trong app.
  const key = process.env.DEEPSEEK_API_KEY || EMBEDDED_DEEPSEEK_KEY;
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

/** Tạo sinh văn bản một lần (không stream). Dùng cho thuyết minh, brief khảo sát. */
export async function deepseekGenerateText(opts: {
  model: string;
  prompt: string;
  system?: string;
}): Promise<string> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await postChat({ model: opts.model, messages, stream: false, ...thinkingParams(opts.model) });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").toString();
}

/**
 * Tạo sinh văn bản một lần (không stream) từ NHIỀU lượt hội thoại (system + lịch sử).
 * Dùng cho hỏi-đáp RAG thư viện tài liệu — trả `message.content`, bỏ qua phần
 * `reasoning_content` (suy luận) của bản pro.
 */
export async function deepseekGenerateChat(opts: {
  model: string;
  system?: string;
  messages: DeepSeekMessage[];
}): Promise<string> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push(...opts.messages);

  const res = await postChat({ model: opts.model, messages, stream: false, ...thinkingParams(opts.model) });
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

  const res = await postChat({ model: opts.model, messages, stream: true, ...thinkingParams(opts.model) });
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
