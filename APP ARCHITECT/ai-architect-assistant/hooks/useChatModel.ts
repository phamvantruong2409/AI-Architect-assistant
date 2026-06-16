"use client";

import { useEffect, useState } from "react";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, type GeminiModelId } from "@/lib/gemini-models";

const STORAGE_KEY = "ai-architect:chat-model";

function isGeminiModelId(value: string | null): value is GeminiModelId {
  return GEMINI_MODELS.some((m) => m.id === value);
}

export function useChatModel() {
  const [model, setModel] = useState<GeminiModelId>(DEFAULT_GEMINI_MODEL);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isGeminiModelId(stored)) setModel(stored);
  }, []);

  const updateModel = (value: GeminiModelId) => {
    setModel(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  };

  return [model, updateModel] as const;
}
