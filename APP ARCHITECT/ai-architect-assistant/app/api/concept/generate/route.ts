import { generateConcepts } from "@/lib/concept-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { ProjectBrief } from "@/types/concept";

export async function POST(req: Request) {
  let body: { brief?: ProjectBrief; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const brief = body.brief;
  if (!brief || (!brief.type?.trim() && !brief.description?.trim())) {
    return Response.json(
      { error: "Vui lòng nhập loại công trình hoặc mô tả dự án" },
      { status: 400 }
    );
  }

  try {
    const concepts = await generateConcepts(brief, body.model);
    return Response.json({ concepts });
  } catch (error) {
    console.error("Concept error:", error);
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
