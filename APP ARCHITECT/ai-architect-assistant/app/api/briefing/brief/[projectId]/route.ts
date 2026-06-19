import { getBriefById, deleteBrief, setBriefById, saveBriefDetail, getBriefDetail } from "@/lib/briefing-store";
import { generateDesignTaskFromDetail } from "@/lib/briefing-gemini";
import { aiErrorCode, aiErrorMessage } from "@/lib/ai";

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

// KTS lưu thông tin chi tiết tự nhập.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const record = await getBriefById(projectId);
  if (!record) {
    return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const detail = typeof body?.detail === "string" ? body.detail : "";

  try {
    await saveBriefDetail(projectId, detail);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Briefing save detail error:", error);
    return Response.json({ error: "Không lưu được thông tin, vui lòng thử lại" }, { status: 500 });
  }
}

// KTS bấm "AI đề xuất nhiệm vụ thiết kế" từ thông tin chi tiết đã nhập.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const record = await getBriefById(projectId);
  if (!record) {
    return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const model = typeof body?.model === "string" ? body.model : undefined;
  // Cho phép gửi kèm thông tin mới nhất để lưu trước khi sinh.
  const detail = typeof body?.detail === "string" ? body.detail : getBriefDetail(record);
  if (!detail.trim()) {
    return Response.json({ error: "Hãy nhập thông tin chi tiết trước khi đề xuất" }, { status: 400 });
  }

  try {
    await saveBriefDetail(projectId, detail);
    const brief = await generateDesignTaskFromDetail(
      record.project_name,
      record.client_name,
      detail,
      model
    );
    await setBriefById(projectId, brief);
    return Response.json({ ok: true, brief });
  } catch (error) {
    console.error("Design task generate error:", error);
    return Response.json(
      { error: aiErrorMessage(error, model), code: aiErrorCode(error, model) },
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
