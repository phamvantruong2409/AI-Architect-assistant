import { getSessionById, deleteSession } from "@/lib/chat-sessions-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSessionById(id);
  if (!session) {
    return Response.json({ error: "Không tìm thấy cuộc trò chuyện" }, { status: 404 });
  }
  return Response.json(session);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteSession(id);
  if (!ok) {
    return Response.json({ error: "Không tìm thấy cuộc trò chuyện" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
