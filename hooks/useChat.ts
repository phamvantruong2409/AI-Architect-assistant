"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveChatSession } from "@/lib/chat-sessions";
import {
  recordAiCall,
  markRateLimited,
  estimateTokens,
  isChatLimitReached,
  recordChatQuestion,
  DAILY_CHAT_LIMIT,
  USAGE_EVENT,
} from "@/lib/ai-usage";
import { startTask, dismissTask } from "@/lib/tasks";
import { useTask } from "@/hooks/useTasks";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";

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

// AbortController theo taskId ở cấp module → nút Dừng hoạt động cả khi tác vụ
// đang chạy nền (sau khi rời trang rồi quay lại, mount mới vẫn dừng được).
const chatControllers = new Map<string, AbortController>();

export function useChat(
  mode?: "default" | "legal",
  session?: ChatSessionConfig,
  model?: string
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [chatLimitReached, setChatLimitReached] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stream chat chạy như TÁC VỤ NỀN, khoá theo session → rời trang vẫn chạy &
  // lưu; quay lại reconnect đọc partial live.
  const chatTaskId = session?.id ? `chat:${session.id}` : null;
  const task = useTask(chatTaskId);
  const isStreaming = imageBusy || task?.status === "running";

  // Load tin nhắn đã lưu sau khi mount (tránh lệch hydration).
  useEffect(() => {
    if (session?.initialMessages?.length) {
      setMessages(session.initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu session khi tin nhắn đổi (cho thao tác ngoài streaming; lúc stream thì
  // runner cũng tự lưu để sống sót khi unmount).
  useEffect(() => {
    if (!session?.id || messages.length === 0) return;
    saveChatSession({ id: session.id, path: session.path, messages });
  }, [messages, session?.id, session?.path]);

  // Đồng bộ trạng thái chạm trần câu hỏi/ngày (kể cả giữa nhiều cửa sổ).
  useEffect(() => {
    const refresh = () => setChatLimitReached(isChatLimitReached());
    refresh();
    window.addEventListener(USAGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(USAGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Phản chiếu partial/result của tác vụ stream vào tin nhắn assistant cuối cùng.
  useEffect(() => {
    if (!task) return;
    const text =
      task.status === "done"
        ? ((task.result as string) ?? "")
        : ((task.partial as string) ?? "");

    if (text) {
      setMessages((prev) => {
        // tìm message assistant cuối cùng
        let realIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "assistant") {
            realIdx = i;
            break;
          }
        }
        if (realIdx === -1 || prev[realIdx].content === text) return prev;
        const next = [...prev];
        next[realIdx] = { ...next[realIdx], content: text };
        return next;
      });
    }

    if (task.status === "error") {
      setError(task.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
      setMessages((prev) => {
        let realIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "assistant") {
            realIdx = i;
            break;
          }
        }
        if (realIdx === -1) return prev;
        const next = [...prev];
        if (!next[realIdx].content) next[realIdx] = { ...next[realIdx], content: task.error ?? "Có lỗi xảy ra." };
        return next;
      });
      dismissTask(task.id);
    } else if (task.status === "done") {
      dismissTask(task.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.partial, task?.result]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || quotaExceeded) return;

      // Chặn cứng khi đã đạt trần câu hỏi/ngày của máy.
      if (isChatLimitReached()) {
        setChatLimitReached(true);
        return;
      }

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `a-${Date.now()}`;
      const history = [...messages, userMessage];
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setError(null);

      const reqModel = model ?? DEFAULT_GEMINI_MODEL;
      const sess = session;
      const taskId = chatTaskId ?? `chat-${Date.now()}`;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      chatControllers.set(taskId, controller);

      const persist = (text: string) => {
        if (!sess) return;
        saveChatSession({
          id: sess.id,
          path: sess.path,
          messages: [...history, { id: assistantId, role: "assistant", content: text }],
        });
      };

      startTask({
        id: taskId,
        type: "chat",
        label: "Đang trả lời…",
        route: sess ? `${sess.path}?id=${sess.id}` : undefined,
        run: async (h) => {
          let fullText = "";
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
              if (data?.code === "QUOTA_EXCEEDED") {
                setQuotaExceeded(true);
                markRateLimited(reqModel);
              }
              throw new Error(data?.error ?? "Có lỗi xảy ra, vui lòng thử lại.");
            }

            // Câu hỏi đã tới model → tính vào trần ngày; đạt 15 thì khoá.
            if (recordChatQuestion() >= DAILY_CHAT_LIMIT) setChatLimitReached(true);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullText += decoder.decode(value, { stream: true });
              h.setPartial(fullText);
              persist(fullText);
            }
          } catch (err) {
            // Người dùng bấm Dừng → giữ phần đã nhận, coi như hoàn tất.
            if (err instanceof DOMException && err.name === "AbortError") {
              persist(fullText);
              return fullText;
            }
            throw err;
          }

          const inputText = history.map((m) => m.content).join("\n");
          recordAiCall(reqModel, estimateTokens(inputText) + estimateTokens(fullText));
          persist(fullText);
          chatControllers.delete(taskId);
          return fullText;
        },
      });
    },
    [messages, model, quotaExceeded, chatTaskId, session, mode]
  );

  const stopGeneration = useCallback(() => {
    const c = (chatTaskId && chatControllers.get(chatTaskId)) || abortControllerRef.current;
    c?.abort();
  }, [chatTaskId]);

  const resetQuota = useCallback(() => setQuotaExceeded(false), []);

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
      setImageBusy(true);
      setError(null);

      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Có lỗi xảy ra, vui lòng thử lại.");

        recordAiCall("gemini-2.5-flash-image", estimateTokens(trimmed));
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
        setImageBusy(false);
      }
    },
    []
  );

  return { messages, sendMessage, generateImage, stopGeneration, resetQuota, isStreaming, error, quotaExceeded, chatLimitReached };
}
