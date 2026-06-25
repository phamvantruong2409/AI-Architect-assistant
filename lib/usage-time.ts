// Theo dõi thời gian mở ứng dụng trong ngày. "Ngày sử dụng" bắt đầu lúc 6h sáng
// và reset lúc 6h sáng hôm sau — nên thời lượng được cộng dồn qua nửa đêm, chỉ về 0
// khi qua mốc 6h sáng.
//
// Việc đếm giờ chạy trong MỘT bộ đếm dùng chung (singleton) để nhiều component
// cùng đọc mà không cộng trùng thời gian.

const STORAGE_KEY = "daily-usage-time";
const RESET_HOUR = 6; // 6h sáng
const IDLE_MS = 5 * 60 * 1000; // 5 phút không tương tác => coi là rảnh
const TICK_MS = 1000;

type UsageRecord = { day: string; seconds: number };

export type UsageState = {
  /** Tổng số giây đã mở app trong ngày sử dụng hiện tại (reset lúc 6h sáng). */
  seconds: number;
  /** Đang rảnh (>5 phút không thao tác hoặc không nhìn tab). */
  idle: boolean;
};

/** Khoá ngày sử dụng (YYYY-MM-DD) cho mốc thời gian `now`, lấy 6h sáng làm ranh giới. */
export function usageDayKey(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < RESET_HOUR) {
    // Trước 6h sáng vẫn tính là ngày hôm trước.
    d.setDate(d.getDate() - 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function read(): UsageRecord {
  const today = usageDayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UsageRecord;
      if (parsed && parsed.day === today && typeof parsed.seconds === "number") {
        return parsed;
      }
    }
  } catch {
    // bỏ qua dữ liệu hỏng
  }
  return { day: today, seconds: 0 };
}

function write(record: UsageRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // bỏ qua khi localStorage không khả dụng
  }
}

/** Định dạng "Xh Ym" / "Ym" / "Xs" cho hiển thị gọn (badge sidebar). */
export function formatUsage(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${s}s`;
}

/** Tách tổng số giây thành { hh, mm, ss } đã pad 2 chữ số. */
export function splitClock(totalSeconds: number): { hh: string; mm: string; ss: string } {
  const s = Math.max(0, Math.floor(totalSeconds));
  return {
    hh: String(Math.floor(s / 3600)).padStart(2, "0"),
    mm: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    ss: String(s % 60).padStart(2, "0"),
  };
}

// ── Bộ đếm dùng chung (chỉ chạy ở trình duyệt) ──────────────────────────────

let state: UsageState = { seconds: 0, idle: false };
const listeners = new Set<() => void>();
let lastActivity = Date.now();
let intervalId: ReturnType<typeof setInterval> | null = null;
let refCount = 0;

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<UsageState>) {
  const merged = { ...state, ...next };
  if (merged.seconds === state.seconds && merged.idle === state.idle) return;
  state = merged;
  emit();
}

// Trong khi đang dùng app, mọi thao tác đều làm "tươi" mốc hoạt động để chưa vào
// trạng thái rảnh.
function markActivity() {
  if (state.idle) return; // Khi đã rảnh, chỉ "click" (xử lý riêng) mới đánh thức.
  lastActivity = Date.now();
}

// Khi overlay đang hiện, CHỈ click thật / chạm / gõ phím mới tắt — di chuột không tắt.
function wakeFromIdle() {
  if (!state.idle) return;
  lastActivity = Date.now();
  setState({ idle: false });
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

const WAKE_EVENTS = ["mousedown", "keydown", "touchstart"] as const;

function tick() {
  const now = Date.now();
  const visible = document.visibilityState === "visible";
  const active = visible && now - lastActivity < IDLE_MS;

  if (active) {
    const record = read();
    record.seconds += TICK_MS / 1000;
    write(record);
    setState({ seconds: record.seconds, idle: false });
  } else {
    // Đồng bộ lại tổng (phòng khi đã qua mốc 6h sáng -> reset) và bật trạng thái rảnh.
    setState({ seconds: read().seconds, idle: true });
  }
}

function start() {
  if (typeof window === "undefined") return;
  refCount += 1;
  if (intervalId !== null) return;
  lastActivity = Date.now();
  state = { seconds: read().seconds, idle: false };
  ACTIVITY_EVENTS.forEach((e) =>
    document.addEventListener(e, markActivity, { passive: true })
  );
  WAKE_EVENTS.forEach((e) =>
    document.addEventListener(e, wakeFromIdle, { passive: true })
  );
  intervalId = setInterval(tick, TICK_MS);
}

function stop() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
  ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, markActivity));
  WAKE_EVENTS.forEach((e) => document.removeEventListener(e, wakeFromIdle));
}

/** Đăng ký lắng nghe; tự khởi động/tắt bộ đếm theo số người dùng. */
export function subscribeUsage(listener: () => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    stop();
  };
}

export function getUsageSnapshot(): UsageState {
  return state;
}

/** Snapshot khi render phía server (chưa có bộ đếm). */
export function getUsageServerSnapshot(): UsageState {
  return { seconds: 0, idle: false };
}
