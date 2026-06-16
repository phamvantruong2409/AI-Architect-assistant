"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "./MarkdownLite";
import type { ChatMessage } from "@/hooks/useChat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-card bg-accent px-4 py-2.5 text-sm text-accent-foreground sm:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2.5 justify-start">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
        <Image
          src="/images/logodark.png"
          alt="AI Architect"
          width={20}
          height={20}
          className="block h-5 w-5 dark:hidden"
        />
        <Image
          src="/images/logolight.png"
          alt="AI Architect"
          width={20}
          height={20}
          className="hidden h-5 w-5 dark:block"
        />
      </div>
      <div className="max-w-[85%] rounded-card border border-border bg-surface px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]">
        {message.content ? (
          <MarkdownLite content={message.content} />
        ) : !message.imageUrl ? (
          <TypingDots />
        ) : null}
        {message.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageUrl}
            alt="Ảnh do AI tạo"
            className="mt-2 max-w-full rounded-card border border-border"
          />
        )}
        {message.content && (
          <button
            onClick={handleCopy}
            className={cn(
              "mt-3 text-xs font-medium text-foreground-soft transition-opacity hover:text-accent",
              "opacity-0 group-hover:opacity-100"
            )}
          >
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground-soft/50"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
