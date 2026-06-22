import { getStorageRoot, setStorageRoot } from "@/lib/settings-store";

export async function GET() {
  return Response.json({ storageRoot: getStorageRoot() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const storageRoot = typeof body.storageRoot === "string" ? body.storageRoot.trim() : "";

    if (!storageRoot) {
      return Response.json({ error: "Đường dẫn thư mục không được để trống" }, { status: 400 });
    }

    const saved = setStorageRoot(storageRoot);
    return Response.json({ storageRoot: saved });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể lưu thư mục" },
      { status: 500 }
    );
  }
}
