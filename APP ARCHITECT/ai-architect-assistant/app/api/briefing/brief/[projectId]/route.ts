import { getBriefById, deleteBrief, setBriefById } from "@/lib/briefing-store";
import { generateBriefFromSurvey } from "@/lib/briefing-gemini";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const record = await getBriefById(projectId);
  if (!record) {
    return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  return Response.json(record);
}

// KTS chủ động bấm tạo brief bằng AI từ đáp án khảo sát đã có.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const record = await getBriefById(projectId);
  if (!record) {
    return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  const answers = record.answers ?? {};
  if (Object.keys(answers).length === 0) {
    return Response.json({ error: "Khách hàng chưa hoàn thành khảo sát" }, { status: 400 });
  }

  try {
    const brief = await generateBriefFromSurvey(record.project_name, record.client_name, answers);
    await setBriefById(projectId, brief);
    return Response.json({ ok: true, brief });
  } catch (error) {
    console.error("Briefing generate error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const ok = await deleteBrief(projectId);
  return Response.json({ ok });
}
