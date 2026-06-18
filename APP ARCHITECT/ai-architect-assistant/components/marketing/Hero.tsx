"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const QUOTES = [
  { text: "Ít hơn là nhiều hơn.", author: "Ludwig Mies van der Rohe" },
  { text: "Hình thức đi sau công năng.", author: "Louis Sullivan" },
  { text: "Nhà là một cỗ máy để ở.", author: "Le Corbusier" },
  { text: "Kiến trúc là một trò chơi bậc thầy, chính xác và lộng lẫy của các khối hình được kết hợp với nhau dưới ánh sáng.", author: "Le Corbusier" },
  { text: "Hình thức và công năng là một.", author: "Frank Lloyd Wright" },
  { text: "Có đến 360 độ, tại sao cứ phải bám lấy một độ?", author: "Zaha Hadid" },
  { text: "Bạn hỏi viên gạch: 'Mày muốn gì hở gạch?' và viên gạch trả lời: 'Tôi thích một vòm cuốn'.", author: "Louis Kahn" },
  { text: "Kiến trúc nên nói lên tiếng nói của thời gian và không gian nơi nó đứng, nhưng phải khao khát sự trường tồn.", author: "Frank Gehry" },
  { text: "Chúng ta định hình các tòa nhà; sau đó chúng định hình chúng ta.", author: "Winston Churchill" },
  { text: "Kiến trúc là âm nhạc đóng băng.", author: "Johann Wolfgang von Goethe" },
  { text: "Chúa ngự trị trong các chi tiết.", author: "Ludwig Mies van der Rohe" },
  { text: "Bất kỳ công trình kiến trúc nào không thể hiện được sự thanh bình đều là một sai lầm.", author: "Luis Barragán" },
  { text: "Một căn phòng không phải là một căn phòng nếu thiếu đi ánh sáng tự nhiên.", author: "Louis Kahn" },
  { text: "Đường thẳng thuộc về con người, đường cong thuộc về Thượng đế.", author: "Antoni Gaudí" },
  { text: "Kiến trúc là nỗ lực làm cho thế giới giống với những giấc mơ của chúng ta hơn một chút.", author: "Bjarke Ingels" },
  { text: "Là một kiến trúc sư, bạn thiết kế cho hiện tại, với sự nhận thức về quá khứ, hướng tới một tương lai về cơ bản là chưa biết trước.", author: "Norman Foster" },
  { text: "Kiến trúc là ý chí của một thời đại được chuyển hóa vào không gian.", author: "Ludwig Mies van der Rohe" },
  { text: "Nghệ thuật nguyên thủy chính là kiến trúc. Không có một nền kiến trúc của riêng mình, chúng ta không có linh hồn của nền văn minh chính mình.", author: "Frank Lloyd Wright" },
  { text: "Kiến trúc là một công việc rất nguy hiểm. Nếu bạn tạo ra một kiến trúc tồi, bạn sẽ áp đặt sự xấu xí lên một nơi nào đó trong cả trăm năm.", author: "Renzo Piano" },
  { text: "Tôi không tin kiến trúc phải nói quá nhiều. Nó nên giữ im lặng và để thiên nhiên trong vỏ bọc của gió và ánh sáng mặt trời.", author: "Tadao Ando" },
  { text: "Trong tất cả các tác phẩm của tôi, ánh sáng là yếu tố kiểm soát quan trọng.", author: "Tadao Ando" },
  { text: "Tôi thích vẽ hơn trò chuyện. Vẽ thì nhanh hơn và lại có ít chỗ cho sự dối trá.", author: "Le Corbusier" },
  { text: "Không gian là hơi thở của nghệ thuật.", author: "Frank Lloyd Wright" },
];

const HERO_IMAGES = [
  "/images/hero/anhbiathu1.jpeg",
  "/images/hero/anhbiathu2.jpeg",
  "/images/hero/anhbiathu3.jpeg",
  "/images/hero/anhbiathu4.jpeg",
  "/images/hero/anhbiathu5.jpeg",
];

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const [activeImage, setActiveImage] = useState(0);
  // Bắt đầu ở quote cố định để server và client render giống nhau (tránh lỗi
  // hydration #418). Chọn ngẫu nhiên sau khi mount ở useEffect bên dưới.
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * QUOTES.length));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveImage((i) => (i + 1) % HERO_IMAGES.length);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex(() => Math.floor(Math.random() * QUOTES.length));
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0">
        <AnimatePresence>
          <motion.div
            key={HERO_IMAGES[activeImage]}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <Image
              src={HERO_IMAGES[activeImage]}
              alt=""
              fill
              priority={activeImage === 0}
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <motion.div
        className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-6"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={item}>
          <AnimatePresence mode="wait">
            <motion.h1
              key={quoteIndex}
              className="font-display italic tracking-tight text-white"
              style={{ fontSize: "clamp(0.78rem, 1.25vw, 1.87rem)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
            >
              {QUOTES[quoteIndex].text}
            </motion.h1>
          </AnimatePresence>
          <p className="mt-2 text-sm text-white/50 italic">— {QUOTES[quoteIndex].author}</p>
        </motion.div>
        <motion.div variants={item} className="mt-10">
          <style>{`
            @keyframes shimmer {
              0% { transform: translateX(-130%) skewX(-20deg); }
              100% { transform: translateX(350%) skewX(-20deg); }
            }
            .hero-btn .shimmer-bar { animation: shimmer 2.4s ease-in-out infinite; animation-delay: 0.6s; }
            .hero-btn:hover .shimmer-bar { animation: shimmer 1.2s ease-in-out infinite; }
          `}</style>
          <Link
            href="/dashboard"
            className="hero-btn group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold text-slate-800 transition-all duration-300 hover:scale-105 hover:gap-4"
            style={{ background: "linear-gradient(105deg, #4b5563 0%, #e2e8f0 30%, #f8fafc 48%, #e2e8f0 58%, #94a3b8 75%, #475569 100%)" }}
          >
            {/* shimmer sweep */}
            <span className="shimmer-bar pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            {/* top edge shine */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

            <span className="relative">Vào không gian làm việc</span>

            {/* arrow */}
            <span className="relative flex items-center transition-transform duration-300 group-hover:translate-x-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </motion.div>
      </motion.div>

      <p className="absolute inset-x-0 bottom-20 text-center text-sm text-white/70">
        Ứng dụng được phát triển bởi KTS. Phạm Văn Trường
      </p>
    </section>
  );
}
