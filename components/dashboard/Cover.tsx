"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const IMAGES = [
  "/images/dashboard/anhbietthuhiendai0.webp",
  "/images/dashboard/anhbietthuhiendai1.webp",
  "/images/dashboard/anhbietthuhiendai2.webp",
  "/images/dashboard/anhbietthuhiendai3.webp",
  "/images/dashboard/anhbietthuhiendai4.webp",
  "/images/dashboard/anhbietthuhiendai5.webp",
];

/** Thời gian hiển thị mỗi ảnh trước khi chuyển (ms). */
const INTERVAL = 15000;

export function Cover() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 -z-20">
      <AnimatePresence>
        <motion.div
          key={index}
          className="absolute inset-0 bg-cover bg-right bg-no-repeat"
          style={{ backgroundImage: `url(${IMAGES[index]})`, filter: "brightness(0.8)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 10, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </div>
  );
}
