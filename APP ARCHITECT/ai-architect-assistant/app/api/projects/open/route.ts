import { spawn } from "child_process";
import { getProjectById } from "@/lib/projects-store";

export async function POST(request: Request) {
  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const project = getProjectById(id);

  if (!project?.folderPath) {
    return Response.json({ error: "Không tìm thấy thư mục dự án" }, { status: 404 });
  }

  spawn("explorer", [project.folderPath], { detached: true }).unref();
  return Response.json({ ok: true });
}
