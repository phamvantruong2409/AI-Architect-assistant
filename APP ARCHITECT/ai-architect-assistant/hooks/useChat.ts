"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveChatSession } from "@/lib/chat-sessions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

export interface ChatSessionConfig {
  id: string;
  path: string;
  initialMessages?: ChatMessage[];
}

export function useChat(
  mode?: "default" | "legal",
  session?: ChatSessionConfig,
  model?: string
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load persisted messages after mount only, so the server-rendered (empty)
  // markup matches the client's first render and avoids a hydration mismatch.
  useEffect(() => {
    if (session?.initialMessages?.length) {
      setMessages(session.initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session?.id || messages.length === 0) return;
    saveChatSession({ id: session.id, path: session.path, messages });
  }, [messages, session?.id, session?.path]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || quotaExceeded) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      const assistantId = `a-${Date.now()}`;
      const history = [...messages, userMessage];

      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            mode,
            model,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          if (data?.code === "QUOTA_EXCEEDED") setQuotaExceeded(true);
          throw new Error(data?.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user stopped generation — keep the partial response as-is
        } else {
          const message = err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.";
          setError(message);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: message } : m))
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, model]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const generateImage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Có lỗi xảy ra, vui lòng thử lại.");

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Đây là ảnh AI tạo cho bạn:", imageUrl: data.image } : m
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.";
        setError(message);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: message } : m))
        );
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  return { messages, sendMessage, generateImage, stopGeneration, isStreaming, error, quotaExceeded };
}
