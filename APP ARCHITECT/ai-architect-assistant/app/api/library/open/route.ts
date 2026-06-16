import { spawn } from "child_process";
import { getLibraryInfo } from "@/lib/library-store";

export async function POST() {
  const { folderPath } = getLibraryInfo();
  spawn("explorer", [folderPath], { detached: true }).unref();
  return Response.json({ ok: true });
}
