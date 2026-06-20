import { critiqueForOptimize } from "@/lib/render-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { RenderCritiqueRequest } from "@/lib/render-types";

export async function POST(req: Request) {
  let body: Partial<RenderCritiqueRequest>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    return Response.json({ error: "Vui lòng đưa ảnh vào để đánh giá" }, { status: 400 });
  }

  try {
    const critique = await critiqueForOptimize({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType || "image/jpeg",
      model: (body.model as RenderCritiqueRequest["model"]) || "gemini-3-flash-preview",
    });
    return Response.json(critique);
  } catch (error) {
    console.error("Render critique error:", error);
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
