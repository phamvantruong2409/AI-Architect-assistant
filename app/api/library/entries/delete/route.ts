import { deleteEntry } from "@/lib/library-store";

export async function POST(request: Request) {
  const body = await request.json();
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === "string")
    : [];

  const errors: string[] = [];
  for (const relPath of paths) {
    try {
      deleteEntry(relPath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Không thể xoá");
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: errors[0] }, { status: 400 });
  }
  return Response.json({ ok: true });
}
