"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ImageIcon, StopIcon } from "@/components/layout/icons";

export function ChatInput({
  onSend,
  onGenerateImage,
  onStop,
  disabled,
  blocked,
}: {
  onSend: (value: string) => void;
  onGenerateImage?: (value: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  blocked?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reset = () => {
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const submit = () => {
    if (!value.trim() || disabled || blocked) return;
    onSend(value);
    reset();
  };

  const submitImage = () => {
    if (!value.trim() || disabled || blocked || !onGenerateImage) return;
    onGenerateImage(value);
    reset();
  };

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-card border border-border bg-surface p-2 pl-4 shadow-sm focus-within:border-accent/50">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder={blocked ? "Đã hết hạn mức Gemini cho hôm nay..." : "Hỏi về thiết kế, vật liệu, quy chuẩn..."}
          disabled={blocked}
          className="flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-foreground-soft/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {onGenerateImage && (
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled || blocked || !value.trim()}
            onClick={submitImage}
            title="Tạo ảnh minh hoạ từ mô tả"
          >
            <ImageIcon className="h-4 w-4" />
            Tạo ảnh
          </Button>
        )}
        {disabled && onStop ? (
          <Button size="sm" variant="secondary" onClick={onStop} title="Dừng phản hồi">
            <StopIcon className="h-4 w-4" />
            Dừng
          </Button>
        ) : (
          <Button size="sm" disabled={disabled || blocked || !value.trim()} onClick={submit}>
            Gửi
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-foreground-soft">
        AI có thể chưa chính xác hoàn toàn — luôn kiểm tra lại với quy chuẩn hiện hành.
      </p>
    </div>
  );
}
