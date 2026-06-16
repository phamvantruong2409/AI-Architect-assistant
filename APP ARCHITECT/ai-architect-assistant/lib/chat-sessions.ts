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

const STORAGE_KEY = "ai-architect:chat-sessions";
const MAX_SESSIONS = 50;
const EVENT_NAME = "chat-sessions-updated";

function readAll(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(EVENT_NAME));
}

function deriveTitle(messages: ChatSessionMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = firstUser?.content.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return "Đoạn chat mới";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function getChatSessions(): ChatSession[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatSession(id: string): ChatSession | undefined {
  return readAll().find((s) => s.id === id);
}

export function saveChatSession(input: {
  id: string;
  path: string;
  messages: ChatSessionMessage[];
}): void {
  if (input.messages.length === 0) return;

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
}

export function deleteChatSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function subscribeChatSessions(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Vừa xong";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} phút trước`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} giờ trước`;
  if (diffMs < 2 * day) return "Hôm qua";
  return `${Math.floor(diffMs / day)} ngày trước`;
}
