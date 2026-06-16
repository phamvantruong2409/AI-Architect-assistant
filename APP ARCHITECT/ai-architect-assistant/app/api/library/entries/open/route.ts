import fs from "fs";
import { spawn } from "child_process";
import { getEntryAbsolutePath } from "@/lib/library-store";

export async function POST(request: Request) {
  const body = await request.json();
  const relPath = typeof body.path === "string" ? body.path : "";
  const absPath = getEntryAbsolutePath(relPath);

  if (!absPath || !fs.existsSync(absPath)) {
    return Response.json({ error: "Không tìm thấy mục này" }, { status: 404 });
  }

  spawn("cmd", ["/c", "start", "", absPath], { detached: true, shell: false }).unref();
  return Response.json({ ok: true });
}
