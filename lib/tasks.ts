// Store tác vụ nền cấp MODULE (singleton). Vì nằm ngoài cây React, các tác vụ
// async chạy ở đây KHÔNG bị hủy khi component/trang unmount — nên tiến trình vẫn
// chạy tới khi xong dù người dùng chuyển trang, và quay lại vẫn đọc được trạng
// thái live. UI đăng ký lắng nghe qua useTasks/useTask (useSyncExternalStore).

export type TaskStatus = "running" | "done" | "error";

export interface Task {
  id: string;
  type: string; // 'render' | 'chat' | 'massing' | 'upscale' | ...
  label: string;
  status: TaskStatus;
  progress: number; // 0–100
  route?: string; // trang để quay lại xem tác vụ
  result?: unknown;
  partial?: unknown; // dữ liệu đang stream (vd văn bản chat đang chảy)
  error?: string;
  startedAt: number;
  updatedAt: number;
}

/** Cách báo tiến trình/partial cho store từ bên trong runner. */
export interface TaskHandle {
  id: string;
  setProgress: (pct: number) => void;
  setPartial: (value: unknown) => void;
}

const tasks = new Map<string, Task>();
const listeners = new Set<() => void>();
const fakeTimers = new Map<string, ReturnType<typeof setInterval>>();

// Snapshot bất biến cho useSyncExternalStore (phải ổn định giữa các lần gọi
// khi không có thay đổi, nếu không React sẽ render vô hạn).
let snapshot: Task[] = [];

function rebuild() {
  snapshot = [...tasks.values()].sort((a, b) => b.startedAt - a.startedAt);
  listeners.forEach((l) => l());
}

export function subscribeTasks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTasksSnapshot(): Task[] {
  return snapshot;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

function patch(id: string, changes: Partial<Task>) {
  const cur = tasks.get(id);
  if (!cur) return;
  tasks.set(id, { ...cur, ...changes, updatedAt: Date.now() });
  rebuild();
}

function stopFake(id: string) {
  const t = fakeTimers.get(id);
  if (t) {
    clearInterval(t);
    fakeTimers.delete(id);
  }
}

export interface StartTaskOptions {
  /** Khoá ổn định để reconnect (vd theo session). Bỏ trống → tự tạo sinh. */
  id?: string;
  type: string;
  label: string;
  route?: string;
  /** Tự bò % tới ~95% cho tác vụ không báo tiến trình thật. */
  fakeProgress?: boolean;
  run: (handle: TaskHandle) => Promise<unknown>;
}

/**
 * Khởi chạy một tác vụ nền. Trả về id. Nếu đã có tác vụ cùng id đang chạy thì
 * không chạy lại (trả id cũ) — dùng cho reconnect / chống double-submit.
 */
export function startTask(opts: StartTaskOptions): string {
  const id = opts.id ?? `${opts.type}-${Date.now()}`;
  const existing = tasks.get(id);
  if (existing && existing.status === "running") return id;

  const now = Date.now();
  tasks.set(id, {
    id,
    type: opts.type,
    label: opts.label,
    status: "running",
    progress: 0,
    route: opts.route,
    startedAt: now,
    updatedAt: now,
  });
  rebuild();

  if (opts.fakeProgress) {
    const timer = setInterval(() => {
      const t = tasks.get(id);
      if (!t || t.status !== "running") return;
      if (t.progress >= 95) return; // đã tới trần → ngừng emit để khỏi re-render vô ích
      const next = Math.min(95, t.progress + Math.max(0.5, (95 - t.progress) * 0.06));
      if (next !== t.progress) patch(id, { progress: next });
    }, 400);
    fakeTimers.set(id, timer);
  }

  const handle: TaskHandle = {
    id,
    setProgress: (pct) => patch(id, { progress: Math.max(0, Math.min(100, pct)) }),
    setPartial: (value) => patch(id, { partial: value }),
  };

  Promise.resolve()
    .then(() => opts.run(handle))
    .then((result) => {
      stopFake(id);
      patch(id, { status: "done", progress: 100, result });
    })
    .catch((err) => {
      stopFake(id);
      patch(id, { status: "error", error: err instanceof Error ? err.message : "Tác vụ thất bại" });
    })
    .finally(() => {
      // Tự dọn sau 90s nếu UI chưa tiêu thụ (tránh tích tụ tác vụ done/error).
      // Kết quả render/chat vẫn còn ở Thư viện/phiên nên không mất gì.
      setTimeout(() => {
        const t = tasks.get(id);
        if (t && t.status !== "running") dismissTask(id);
      }, 90000);
    });

  return id;
}

/** Xoá tác vụ khỏi store (sau khi UI đã tiêu thụ kết quả, hoặc bỏ qua). */
export function dismissTask(id: string) {
  stopFake(id);
  if (tasks.delete(id)) rebuild();
}
