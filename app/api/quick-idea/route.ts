// Ý tưởng nhanh từ MB — phân tích ảnh mặt bằng (+ tuỳ chọn ảnh SketchUp) + phong cách
// + ghi chú → trả về prompt render đầy đủ. Render thật vẫn dùng /api/render/generate.

import { analyzeQuickIdea } from "@/lib/quick-idea";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { QuickIdeaRequest } from "@/lib/quick-idea-types";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: Partial<QuickIdeaRequest>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (typeof body.planImageBase64 !== "string" || !body.planImageBase64.trim()) {
    return Response.json({ error: "Vui lòng đưa ảnh mặt bằng vào" }, { status: 400 });
  }
  const mode = body.mode === "fidelity" ? "fidelity" : "concept";
  if (mode === "fidelity" && (typeof body.sceneImageBase64 !== "string" || !body.sceneImageBase64.trim())) {
    return Response.json(
      { error: "Chế độ Bám thiết kế cần thêm ảnh SketchUp" },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeQuickIdea({
      mode,
      planImageBase64: body.planImageBase64,
      planMime: body.planMime || "image/jpeg",
      sceneImageBase64: body.sceneImageBase64,
      sceneMime: body.sceneMime || "image/jpeg",
      style: typeof body.style === "string" ? body.style : "",
      notes: typeof body.notes === "string" ? body.notes : "",
      model: body.model,
    });
    return Response.json(result);
  } catch (error) {
    console.error("Quick idea error:", error);
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
