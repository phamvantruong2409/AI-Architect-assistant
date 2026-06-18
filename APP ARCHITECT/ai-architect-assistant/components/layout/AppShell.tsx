"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { AmbientSound } from "./AmbientSound";
import { MenuIcon, CloseIcon, ChatIcon } from "./icons";
import { navItems } from "./nav-items";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

const GREETINGS = [
  "Chào! Bạn cần thiết kế gì hôm nay? 🏡",
  "Có ý tưởng mới chưa? Tôi sẵn sàng lắng nghe!",
  "Thử hỏi tôi về phong cách kiến trúc nhé?",
  "Cần brief dự án nhanh? Tôi giúp được đó! ✏️",
  "Hôm nay mình thiết kế gì cùng nhau nhỉ?",
  "Cần tư vấn vật liệu hay xu hướng mới? 💡",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/chat") return;
    const show = () => {
      const msg = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      setGreeting(msg);
      setTimeout(() => setGreeting(null), 5000);
    };
    const initial = setTimeout(show, 12000);
    const interval = setInterval(show, 50000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname, router]);
  const studioLabels: Record<string, string> = {
    "/portfolio": "Portfolio",
    "/studio/regulatory": "Pháp lý AI",
    "/studio/knowledge": "Kiến thức AI",
    "/concept": "Studio",
  };
  const studioLabel = Object.entries(studioLabels).find(([path]) => pathname.startsWith(path))?.[1];
  const current = navItems.find((item) => item.href === pathname) ?? (studioLabel ? { label: studioLabel } : undefined);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 md:block">
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl shadow-black/50">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 text-sidebar-foreground-soft"
              aria-label="Đóng menu"
            >
              <CloseIcon />
            </button>
            <Suspense>
              <Sidebar onNavigate={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col relative">
        <header className={`flex h-14 items-center justify-between px-4 sm:px-6 transition-colors z-10 ${pathname === "/dashboard" ? "absolute inset-x-0 top-0 bg-transparent" : "shrink-0 bg-background/80 backdrop-blur-sm"}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="text-foreground-soft md:hidden"
              aria-label="Mở menu"
            >
              <MenuIcon />
            </button>
            <button
              onClick={() => (pathname === "/dashboard" ? router.push("/") : router.back())}
              aria-label={pathname === "/dashboard" ? "Về trang chủ" : "Quay lại"}
              className="flex h-8 w-8 items-center justify-center rounded-card text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-semibold text-foreground">
              {current?.label ?? "AI Architect"}
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar">{children}</main>
      </div>

      {/* Floating buttons */}
      {pathname !== "/chat" && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          <AnimatePresence>
            {greeting && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                transition={{ duration: 0.25 }}
                className="relative max-w-[190px] rounded-xl rounded-br-sm bg-surface border border-border px-3 py-2 shadow-lg text-xs text-foreground leading-relaxed"
              >
                {greeting}
                <div className="absolute -bottom-1.5 right-2 h-3 w-3 rotate-45 bg-surface border-r border-b border-border" />
              </motion.div>
            )}
          </AnimatePresence>
          <AmbientSound />
          <Link
            href="/chat"
            aria-label="Mở AI Chat"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 text-white shadow-lg shadow-teal-500/30 transition-all duration-300 hover:scale-110 hover:shadow-teal-500/50 animate-pulse-glow"
          >
            <img src="/images/logolight.png" alt="AI Chat" className="h-6 w-6 object-contain" />
          </Link>
        </div>
      )}
    </div>
  );
}
