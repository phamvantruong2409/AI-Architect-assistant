"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useUsageTime } from "@/hooks/useUsageTime";
import { formatUsage, splitClock } from "@/lib/usage-time";
import { ClockIcon } from "./icons";

/** Hiển thị nhỏ trong sidebar: thời gian đã mở app hôm nay. */
export function UsageTimeBadge() {
  const { seconds } = useUsageTime();
  return (
    <div
      className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground-soft"
      title="Thời gian dùng ứng dụng hôm nay (làm mới lúc 6h sáng)"
    >
      <ClockIcon className="h-3 w-3" />
      <span>Hôm nay: {formatUsage(seconds)}</span>
    </div>
  );
}

/**
 * Lớp phủ hiện khi rảnh hơn 5 phút (không thao tác), cho biết đã mở ứng dụng bao lâu
 * hôm nay — với giao diện đồng hồ ĐỒNG THAU CỔ ĐIỂN. Chỉ CLICK / gõ phím / chạm mới
 * tắt (di chuột không tắt).
 */
export function IdleUsageOverlay() {
  const { seconds, idle } = useUsageTime();
  const { hh, mm, ss } = splitClock(seconds);

  return (
    <AnimatePresence>
      {idle && (
        <motion.div
          key="idle-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="vintage-backdrop fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
        >
          {/* Hạt nhiễu phim cổ */}
          <div className="vintage-grain pointer-events-none absolute inset-0" />

          {/* Khối đồng hồ */}
          <div className="vintage-enter relative flex flex-col items-center">
            {/* Mặt đồng hồ tròn */}
            <div className="vintage-clock-face relative flex h-72 w-72 items-center justify-center rounded-full sm:h-80 sm:w-80">
              {/* Vành đồng thau quay */}
              <div className="vintage-brass-ring pointer-events-none absolute -inset-1 rounded-full opacity-70" />

              {/* Vạch giờ quanh mặt */}
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-3 w-[2px] rounded bg-[#caa15e]/60"
                  style={{
                    transform: `rotate(${i * 30}deg) translateY(-128px)`,
                    transformOrigin: "center",
                  }}
                />
              ))}

              {/* Nội dung trung tâm */}
              <div className="relative z-10 flex flex-col items-center px-6 text-center">
                <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[#caa15e]/80">
                  Thời gian hôm nay
                </p>

                <div className="mt-3 flex items-baseline font-display text-5xl font-semibold sm:text-6xl vintage-digits">
                  <span>{hh}</span>
                  <span className="vintage-colon mx-1">:</span>
                  <span>{mm}</span>
                  <span className="vintage-colon mx-1">:</span>
                  <span>{ss}</span>
                </div>

                <div className="mt-2 flex gap-3 text-[10px] uppercase tracking-[0.25em] text-[#caa15e]/55">
                  <span>Giờ</span>
                  <span>Phút</span>
                  <span>Giây</span>
                </div>
              </div>
            </div>

            {/* Con lắc */}
            <div className="vintage-pendulum mt-1 flex flex-col items-center">
              <div className="h-16 w-[2px] bg-gradient-to-b from-[#caa15e]/70 to-[#8a6a32]/40" />
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#f3d9a6] to-[#8a6a32] shadow-[0_0_14px_rgba(243,217,166,0.4)]" />
            </div>

            {/* Lời nhắc */}
            <p className="mt-6 text-xs italic tracking-wide text-[#d8b87a]/70">
              Bạn đã nghỉ một lát — chạm hoặc nhấn để quay lại làm việc
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
