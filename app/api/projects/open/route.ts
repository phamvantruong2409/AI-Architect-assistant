import { spawnSync } from "child_process";
import fs from "fs";
import { getProjectById } from "@/lib/projects-store";

export async function POST(request: Request) {
  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const project = getProjectById(id);

  if (!project?.folderPath) {
    return Response.json({ error: "Không tìm thấy thư mục dự án" }, { status: 404 });
  }

  try { fs.mkdirSync(project.folderPath, { recursive: true }); } catch { /* ignore */ }

  spawnSync("powershell", [
    "-NoProfile", "-NonInteractive", "-Command",
    `Start-Process -FilePath "explorer.exe" -ArgumentList "${project.folderPath.replace(/"/g, '""')}"`,
  ]);

  return Response.json({ ok: true });
}
