import Image from "next/image";
import { fetchInspiration } from "@/lib/fetchInspiration";

export async function InspirationToday() {
  const items = await fetchInspiration();

  return (
    <div>
      <div className="flex items-center justify-center mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-amber-400">✦</span>
          Nguồn cảm hứng
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-foreground-soft">Không thể tải nội dung.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/2] overflow-hidden rounded-md border border-border transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 300px"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              <button className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/60 backdrop-blur-sm transition-all hover:bg-accent hover:text-white opacity-0 group-hover:opacity-100">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{item.title}</p>
                {item.tag && (
                  <p className="text-[10px] text-white/60 mt-0.5">{item.tag}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
