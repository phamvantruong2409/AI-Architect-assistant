import fs from "fs";
import path from "path";
import { recentProjects as seedProjects, type RecentProject } from "./dashboard-data";
import { getProjectsRoot } from "./settings-store";

const DATA_FILE = path.join(process.cwd(), "data", "projects.json");

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
    const seeded = seedProjects.map((project) => {
      const folderPath = uniqueFolderPath(project.name);
      fs.mkdirSync(folderPath, { recursive: true });
      return { ...project, folderPath };
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(seeded, null, 2), "utf-8");
    return seeded;
  }

  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw) as RecentProject[];
}

function saveProjects(projects: RecentProject[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

export function getProjects(): RecentProject[] {
  return ensureDataFile();
}

export function getProjectById(id: string): RecentProject | undefined {
  return ensureDataFile().find((project) => project.id === id);
}

export function createProject(input: { name: string; type: string }): RecentProject {
  const projects = ensureDataFile();
  const folderPath = uniqueFolderPath(input.name);
  fs.mkdirSync(folderPath, { recursive: true });

  const project: RecentProject = {
    id: `project-${Date.now()}`,
    name: input.name.trim(),
    type: input.type.trim() || "Chưa phân loại",
    progress: 0,
    gradient: GRADIENTS[projects.length % GRADIENTS.length],
    folderPath,
  };

  projects.unshift(project);
  saveProjects(projects);
  return project;
}

export function saveCoverImage(id: string, buffer: Buffer, originalName: string): RecentProject | null {
  const projects = ensureDataFile();
  const project = projects.find((p) => p.id === id);
  if (!project?.folderPath) return null;

  const assetsDir = path.join(project.folderPath, ".assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const dest = path.join(assetsDir, `cover${ext}`);
  fs.writeFileSync(dest, buffer);

  project.coverImagePath = dest;
  project.coverUpdatedAt = Date.now();
  saveProjects(projects);
  return project;
}

export function deleteProject(id: string): boolean {
  const projects = ensureDataFile();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return false;

  projects.splice(index, 1);
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
