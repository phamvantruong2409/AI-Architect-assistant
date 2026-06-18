import { listBriefs, createBrief } from "@/lib/briefing-store";

export async function GET() {
  try {
    return Response.json(await listBriefs());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Lỗi tải dữ liệu" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { project_name?: string; client_name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const project_name = typeof body.project_name === "string" ? body.project_name.trim() : "";
  const client_name = typeof body.client_name === "string" ? body.client_name.trim() : "";
  if (!project_name || !client_name) {
    return Response.json({ error: "Thiếu tên dự án hoặc tên khách hàng" }, { status: 400 });
  }

  try {
    const project = await createBrief(project_name, client_name);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tạo dự án" }, { status: 500 });
  }
}
