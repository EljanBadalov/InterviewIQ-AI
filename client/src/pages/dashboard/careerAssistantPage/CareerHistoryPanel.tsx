import { useEffect, useRef, useState } from "react";
import { FiEdit2, FiMessageSquare, FiMoreHorizontal, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import type { CareerConversation } from "../../../api/careerAssistantApi";

interface Props {
  conversations: CareerConversation[];
  activeId?: string;
  busy: boolean;
  hasMore: boolean;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (conversation: CareerConversation) => void;
  onRename: (conversation: CareerConversation) => void;
  onDelete: (conversation: CareerConversation) => void;
  onLoadMore: () => void;
}
export const CareerHistoryPanel = (props: Props) => {
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (props.open) searchInput.current?.focus(); }, [props.open]);
  const visible = props.conversations.filter(conversation =>
    conversation.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <aside id="career-history-panel" className={`career-history ${props.open ? "is-open" : ""}`} aria-label="Chat history" onKeyDown={event => { if (event.key === "Escape" && props.open) { props.onClose(); event.stopPropagation(); } }}>
    <div className="career-history-heading">
      <div><span className="career-panel-eyebrow">YOUR CONVERSATIONS</span><h2>Chat History</h2></div>
      <button className="career-new-chat" type="button" disabled={props.busy} onClick={() => { setSearch(""); props.onNew(); }}>
        <FiPlus aria-hidden="true" /> New Chat
      </button>
      <button className="career-history-close career-icon-button" type="button" aria-label="Close chat history" onClick={props.onClose}><FiX /></button>
    </div>
    <label className="career-history-search"><FiSearch aria-hidden="true" />
      <input ref={searchInput} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search conversations..." aria-label="Search conversations" />
    </label>
    <p className="career-search-scope">Searches loaded conversations</p>
    <div className="career-history-list" aria-busy={props.busy}>
      {visible.map(conversation => <div className={`career-history-item ${props.activeId === conversation.conversationId ? "is-active" : ""}`} key={conversation.conversationId}>
        <button className="career-conversation-select" type="button" disabled={props.busy} aria-pressed={props.activeId === conversation.conversationId}
          onClick={() => props.onSelect(conversation)}>
          <FiMessageSquare className="career-conversation-icon" aria-hidden="true" />
          <span><strong>{conversation.title}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(conversation.updatedAt))}</small></span>
        </button>
        <details className="career-conversation-menu" name="career-conversation-actions" onKeyDown={event => { if (event.key === "Escape") event.currentTarget.open = false; }}>
          <summary aria-label={`Actions for ${conversation.title}`}><FiMoreHorizontal aria-hidden="true" /></summary>
          <div className="career-conversation-menu-items">
            <button type="button" disabled={props.busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); props.onRename(conversation); }}><FiEdit2 /> Rename</button>
            <button type="button" disabled={props.busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); props.onDelete(conversation); }}><FiTrash2 /> Delete</button>
          </div>
        </details>
      </div>)}
      {!visible.length && <div className="career-history-empty"><FiMessageSquare /><strong>{search ? "No matching conversations" : props.busy ? "Loading conversations…" : "A fresh start"}</strong>
        <p>{search ? "Try another title or load more conversations." : "Start a chat to save your first conversation here."}</p></div>}
    </div>
    <footer className="career-history-footer">
      {props.hasMore && <button type="button" disabled={props.busy} onClick={props.onLoadMore}>Load more conversations</button>}
      <span>Your conversations, all in one place.</span>
    </footer>
  </aside>;
};
