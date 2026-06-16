import Image from "next/image";
import Link from "next/link";
import {
  CubeIcon,
  ImageIcon,
  LayersIcon,
  PencilIcon,
  WandIcon,
} from "@/components/layout/icons";
import { studioTools, type StudioTool } from "@/lib/dashboard-data";

const icons: Record<StudioTool["icon"], typeof CubeIcon> = {
  cube: CubeIcon,
  layers: LayersIcon,
  wand: WandIcon,
  image: ImageIcon,
  pencil: PencilIcon,
};

const TOOL_GRADIENTS: Record<StudioTool["icon"], string> = {
  image: "from-violet-600 to-purple-500",
  pencil: "from-blue-600 to-blue-500",
  layers: "from-rose-600 to-pink-500",
  cube: "from-teal-600 to-cyan-500",
  wand: "from-zinc-600 to-zinc-500",
};

export function StudioTools() {
  return (
    <div>
      <h2 className="font-display text-base font-semibold text-foreground mb-3">Studio</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {studioTools.map((tool, index) => {
          const ToolIcon = icons[tool.icon];
          const gradient = TOOL_GRADIENTS[tool.icon];

          const content = (
            <div className="group flex flex-col items-center gap-2.5 rounded-card border border-border bg-surface p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-surface-muted hover:shadow-md cursor-pointer">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-[0.75rem] ${
                  tool.iconSrc ? "bg-surface-muted border border-border" : `bg-gradient-to-br ${gradient}`
                } transition-all duration-300 group-hover:scale-105`}
              >
                {tool.iconSrc ? (
                  <Image
                    src={tool.iconSrc}
                    alt={tool.name}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                ) : (
                  <ToolIcon className="h-5 w-5 text-white" />
                )}
              </span>
              <span className="text-xs font-medium text-foreground-soft group-hover:text-foreground transition-colors">
                {tool.name}
              </span>
            </div>
          );

          if (tool.href) {
            return (
              <Link key={index} href={tool.href} className="block">
                {content}
              </Link>
            );
          }

          return <div key={index}>{content}</div>;
        })}
      </div>
    </div>
  );
}
