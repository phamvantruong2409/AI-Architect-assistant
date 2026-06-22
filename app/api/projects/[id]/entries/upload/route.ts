import { saveUploadedFile, getProjectById } from "@/lib/projects-store";
import type { ProjectEntry } from "@/lib/projects-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProjectById(id)) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const formData = await request.formData();
  const targetPath = typeof formData.get("path") === "string" ? String(formData.get("path")) : "";
  const count = Number(formData.get("count") ?? "0");

  const entries: ProjectEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    const file = formData.get(`file_${i}`);
    const relPath = formData.get(`path_${i}`);
    if (!(file instanceof File) || typeof relPath !== "string") continue;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      entries.push(saveUploadedFile(id, targetPath, relPath, buffer));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Không thể tải lên file");
    }
  }

  return Response.json({ entries, errors });
}
