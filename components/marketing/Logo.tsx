import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  withSubtitle = false,
  forceLight = false,
}: {
  className?: string;
  withSubtitle?: boolean;
  forceLight?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/images/logodark.png"
        alt="AI Architect"
        width={42}
        height={42}
        className={cn(
          "h-[42px] w-[42px] shrink-0",
          forceLight ? "hidden" : "block dark:hidden",
        )}
      />
      <Image
        src="/images/logolight.png"
        alt="AI Architect"
        width={42}
        height={42}
        className={cn(
          "h-[42px] w-[42px] shrink-0",
          forceLight ? "block" : "hidden dark:block",
        )}
      />
      <span className="leading-tight">
        <span className="font-display block text-2xl tracking-tight">
          AI Architect
        </span>
        {withSubtitle && (
          <span className="block text-base text-foreground-soft">
            Assistant
          </span>
        )}
      </span>
    </span>
  );
}
