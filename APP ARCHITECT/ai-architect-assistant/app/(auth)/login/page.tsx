"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

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
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError("Không mở được đăng nhập Google. Vui lòng thử lại.");
      setGoogleLoading(false);
    }
    // Nếu thành công, trình duyệt tự chuyển sang Google.
  }

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

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-card border border-border bg-background text-sm font-medium transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            {googleLoading ? "Đang mở Google..." : "Đăng nhập bằng Google"}
          </button>

          <div className="flex items-center gap-3 text-xs text-foreground-soft/60">
            <span className="h-px flex-1 bg-border" />
            hoặc dùng không cần tài khoản
            <span className="h-px flex-1 bg-border" />
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
