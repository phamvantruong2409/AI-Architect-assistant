import Image from "next/image";
import Link from "next/link";

const inspirations = [
  {
    id: "1",
    title: "Căn nhà thô mộc",
    tag: "Rustic • Thô mộc",
    image: "/images/day-update/n01.jpg",
  },
  {
    id: "2",
    title: "Resort biển Địa Trung Hải",
    tag: "Mediterranean • 5 sao",
    image: "/images/day-update/n04.jpg",
  },
  {
    id: "3",
    title: "Cafe Industrial",
    tag: "Industrial • 150m²",
    image: "/images/day-update/n03.jpg",
  },
];

export function InspirationToday() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-amber-400">✦</span>
          Inspiration Today
        </h2>
        <Link href="/library" className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
          Xem tất cả
        </Link>
      </div>

      <div className="space-y-2.5">
        {inspirations.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-[4/2] overflow-hidden rounded-card border border-border transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
          >
            {/* Real photo background */}
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 300px"
            />

            {/* Content overlay at bottom of image */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Bookmark icon */}
            <button className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/60 backdrop-blur-sm transition-all hover:bg-accent hover:text-white opacity-0 group-hover:opacity-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Text on image */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5">
              <p className="text-xs font-semibold text-white leading-tight">{item.title}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{item.tag}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
