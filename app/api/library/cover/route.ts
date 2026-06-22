import { saveLibraryCover } from "@/lib/library-store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Thiếu file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "File phải là ảnh" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const info = saveLibraryCover(buffer, file.name);
  return Response.json(info);
}
