import fs from "fs";
import path from "path";
import { type RecentProject } from "./dashboard-data";
import { DATA_DIR, getProjectsRoot, getStorageRoot } from "./settings-store";

const DATA_FILE = path.join(DATA_DIR, "projects.json");

const GRADIENTS = [
  "from-[#d9c7a8] to-[#8a7559]",
  "from-[#cdd6c8] to-[#7d8b76]",
  "from-[#f0ddd1] to-[#b1592f]",
  "from-[#e4ded3] to-[#a9a096]",
  "from-[#cfe0e8] to-[#5b7f99]",
  "from-[#e8d8e8] to-[#9b6f9b]",
];

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim() || "Du an moi";
}

function uniqueFolderPath(name: string): string {
  const projectsRoot = getProjectsRoot();
  const base = sanitizeFolderName(name);
  let candidate = path.join(projectsRoot, base);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(projectsRoot, `${base} (${counter})`);
    counter++;
  }
  return candidate;
}

function ensureDataFile(): RecentProject[] {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    return [];
  }

  const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentProject[];
  } catch {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
    return [];
  }
}

function saveProjects(projects: RecentProject[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

export function getProjects(): RecentProject[] {
  const projects = ensureDataFile();
  const existing = projects.filter((p) => p.folderPath && fs.existsSync(p.folderPath));
  if (existing.length !== projects.length) {
    const removed = projects.filter((p) => !existing.includes(p));
    for (const p of removed) {
      if (p.coverImagePath && fs.existsSync(p.coverImagePath)) {
        try { fs.unlinkSync(p.coverImagePath); } catch { /* ignore */ }
      }
    }
    saveProjects(existing);
  }
  return existing;
}

export function getProjectById(id: string): RecentProject | undefined {
  return ensureDataFile().find((project) => project.id === id);
}

export function updateProject(id: string, input: { name?: string; type?: string; progress?: number }): RecentProject | null {
  const projects = ensureDataFile();
  const project = projects.find((p) => p.id === id);
  if (!project) return null;

  if (input.name !== undefined) project.name = input.name.trim() || project.name;
  if (input.type !== undefined) project.type = input.type.trim() || "Chưa phân loại";
  if (input.progress !== undefined) project.progress = Math.min(100, Math.max(0, Math.round(input.progress)));

  saveProjects(projects);
  return project;
}

export function createProject(input: { name: string; type: string; folderPath?: string }): RecentProject {
  const projects = ensureDataFile();

  let resolvedFolderPath: string;
  if (input.folderPath) {
    if (!path.isAbsolute(input.folderPath)) {
      throw new Error("Đường dẫn thư mục không hợp lệ");
    }
    const normalized = path.resolve(input.folderPath);
    const duplicate = projects.find(
      (p) => p.folderPath && path.resolve(p.folderPath) === normalized
    );
    if (duplicate) {
      throw new Error(`Thư mục này đã được liên kết với dự án "${duplicate.name}"`);
    }
    fs.mkdirSync(input.folderPath, { recursive: true });
    resolvedFolderPath = input.folderPath;
  } else {
    resolvedFolderPath = uniqueFolderPath(input.name);
    fs.mkdirSync(resolvedFolderPath, { recursive: true });
  }

  const project: RecentProject = {
    id: `project-${Date.now()}`,
    name: input.name.trim(),
    type: input.type.trim() || "Chưa phân loại",
    progress: 0,
    gradient: GRADIENTS[projects.length % GRADIENTS.length],
    folderPath: resolvedFolderPath,
  };

  projects.unshift(project);
  saveProjects(projects);
  return project;
}

export function saveCoverImage(id: string, buffer: Buffer, originalName: string): RecentProject | null {
  const projects = ensureDataFile();
  const project = projects.find((p) => p.id === id);
  if (!project) return null;

  const coversDir = path.join(DATA_DIR, "covers");
  fs.mkdirSync(coversDir, { recursive: true });

  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const dest = path.join(coversDir, `${id}${ext}`);
  fs.writeFileSync(dest, buffer);

  project.coverImagePath = dest;
  project.coverUpdatedAt = Date.now();
  saveProjects(projects);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = ensureDataFile();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const [removed] = projects.splice(index, 1);

  if (removed.coverImagePath && fs.existsSync(removed.coverImagePath)) {
    try { fs.unlinkSync(removed.coverImagePath); } catch { /* ignore */ }
  }

  if (removed.folderPath && fs.existsSync(removed.folderPath)) {
    try {
      const { default: trash } = await import("trash");
      await trash(removed.folderPath);
    } catch { /* ignore */ }
  }

  saveProjects(projects);
  return true;
}

export interface ProjectEntry {
  name: string;
  path: string;
  type: "folder" | "file";
  ext?: string;
}

function splitRelativePath(relativePath: string): string[] {
  return relativePath.split(/[\\/]/).filter(Boolean);
}

function resolveProjectPath(project: RecentProject, relativePath: string): string {
  const root = path.resolve(project.folderPath!);
  const segments = splitRelativePath(relativePath || "");
  const target = path.resolve(root, ...segments);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Đường dẫn không hợp lệ");
  }
  return target;
}

export function listEntries(id: string, relativePath = ""): ProjectEntry[] {
  const project = getProjectById(id);
  if (!project?.folderPath) return [];

  let dir: string;
  try {
    dir = resolveProjectPath(project, relativePath);
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

export function createEntryFolder(id: string, relativePath: string, name: string): ProjectEntry {
  const project = getProjectById(id);
  if (!project?.folderPath) {
    throw new Error("Không tìm thấy thư mục dự án");
  }

  const sanitized = sanitizeSubfolderName(name);
  if (!sanitized) {
    throw new Error("Tên thư mục không hợp lệ");
  }

  const parentDir = resolveProjectPath(project, relativePath);
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

export function renameEntry(id: string, relativePath: string, newName: string): ProjectEntry {
  const project = getProjectById(id);
  if (!project?.folderPath) {
    throw new Error("Không tìm thấy thư mục dự án");
  }

  const sanitized = sanitizeSubfolderName(newName);
  if (!sanitized) {
    throw new Error("Tên không hợp lệ");
  }

  const segments = splitRelativePath(relativePath);
  if (segments.length === 0) {
    throw new Error("Không thể đổi tên thư mục gốc");
  }

  const oldPath = resolveProjectPath(project, relativePath);
  if (!fs.existsSync(oldPath)) {
    throw new Error("Không tìm thấy mục này");
  }

  const newRelPath = [...segments.slice(0, -1), sanitized].join("/");
  const newPath = resolveProjectPath(project, newRelPath);

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

export function saveUploadedFile(
  id: string,
  targetPath: string,
  relativePath: string,
  buffer: Buffer
): ProjectEntry {
  const project = getProjectById(id);
  if (!project?.folderPath) {
    throw new Error("Không tìm thấy thư mục dự án");
  }

  const segments = splitRelativePath(relativePath)
    .map(sanitizeSubfolderName)
    .filter((segment) => segment && segment !== "." && segment !== "..");
  if (segments.length === 0) {
    throw new Error("Tên file không hợp lệ");
  }

  const targetDir = resolveProjectPath(project, targetPath);
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

export function deleteEntry(id: string, relativePath: string): void {
  const project = getProjectById(id);
  if (!project?.folderPath) {
    throw new Error("Không tìm thấy thư mục dự án");
  }

  const segments = splitRelativePath(relativePath);
  if (segments.length === 0) {
    throw new Error("Không thể xoá thư mục gốc");
  }

  const target = resolveProjectPath(project, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error("Không tìm thấy mục này");
  }

  fs.rmSync(target, { recursive: true, force: true });
}

export function getEntryAbsolutePath(id: string, relativePath: string): string | null {
  const project = getProjectById(id);
  if (!project?.folderPath) return null;
  try {
    return resolveProjectPath(project, relativePath);
  } catch {
    return null;
  }
}

function copyFolderRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function moveFolder(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      copyFolderRecursive(src, dest);
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export function migrateProjectFolders(newStorageRoot: string): { moved: number; skipped: number } {
  const projects = ensureDataFile();
  const oldStorageRoot = getStorageRoot();
  const newProjectsRoot = path.join(newStorageRoot, "Dự án");

  let moved = 0;
  let skipped = 0;

  const updated = projects.map((project) => {
    if (!project.folderPath) { skipped++; return project; }

    const normalizedOld = path.resolve(project.folderPath);
    const normalizedRoot = path.resolve(oldStorageRoot);

    const isUnderOldRoot = normalizedOld.startsWith(normalizedRoot + path.sep) ||
      normalizedOld === normalizedRoot;

    if (!isUnderOldRoot || !fs.existsSync(project.folderPath)) {
      skipped++;
      return project;
    }

    const folderName = path.basename(project.folderPath);
    const newFolderPath = path.join(newProjectsRoot, folderName);

    if (fs.existsSync(newFolderPath)) { skipped++; return project; }

    try {
      fs.mkdirSync(newProjectsRoot, { recursive: true });
      moveFolder(project.folderPath, newFolderPath);
      moved++;
      return { ...project, folderPath: newFolderPath };
    } catch {
      skipped++;
      return project;
    }
  });

  saveProjects(updated);
  return { moved, skipped };
}
