import { deleteProject, getProjectById, updateProject } from "@/lib/projects-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectById(id);
  if (!project) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }
  return Response.json(project);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const updated = updateProject(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    progress: typeof body.progress === "number" ? body.progress : undefined,
  });
  if (!updated) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }
  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteProject(id);
  if (!deleted) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
