import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { getEntryAbsolutePath, getProjectById } from "@/lib/projects-store";
import { getEntryAbsolutePath as getLibraryEntryAbsolutePath, getLibraryInfo } from "@/lib/library-store";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");
  const id = request.nextUrl.searchParams.get("id");
  const entryPath = request.nextUrl.searchParams.get("path");

  let filePath: string | null | undefined;

  if (source === "library") {
    filePath = entryPath ? getLibraryEntryAbsolutePath(entryPath) : getLibraryInfo().coverImagePath;
  } else {
    const project = id ? getProjectById(id) : undefined;
    filePath = entryPath && id ? getEntryAbsolutePath(id, entryPath) : project?.coverImagePath;
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return new Response("Unsupported file type", { status: 415 });
  }

  const data = fs.readFileSync(filePath);
  return new Response(data, {
    headers: { "Content-Type": mime, "Cache-Control": "no-store" },
  });
}
