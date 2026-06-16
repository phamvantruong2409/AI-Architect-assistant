"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const QUOTES = [
  { text: "Định hình thiết kế từ nét vẽ đầu tiên.", author: "KTS. Phạm Văn Trường" },
  { text: "Kiến trúc là âm nhạc được đóng băng.", author: "Friedrich Schelling" },
  { text: "Hình thức đi theo chức năng.", author: "Louis Sullivan" },
  { text: "Ít hơn là nhiều hơn.", author: "Ludwig Mies van der Rohe" },
  { text: "Kiến trúc bắt đầu khi bạn đặt hai viên gạch lên nhau thật cẩn thận.", author: "Ludwig Mies van der Rohe" },
  { text: "Ngôi nhà là cỗ máy để sống.", author: "Le Corbusier" },
  { text: "Không gian, ánh sáng và trật tự — đó là những gì con người cần.", author: "Le Corbusier" },
  { text: "Ánh sáng là nguyên liệu chính của kiến trúc.", author: "Louis Kahn" },
  { text: "Khoảng không giữa các bức tường quan trọng không kém bản thân bức tường.", author: "Louis Kahn" },
  { text: "Chi tiết không phải là chi tiết — chúng tạo nên thiết kế.", author: "Charles Eames" },
  { text: "Hãy đọc thiên nhiên như một cuốn sách mở.", author: "Antoni Gaudí" },
  { text: "Kiến trúc là cuộc đối thoại giữa con người và không gian họ sinh sống.", author: "Tadao Ando" },
  { text: "Tôi không thiết kế công trình — tôi thiết kế những giấc mơ.", author: "Zaha Hadid" },
  { text: "Kiến trúc nên nói về thời đại của nó, nhưng khao khát sự trường tồn.", author: "Frank Gehry" },
  { text: "Ngôi nhà tốt nhất là ngôi nhà bạn luôn muốn trở về.", author: "Frank Lloyd Wright" },
  { text: "Kiến trúc là nghệ thuật cư trú — cách con người hiện diện trên trái đất.", author: "Martin Heidegger" },
  { text: "Vật liệu thô sơ nhất cũng tạo nên vẻ đẹp khi được đặt đúng chỗ.", author: "Peter Zumthor" },
  { text: "Mỗi công trình là một câu hỏi về cách sống.", author: "Peter Zumthor" },
  { text: "Kiến trúc phải chạm đến mặt đất bằng sự khiêm nhường.", author: "Alvar Aalto" },
  { text: "Kiến trúc tốt cho phép con người sống với phẩm giá hơn.", author: "Renzo Piano" },
  { text: "Ngôi nhà là thơ ca được xây dựng bằng vật liệu.", author: "John Ruskin" },
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
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

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
              className="font-display italic tracking-tight text-white whitespace-nowrap"
              style={{ fontSize: "clamp(1rem, 1.6vw, 2.4rem)" }}
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
