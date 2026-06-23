import { Logo } from "@/components/marketing/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ChatIcon,
  GoogleIcon,
  LayersIcon,
  WandIcon,
} from "@/components/layout/icons";
import Link from "next/link";

const features = [
  {
    icon: ChatIcon,
    title: "Hỏi đáp chuyên ngành",
    description: "Thuật ngữ, quy chuẩn và kinh nghiệm KTS Việt Nam.",
  },
  {
    icon: WandIcon,
    title: "Tạo sinh concept từ brief",
    description: "Nhập yêu cầu khách hàng, nhận 3 hướng phong cách.",
  },
  {
    icon: LayersIcon,
    title: "Prompt render & đánh giá",
    description: "Tối ưu cho D5, Lumion, Enscape — và nhận xét ảnh render.",
  },
];

export default function RegisterPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branding panel */}
      <div className="bg-blueprint relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-muted p-10 lg:flex">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-surface-muted/40 to-surface-muted" />

        <Logo withSubtitle />

        <div className="max-w-md space-y-8">
          <h1 className="font-display text-3xl leading-tight tracking-tight">
            Bắt đầu hành trình thiết kế cùng AI
          </h1>
          <div className="space-y-5">
            {features.map(({ icon: FeatureIcon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface text-accent">
                  <FeatureIcon />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-foreground-soft">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-foreground-soft">
          Miễn phí khi bắt đầu — không cần thẻ thanh toán.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:hidden">
            <Logo className="justify-center" withSubtitle />
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-2xl tracking-tight">
              Tạo tài khoản
            </h2>
            <p className="text-sm text-foreground-soft">
              Sẵn sàng cho dự án tiếp theo của bạn
            </p>
          </div>

          <Card className="space-y-5 p-6">
            <Button variant="secondary" className="w-full">
              <GoogleIcon />
              Tiếp tục với Google
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-foreground-soft">
                hoặc
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-foreground-soft"
                >
                  Họ và tên
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground-soft"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="ten@congty.com"
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground-soft"
                >
                  Mật khẩu
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <Button type="submit" className="w-full">
                Tạo tài khoản
              </Button>
            </form>
          </Card>

          <p className="text-center text-sm text-foreground-soft">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
