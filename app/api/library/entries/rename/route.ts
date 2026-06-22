import { renameEntry } from "@/lib/library-store";

export async function POST(request: Request) {
  const body = await request.json();
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const entry = renameEntry(path, name);
    return Response.json(entry);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể đổi tên" },
      { status: 400 }
    );
  }
}
