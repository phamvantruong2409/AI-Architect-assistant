import Link from "next/link";
import { recentChats } from "@/lib/dashboard-data";
import { ChatIcon } from "@/components/layout/icons";

export function RecentChats() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground">Chat gần đây</h2>
        <Link href="/chat" className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
          Xem tất cả
        </Link>
      </div>
      <ul className="space-y-0.5">
        {recentChats.map((chat) => (
          <li key={chat.id}>
            <Link
              href="/chat"
              className="group flex items-start gap-3 rounded-card px-3 py-2.5 transition-all duration-200 hover:bg-surface-muted"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground-soft transition-colors group-hover:bg-accent/15 group-hover:text-accent">
                <ChatIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                  {chat.title}
                </span>
                <span className="block text-xs text-foreground-soft mt-0.5">
                  {chat.time}
                </span>
              </span>
              <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-foreground-soft">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
