import fs from "fs";
import os from "os";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");
const DEFAULT_STORAGE_ROOT = path.join(os.homedir(), "Documents", "AI Architect");

interface Settings {
  storageRoot?: string;
}

function readSettings(): Settings {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Settings;
  } catch {
    return {};
  }
}

function writeSettings(settings: Settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export function getStorageRoot(): string {
  return readSettings().storageRoot || DEFAULT_STORAGE_ROOT;
}

export function setStorageRoot(storageRoot: string): string {
  if (!path.isAbsolute(storageRoot)) {
    throw new Error("Đường dẫn thư mục không hợp lệ");
  }
  fs.mkdirSync(storageRoot, { recursive: true });
  const settings = readSettings();
  settings.storageRoot = storageRoot;
  writeSettings(settings);
  return storageRoot;
}

export function getProjectsRoot(): string {
  const projectsRoot = path.join(getStorageRoot(), "Dự án");
  fs.mkdirSync(projectsRoot, { recursive: true });
  return projectsRoot;
}

export function getLibraryRoot(): string {
  const libraryRoot = path.join(getStorageRoot(), "Thư viện");
  fs.mkdirSync(libraryRoot, { recursive: true });
  return libraryRoot;
}
