/** Thanh tiến trình % cho tác vụ AI (dùng kèm hook useFakeProgress). */
export function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-foreground-soft">
        <span>{label ?? "AI đang xử lý"}</span>
        <span className="font-medium text-accent tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
