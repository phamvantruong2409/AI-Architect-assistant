"use client";

import { motion } from "framer-motion";

export function Cover() {
  return (
    <div className="absolute inset-0 -z-20">
      {/* Day */}
      <div
        className="absolute inset-0 bg-cover bg-right bg-no-repeat"
        style={{ backgroundImage: "url(/images/anhbiadashboard2.png)" }}
      />
      {/* Night — crossfades in and out over the day image */}
      <motion.div
        className="absolute inset-0 bg-cover bg-right bg-no-repeat"
        style={{ backgroundImage: "url(/images/anhbiadashboard3.png)" }}
        animate={{ opacity: [0, 1, 1, 0, 0] }}
        transition={{
          duration: 90,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 1 / 3, 0.5, 5 / 6, 1],
        }}
      />
    </div>
  );
}
