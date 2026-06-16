import fs from "fs";
import path from "path";
import { getLibraryRoot } from "./settings-store";

const DATA_FILE = path.join(process.cwd(), "data", "library.json");

export interface LibraryInfo {
  folderPath: string;
  coverImagePath?: string;
  coverUpdatedAt?: number;
}

export interface LibraryEntry {
  name: string;
  path: string;
  type: "folder" | "file";
  ext?: string;
}

interface LibraryMeta {
  coverImagePath?: string;
  coverUpdatedAt?: number;
}

function readMeta(): LibraryMeta {
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as LibraryMeta;
  } catch {
    return {};
  }
}

function saveMeta(meta: LibraryMeta) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(meta, null, 2), "utf-8");
}

export function getLibraryInfo(): LibraryInfo {
  return { folderPath: getLibraryRoot(), ...readMeta() };
}

export function saveLibraryCover(buffer: Buffer, originalName: string): LibraryInfo {
  const libraryRoot = getLibraryRoot();
  const assetsDir = path.join(libraryRoot, ".assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const dest = path.join(assetsDir, `cover${ext}`);
  fs.writeFileSync(dest, buffer);

  const meta = readMeta();
  meta.coverImagePath = dest;
  meta.coverUpdatedAt = Date.now();
  saveMeta(meta);
  return { folderPath: libraryRoot, ...meta };
}

function splitRelativePath(relativePath: string): string[] {
  return relativePath.split(/[\\/]/).filter(Boolean);
}

function resolveLibraryPath(relativePath: string): string {
  const root = path.resolve(getLibraryRoot());
  const segments = splitRelativePath(relativePath || "");
  const target = path.resolve(root, ...segments);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Đường dẫn không hợp lệ");
  }
  return target;
}

export function listEntries(relativePath = ""): LibraryEntry[] {
  let dir: string;
  try {
    dir = resolveLibraryPath(relativePath);
  } catch {
    return [];
  }
  if (!fs.existsSync(dir)) return [];

  const segments = splitRelativePath(relativePath);

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: [...segments, entry.name].join("/"),
      type: entry.isDirectory() ? ("folder" as const) : ("file" as const),
      ext: entry.isDirectory() ? undefined : path.extname(entry.name).slice(1).toLowerCase(),
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, "vi");
    });
}

function sanitizeSubfolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
}

export function createEntryFolder(relativePath: string, name: string): LibraryEntry {
  const sanitized = sanitizeSubfolderName(name);
  if (!sanitized) {
    throw new Error("Tên thư mục không hợp lệ");
  }

  const parentDir = resolveLibraryPath(relativePath);
  if (!fs.existsSync(parentDir)) {
    throw new Error("Không tìm thấy thư mục");
  }

  const targetDir = path.join(parentDir, sanitized);
  if (fs.existsSync(targetDir)) {
    throw new Error("Thư mục đã tồn tại");
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const segments = [...splitRelativePath(relativePath), sanitized];
  return { name: sanitized, path: segments.join("/"), type: "folder" };
}

export function renameEntry(relativePath: string, newName: string): LibraryEntry {
  const sanitized = sanitizeSubfolderName(newName);
  if (!sanitized) {
    throw new Error("Tên không hợp lệ");
  }

  const segments = splitRelativePath(relativePath);
  if (segments.length === 0) {
    throw new Error("Không thể đổi tên thư mục gốc");
  }

  const oldPath = resolveLibraryPath(relativePath);
  if (!fs.existsSync(oldPath)) {
    throw new Error("Không tìm thấy mục này");
  }

  const newRelPath = [...segments.slice(0, -1), sanitized].join("/");
  const newPath = resolveLibraryPath(newRelPath);

  if (newPath !== oldPath && fs.existsSync(newPath)) {
    throw new Error("Đã tồn tại mục với tên này");
  }

  fs.renameSync(oldPath, newPath);
  const stat = fs.statSync(newPath);

  return {
    name: sanitized,
    path: newRelPath,
    type: stat.isDirectory() ? "folder" : "file",
    ext: stat.isDirectory() ? undefined : path.extname(sanitized).slice(1).toLowerCase(),
  };
}

export function saveUploadedFile(targetPath: string, relativePath: string, buffer: Buffer): LibraryEntry {
  const segments = splitRelativePath(relativePath)
    .map(sanitizeSubfolderName)
    .filter((segment) => segment && segment !== "." && segment !== "..");
  if (segments.length === 0) {
    throw new Error("Tên file không hợp lệ");
  }

  const targetDir = resolveLibraryPath(targetPath);
  if (!fs.existsSync(targetDir)) {
    throw new Error("Không tìm thấy thư mục");
  }

  const dirSegments = segments.slice(0, -1);
  const fileName = segments[segments.length - 1];

  const destDir = path.join(targetDir, ...dirSegments);
  fs.mkdirSync(destDir, { recursive: true });

  let destPath = path.join(destDir, fileName);
  if (fs.existsSync(destPath)) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let counter = 2;
    while (fs.existsSync(destPath)) {
      destPath = path.join(destDir, `${base} (${counter})${ext}`);
      counter++;
    }
  }

  fs.writeFileSync(destPath, buffer);

  const targetSegments = splitRelativePath(targetPath);
  const relSegments = [...targetSegments, ...dirSegments, path.basename(destPath)];
  return {
    name: path.basename(destPath),
    path: relSegments.join("/"),
    type: "file",
    ext: path.extname(destPath).slice(1).toLowerCase(),
  };
}

export function deleteEntry(relativePath: string): void {
  const segments = splitRelativePath(relativePath);
  if (segments.length === 0) {
    throw new Error("Không thể xoá thư mục gốc");
  }

  const target = resolveLibraryPath(relativePath);
  if (!fs.existsSync(target)) {
    throw new Error("Không tìm thấy mục này");
  }

  fs.rmSync(target, { recursive: true, force: true });
}

export function getEntryAbsolutePath(relativePath: string): string | null {
  try {
    return resolveLibraryPath(relativePath);
  } catch {
    return null;
  }
}
