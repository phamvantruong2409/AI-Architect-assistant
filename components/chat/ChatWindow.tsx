"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { useChatModel } from "@/hooks/useChatModel";
import { useAiUsage } from "@/hooks/useAiUsage";
import { getChatSession, type ChatSessionMessage } from "@/lib/chat-sessions";
import { AI_MODELS, GEMINI_MODELS, DEFAULT_CHAT_MODEL } from "@/lib/ai-models";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { DEFAULT_CHAT_QUESTIONS } from "@/lib/suggestions";
import { DAILY_CHAT_LIMIT } from "@/lib/ai-usage";

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
  suggestions,
  emptyTitle = DEFAULT_TITLE,
  emptyDescription = DEFAULT_DESCRIPTION,
  banner,
  sessionIdParam,
  initialSessionId,
}: ChatWindowProps & { sessionIdParam: string | null; initialSessionId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Load existing session messages async before mounting the chat UI
  const [loadedMessages, setLoadedMessages] = useState<ChatSessionMessage[] | null>(
    sessionIdParam ? null : []
  );

  useEffect(() => {
    if (!sessionIdParam) return;
    getChatSession(sessionIdParam).then((s) => {
      setLoadedMessages((s?.messages ?? []) as ChatSessionMessage[]);
    });
  }, [sessionIdParam]);

  if (loadedMessages === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-foreground-soft">
        Đang tải...
      </div>
    );
  }

  return (
    <ChatSessionInner
      mode={mode}
      suggestions={suggestions}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      banner={banner}
      sessionIdParam={sessionIdParam}
      initialSessionId={initialSessionId}
      initialMessages={loadedMessages}
      pathname={pathname}
      router={router}
      searchParams={searchParams}
    />
  );
}

function ChatSessionInner({
  mode,
  suggestions,
  emptyTitle,
  emptyDescription,
  banner,
  sessionIdParam,
  initialSessionId,
  initialMessages,
  pathname,
  router,
  searchParams,
}: ChatWindowProps & {
  sessionIdParam: string | null;
  initialSessionId: string;
  initialMessages: ChatSessionMessage[];
  pathname: string;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const [sessionId] = useState(() => sessionIdParam ?? initialSessionId);
  const [model, setModel] = useChatModel(AI_MODELS, DEFAULT_CHAT_MODEL);
  const { rateLimited } = useAiUsage();

  const { messages, sendMessage, generateImage, stopGeneration, resetQuota, isStreaming, quotaExceeded, chatLimitReached } = useChat(
    mode,
    { id: sessionId, path: pathname, initialMessages },
    model
  );

  // Model Gemini còn lượt để gợi ý chuyển sang khi model hiện tại bị 429
  // (chỉ áp dụng cho Gemini — DeepSeek dùng quota/số dư riêng của người dùng).
  const fallback = GEMINI_MODELS.find((m) => m.id !== model && !rateLimited[m.id]);
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

  // Khi không truyền suggestions riêng (vd chat mặc định) → tải câu hỏi gợi ý
  // theo ngày do AI tạo sinh, bám xu hướng hiện tại; lỗi/offline thì giữ mặc định.
  const [dailyQuestions, setDailyQuestions] = useState<string[] | null>(null);
  useEffect(() => {
    if (suggestions) return;
    let alive = true;
    fetch("/api/chat-suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.suggestions?.length) setDailyQuestions(d.suggestions);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [suggestions]);
  const effectiveSuggestions = suggestions ?? dailyQuestions ?? DEFAULT_CHAT_QUESTIONS;

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
            {AI_MODELS.map((m) => (
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
            title={emptyTitle ?? DEFAULT_TITLE}
            description={emptyDescription ?? DEFAULT_DESCRIPTION}
            suggestions={effectiveSuggestions}
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
        fallback ? (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-600">
            <span>Đã hết lượt đặt câu hỏi cho hôm nay.</span>
            <button
              onClick={() => {
                setModel(fallback.id);
                resetQuota();
              }}
              className="rounded-card bg-amber-500/90 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-amber-500"
            >
              Thử nguồn AI khác
            </button>
          </div>
        ) : (
          <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs font-medium text-red-500">
            ⚠️ Đã hết lượt gọi AI hôm nay (tất cả model). Vui lòng thử lại sau.
          </div>
        )
      )}
      {chatLimitReached && (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-600">
          Đã đạt giới hạn {DAILY_CHAT_LIMIT} câu hỏi cho hôm nay. Vui lòng quay lại vào ngày mai.
        </div>
      )}
      <ChatInput
        onSend={sendMessage}
        onGenerateImage={generateImage}
        onStop={stopGeneration}
        disabled={isStreaming}
        blocked={quotaExceeded || chatLimitReached}
        blockedMessage={chatLimitReached ? `Đã đạt ${DAILY_CHAT_LIMIT} câu hỏi cho hôm nay — quay lại vào ngày mai.` : undefined}
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logoiconhinhtron.png"
        alt="AI Architect"
        className="h-16 w-16 rounded-full object-contain"
      />
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
