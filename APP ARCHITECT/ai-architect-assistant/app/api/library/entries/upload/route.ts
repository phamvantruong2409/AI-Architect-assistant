import { saveUploadedFile } from "@/lib/library-store";
import type { LibraryEntry } from "@/lib/library-store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const targetPath = typeof formData.get("path") === "string" ? String(formData.get("path")) : "";
  const count = Number(formData.get("count") ?? "0");

  const entries: LibraryEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    const file = formData.get(`file_${i}`);
    const relPath = formData.get(`path_${i}`);
    if (!(file instanceof File) || typeof relPath !== "string") continue;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      entries.push(saveUploadedFile(targetPath, relPath, buffer));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Không thể tải lên file");
    }
  }

  return Response.json({ entries, errors });
}
