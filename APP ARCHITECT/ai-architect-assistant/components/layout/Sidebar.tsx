"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { cn } from "@/lib/utils";
import { useChatSessions } from "@/hooks/useChatSessions";
import { deleteChatSession, formatRelativeTime, type ChatSession } from "@/lib/chat-sessions";
import { ConfirmDeleteDialog } from "@/components/chat/ConfirmDeleteDialog";
import { navItems } from "./nav-items";
import { SettingsIcon, StarIcon, TrashIcon, CubeIcon, LayersIcon, WandIcon, ImageIcon, PencilIcon, ChevronDownIcon, BellIcon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { useAiUsage } from "@/hooks/useAiUsage";
import { MODEL_LIMITS, DEFAULT_LIMIT } from "@/lib/ai-usage";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

const studioItems = [
  {
    name: "Portfolio",
    href: "/portfolio",
    iconSrc: "/images/studio/logoport.png",
    icon: ImageIcon,
    gradient: "from-violet-600 to-purple-500",
  },
  {
    name: "Pháp lý AI",
    href: "/studio/regulatory",
    icon: LayersIcon,
    gradient: "from-rose-600 to-pink-500",
  },
  {
    name: "Kiến thức AI",
    href: "/studio/knowledge",
    icon: CubeIcon,
    gradient: "from-teal-600 to-cyan-500",
  },
  {
    name: "Khảo sát AI",
    href: "/studio/briefing",
    icon: PencilIcon,
    gradient: "from-amber-600 to-orange-500",
  },
  {
    name: "Sắp ra mắt",
    href: null,
    icon: WandIcon,
    gradient: "from-zinc-600 to-zinc-500",
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("id");
  const sessions = useChatSessions();
  const [pendingDelete, setPendingDelete] = useState<ChatSession | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(true);
  const [userName, setUserName] = useState("Người dùng");
  const { stats, rateLimited } = useAiUsage();

  const limit = MODEL_LIMITS[DEFAULT_GEMINI_MODEL] ?? DEFAULT_LIMIT;
  const tpmCap = limit.tpm;
  const rpdCap = limit.rpd;
  const tpmPct = Math.min(100, Math.round((stats.tpm / tpmCap) * 100));
  const rpdPct = rpdCap ? Math.min(100, Math.round((stats.rpd / rpdCap) * 100)) : Math.min(100, stats.rpd);
  const rpdReached = rpdCap !== null && stats.rpd >= rpdCap;
  const all429 = GEMINI_MODELS.every((m) => rateLimited[m.id]);
  const allLimited = all429 || rpdReached; // hết lượt: do 429 hoặc chạm trần RPD/ngày
  const primaryLimited = rateLimited[DEFAULT_GEMINI_MODEL];
  const fallback = GEMINI_MODELS.find((m) => m.id !== DEFAULT_GEMINI_MODEL && !rateLimited[m.id]);

  useEffect(() => {
    const stored = localStorage.getItem("user-name");
    if (stored) setUserName(stored);
  }, []);

  const handleDelete = (e: React.MouseEvent, session: ChatSession) => {
    e.preventDefault();
    e.stopPropagation();
    setPendingDelete(session);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const toDelete = pendingDelete;
    setPendingDelete(null);
    await deleteChatSession(toDelete.id);
    if (pathname === toDelete.path && activeChatId === toDelete.id) {
      router.push(toDelete.path);
    }
  };

  const isStudioActive = pathname.startsWith("/studio") || pathname === "/portfolio";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="bg-background px-5 py-5">
        <Link href="/dashboard" className="text-foreground">
          <Logo withSubtitle />
        </Link>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href && (item.href !== "/chat" || !activeChatId);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-accent shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]"
                    : "text-sidebar-foreground-soft hover:bg-sidebar-surface hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Studio Section */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setIsStudioOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 mb-1 rounded-card transition-colors hover:bg-sidebar-surface",
            )}
          >
            <CubeIcon className={cn(
              "h-[15px] w-[15px] shrink-0",
              isStudioActive ? "text-accent" : "text-sidebar-foreground-soft"
            )} />
            <span className={cn(
              "flex-1 text-left text-xs font-semibold uppercase tracking-wider",
              isStudioActive ? "text-accent" : "text-sidebar-foreground-soft"
            )}>
              Studio
            </span>
            <ChevronDownIcon className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isStudioActive ? "text-accent" : "text-sidebar-foreground-soft",
              isStudioOpen ? "rotate-0" : "-rotate-90"
            )} />
          </button>

          {isStudioOpen && <div className="space-y-0.5">
            {studioItems.map((item) => {
              const active = item.href ? pathname === item.href : false;
              const Icon = item.icon;

              if (!item.href) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2.5 rounded-card px-3 py-2 text-sm opacity-40 cursor-not-allowed"
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-gradient-to-br ${item.gradient}`}>
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-sidebar-foreground-soft text-xs">{item.name}</span>
                    <span className="ml-auto text-[10px] text-sidebar-foreground-soft/50 border border-sidebar-foreground-soft/20 rounded px-1">Em</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-card px-3 py-2 text-sm transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-accent shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]"
                      : "text-sidebar-foreground-soft hover:bg-sidebar-surface hover:text-sidebar-foreground"
                  )}
                >
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]",
                    active ? `bg-gradient-to-br ${item.gradient}` : "bg-sidebar-surface"
                  )}>
                    {item.iconSrc ? (
                      <Image src={item.iconSrc} alt={item.name} width={16} height={16} className="h-4 w-4 object-contain" />
                    ) : (
                      <Icon className={cn("h-3.5 w-3.5", active ? "text-white" : "text-sidebar-foreground-soft")} />
                    )}
                  </span>
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>}
        </div>

        {sessions.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-sidebar-foreground-soft">
              Đoạn chat
            </p>
            <ul className="mt-1 space-y-0.5">
              {sessions.map((session) => {
                const active = pathname === session.path && activeChatId === session.id;

                return (
                  <li key={session.id} className="group relative">
                    <Link
                      href={`${session.path}?id=${session.id}`}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-card px-3 py-2 pr-9 text-sm transition-all duration-200",
                        active
                          ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-accent shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]"
                          : "text-sidebar-foreground-soft hover:bg-sidebar-surface hover:text-sidebar-foreground"
                      )}
                      title={session.title}
                    >
                      <span className="block truncate">{session.title}</span>
                      <span className="block truncate text-xs text-sidebar-foreground-soft/70">
                        {formatRelativeTime(session.updatedAt)}
                      </span>
                    </Link>
                    <button
                      onClick={(e) => handleDelete(e, session)}
                      aria-label="Xoá đoạn chat"
                      title="Xoá đoạn chat"
                      className="absolute right-1.5 top-1.5 rounded-card p-1.5 text-sidebar-foreground-soft opacity-0 transition-colors hover:bg-sidebar-surface hover:text-foreground group-hover:opacity-100"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-3 px-3 pb-[50px]">
        <div className="rounded-card border border-sidebar-border bg-sidebar-surface p-4">
          <div className="flex items-center justify-between text-accent">
            <span className="flex items-center gap-2">
              <StarIcon className="h-4 w-4" />
              <span className="text-sm font-medium text-sidebar-foreground">
                Lượng dùng AI hôm nay
              </span>
            </span>
            <span className="text-[10px] text-sidebar-foreground-soft">qua app</span>
          </div>

          {/* TPM — token/phút (cửa sổ 60s) */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-sidebar-foreground-soft">
              <span>TPM</span>
              <span>
                {formatTokens(stats.tpm)} / {formatTokens(tpmCap)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${tpmPct}%` }} />
            </div>
          </div>

          {/* RPD — số request trong ngày */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[11px] text-sidebar-foreground-soft">
              <span>RPD</span>
              <span className={rpdReached ? "font-semibold text-red-500" : undefined}>
                {stats.rpd} / {rpdCap ?? "∞"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  rpdReached ? "bg-red-500" : rpdPct >= 80 ? "bg-amber-500" : "bg-accent"
                )}
                style={{ width: `${rpdPct}%` }}
              />
            </div>
          </div>

          {allLimited ? (
            <p className="mt-3 rounded-card border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-500">
              ⚠️ Đã hết lượt gọi AI hôm nay{rpdReached ? ` (${stats.rpd}/${rpdCap})` : ""}.
            </p>
          ) : primaryLimited && fallback ? (
            <p className="mt-3 rounded-card border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-600">
              Gemini 3 Flash đã hết lượt — chuyển sang {fallback.label}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              onClick={onNavigate}
              className={cn(
                "flex flex-1 items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium transition-all duration-200",
                pathname === "/settings"
                  ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-accent shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]"
                  : "text-sidebar-foreground-soft hover:bg-sidebar-surface hover:text-sidebar-foreground"
              )}
            >
              <SettingsIcon className="h-[18px] w-[18px]" />
              Cài đặt
            </Link>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-foreground-soft transition-colors hover:bg-sidebar-surface hover:text-sidebar-foreground"
              aria-label="Thông báo"
            >
              <BellIcon className="h-[17px] w-[17px]" />
            </button>
            <ThemeToggle />
          </div>
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-sidebar-foreground leading-tight">{userName}</p>
            <p className="text-[10px] text-sidebar-foreground-soft">Studio Pro</p>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Xoá cuộc trò chuyện?"
        description="Hành động này không thể hoàn tác. Toàn bộ nội dung cuộc trò chuyện sẽ bị xoá vĩnh viễn."
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
