"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getChatSessions,
  subscribeChatSessions,
  type ChatSession,
} from "@/lib/chat-sessions";

export function useChatSessions(): ChatSession[] {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const refresh = useCallback(() => {
    setSessions(getChatSessions());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeChatSessions(refresh);
  }, [refresh]);

  return sessions;
}
