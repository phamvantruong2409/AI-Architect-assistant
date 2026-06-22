"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const QUOTES = [
  { text: "Tôi không nhớ nổi bất kì thứ gì trong tuổi thơ tôi mà không liên quan tới công trình.", author: "Renzo Piano" },
  { text: "Một thiết kế chưa được coi là hoàn thành cho đến khi ai đó sử dụng nó.", author: "Brenda Laurel" },
  { text: "Sẽ không bao giờ có kiến trúc sư vĩ đại hay công trình vĩ đại nếu không có những chủ đầu tư vĩ đại.", author: "Emilio Ambasz" },
  { text: "Kiến trúc không dựa trên bê tông, thép hay các yếu tố của đất. Nó dựa trên sự kỳ diệu.", author: "Daniel Libeskind" },
  { text: "Khi bạn có một không gian lớn để chinh phục, đường cong là giải pháp tự nhiên.", author: "Oscar Niemeyer" },
  { text: "Đơn giản là tinh tế cuối cùng.", author: "Leonardo da Vinci" },
  { text: "Mỗi tình huống mới đòi hỏi một kiến trúc mới.", author: "Jean Nouvel" },
  { text: "Kiến trúc không phải là một mô hình kinh doanh mang lại cảm hứng, đó là một quy trình hợp lý để làm những điều hợp lý và hy vọng những điều đó tạo ra cái đẹp, chỉ đơn giản là như vậy.", author: "Harry Seidler" },
  { text: "Tôi yêu giấy. Một tập giấy dày và một cây bút chì, còn tôi là nội dung.", author: "Cecil Balmond" },
  { text: "Một trong những nét quyến rũ của kiến trúc là mỗi lần bắt đầu công việc là như phải làm lại từ đầu.", author: "Renzo Piano" },
  { text: "Kiến trúc không chỉ là lý thuyết, bạn đừng nhìn một toà nhà theo cách của bạn.", author: "Arthur Erickson" },
  { text: "Bất kỳ sản phẩm kiến trúc nào mà không thể hiện được sự thanh thản thì đó là một sai lầm.", author: "Luis Barragán" },
  { text: "Tôi tin rằng chúng tôi — những kiến trúc sư có thể ảnh hưởng đến chất lượng sống của người dân.", author: "Richard Rogers" },
  { text: "Tay nắm cửa là những cái bắt tay của toà nhà.", author: "Juhani Pallasmaa" },
  { text: "Không có gì đòi hỏi sự quan tâm của kiến trúc sư hơn tỷ lệ của các toà nhà.", author: "Vitruvius" },
  { text: "Ý tưởng tốt đến từ khắp mọi nơi. Việc nhận ra một ý tưởng tốt quan trọng hơn việc sáng tác ra nó.", author: "Jeanne Gang" },
  { text: "Kiến trúc là một biểu hiện của giá trị.", author: "Norman Foster" },
  { text: "Là một kiến trúc sư, tôi nghĩ rằng kỹ năng tốt nhất của mình là thành quả của sự phối hợp giữa tay và mắt. Tôi có thể chuyển một bản phác thảo thành một mô hình rồi một toà nhà.", author: "Frank Gehry" },
  { text: "Không gian là hơi thở của nghệ thuật.", author: "Frank Lloyd Wright" },
  { text: "Khi người ta không thoả mãn với ngôi nhà đang sống, họ trở thành kiến trúc sư.", author: "Renzo Piano" },
  { text: "Kiến trúc không phải là phương tiện truyền đạt cảm xúc cá nhân dành cho tôi.", author: "Zaha Hadid" },
  { text: "Chúng tôi kiến trúc nên những tòa nhà và sau đó chúng cũng “kiến trúc” cuộc đời của chúng tôi.", author: "Winston Churchill" },
  { text: "Vẻ đẹp của tòa nhà không phải là thứ mà bạn nhìn vào; phần kết cấu xây dựng của nền móng mới là thứ sẽ được chứng minh theo thời gian.", author: "David Allan Coe" },
  { text: "Kiến trúc tuyệt vời là như cách của nó sau khi mặt trời lặn; có lẽ đến lúc về đêm kiến trúc mới thực sự là nghệ thuật trong đêm, giống như nghệ thuật của pháo hoa.", author: "Gilbert K. Chesterton" },
  { text: "Nghệ thuật là mẹ của kiến trúc. Nếu không có một kiến trúc riêng cho mình, chúng ta cũng không có tâm hồn bên trong ta.", author: "Frank Lloyd Wright" },
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
              style={{ fontSize: "clamp(0.94rem, 1.5vw, 2.24rem)" }}
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
            onClick={() => {
              // Phát nhạc chào mừng khi vào không gian làm việc. Đây là một
              // thao tác click của người dùng nên trình duyệt cho phép phát tiếng.
              // Điều hướng /dashboard là soft-navigation nên Audio vẫn chạy tiếp.
              try {
                const audio = new Audio("/intro.mp3");
                audio.volume = 0.7;
                void audio.play();
              } catch {
                // không phát được nhạc thì vẫn cho vào không gian làm việc
              }
            }}
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
