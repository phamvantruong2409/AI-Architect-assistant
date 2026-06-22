import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR } from "./settings-store";

const DATA_FILE = path.join(DATA_DIR, "briefing.json");

export type SurveyAnswers = Record<string, string | string[]>;

export interface BriefRecord {
  id: string;
  project_name: string;
  client_name: string;
  client_token: string;
  status: "pending" | "completed";
  detail?: string; // thông tin chi tiết KTS tự nhập
  answers?: SurveyAnswers; // dữ liệu cũ (giữ để tương thích)
  brief?: string; // nhiệm vụ thiết kế (Markdown) do AI sinh
  created_at: string;
  completed_at?: string;
}

function readAll(): BriefRecord[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BriefRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: BriefRecord[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");
}

export async function listBriefs(): Promise<BriefRecord[]> {
  return readAll().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function createBrief(projectName: string, clientName: string): Promise<BriefRecord> {
  const records = readAll();
  const record: BriefRecord = {
    id: randomUUID(),
    client_token: randomUUID().replace(/-/g, "").slice(0, 16),
    project_name: projectName,
    client_name: clientName,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  records.unshift(record);
  writeAll(records);
  return record;
}

export async function getBriefById(id: string): Promise<BriefRecord | undefined> {
  return readAll().find((r) => r.id === id);
}

export async function deleteBrief(id: string): Promise<boolean> {
  const records = readAll();
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;
  writeAll(filtered);
  return true;
}

// KTS tự nhập thông tin chi tiết của dự án (ô nhập tự do).
export async function saveBriefDetail(id: string, detail: string): Promise<void> {
  const records = readAll();
  const record = records.find((r) => r.id === id);
  if (!record) return;
  record.detail = detail;
  writeAll(records);
}

export function getBriefDetail(record: BriefRecord): string {
  if (typeof record.detail === "string") return record.detail;
  // tương thích dữ liệu cũ lưu trong answers.detail
  const legacy = record.answers?.detail;
  return typeof legacy === "string" ? legacy : "";
}

// Lưu nhiệm vụ thiết kế do AI sinh và đánh dấu dự án hoàn thành.
export async function setBriefById(id: string, brief: string): Promise<void> {
  const records = readAll();
  const record = records.find((r) => r.id === id);
  if (!record) return;
  record.brief = brief;
  record.status = "completed";
  record.completed_at = new Date().toISOString();
  writeAll(records);
}
