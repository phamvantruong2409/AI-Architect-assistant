"use client";

import { useEffect, useRef, useState } from "react";

/**
 * % tiến trình MÔ PHỎNG cho các tác vụ AI không báo tiến trình thật (LLM sinh văn
 * bản, phân tích ảnh...). Khi `active`: % bò dần lên tới `cap` (~95%), chậm dần khi
 * gần cap để không bao giờ "đứng" ở 100% trước khi xong. Khi xong (active chuyển
 * false sau khi từng true): nhảy 100% rồi về 0 sau một nhịp ngắn.
 *
 * Trả về số nguyên 0–100 để hiển thị (vd `${pct}%` hoặc width thanh tiến trình).
 */
export function useFakeProgress(active: boolean, cap = 95): number {
  const [pct, setPct] = useState(0);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      const id = setInterval(() => {
        setPct((p) => (p >= cap ? p : Math.min(cap, p + Math.max(0.5, (cap - p) * 0.06))));
      }, 200);
      return () => clearInterval(id);
    }
    if (wasActive.current) {
      wasActive.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPct(100); // hoàn tất → đầy thanh, rồi reset về 0 sau 600ms
      const t = setTimeout(() => setPct(0), 600);
      return () => clearTimeout(t);
    }
  }, [active, cap]);

  return Math.round(pct);
}
