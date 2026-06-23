"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "@/components/layout/icons";
import { DEFAULT_SUGGESTIONS } from "@/lib/suggestions";

export function PromptBar() {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const router = useRouter();

  // Tải gợi ý theo ngày (do AI tạo sinh, bám bối cảnh hôm nay); lỗi thì giữ mặc định.
  useEffect(() => {
    let alive = true;
    fetch("/api/suggestions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data?.suggestions?.length) setSuggestions(data.suggestions);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const submit = (query?: string) => {
    const q = (query ?? value).trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="space-y-3">
      <div className="relative flex items-center gap-2 rounded-card p-2 pl-4 backdrop-blur-[2px] transition-all duration-300
        bg-white/[0.04] shadow-[inset_0_2px_0px_rgba(255,255,255,0.45),0_0_20px_rgba(20,184,166,0.08)] focus-within:bg-white/[0.06] focus-within:shadow-[inset_0_2px_0px_rgba(255,255,255,0.5),0_0_25px_rgba(20,184,166,0.22)]
        dark:bg-white/[0.04] dark:shadow-[inset_0_2px_0px_rgba(255,255,255,0.45),0_0_20px_rgba(20,184,166,0.08)] dark:focus-within:bg-white/[0.06]">
        {/* Diagonal glass bevel */}
        <div className="pointer-events-none absolute inset-0 rounded-card bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.06)_25%,transparent_55%)]" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Mô tả ý tưởng, đặt câu hỏi hoặc dán brief dự án..."
          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
        />
        <button
          onClick={() => submit()}
          aria-label="Gửi"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-gradient-to-br from-teal-500 to-cyan-400 text-white shadow-md transition-all hover:scale-105 hover:shadow-[0_0_18px_rgba(20,184,166,0.5)]"
        >
          <SendIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/35">Gợi ý cho bạn:</span>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-all hover:border-accent/40 hover:bg-accent/10 hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
