import { useApiQuery } from '../../../query/apiQueries';
import { useSyncExternalStore } from 'react';
import { activeCareer, careerContext, careerSnapshot, subscribeCareer } from '../../../query/careerContextStore';
import { FiEdit2, FiMessageSquare, FiSend } from "react-icons/fi";
import type { CareerConversation } from "../../../api/careerAssistantApi";
import { CareerHistoryPanel } from "./CareerHistoryPanel";
import { CareerConversationDialog } from "./CareerConversationDialog";
import { useCareerChatScroll } from "./useCareerChatScroll";
import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Link,
} from "react-router-dom";

import ReactMarkdown from "react-markdown";

import type { CareerAssistantChatResponse } from "../../../api/careerAssistantApi";
import { useCareerChatHistory, type ChatMessage } from "./useCareerChatHistory";

import "./careerAssistantPage.scss";

/* =========================================================
   TYPES
========================================================= */

interface JobMatchCard {
  id: string;

  title: string;

  company: string;

  location?: string;

  remoteType?: string;

  employmentType?: string;

  matchScore?: number;

  matchLevel?: string;

  matchedSkills?: string[];

  missingSkills?: string[];
}

/* =========================================================
   STORAGE
========================================================= */

const formatJobMeta = (
  value?: string
): string => {
  if (!value) {
    return "";
  }

  return value
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
};

/* =========================================================
   JOB MATCH DATA
========================================================= */

const getJobMatchCards = (
  response?: CareerAssistantChatResponse
): JobMatchCard[] => {
  if (
    !response ||
    response.intent !==
    "JOB_MATCHING"
  ) {
    return [];
  }

  const jobMatching =
    response.data
      ?.jobMatching as
    | {
      jobs?: JobMatchCard[];
    }
    | undefined;

  if (
    !jobMatching ||
    !Array.isArray(
      jobMatching.jobs
    )
  ) {
    return [];
  }

  /*
   * We intentionally show the strongest
   * three matches inside the conversation.
   *
   * The full Jobs page can still contain
   * every available match.
   */

  return jobMatching.jobs.slice(
    0,
    3
  );
};

/* =========================================================
   DETERMINE RICH RESPONSE
========================================================= */

const isJobMatchingResponse = (
  message: ChatMessage
): boolean => {
  return (
    message.role ===
    "assistant" &&
    message.response?.intent ===
    "JOB_MATCHING" &&
    getJobMatchCards(
      message.response
    ).length >
    0
  );
};

/* =========================================================
   COMPONENT
========================================================= */

