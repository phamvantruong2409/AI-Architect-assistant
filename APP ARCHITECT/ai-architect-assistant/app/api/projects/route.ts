import { getProjects, createProject } from "@/lib/projects-store";

export async function GET() {
  try {
    return Response.json(getProjects());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải danh sách dự án" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";

  if (!name) {
    return Response.json({ error: "Tên dự án không được để trống" }, { status: 400 });
  }

  try {
    const project = createProject({ name, type });
    return Response.json(project, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo dự án" },
      { status: 500 }
    );
  }
}
