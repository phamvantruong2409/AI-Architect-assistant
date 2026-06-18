import fs from "fs";
import path from "path";
import { DATA_DIR } from "./settings-store";

const DATA_FILE = path.join(DATA_DIR, "chat-sessions.json");
const MAX_SESSIONS = 50;

export interface ChatSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  path: string;
  updatedAt: number;
  messages: ChatSessionMessage[];
}

function readAll(): ChatSession[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: ChatSession[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

function deriveTitle(messages: ChatSessionMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.content.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return "Đoạn chat mới";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function getSessions(): ChatSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSessionById(id: string): ChatSession | undefined {
  return readAll().find((s) => s.id === id);
}

export function upsertSession(input: {
  id: string;
  path: string;
  messages: ChatSessionMessage[];
}): ChatSession {
  if (input.messages.length === 0) {
    return getSessionById(input.id) ?? {
      id: input.id,
      title: "Đoạn chat mới",
      path: input.path,
      updatedAt: Date.now(),
      messages: [],
    };
  }

  const sessions = readAll();
  const index = sessions.findIndex((s) => s.id === input.id);
  const session: ChatSession = {
    id: input.id,
    path: input.path,
    title: deriveTitle(input.messages),
    messages: input.messages,
    updatedAt: Date.now(),
  };

  if (index === -1) {
    sessions.unshift(session);
  } else {
    sessions[index] = session;
  }

  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  writeAll(sessions.slice(0, MAX_SESSIONS));
  return session;
}

export function deleteSession(id: string): boolean {
  const sessions = readAll();
  const filtered = sessions.filter((s) => s.id !== id);
  if (filtered.length === sessions.length) return false;
  writeAll(filtered);
  return true;
}
