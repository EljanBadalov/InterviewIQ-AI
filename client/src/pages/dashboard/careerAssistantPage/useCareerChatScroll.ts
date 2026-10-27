import { useLayoutEffect, useRef } from "react";
import type { ChatMessage } from "./useCareerChatHistory";

export const useCareerChatScroll = (sessionKey: string, messages: ChatMessage[], sending: boolean) => {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const previous = useRef({ sessionKey: "", first: "", last: "", height: 0, top: 0 });
  const capture = () => {
    const element = viewport.current;
    if (!element) return;
    previous.current.height = element.scrollHeight;
    previous.current.top = element.scrollTop;
  };
  const onScroll = () => {
    const element = viewport.current;
    if (!element) return;
    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
    capture();
  };
  const followNext = () => { following.current = true; };
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const before = previous.current;
    const first = messages[0]?.id || "";
    const last = messages.at(-1)?.id || "";
    if (before.sessionKey !== sessionKey) {
      following.current = true;
      element.scrollTop = element.scrollHeight;
    } else if (before.first && first !== before.first && last === before.last) {
      // Prepending older messages must preserve the visible reading position.
      element.scrollTop = before.top + element.scrollHeight - before.height;
    } else if (following.current) {
      element.scrollTop = element.scrollHeight;
    }
    previous.current = { sessionKey, first, last, height: element.scrollHeight, top: element.scrollTop };
  }, [sessionKey, messages, sending]);
  return { viewport, onScroll, capture, followNext };
};
