import { deleteProject, getProjectById } from "@/lib/projects-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectById(id);
  if (!project) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }
  return Response.json(project);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = deleteProject(id);
  if (!deleted) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
