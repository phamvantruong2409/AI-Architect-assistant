"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TaskIndicator } from "./TaskIndicator";
import { IdleUsageOverlay } from "./UsageTime";
import { MenuIcon, CloseIcon, ChatIcon } from "./icons";
import { navItems } from "./nav-items";
import { createClient } from "@/lib/supabase/client";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

const GREETINGS = [
  "Chào! Bạn cần thiết kế gì hôm nay? 🏡",
  "Có ý tưởng mới chưa? Tôi sẵn sàng lắng nghe!",
  "Thử hỏi tôi về phong cách kiến trúc nhé?",
  "Cần brief dự án nhanh? Tôi giúp được đó! ✏️",
  "Hôm nay mình thiết kế gì cùng nhau nhỉ?",
  "Cần tư vấn vật liệu hay xu hướng mới? 💡",
  "Dự án đang tới đâu rồi? Cần tôi phụ một tay không?",
  "Bí ý tưởng mặt tiền? Hỏi tôi thử xem! 🏠",
  "Muốn phối cảnh đẹp hơn? Tôi gợi ý prompt cho nhé!",
  "Đang vướng quy chuẩn nào không? Tôi tra giúp ngay.",
  "Cần ý tưởng bố trí mặt bằng không nào? 📐",
  "Thử một phong cách mới cho dự án hôm nay nhé?",
  "Cần tính khoảng lùi hay mật độ xây dựng? Hỏi tôi nha.",
  "Mệt rồi thì nghỉ chút, xong mình làm tiếp nhé! ☕",
  "Có muốn tôi đề xuất bảng màu cho không gian này?",
  "Cần ý tưởng chống nóng cho hướng Tây không? ☀️",
  "Muốn so sánh vài phương án thiết kế không nào?",
  "Đang nghĩ về nội thất phòng nào thế? Tôi gợi ý nhé!",
  "Cần tham khảo công trình tương tự không? 🔍",
  "Thử brief nhanh cho khách hàng xem sao nhé?",
  "Cần ý tưởng cảnh quan, sân vườn không nào? 🌿",
  "Muốn tối ưu ánh sáng tự nhiên cho nhà không?",
  "Có dự định làm nhà cấp 4 hiện đại không nhỉ?",
  "Cần gợi ý vật liệu bền vững, thân thiện không? 🌱",
  "Đang thiết kế cho khí hậu vùng nào thế?",
  "Muốn tôi phác ý tưởng concept cho dự án mới chứ?",
  "Cần ý tưởng cho không gian nhỏ, tối ưu diện tích? 📏",
  "Thử hỏi tôi về phong thủy hướng nhà nhé?",
  "Có muốn xem xu hướng kiến trúc 2026 không nào? ✨",
  "Cần một góc nhìn mới cho thiết kế hôm nay chứ?",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  // null = đang kiểm tra, true = đã có tên/phiên, false = chưa → đang đẩy về /login
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Guard vào workspace: đã tạo tên (lần trước) hoặc đã đăng nhập Google thì vào
    // thẳng; chưa có gì thì mới đẩy về trang login để tạo tên.
    let active = true;
    (async () => {
      if (localStorage.getItem("user-name")) {
        if (active) setAuthed(true);
        return;
      }
      const { data } = await createClient().auth.getSession();
      if (!active) return;
      if (data.session) {
        setAuthed(true);
      } else {
        setAuthed(false);
        router.replace("/login");
      }
    })();
    return () => { active = false; };
  }, [router]);

  const greetingIndex = useRef(0);

  useEffect(() => {
    if (pathname === "/chat") return;
    let hideTimer: ReturnType<typeof setTimeout>;
    // Lần lượt qua từng câu (không lặp lại liền kề) — mỗi câu cách nhau 2 phút,
    // hiện khoảng 10 giây rồi ẩn.
    const show = () => {
      setGreeting(GREETINGS[greetingIndex.current % GREETINGS.length]);
      greetingIndex.current += 1;
      hideTimer = setTimeout(() => setGreeting(null), 10000);
    };
    const initial = setTimeout(show, 120000);
    const interval = setInterval(show, 120000);
    return () => { clearTimeout(initial); clearInterval(interval); clearTimeout(hideTimer); };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pathname, router]);
  const studioLabels: Record<string, string> = {
    "/portfolio": "Portfolio",
    "/studio/regulatory": "Pháp lý AI",
    "/studio/knowledge": "Kiến thức AI",
    "/concept": "Studio",
  };
  const studioLabel = Object.entries(studioLabels).find(([path]) => pathname.startsWith(path))?.[1];
  const current = navItems.find((item) => item.href === pathname) ?? (studioLabel ? { label: studioLabel } : undefined);

  // Chưa xác minh xong (hoặc chưa có tên → đang chuyển sang /login): không render
  // workspace để tránh nháy nội dung dashboard rồi mới nhảy trang.
  if (authed !== true) return null;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-[280px] shrink-0 md:block">
        <Suspense>
          <Sidebar />
        </Suspense>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl shadow-black/50">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 text-sidebar-foreground-soft"
              aria-label="Đóng menu"
            >
              <CloseIcon />
            </button>
            <Suspense>
              <Sidebar onNavigate={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col relative">
        <header className={`flex h-14 items-center justify-between px-4 sm:px-6 transition-colors z-10 ${pathname === "/dashboard" ? "absolute inset-x-0 top-0 bg-transparent" : "shrink-0 bg-background/80 backdrop-blur-sm"}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="text-foreground-soft md:hidden"
              aria-label="Mở menu"
            >
              <MenuIcon />
            </button>
            <button
              onClick={() => (pathname === "/dashboard" ? router.push("/") : router.back())}
              aria-label={pathname === "/dashboard" ? "Về trang chủ" : "Quay lại"}
              className="flex h-8 w-8 items-center justify-center rounded-card text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-semibold text-foreground">
              {current?.label ?? "AI Architect"}
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar">{children}</main>
      </div>

      {/* Floating buttons */}
      {pathname !== "/chat" && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
          <AnimatePresence>
            {greeting && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                transition={{ duration: 0.25 }}
                className="relative max-w-[190px] rounded-xl rounded-br-sm bg-surface border border-border px-3 py-2 shadow-lg text-xs text-foreground leading-relaxed"
              >
                {greeting}
                <div className="absolute -bottom-1.5 right-2 h-3 w-3 rotate-45 bg-surface border-r border-b border-border" />
              </motion.div>
            )}
          </AnimatePresence>
          <Link
            href="/chat"
            aria-label="Mở AI Chat"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 text-white shadow-lg shadow-teal-500/30 transition-all duration-300 hover:scale-110 hover:shadow-teal-500/50 animate-pulse-glow"
          >
            <img src="/images/logolight.png" alt="AI Chat" className="h-6 w-6 object-contain" />
          </Link>
        </div>
      )}

      {/* Chỉ báo tác vụ nền — hiện ở MỌI trang (kể cả /chat) */}
      <div className="fixed bottom-6 left-6 z-40">
        <TaskIndicator />
      </div>

      {/* Lớp phủ khi rảnh >5 phút — hiện thời gian đã mở app hôm nay */}
      <IdleUsageOverlay />
    </div>
  );
}
