import { renameEntry, getProjectById } from "@/lib/projects-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProjectById(id)) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const body = await request.json();
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const entry = renameEntry(id, path, name);
    return Response.json(entry);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể đổi tên" },
      { status: 400 }
    );
  }
}
