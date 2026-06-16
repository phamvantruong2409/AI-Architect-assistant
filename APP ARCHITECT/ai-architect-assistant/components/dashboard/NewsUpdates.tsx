import Link from "next/link";
import { newsItems } from "@/lib/dashboard-data";
import { SparkleIcon } from "@/components/layout/icons";

export function NewsUpdates() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Tin tức &amp; Cập nhật
        </h2>
        <Link href="/docs" className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
          Xem tất cả
        </Link>
      </div>
      <ul className="space-y-3">
        {newsItems.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 group cursor-pointer">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <SparkleIcon className="h-3 w-3" />
            </span>
            <span>
              <span className="block text-xs font-medium text-foreground group-hover:text-accent transition-colors leading-relaxed">
                {item.title}
              </span>
              <span className="mt-1 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground-soft">
                {item.time}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
