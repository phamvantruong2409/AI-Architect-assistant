import { getGeminiApiKey, setGeminiApiKey } from "@/lib/settings-store";

// GET: chỉ cho biết đã có key hay chưa — KHÔNG trả về key thật.
export async function GET() {
  return Response.json({ hasKey: getGeminiApiKey().length > 0 });
}

// Kiểm tra key bằng endpoint models (không tốn token), phân biệt sai/lỗi-mạng.
async function checkKey(key: string): Promise<"valid" | "invalid" | "network"> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`
    );
    return res.ok ? "valid" : "invalid";
  } catch {
    return "network";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (apiKey) {
      const status = await checkKey(apiKey);
      if (status === "invalid") {
        return Response.json(
          { error: "API key không hợp lệ. Vui lòng kiểm tra lại key tại Google AI Studio." },
          { status: 400 }
        );
      }
      if (status === "network") {
        return Response.json(
          { error: "Không kiểm tra được API key (lỗi mạng). Vui lòng thử lại." },
          { status: 503 }
        );
      }
    }

    setGeminiApiKey(apiKey);
    return Response.json({ hasKey: apiKey.length > 0 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể lưu API key" },
      { status: 500 }
    );
  }
}
