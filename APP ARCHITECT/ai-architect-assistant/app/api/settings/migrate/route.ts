import { migrateProjectFolders } from "@/lib/projects-store";
import { setStorageRoot } from "@/lib/settings-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newStorageRoot = typeof body.storageRoot === "string" ? body.storageRoot.trim() : "";

    if (!newStorageRoot) {
      return Response.json({ error: "Đường dẫn không hợp lệ" }, { status: 400 });
    }

    const result = migrateProjectFolders(newStorageRoot);
    const saved = setStorageRoot(newStorageRoot);
    return Response.json({ storageRoot: saved, ...result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Lỗi di chuyển dữ liệu" },
      { status: 500 }
    );
  }
}
