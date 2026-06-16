const stats = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    value: 0,
    total: 20,
    label: "Lượt AI",
    color: "text-amber-400",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6a1 1 0 0 1 1-1h4.5l2 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
      </svg>
    ),
    value: 0,
    total: null,
    label: "Dự án",
    color: "text-blue-400",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
    value: 0,
    total: null,
    label: "Prompt",
    color: "text-purple-400",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="M3 12l9 5 9-5" />
      </svg>
    ),
    value: 0,
    total: null,
    label: "Layout",
    color: "text-teal-400",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="M21 16l-5-5-4 4-2-2-5 5" />
      </svg>
    ),
    value: 0,
    total: null,
    label: "Render",
    color: "text-cyan-400",
  },
];

export function AnalyticsBar() {
  const aiStat = stats[0];
  const usagePercent = aiStat.total ? (aiStat.value / aiStat.total) * 100 : 0;

  return (
    <div className="rounded-card border border-border bg-surface overflow-hidden">
      {/* Stats row */}
      <div className="flex divide-x divide-border">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 px-3 text-center transition-colors hover:bg-surface-muted"
          >
            <span className={stat.color}>{stat.icon}</span>
            <div className="flex items-baseline gap-0.5">
              <span className="font-display text-base font-bold tabular-nums text-foreground">
                {stat.value}
              </span>
              {stat.total !== null && (
                <span className="text-xs text-foreground-soft">/{stat.total}</span>
              )}
            </div>
            <span className="text-[11px] text-foreground-soft leading-none">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* AI usage progress */}
      <div className="border-t border-border px-5 py-1.5 flex items-center gap-3">
        <span className="text-[11px] text-foreground-soft whitespace-nowrap">Lượt AI hôm nay</span>
        <div className="flex-1 h-1 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-foreground-soft tabular-nums whitespace-nowrap">
          {aiStat.value} / {aiStat.total}
        </span>
      </div>
    </div>
  );
}
