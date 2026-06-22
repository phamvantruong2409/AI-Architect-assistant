import { Suspense } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <Suspense>
        <ChatWindow />
      </Suspense>
    </div>
  );
}
