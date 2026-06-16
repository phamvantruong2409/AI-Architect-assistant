import type { ComponentType, SVGProps } from "react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="font-display mt-4 text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-foreground-soft">{description}</p>
      <span className="mt-6 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-foreground-soft">
        Sắp ra mắt
      </span>
    </div>
  );
}
