import { generateDossier } from "@/lib/dossier-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import type { DossierFormData } from "@/lib/dossier-types";

export async function POST(req: Request) {
  let body: DossierFormData;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (!body.projectName?.trim()) {
    return Response.json({ error: "Vui lòng nhập tên công trình" }, { status: 400 });
  }
  if (!body.concept?.trim()) {
    return Response.json({ error: "Vui lòng mô tả ý tưởng / yêu cầu chủ đạo" }, { status: 400 });
  }

  try {
    const result = await generateDossier(body);
    return Response.json(result);
  } catch (error) {
    console.error("Dossier error:", error);
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
