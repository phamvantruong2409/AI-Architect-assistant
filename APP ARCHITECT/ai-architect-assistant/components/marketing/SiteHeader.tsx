import Link from "next/link";
import { Logo } from "./Logo";
import { LinkButton } from "@/components/ui/Button";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-black/15 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
        <Link href="/" className="text-white">
          <Logo forceLight />
        </Link>
        <div className="flex items-center gap-3">
          <LinkButton href="/dashboard" size="sm">
            Đăng nhập
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
