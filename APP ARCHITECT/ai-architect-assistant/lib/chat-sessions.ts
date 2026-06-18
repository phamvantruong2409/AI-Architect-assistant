// Client-side module — talks to /api/chat-sessions over HTTP.
// Dispatches "chat-sessions-updated" after mutations so useChatSessions can refresh.

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

const EVENT_NAME = "chat-sessions-updated";

function dispatch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export async function getChatSessions(): Promise<ChatSession[]> {
  try {
    const res = await fetch("/api/chat-sessions");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getChatSession(id: string): Promise<ChatSession | undefined> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`);
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export async function saveChatSession(input: {
  id: string;
  path: string;
  messages: ChatSessionMessage[];
}): Promise<void> {
  if (input.messages.length === 0) return;
  try {
    await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    dispatch();
  } catch {
    // ignore — chat continues working even if save fails
  }
}

export async function deleteChatSession(id: string): Promise<void> {
  try {
    await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    dispatch();
  } catch {
    // ignore
  }
}

export function subscribeChatSessions(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
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
