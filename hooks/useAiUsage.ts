"use client";

import { useEffect, useState } from "react";
import {
  getUsageStats,
  getRateLimited,
  USAGE_EVENT,
  type UsageStats,
} from "@/lib/ai-usage";

export function useAiUsage() {
  const [stats, setStats] = useState<UsageStats>({ rpd: 0, tpm: 0 });
  const [rateLimited, setRateLimited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const refresh = () => {
      setStats(getUsageStats());
      setRateLimited(getRateLimited());
    };
    refresh();
    window.addEventListener(USAGE_EVENT, refresh);
    window.addEventListener("storage", refresh); // đồng bộ giữa các cửa sổ
    // TPM dùng cửa sổ trượt 60s — refresh định kỳ để thanh tự phân rã về 0
    const iv = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener(USAGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      clearInterval(iv);
    };
  }, []);

  return { stats, rateLimited };
}
