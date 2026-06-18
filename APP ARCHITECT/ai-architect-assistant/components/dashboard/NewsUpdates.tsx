import { SparkleIcon } from "@/components/layout/icons";
import { fetchNews } from "@/lib/fetchNews";

export async function NewsUpdates() {
  const items = await fetchNews();

  return (
    <div>
      <div className="flex items-center justify-center mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Tin tức &amp; Cập nhật
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-foreground-soft">Không thể tải tin tức.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 group">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <SparkleIcon className="h-3 w-3" />
              </span>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              >
                <span className="block text-xs font-medium text-foreground group-hover:text-accent transition-colors leading-relaxed">
                  {item.title}
                </span>
                <span className="mt-1 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground-soft">
                  {item.pubDate}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
