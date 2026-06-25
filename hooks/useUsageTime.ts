"use client";

import { useSyncExternalStore } from "react";
import {
  subscribeUsage,
  getUsageSnapshot,
  getUsageServerSnapshot,
  type UsageState,
} from "@/lib/usage-time";

/**
 * Trạng thái thời gian dùng app trong ngày (live). Chỉ cộng dồn khi tab hiển thị và
 * người dùng còn tương tác trong vòng 5 phút; quá 5 phút không thao tác => `idle`.
 * Reset lúc 6h sáng. Mọi component dùng chung một bộ đếm nên không cộng trùng.
 */
export function useUsageTime(): UsageState {
  return useSyncExternalStore(
    subscribeUsage,
    getUsageSnapshot,
    getUsageServerSnapshot
  );
}
