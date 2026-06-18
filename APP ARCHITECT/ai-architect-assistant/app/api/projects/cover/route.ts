import { saveCoverImage } from "@/lib/projects-store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const id = formData.get("id");
  const file = formData.get("file");

  if (typeof id !== "string" || !id || !(file instanceof File)) {
    return Response.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "File phải là ảnh" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return Response.json({ error: "Không thể đọc file" }, { status: 400 });
  }

  let project;
  try {
    project = saveCoverImage(id, buffer, file.name);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể lưu ảnh bìa" },
      { status: 500 }
    );
  }

  if (!project) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  return Response.json(project);
}