const CareerAssistantPage = () => {
  useSyncExternalStore(subscribeCareer,careerSnapshot);
  const contextQuery=useApiQuery('/career-automation/active-career',!careerContext());
  const defaultCareer=activeCareer();
  const chat = useCareerChatHistory();
  const { messages, isLoading, error } = chat;
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CareerConversation | null>(null);
  useEffect(() => {
    const clearLocalState = () => { setInput(""); setRenameTarget(null); setHistoryOpen(false); };
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === "interviewiq_token" || event.key === "interviewiq_user") clearLocalState(); };
    window.addEventListener("interviewiq-auth-change", clearLocalState);
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener("interviewiq-auth-change", clearLocalState); window.removeEventListener("storage", changed); };
  }, []);
  const { viewport: messagesViewport, onScroll: handleMessagesScroll, capture: captureScroll, followNext } = useCareerChatScroll(chat.sessionKey, messages, chat.isSending);

  const normalizeAssistantMarkdown = (text: string): string => {
    return text
      .replace(/\r\n/g, "\n")
      .replace(
        /([.!?])\s+(?=\d+\.\s+\*\*)/g,
        "$1\n\n"
      )
      .replace(
        /(\S)\s+(?=\d+\.\s+\*\*)/g,
        "$1\n"
      )
      .replace(
        /(\n)(\d+\.\s+\*\*)/g,
        "\n$2"
      )
      .trim();
  };

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || isLoading) return;
    setInput("");
    followNext();
    await chat.send(message);
  };

  /* =======================================================
     QUICK PROMPTS
  ======================================================= */

  const handleQuickPrompt =
    (
      prompt: string
    ) => {
      if (
        isLoading
      ) {
        return;
      }

      setInput(
        prompt
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="career-assistant-page">
      <div className="career-assistant-container">

        {historyOpen && <button type="button" className="career-history-backdrop" aria-label="Close chat history" onClick={() => setHistoryOpen(false)} />}
        <CareerHistoryPanel conversations={chat.conversations} activeId={chat.active?.conversationId} busy={isLoading}
          hasMore={Boolean(chat.nextCursor)} open={historyOpen} onClose={() => setHistoryOpen(false)}
          onNew={() => { setInput(""); setRenameTarget(null); followNext(); chat.newChat(); setHistoryOpen(false); }}
          onSelect={conversation => { setInput(""); setRenameTarget(null); void chat.select(conversation); setHistoryOpen(false); }}
          onRename={setRenameTarget} onDelete={chat.setDeleteTarget} onLoadMore={() => void chat.loadMore()} />
        {renameTarget && <CareerConversationDialog key={`rename-${renameTarget.conversationId}`} mode="rename" conversation={renameTarget}
          busy={isLoading} onClose={() => setRenameTarget(null)} onConfirm={title => chat.rename(renameTarget, title)} />}
        {chat.deleteTarget && <CareerConversationDialog key={`delete-${chat.deleteTarget.conversationId}`} mode="delete" conversation={chat.deleteTarget}
          busy={isLoading} onClose={() => chat.setDeleteTarget(null)} onConfirm={async () => Boolean(await chat.confirmDelete())} />}
        <main className="career-assistant-chat">
          <header className="career-chat-header">
            <button type="button" className="career-history-toggle career-icon-button" aria-label="Open chat history" aria-expanded={historyOpen} aria-controls="career-history-panel" onClick={() => setHistoryOpen(true)}><FiMessageSquare /></button>
            <div className="career-chat-title"><span className="career-panel-eyebrow">CAREER ASSISTANT</span><h1>{chat.active?.title || "New conversation"}</h1>{defaultCareer && <small>Account career: {defaultCareer.targetRole}. Conversation topics take priority.</small>}{contextQuery.isError && <small role="status">Account career could not be refreshed.</small>}</div>
            {chat.active && <button type="button" className="career-icon-button" aria-label="Rename active conversation" disabled={isLoading} onClick={() => setRenameTarget(chat.active)}><FiEdit2 /></button>}
            <span className="career-assistant-status"><span className="career-assistant-status-dot" />Career AI</span>
          </header>
          <div className="career-assistant-messages" ref={messagesViewport} onScroll={handleMessagesScroll} role="region" aria-label="Conversation messages" tabIndex={0}>
            {chat.nextBefore && <button className="career-load-earlier" type="button" disabled={isLoading} onClick={() => { captureScroll(); void chat.loadMore(true); }}>Load earlier messages</button>}


            {messages.map(
              (
                message
              ) => {
                const jobs =
                  getJobMatchCards(
                    message.response
                  );

                const showJobMatching =
                  isJobMatchingResponse(
                    message
                  );

                return (
                  <div
                    key={
                      message.id
                    }
                    className={`career-message career-message-${message.role}`}
                  >
                    {/* ===================================
                        AVATAR
                    =================================== */}

                    {message.role ===
                      "assistant" && (
                        <div className="career-message-avatar">
                          AI
                        </div>
                      )}

                    {/* ===================================
                        MESSAGE CONTENT
                    =================================== */}

                    <div className="career-message-content">

                      <div className="career-message-label">
                        {message.role ===
                          "assistant"
                          ? "Career Assistant"
                          : "You"}
                      </div>

                      {/* =================================
                          NORMAL MESSAGE
                      ================================= */}

                      {!showJobMatching && (
                        <div className="career-message-bubble">
                          {message.role === "assistant" ? (
                            <div className="career-message-markdown">
                              <ReactMarkdown>
                                {normalizeAssistantMarkdown(message.content)}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            message.content
                          )}
                        </div>
                      )}

                      {/* =================================
                          JOB MATCHING RICH RESPONSE
                      ================================= */}

                      {showJobMatching && (
                        <div className="career-job-response">

                          <div className="career-job-response-intro">
                            <strong>
                              I found your strongest current job matches.
                            </strong>

                            <span>
                              These positions have the highest alignment
                              with your current CV and skills.
                            </span>
                          </div>

                          <div className="career-job-match-list">

                            {jobs.map(
                              (
                                job,
                                index
                              ) => (
                                <article
                                  key={
                                    job.id
                                  }
                                  className="career-job-card"
                                >

                                  {/* =====================
                                      NUMBER
                                  ===================== */}

                                  <div className="career-job-rank">
                                    {
                                      index +
                                      1
                                    }
                                  </div>

                                  {/* =====================
                                      CONTENT
                                  ===================== */}

                                  <div className="career-job-main">

                                    {/* ===================
                                        HEADER
                                    =================== */}

                                    <div className="career-job-card-header">

                                      <div className="career-job-heading">
                                        <h3>
                                          {
                                            job.title
                                          }
                                        </h3>

                                        <p>
                                          {
                                            job.company
                                          }
                                        </p>
                                      </div>

                                      {typeof job.matchScore ===
                                        "number" && (
                                          <div className="career-job-score">
                                            <strong>
                                              {
                                                job.matchScore
                                              }
                                              %
                                            </strong>

                                            <span>
                                              Match
                                            </span>
                                          </div>
                                        )}
                                    </div>

                                    {/* ===================
                                        LOCATION / TYPE
                                    =================== */}

                                    <div className="career-job-info">

                                      {job.location && (
                                        <span>
                                          {
                                            job.location
                                          }
                                        </span>
                                      )}

                                      {job.remoteType && (
                                        <span>
                                          {formatJobMeta(
                                            job.remoteType
                                          )}
                                        </span>
                                      )}

                                      {job.employmentType && (
                                        <span>
                                          {formatJobMeta(
                                            job.employmentType
                                          )}
                                        </span>
                                      )}

                                      {job.matchLevel && (
                                        <span className="career-job-level">
                                          {formatJobMeta(
                                            job.matchLevel
                                          )}
                                        </span>
                                      )}

                                    </div>

                                    {/* ===================
                                        MATCHED SKILLS
                                    =================== */}

                                    {Array.isArray(
                                      job.matchedSkills
                                    ) &&
                                      job.matchedSkills
                                        .length >
                                      0 && (
                                        <div className="career-job-skill-section">

                                          <div className="career-job-section-title">
                                            Matching skills
                                          </div>

                                          <div className="career-job-skills">
                                            {job.matchedSkills
                                              .slice(
                                                0,
                                                6
                                              )
                                              .map(
                                                (
                                                  skill
                                                ) => (
                                                  <span
                                                    key={
                                                      skill
                                                    }
                                                    className="career-job-skill career-job-skill-match"
                                                  >
                                                    {
                                                      skill
                                                    }
                                                  </span>
                                                )
                                              )}
                                          </div>

                                        </div>
                                      )}

                                    {/* ===================
                                        MISSING SKILLS
                                    =================== */}

                                    {Array.isArray(
                                      job.missingSkills
                                    ) &&
                                      job.missingSkills
                                        .length >
                                      0 && (
                                        <div className="career-job-skill-section">

                                          <div className="career-job-section-title">
                                            Skills to strengthen
                                          </div>

                                          <div className="career-job-skills">
                                            {job.missingSkills
                                              .slice(
                                                0,
                                                5
                                              )
                                              .map(
                                                (
                                                  skill
                                                ) => (
                                                  <span
                                                    key={
                                                      skill
                                                    }
                                                    className="career-job-skill career-job-skill-missing"
                                                  >
                                                    {
                                                      skill
                                                    }
                                                  </span>
                                                )
                                              )}
                                          </div>

                                        </div>
                                      )}

                                    {/* ===================
                                        ACTION
                                    =================== */}

                                    <div className="career-job-actions">
                                      <Link
                                        to={`/dashboard/jobs/${job.id}`}
                                        className="career-job-view-button"
                                      >
                                        View Job

                                        <span>
                                          →
                                        </span>
                                      </Link>
                                    </div>

                                  </div>
                                </article>
                              )
                            )}

                          </div>
                        </div>
                      )}

                      {/* =================================
                          RESPONSE META
                      ================================= */}

                      {message.response && (
                        <div className="career-message-meta">
                          <span>
                            {
                              message
                                .response
                                .intent
                            }
                          </span>

                          {message.response
                            .data
                            ?.nextStep && (
                              <span>
                                {
                                  message
                                    .response
                                    .data
                                    .nextStep
                                }
                              </span>
                            )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              }
            )}

            {/* ===========================================
                LOADING
            =========================================== */}

            {chat.isSending && (
              <div className="career-message career-message-assistant">

                <div className="career-message-avatar">
                  AI
                </div>

                <div className="career-message-content">

                  <div className="career-message-label">
                    Career Assistant
                  </div>

                  <div className="career-message-bubble career-message-thinking">
                    <span />
                    <span />
                    <span />
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* =============================================
              ERROR
          ============================================= */}

          {error && (
            <div className="career-assistant-error" role="alert">
              {error}
            </div>
          )}

          {/* =============================================
              QUICK PROMPTS
          ============================================= */}

          {messages.length <=
            1 && (
              <div className="career-quick-prompts">

                <button
                  type="button"
                  onClick={() =>
                    handleQuickPrompt(
                      "Analyze my CV"
                    )
                  }
                >
                  Analyze my CV
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickPrompt(
                      "Which jobs match my CV?"
                    )
                  }
                >
                  Find matching jobs
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickPrompt(
                      "How did I do in my last interview?"
                    )
                  }
                >
                  Interview feedback
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickPrompt(
                      "How has my career progress changed?"
                    )
                  }
                >
                  Career progress
                </button>

              </div>
            )}

          {/* =============================================
              INPUT
          ============================================= */}

          <form
            className="career-assistant-form"
            onSubmit={
              handleSubmit
            }
          >

            <div className="career-assistant-input-wrapper">

              <textarea
                value={
                  input
                }
                onChange={event => {
                  setInput(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    event.currentTarget
                      .form
                      ?.requestSubmit();
                  }
                }}
                placeholder="Ask InterviewIQ about your career..."
                rows={1}
                disabled={
                  isLoading
                }
              />

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !input.trim()
                }
                className="career-assistant-send"
                aria-label="Send message"
              >
                {chat.isSending ? "…" : <FiSend aria-hidden="true" />}
              </button>

            </div>

            <p className="career-assistant-disclaimer">
              Career Assistant uses your InterviewIQ data
              to provide personalized recommendations.
            </p>

          </form>

        </main>
      </div>
    </div>
  );
};

export default CareerAssistantPage;