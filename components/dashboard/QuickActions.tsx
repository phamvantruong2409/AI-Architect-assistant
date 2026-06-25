"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { quickActions, type IconName, type QuickAction } from "@/lib/dashboard-data";
import type { SVGProps } from "react";
import {
  ChatIcon,
  WandIcon,
  LayersIcon,
  ImageIcon,
  DocumentIcon,
  ArchiveIcon,
  UpscaleIcon,
  WorkflowIcon,
  ChevronDownIcon,
  CubeIcon,
  HomeIcon,
  BuildingIcon,
  CityIcon,
  MapIcon,
  RulerIcon,
  CompassIcon,
  GridIcon,
  BlueprintIcon,
  FloorplanIcon,
  PaletteIcon,
  BrushIcon,
  PencilIcon,
  CameraIcon,
  RenderIcon,
  BoxIcon,
  TreeIcon,
  SunIcon,
  LightbulbIcon,
  TargetIcon,
  RocketIcon,
  SparkleIcon,
  BrainIcon,
  DatabaseIcon,
  FolderIcon,
  FileIcon,
  ChartIcon,
  CalculatorIcon,
  ClockIcon,
  SettingsIcon,
  UsersIcon,
  ShieldIcon,
  SearchIcon,
} from "@/components/layout/icons";

const ICONS: Record<IconName, (props: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  chat: ChatIcon,
  wand: WandIcon,
  layers: LayersIcon,
  image: ImageIcon,
  document: DocumentIcon,
  archive: ArchiveIcon,
  upscale: UpscaleIcon,
  workflow: WorkflowIcon,
  cube: CubeIcon,
  home: HomeIcon,
  building: BuildingIcon,
  city: CityIcon,
  map: MapIcon,
  ruler: RulerIcon,
  compass: CompassIcon,
  grid: GridIcon,
  blueprint: BlueprintIcon,
  floorplan: FloorplanIcon,
  palette: PaletteIcon,
  brush: BrushIcon,
  pencil: PencilIcon,
  camera: CameraIcon,
  render: RenderIcon,
  box: BoxIcon,
  tree: TreeIcon,
  sun: SunIcon,
  lightbulb: LightbulbIcon,
  target: TargetIcon,
  rocket: RocketIcon,
  sparkles: SparkleIcon,
  brain: BrainIcon,
  database: DatabaseIcon,
  folder: FolderIcon,
  file: FileIcon,
  chart: ChartIcon,
  calculator: CalculatorIcon,
  clock: ClockIcon,
  settings: SettingsIcon,
  users: UsersIcon,
  shield: ShieldIcon,
  search: SearchIcon,
};

const GLOW = "shadow-[0_0_16px_rgba(20,184,166,0.25)]";

function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
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

function handleMouseLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "";
}

/** Lớp kính dùng chung cho mọi ô (link, nhóm, bước con). */
function CardSurface() {
  return (
    <>
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
    </>
  );
}

/** Nội dung bên trong ô: icon + nhãn + CTA. */
function CardBody({
  action,
  trailing,
  large,
}: {
  action: QuickAction;
  trailing: React.ReactNode;
  large?: boolean;
}) {
  const Icon = ICONS[action.icon];
  return (
    <>
      {/* Top row: icon + arrow/chevron */}
      <div className="flex items-start justify-between">
        <span
          className={`flex items-center justify-center rounded-[0.65rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-teal-400 transition-all duration-300 group-hover:scale-105 group-hover:${GLOW} group-hover:border-teal-500/30 ${
            large ? "h-12 w-12" : "h-9 w-9"
          }`}
        >
          <Icon className={large ? "h-6 w-6" : "h-4 w-4"} />
        </span>
        {trailing}
      </div>

      {/* Labels */}
      <div className="flex-1 min-h-0">
        <p className={`font-semibold text-white dark:text-foreground ${large ? "text-base" : "text-sm"}`}>
          {action.label}
        </p>
        <p
          className={`mt-0.5 text-white/60 dark:text-foreground-soft leading-relaxed line-clamp-2 ${
            large ? "text-[12px]" : "text-[12px]"
          }`}
        >
          {action.description}
        </p>
      </div>

      {/* CTA */}
      <span
        className={`mt-auto inline-flex items-center gap-1 font-medium text-teal-400 dark:text-accent transition-all duration-200 group-hover:gap-1.5 ${
          large ? "text-sm" : "text-xs"
        }`}
      >
        {action.cta}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </>
  );
}

const CARD_CLASS =
  "group relative flex flex-col gap-2 overflow-hidden rounded-card backdrop-blur-md text-left " +
  "bg-black/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] " +
  "dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

const CARD_STYLE: React.CSSProperties = {
  transformStyle: "preserve-3d",
  willChange: "transform",
  transition: "transform 0.08s ease-out",
};

const ArrowGlyph = (
  <span className="text-white/30 dark:text-foreground-soft/40 transition-all duration-300 group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  </span>
);

function LinkCard({
  action,
  large,
  square,
  onClick,
}: {
  action: QuickAction;
  large?: boolean;
  square?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={action.href}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={CARD_STYLE}
      className={`${CARD_CLASS} ${large ? "p-5" : "p-3"} ${square ? "aspect-square w-full justify-between" : "h-full"}`}
    >
      <CardSurface />
      <CardBody action={action} trailing={ArrowGlyph} large={large} />
    </Link>
  );
}

function GroupCard({
  action,
  open,
  onToggle,
}: {
  action: QuickAction;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-expanded={open}
      style={CARD_STYLE}
      className={`${CARD_CLASS} p-3 ${open ? "ring-1 ring-teal-500/40 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.4)]" : ""}`}
    >
      <CardSurface />
      <CardBody
        action={action}
        trailing={
          <span
            className={`text-teal-400 dark:text-accent transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </span>
        }
      />
    </button>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.8 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 22 },
  },
  exit: { opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.12 } },
};

/** Overlay nổi giữa màn hình, làm mờ nền; bấm nền để đóng. */
function WorkflowOverlay({
  group,
  onClose,
}: {
  group: QuickAction;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const items = group.items!;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Nền mờ — bấm vào để quay lại dashboard */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Cụm 4 ô nổi lên chính giữa */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="relative w-full max-w-4xl"
      >
        <motion.div variants={itemVariants} className="mb-5 text-center">
          <h2 className="text-xl font-semibold text-white">{group.label}</h2>
          <p className="mt-1 text-sm text-white/60">{group.description}</p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4">
          {items.map((sub) => (
            <motion.div key={sub.label} variants={itemVariants} className="w-52">
              <LinkCard action={sub} large square onClick={onClose} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export function QuickActions() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const activeGroup = quickActions.find(
    (a) => a.items && a.label === openGroup
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {quickActions.map((action) =>
          action.items ? (
            <GroupCard
              key={action.label}
              action={action}
              open={openGroup === action.label}
              onToggle={() =>
                setOpenGroup((cur) => (cur === action.label ? null : action.label))
              }
            />
          ) : (
            <LinkCard key={action.label} action={action} />
          )
        )}
      </div>

      <AnimatePresence>
        {activeGroup && (
          <WorkflowOverlay
            key={activeGroup.label}
            group={activeGroup}
            onClose={() => setOpenGroup(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
