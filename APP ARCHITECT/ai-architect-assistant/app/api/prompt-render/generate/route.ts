import { generateRenderPrompt } from "@/lib/prompt-render-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { PromptRenderFormData } from "@/lib/prompt-render-types";

export async function POST(req: Request) {
  let body: PromptRenderFormData;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (!body.subject?.trim()) {
    return Response.json({ error: "Vui lòng mô tả đối tượng / công trình cần render" }, { status: 400 });
  }

  try {
    const result = await generateRenderPrompt(body);
    return Response.json(result);
  } catch (error) {
    console.error("Prompt render error:", error);
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "AI trả về dữ liệu không đọc được. Vui lòng thử lại hoặc đổi model." },
        { status: 502 }
      );
    }
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }
}
