"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

const LOGIN_IMAGES = [
  "/images/anhlogin.png",
  "/images/anhlogin2.png",
  "/images/anhlogin3.png",
  "/images/anhlogin4.png",
  "/images/anhlogin5.png",
  "/images/anhlogin6.png",
];

export default function LoginPage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Slideshow: đổi ảnh mỗi 7s, crossfade 3s (transition ở lớp ảnh)
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % LOGIN_IMAGES.length);
    }, 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Cho biết đã có key lưu sẵn (không tải key thật về client)
    fetch("/api/settings/gemini-key")
      .then((r) => r.json())
      .then((d) => setHasKey(Boolean(d.hasKey)))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setError(null);
    setSaving(true);
    // Chỉ gửi khi người dùng nhập key mới (để trống = giữ key cũ).
    // Key sẽ được kiểm tra hợp lệ ở server trước khi lưu — sai thì chặn đăng nhập.
    const key = apiKey.trim();
    if (key) {
      try {
        const res = await fetch("/api/settings/gemini-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "API key không hợp lệ.");
          setSaving(false);
          return;
        }
      } catch {
        setError("Không kiểm tra được API key. Kiểm tra kết nối mạng rồi thử lại.");
        setSaving(false);
        return;
      }
    }
    localStorage.setItem("user-name", trimmed);
    router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-muted p-10 lg:flex">
        {/* Slideshow ảnh nền — crossfade dần dần (z-0, dưới cùng) */}
        {LOGIN_IMAGES.map((src, i) => (
          <div
            key={src}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-[3000ms] ease-in-out"
            style={{ backgroundImage: `url('${src}')`, opacity: i === slide ? 1 : 0 }}
          />
        ))}
        {/* Lớp phủ nhẹ để logo + dòng chân đọc rõ (z-[1]) */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-black/10 to-black/50" />

        <div className="relative z-10">
          <Logo withSubtitle />
        </div>
        <p className="relative z-10 text-sm text-foreground-soft">
          Từ ý tưởng đến hồ sơ trình bày — mỗi ngày.
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Về trang chủ"
          className="absolute left-5 top-5 flex items-center gap-1.5 text-sm text-foreground-soft transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Trang chủ
        </button>
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo className="justify-center" withSubtitle />
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-2xl tracking-tight">Bạn tên là gì?</h2>
            <p className="text-sm text-foreground-soft">
              Để AI Architect chào đón bạn đúng cách
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground-soft">
                Tên của bạn
              </label>
              <input
                id="name"
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="h-12 w-full rounded-card border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <label htmlFor="apikey" className="text-sm font-medium text-foreground-soft">
                  API Key (Gemini)
                </label>
                <span className="group relative inline-flex">
                  <InfoIcon className="h-3.5 w-3.5 cursor-help text-foreground-soft/70 transition-colors hover:text-accent" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-card border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-foreground shadow-lg group-hover:block">
                    API Key dùng cho các tác vụ có sử dụng AI trong AI Architect Assistant — chat, sinh concept, đánh giá render, thuyết minh, kiểm tra pháp lý...
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
                  </span>
                </span>
              </div>
              <input
                id="apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "•••• đã lưu — để trống nếu giữ nguyên" : "Dán API key của bạn..."}
                className="h-12 w-full rounded-card border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
              />
              <p className="text-xs text-foreground-soft/70">
                {hasKey ? "✓ Đã có key. " : ""}Lấy key miễn phí tại Google AI Studio (aistudio.google.com/apikey).
              </p>
            </div>

            {error && (
              <div className="rounded-card border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12" disabled={!name.trim() || saving}>
              {saving ? "Đang kiểm tra..." : "Bắt đầu →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
