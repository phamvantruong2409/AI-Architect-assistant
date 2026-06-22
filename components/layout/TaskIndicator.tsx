"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTasks } from "@/hooks/useTasks";
import { dismissTask, type Task } from "@/lib/tasks";

const TYPE_LABEL: Record<string, string> = {
  render: "Render ảnh",
  chat: "Trả lời chat",
  massing: "Dựng khối",
  upscale: "Phóng to ảnh",
  analyze: "Phân tích ảnh",
  critique: "Đánh giá render",
  improve: "Cải thiện prompt",
};

function StatusDot({ task }: { task: Task }) {
  if (task.status === "running")
    return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-400" />;
  if (task.status === "done")
    return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />;
}

export function TaskIndicator() {
  const tasks = useTasks();
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const running = tasks.filter((t) => t.status === "running").length;
  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <AnimatePresence>
        {open &&
          tasks.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-60 rounded-xl border border-border bg-surface p-3 shadow-lg"
            >
              <div className="flex items-center gap-2">
                <StatusDot task={t} />
                <button
                  onClick={() => t.route && router.push(t.route)}
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium text-foreground hover:underline"
                  title={t.label}
                >
                  {t.label || TYPE_LABEL[t.type] || t.type}
                </button>
                {t.status !== "running" && (
                  <button
                    onClick={() => dismissTask(t.id)}
                    aria-label="Bỏ qua"
                    className="text-foreground-soft hover:text-foreground"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {t.status === "running" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-[width] duration-300"
                    style={{ width: `${Math.round(t.progress)}%` }}
                  />
                </div>
              )}
              {t.status === "error" && (
                <p className="mt-1 text-[11px] text-red-500">{t.error}</p>
              )}
              {t.status === "done" && (
                <p className="mt-1 text-[11px] text-emerald-600">Hoàn tất — bấm để xem.</p>
              )}
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Nút thu gọn/mở danh sách */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-lg"
      >
        {running > 0 ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        )}
        {running > 0 ? `${running} tác vụ đang chạy` : "Tác vụ nền"}
      </button>
    </div>
  );
}
