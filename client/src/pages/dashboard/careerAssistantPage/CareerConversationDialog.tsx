import { useEffect, useRef, useState } from "react";
import type { CareerConversation } from "../../../api/careerAssistantApi";

interface Props {
  conversation: CareerConversation;
  mode: "rename" | "delete";
  busy: boolean;
  onClose: () => void;
  onConfirm: (title: string) => Promise<boolean>;
}
export const CareerConversationDialog = ({ conversation, mode, busy, onClose, onConfirm }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(conversation.title);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); if (mode === "rename") input.current?.focus(); }, [mode]);
  const valid = title.trim().length > 0 && title.length <= 100 && !/\p{Cc}/u.test(title);
  return <dialog ref={dialog} className="career-conversation-dialog" aria-labelledby="career-dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={async event => {
      event.preventDefault();
      if (busy || (mode === "rename" && !valid)) return;
      setError("");
      if (await onConfirm(title)) onClose();
      else setError("The change could not be saved. Please try again.");
    }}>
      <span className="career-panel-eyebrow">CHAT HISTORY</span>
      <h2 id="career-dialog-title">{mode === "rename" ? "Rename conversation" : "Delete this conversation?"}</h2>
      {mode === "rename" ? <label>Conversation title
        <input ref={input} value={title} onChange={event => setTitle(event.target.value)} maxLength={100} disabled={busy} required />
        <small>{title.length}/100 characters</small>
      </label> : <p>“{conversation.title}” will be removed from your history and cannot be continued.</p>}
      {error && <p role="alert" className="career-dialog-error">{error}</p>}
      <div className="career-dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button className={mode === "delete" ? "is-danger" : "is-primary"} type="submit" disabled={busy || (mode === "rename" && !valid)}>
          {busy ? "Saving…" : mode === "rename" ? "Save title" : "Delete conversation"}
        </button></div>
    </form>
  </dialog>;
};
