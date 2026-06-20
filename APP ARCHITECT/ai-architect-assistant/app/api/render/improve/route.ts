import { improveForOptimize } from "@/lib/render-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { RenderImproveRequest } from "@/lib/render-types";

export async function POST(req: Request) {
  let body: Partial<RenderImproveRequest>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    return Response.json({ error: "Thiếu ảnh gốc để tạo prompt" }, { status: 400 });
  }
  if (typeof body.critique !== "string" || !body.critique.trim()) {
    return Response.json({ error: "Thiếu phần đánh giá để tạo prompt cải thiện" }, { status: 400 });
  }

  try {
    const analysis = await improveForOptimize({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType || "image/jpeg",
      model: (body.model as RenderImproveRequest["model"]) || "gemini-3-flash-preview",
      critique: body.critique,
    });
    return Response.json(analysis);
  } catch (error) {
    console.error("Render improve error:", error);
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
