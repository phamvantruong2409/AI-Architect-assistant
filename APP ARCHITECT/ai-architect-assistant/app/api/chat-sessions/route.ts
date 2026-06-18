import { getSessions, upsertSession } from "@/lib/chat-sessions-store";

export async function GET() {
  return Response.json(getSessions());
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const sessionPath = typeof body.path === "string" ? body.path : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!id) {
    return Response.json({ error: "Thiếu id" }, { status: 400 });
  }

  const session = upsertSession({ id, path: sessionPath, messages });
  return Response.json(session);
}
