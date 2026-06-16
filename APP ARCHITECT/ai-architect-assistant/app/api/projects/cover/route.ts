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

  const buffer = Buffer.from(await file.arrayBuffer());
  const project = saveCoverImage(id, buffer, file.name);
  if (!project) {
    return Response.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  return Response.json(project);
}
