import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";

export function useChatStorage(userId: string | null) {
  const key = userId ? `talia-chat-${userId}` : null;
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!key || typeof window === "undefined") {
      setReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setInitial(JSON.parse(raw) as UIMessage[]);
      else setInitial([]);
    } catch {
      setInitial([]);
    }
    setReady(true);
  }, [key]);

  const save = useCallback(
    (messages: UIMessage[]) => {
      if (!key || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, JSON.stringify(messages));
      } catch {
        /* ignore quota */
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { initial, ready, save, clear };
}
