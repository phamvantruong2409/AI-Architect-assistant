import fs from "fs";
import { spawn } from "child_process";
import { getEntryAbsolutePath, getProjectById } from "@/lib/projects-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProjectById(id)) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const body = await request.json();
  const relPath = typeof body.path === "string" ? body.path : "";
  const absPath = getEntryAbsolutePath(id, relPath);

  if (!absPath || !fs.existsSync(absPath)) {
    return Response.json({ error: "Không tìm thấy mục này" }, { status: 404 });
  }

  // "start" launches the file with its registered default application;
  // "explorer <file>" would only open the containing folder instead.
  spawn("cmd", ["/c", "start", "", absPath], { detached: true, shell: false }).unref();
  return Response.json({ ok: true });
}
