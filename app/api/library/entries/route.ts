import { createEntryFolder, listEntries } from "@/lib/library-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  return Response.json(listEntries(path));
}

export async function POST(request: Request) {
  const body = await request.json();
  const path = typeof body.path === "string" ? body.path : "";
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const folder = createEntryFolder(path, name);
    return Response.json(folder, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo thư mục" },
      { status: 400 }
    );
  }
}
