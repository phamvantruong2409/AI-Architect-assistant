import { getBriefByToken, saveSurveyAnswers, type SurveyAnswers } from "@/lib/briefing-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const record = await getBriefByToken(token);
  if (!record) {
    return Response.json({ error: "Không tìm thấy khảo sát" }, { status: 404 });
  }
  return Response.json({
    project: { project_name: record.project_name, client_name: record.client_name },
    completed: record.status === "completed",
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const record = await getBriefByToken(token);
  if (!record) {
    return Response.json({ error: "Không tìm thấy khảo sát" }, { status: 404 });
  }

  let body: { answers?: SurveyAnswers };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const answers = body.answers ?? {};

  // Chỉ lưu đáp án và phản hồi NGAY cho khách (không gọi Gemini).
  // Brief do kiến trúc sư tự bấm tạo sau (POST /api/briefing/brief/[id]) nếu cần.
  try {
    await saveSurveyAnswers(token, answers);
  } catch (error) {
    console.error("Briefing save answers error:", error);
    return Response.json({ error: "Không lưu được khảo sát, vui lòng thử lại" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
