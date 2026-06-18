"use client";

// Theo dõi lượng dùng AI NGAY TẠI MÁY (localStorage) — vì Google không cung cấp
// API đọc usage TPM/RPD thật trên AI Studio. Con số ở đây = lượng dùng qua chính
// app này (token ước tính từ độ dài nội dung, ~4 ký tự / 1 token).

const LOG_KEY = "ai-architect:usage-log"; // [{ t, model, tokens }]
const LIMIT_KEY = "ai-architect:rate-limited"; // { date, models: {id:true} }
export const USAGE_EVENT = "ai-usage-updated";

// Trần cho thanh đo (Google không cho đọc trần thật theo thời gian thực).
// rpd = null => không giới hạn. Chỉnh tại đây nếu cần.
export const MODEL_LIMITS: Record<string, { tpm: number; rpd: number | null }> = {
  "gemini-3-flash-preview": { tpm: 250_000, rpd: 20 },
  "gemini-2.5-flash": { tpm: 250_000, rpd: 20 },
};
export const DEFAULT_LIMIT: { tpm: number; rpd: number | null } = { tpm: 250_000, rpd: 20 };

interface LogEntry {
  t: number;
  model: string;
  tokens: number;
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// Khoá ngày theo giờ MÁY (local) — để mọi thứ reset đúng lúc nửa đêm địa phương,
// đồng bộ với startOfToday() bên dưới (RPD cũng tính từ nửa đêm local).
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function emit() {
  window.dispatchEvent(new Event(USAGE_EVENT));
}

function readLog(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Ước tính token từ độ dài văn bản (~4 ký tự / token). */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

/** Ghi nhận 1 lần gọi AI thành công. Tự xoá cờ hết-lượt của model đó. */
export function recordAiCall(model: string, tokens: number) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const log = readLog().filter((e) => now - e.t < DAY_MS);
  log.push({ t: now, model, tokens: Math.max(0, Math.round(tokens) || 0) });
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
  clearRateLimited(model);
  emit();
}

function readLimitState(): { date: string; models: Record<string, boolean> } {
  try {
    const s = JSON.parse(localStorage.getItem(LIMIT_KEY) || "null");
    if (s && s.date === today()) return s;
  } catch {
    /* ignore */
  }
  return { date: today(), models: {} };
}

/** Đánh dấu model đã hết lượt (gặp 429). Reset tự động sang ngày mới. */
export function markRateLimited(model: string) {
  if (typeof window === "undefined") return;
  const state = readLimitState();
  state.models[model] = true;
  localStorage.setItem(LIMIT_KEY, JSON.stringify(state));
  emit();
}

export function clearRateLimited(model: string) {
  if (typeof window === "undefined") return;
  const state = readLimitState();
  if (state.models[model]) {
    delete state.models[model];
    localStorage.setItem(LIMIT_KEY, JSON.stringify(state));
    emit();
  }
}

export function getRateLimited(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  return readLimitState().models;
}

export interface UsageStats {
  rpd: number; // số request kể từ đầu ngày
  tpm: number; // token trong 60 giây gần nhất
}

export function getUsageStats(): UsageStats {
  const now = Date.now();
  const day0 = startOfToday();
  let rpd = 0;
  let tpm = 0;
  for (const e of readLog()) {
    if (e.t >= day0) rpd++;
    if (now - e.t < MINUTE_MS) tpm += e.tokens;
  }
  return { rpd, tpm };
}
