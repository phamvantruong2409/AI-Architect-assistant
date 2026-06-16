"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MenuIcon, CloseIcon, ChatIcon } from "./icons";
import { navItems } from "./nav-items";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.location.href = "http://localhost:3000";
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname]);
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
            <h1 className="font-display text-base font-semibold text-foreground">
              {current?.label ?? "AI Architect"}
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Floating AI Assistant Button */}
      {pathname !== "/chat" && (
        <Link
          href="/chat"
          aria-label="Mở AI Chat"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 text-white shadow-lg shadow-teal-500/30 transition-all duration-300 hover:scale-110 hover:shadow-teal-500/50 animate-pulse-glow"
        >
          <ChatIcon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
