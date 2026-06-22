import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/15 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-3 text-sm text-white/80 sm:flex-row sm:justify-between">
        <Logo className="text-white" forceLight />
        <p>© {new Date().getFullYear()} AI Architect Assistant. Made for architects.</p>
      </div>
    </footer>
  );
}
