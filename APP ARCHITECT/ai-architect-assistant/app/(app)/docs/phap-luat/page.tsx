import { Suspense } from "react";
import Link from "next/link";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ExternalLinkIcon } from "@/components/layout/icons";

const SUGGESTIONS = [
  "Khoảng lùi xây dựng nhà phố quy định trong văn bản nào?",
  "Luật Đất đai 2024 có gì thay đổi về cấp phép xây dựng?",
  "Quy chuẩn PCCC cho nhà ở riêng lẻ kết hợp kinh doanh?",
  "Văn bản nào quy định mật độ xây dựng tối đa?",
];

export default function PhapLuatPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <Suspense>
        <ChatWindow
          mode="legal"
          suggestions={SUGGESTIONS}
          emptyTitle="Tra cứu pháp luật xây dựng"
          emptyDescription="Hỏi về luật, nghị định, thông tư và quy chuẩn liên quan đến xây dựng — trợ lý đối chiếu với các văn bản hiện hành."
          banner={
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted px-4 py-2 text-xs text-foreground-soft">
              <span>
                Nguồn đối chiếu: văn bản pháp luật về xây dựng, nhà ở, đất đai,
                quy hoạch, PCCC — luôn kiểm tra lại bản mới nhất.
              </span>
              <Link
                href="https://thuvienphapluat.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline"
              >
                thuvienphapluat.vn
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          }
        />
      </Suspense>
    </div>
  );
}
