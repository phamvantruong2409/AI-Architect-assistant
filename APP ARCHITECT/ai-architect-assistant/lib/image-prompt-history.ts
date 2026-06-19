import type { ImagePromptResult } from "@/lib/image-prompt-types";

export interface ImagePromptHistoryEntry {
  id: string;
  createdAt: number;
  engineValue: string;
  engineLabel: string;
  /** Thumbnail nhỏ (dataURL) để xem lại; có thể null. */
  thumb: string | null;
  result: ImagePromptResult;
}

const KEY = "imagePromptHistory";
const MAX = 15;

export function loadHistory(): ImagePromptHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as ImagePromptHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: ImagePromptHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quá hạn mức localStorage — thử giữ ít mục hơn.
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 5)));
    } catch {
      /* bỏ qua nếu vẫn lỗi */
    }
  }
}

export function addHistory(entry: ImagePromptHistoryEntry): ImagePromptHistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, MAX);
  persist(next);
  return next;
}

export function removeHistory(id: string): ImagePromptHistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): ImagePromptHistoryEntry[] {
  persist([]);
  return [];
}
