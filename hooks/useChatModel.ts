"use client";

import { useEffect, useState } from "react";
import { AI_MODELS, DEFAULT_GEMINI_MODEL, type AiModelId } from "@/lib/ai-models";

const STORAGE_KEY = "ai-architect:chat-model";

/**
 * Lựa chọn model dùng chung (lưu localStorage). `allowed` giới hạn danh sách
 * model hợp lệ cho trang hiện tại — trang chỉ hỗ trợ Gemini truyền GEMINI_MODELS
 * để không hiển thị/nhận model DeepSeek đã lưu từ tính năng khác.
 */
export function useChatModel<T extends string = AiModelId>(
  allowed: readonly { id: T }[] = AI_MODELS as unknown as readonly { id: T }[],
  defaultModel: T = DEFAULT_GEMINI_MODEL as T
) {
  const [model, setModel] = useState<T>(defaultModel);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && allowed.some((m) => m.id === stored)) {
      // Đọc lựa chọn đã lưu sau khi mount để tránh lệch hydration (server không
      // có localStorage). setState ở đây là cố ý.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModel(stored as T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateModel = (value: T) => {
    setModel(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  };

  return [model, updateModel] as const;
}
