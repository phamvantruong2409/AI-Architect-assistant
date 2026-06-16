"use client";

import Link from "next/link";
import { quickActions } from "@/lib/dashboard-data";
import {
  ChatIcon,
  WandIcon,
  LayersIcon,
  ImageIcon,
  DocumentIcon,
} from "@/components/layout/icons";

const ICONS = {
  chat: ChatIcon,
  wand: WandIcon,
  layers: LayersIcon,
  image: ImageIcon,
  document: DocumentIcon,
};

const ICON_GLOWS = {
  chat: "shadow-[0_0_16px_rgba(20,184,166,0.25)]",
  wand: "shadow-[0_0_16px_rgba(20,184,166,0.25)]",
  layers: "shadow-[0_0_16px_rgba(20,184,166,0.25)]",
  image: "shadow-[0_0_16px_rgba(20,184,166,0.25)]",
  document: "shadow-[0_0_16px_rgba(20,184,166,0.25)]",
};

function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const rotX = ((y - cy) / cy) * -6;
  const rotY = ((x - cx) / cx) * 6;
  el.style.setProperty("--mx", `${x}px`);
  el.style.setProperty("--my", `${y}px`);
  el.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03) translateY(-2px)`;
}

function handleMouseLeave(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.transform = "";
}

export function QuickActions() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {quickActions.map((action) => {
          const Icon = ICONS[action.icon];
          const glow = ICON_GLOWS[action.icon];

          return (
            <Link
              key={action.label}
              href={action.href}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ transformStyle: "preserve-3d", willChange: "transform", transition: "transform 0.08s ease-out" }}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-card p-3 backdrop-blur-md
              bg-black/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]
              dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            >
              {/* Diagonal glass bevel */}
              <div className="pointer-events-none absolute inset-0
                bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_25%,transparent_55%)]
                dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.08)_25%,transparent_55%)]" />

              {/* Top shine */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-8
                bg-gradient-to-b from-white/[0.08] to-transparent" />

              {/* Mouse spotlight reflection */}
              <div
                className="pointer-events-none absolute inset-0 rounded-card opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{
                  background: [
                    "radial-gradient(circle 7px at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 40%, transparent 70%)",
                    "radial-gradient(circle 70px at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08) 0%, transparent 70%)",
                  ].join(", "),
                }}
              />

              {/* Top row: icon + arrow */}
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[0.65rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-teal-400 transition-all duration-300 group-hover:scale-105 group-hover:${glow} group-hover:border-teal-500/30`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-white/30 dark:text-foreground-soft/40 transition-all duration-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </span>
              </div>

              {/* Labels */}
              <div className="flex-1">
                <p className="text-sm font-semibold text-white dark:text-foreground">{action.label}</p>
                <p className="mt-0.5 text-xs text-white/60 dark:text-foreground-soft leading-relaxed">
                  {action.description}
                </p>
              </div>

              {/* CTA */}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 dark:text-accent transition-all duration-200 group-hover:gap-1.5">
                {action.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
