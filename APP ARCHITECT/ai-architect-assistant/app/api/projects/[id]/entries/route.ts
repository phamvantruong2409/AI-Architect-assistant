import { createEntryFolder, listEntries, getProjectById } from "@/lib/projects-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProjectById(id)) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  return Response.json(listEntries(id, path));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getProjectById(id)) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const body = await request.json();
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const folder = createEntryFolder(id, path, name);
    return Response.json(folder, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo thư mục" },
      { status: 400 }
    );
  }
}
