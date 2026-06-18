import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-black/15 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
        <Link href="/" className="text-white">
          <Logo forceLight />
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-white/20 bg-white/10 px-5 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/35"
        >
          Đăng nhập
        </Link>
      </div>
    </header>
  );
}
