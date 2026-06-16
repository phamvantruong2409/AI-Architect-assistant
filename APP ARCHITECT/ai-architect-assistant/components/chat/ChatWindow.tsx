"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useChatModel } from "@/hooks/useChatModel";
import { getChatSession } from "@/lib/chat-sessions";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SparkleIcon } from "@/components/layout/icons";

const DEFAULT_SUGGESTIONS = [
  "Gợi ý vật liệu chống nóng cho mặt tiền hướng Tây",
  "Quy định khoảng lùi xây dựng nhà phố theo QCVN 01:2021",
  "So sánh phong cách Indochine và Nhiệt đới hiện đại",
  "Thông thủy cầu thang tối thiểu là bao nhiêu?",
];

const DEFAULT_TITLE = "Bạn đang nghĩ về điều gì?";
const DEFAULT_DESCRIPTION =
  "Hỏi về thuật ngữ, quy chuẩn, vật liệu hay phong cách kiến trúc Việt Nam — trợ lý sẽ trả lời ngay.";

interface ChatWindowProps {
  mode?: "default" | "legal";
  suggestions?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  banner?: ReactNode;
}

export function ChatWindow(props: ChatWindowProps) {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("id");
  // Stable id for a brand-new chat (no ?id= yet). Once the session adopts
  // this id via router.replace, sessionIdParam === generatedId, so the key
  // below stays the same and the chat doesn't remount mid-stream.
  const [generatedId] = useState(() => crypto.randomUUID());
  const key = sessionIdParam ?? generatedId;

  return (
    <ChatSession
      key={key}
      sessionIdParam={sessionIdParam}
      initialSessionId={generatedId}
      {...props}
    />
  );
}

function ChatSession({
  mode = "default",
  suggestions = DEFAULT_SUGGESTIONS,
  emptyTitle = DEFAULT_TITLE,
  emptyDescription = DEFAULT_DESCRIPTION,
  banner,
  sessionIdParam,
  initialSessionId,
}: ChatWindowProps & { sessionIdParam: string | null; initialSessionId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessionId] = useState(() => sessionIdParam ?? initialSessionId);
  const [initialMessages] = useState(() =>
    sessionIdParam ? getChatSession(sessionIdParam)?.messages ?? [] : []
  );

  const [model, setModel] = useChatModel();
  const { messages, sendMessage, generateImage, stopGeneration, isStreaming, quotaExceeded } = useChat(
    mode,
    {
      id: sessionId,
      path: pathname,
      initialMessages,
    },
    model
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionIdParam && messages.length > 0) {
      router.replace(`${pathname}?id=${sessionId}`);
    }
  }, [messages.length, sessionIdParam, pathname, sessionId, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {banner}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="relative">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            className="appearance-none rounded-card border border-border bg-surface px-3 py-1.5 pr-8 text-xs font-medium text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            suggestions={suggestions}
            onPick={sendMessage}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>
      {quotaExceeded && (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-600">
          Đã hết hạn mức sử dụng Gemini cho hôm nay. Vui lòng thử lại sau hoặc đổi sang model khác.
        </div>
      )}
      <ChatInput
        onSend={sendMessage}
        onGenerateImage={generateImage}
        onStop={stopGeneration}
        disabled={isStreaming}
        blocked={quotaExceeded}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  suggestions,
  onPick,
}: {
  title: string;
  description: string;
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <SparkleIcon className="h-6 w-6" />
      </div>
      <h2 className="font-display mt-4 text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-foreground-soft">
        {description}
      </p>
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-card border border-border bg-surface px-4 py-3 text-left text-sm text-foreground-soft transition-colors hover:border-accent/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
