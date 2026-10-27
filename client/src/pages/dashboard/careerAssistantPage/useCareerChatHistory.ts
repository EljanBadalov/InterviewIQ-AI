import { useEffect, useRef, useState } from "react";
import {
  createCareerAssistantSessionId, deleteCareerConversation, getCareerConversation, getCareerMessages, listCareerConversations,
  renameCareerConversation, sendCareerAssistantMessage, type CareerAssistantChatResponse, type CareerConversation, type CareerHistoryMessage
} from "../../../api/careerAssistantApi";
import { getAuthToken, getStoredUser } from "../../../utils/authStorage";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CareerAssistantChatResponse;
}
const welcome: ChatMessage[] = [{ id: "welcome", role: "assistant", content:
  "Hi! I'm your InterviewIQ Career Assistant. I can help analyze your CV, compare job matches, review interview performance, track your career progress, and plan your next steps." }];
const toMessage = (message: CareerHistoryMessage): ChatMessage => {
  const metadata = message.metadata || {};
  return { id: message._id, role: message.sender === "customer" ? "user" : "assistant", content: message.text,
    response: message.sender === "assistant" ? {
      sessionId: "", reply: message.text, intent: message.intent || "", confidence: message.confidence || 0,
      alternatives: [], needsClarification: false, requiresHuman: false, memory: {},
      action: (metadata.action || "REPLY") as CareerAssistantChatResponse["action"],
      data: metadata.data as CareerAssistantChatResponse["data"]
    } : undefined };
};
export const useCareerChatHistory = () => {
  const user = getStoredUser();
  const userId = user?.id || user?._id || "";
  const storageKey = `interviewiq-career-active:${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(welcome);
  const [conversations, setConversations] = useState<CareerConversation[]>([]);
  const [active, setActive] = useState<CareerConversation | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSending, setSending] = useState(false);
  const [draftSession, setDraftSession] = useState(createCareerAssistantSessionId);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CareerConversation | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const authToken = useRef(getAuthToken());
  const valid = (version: number) => generation.current === version && !request.current?.signal.aborted && authToken.current === getAuthToken();
  const start = () => {
    request.current?.abort();
    request.current = new AbortController();
    busy.current = true;
    setLoading(true); setError(null);
    return { version: ++generation.current, signal: request.current.signal };
  };
  const finish = (version: number) => { if (valid(version)) { busy.current = false; setLoading(false); setSending(false); } };
  const fail = (version: number, error: unknown) => {
    if (valid(version) && !(error instanceof Error && ["CanceledError", "AbortError"].includes(error.name))) {
      setError("The request could not be completed. Please try again.");
    }
  };
  const select = async (conversation: CareerConversation) => {
    if (busy.current) return;
    const { version, signal } = start();
    setMessages([]); setActive(conversation); setNextBefore(null);
    try {
      const page = await getCareerMessages(conversation.conversationId, undefined, signal);
      if (!valid(version)) return;
      setMessages(page.messages.length ? page.messages.filter(m => m.sender !== "system").map(toMessage) : welcome);
      setNextBefore(page.nextBefore); sessionStorage.setItem(storageKey, conversation.conversationId);
    } catch (error) { if (valid(version)) { fail(version, error); setActive(null); } }
    finally { finish(version); }
  };
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const signal = controller.signal;
    const version = ++generation.current;
    busy.current = true;
    authToken.current = getAuthToken();
    const clear = () => {
      ++generation.current; request.current?.abort(); busy.current = false;
      setMessages([]); setConversations([]); setActive(null); setDeleteTarget(null); setError(null); setLoading(false); setSending(false); setNextCursor(null); setNextBefore(null);
    };
    const storageChanged = (event: StorageEvent) => { if (event.key === "interviewiq_token" || event.key === "interviewiq_user" || event.key === null) clear(); };
    window.addEventListener("interviewiq-auth-change", clear);
    window.addEventListener("storage", storageChanged);
    void (async () => {
      try {
        const page = await listCareerConversations(undefined, signal);
        if (!valid(version)) return;
        setConversations(page.conversations); setNextCursor(page.nextCursor);
        const selectedId = sessionStorage.getItem(storageKey);
        let selected = page.conversations.find(c => c.conversationId === selectedId);
        if (!selected && selectedId) {
          try { selected = await getCareerConversation(selectedId, signal); }
          catch { if (!signal.aborted) sessionStorage.removeItem(storageKey); }
        }
        selected ||= page.conversations[0];
        if (!valid(version)) return;
        if (selected) {
          const history = await getCareerMessages(selected.conversationId, undefined, signal);
          if (!valid(version)) return;
          setActive(selected); setMessages(history.messages.length ? history.messages.filter(m => m.sender !== "system").map(toMessage) : welcome);
          setNextBefore(history.nextBefore);
        } else { setMessages(welcome); }
      } catch (error) { fail(version, error); }
      finally { finish(version); }
    })();
    return () => { controller.abort(); window.removeEventListener("interviewiq-auth-change", clear); window.removeEventListener("storage", storageChanged); };
    // Requests are intentionally scoped to the signed-in identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const newChat = () => {
    if (busy.current) return;
    request.current?.abort();
    ++generation.current;
    setDraftSession(createCareerAssistantSessionId());
    setActive(null); setMessages(welcome); setNextBefore(null); setError(null);
    sessionStorage.removeItem(storageKey);
  };
  const send = async (text: string) => {
    if (busy.current) return;
    const { version, signal } = start();
    setSending(true);
    const sessionId = active?.sessionId || draftSession;
    const messageId = crypto.randomUUID();
    setMessages(list => [...list, { id: messageId, role: "user", content: text }]);
    try {
      // The server persists a new session only after a real message is submitted.
      const response = await sendCareerAssistantMessage({ sessionId, message: text,
        customerName: user?.fullName, email: user?.email }, signal);
      if (!valid(version)) return;
      setMessages(list => [...list, { id: crypto.randomUUID(), role: "assistant", content: response.reply, response }]);
      let conversation = response.conversation;
      // Keep compatibility with a backend that has not been restarted yet.
      if (!conversation) {
        const page = await listCareerConversations(undefined, signal);
        if (!valid(version)) return;
        conversation = page.conversations.find(item => item.sessionId === sessionId);
      }
      if (conversation) {
        setActive(conversation);
        setConversations(list => list.some(item => item.conversationId === conversation.conversationId)
          ? list.map(item => item.conversationId === conversation.conversationId ? conversation : item)
          : [conversation, ...list]);
        sessionStorage.setItem(storageKey, conversation.conversationId);
      }
    } catch (error) {
      fail(version, error);
      // If persistence succeeded before a transport failure, recover that same session.
      if (valid(version)) {
        try {
          const page = await listCareerConversations(undefined, signal);
          if (!valid(version)) return;
          setConversations(page.conversations); setNextCursor(page.nextCursor);
          const saved = page.conversations.find(item => item.sessionId === sessionId);
          if (saved) { setActive(saved); sessionStorage.setItem(storageKey, saved.conversationId); }
        } catch { /* Keep the draft session identifier for a safe retry. */ }
      }
    } finally { finish(version); }
  };
  const rename = async (conversation: CareerConversation, title: string): Promise<boolean> => {
    if (busy.current) return false;
    const { version, signal } = start();
    const previousList = conversations;
    const previousActive = active;
    const optimisticTitle = title.trim().replace(/\s+/gu, " ");
    setConversations(list => list.map(item => item.conversationId === conversation.conversationId ? { ...item, title: optimisticTitle } : item));
    setActive(current => current?.conversationId === conversation.conversationId ? { ...current, title: optimisticTitle } : current);
    try {
      const result = await renameCareerConversation(conversation.conversationId, title, signal);
      if (!valid(version)) return false;
      setConversations(list => list.map(item => item.conversationId === result.conversationId ? { ...item, title: result.title } : item));
      setActive(current => current?.conversationId === result.conversationId ? { ...current, title: result.title } : current);
      return true;
    } catch (error) {
      if (valid(version)) { setConversations(previousList); setActive(previousActive); fail(version, error); }
      return false;
    } finally { finish(version); }
  };
  const loadMore = async (earlierMessages = false) => {
    if (busy.current) return;
    const { version, signal } = start();
    try {
      if (earlierMessages && active && nextBefore) {
        const page = await getCareerMessages(active.conversationId, nextBefore, signal);
        if (!valid(version)) return;
        setMessages(list => [...page.messages.filter(m => m.sender !== "system").map(toMessage), ...list]); setNextBefore(page.nextBefore);
      } else if (nextCursor) {
        const page = await listCareerConversations(nextCursor, signal);
        if (!valid(version)) return;
        setConversations(list => [...list, ...page.conversations.filter(c => !list.some(old => old.conversationId === c.conversationId))]); setNextCursor(page.nextCursor);
      }
    } catch (error) { fail(version, error); } finally { finish(version); }
  };
  const confirmDelete = async () => {
    if (!deleteTarget || busy.current) return false;
    const { version, signal } = start();
    try {
      await deleteCareerConversation(deleteTarget.conversationId, signal);
      if (!valid(version)) return false;
      setConversations(list => list.filter(c => c.conversationId !== deleteTarget.conversationId));
      if (active?.conversationId === deleteTarget.conversationId) { setActive(null); setMessages(welcome); setNextBefore(null); sessionStorage.removeItem(storageKey); }
      setDeleteTarget(null);
      return true;
    } catch (error) { fail(version, error); return false; } finally { finish(version); }
  };
  return { sessionKey: active?.sessionId || draftSession, messages, conversations, active, isLoading, isSending, error, nextCursor, nextBefore, deleteTarget, setDeleteTarget,
    select, newChat, send, rename, loadMore, confirmDelete };
};
