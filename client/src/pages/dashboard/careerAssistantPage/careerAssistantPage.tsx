import {
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  createCareerAssistantSessionId,
  sendCareerAssistantMessage,
  type CareerAssistantChatResponse,
} from "../../../api/careerAssistantApi";

import {
  getStoredUser,
} from "../../../utils/authStorage";

import "./CareerAssistantPage.scss";

/* =========================================================
   TYPES
========================================================= */

type ChatRole =
  | "user"
  | "assistant";

interface ChatMessage {
  id: string;

  role: ChatRole;

  content: string;

  response?: CareerAssistantChatResponse;
}

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

const SESSION_STORAGE_KEY =
  "interviewiq-career-assistant-session";

/* =========================================================
   HELPERS
========================================================= */

const getSessionId = (): string => {
  const existing =
    sessionStorage.getItem(
      SESSION_STORAGE_KEY
    );

  if (existing) {
    return existing;
  }

  const created =
    createCareerAssistantSessionId();

  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    created
  );

  return created;
};

const createMessageId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join("-");
};

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
  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>([
      {
        id:
          "welcome",

        role:
          "assistant",

        content:
          "Hi! I'm your InterviewIQ Career Assistant. I can help analyze your CV, compare job matches, review interview performance, track your career progress, and plan your next steps.",
      },
    ]);

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  /* =======================================================
     SESSION
  ======================================================= */

  const sessionId =
    useMemo(
      () =>
        getSessionId(),
      []
    );

  /* =======================================================
     USER
  ======================================================= */

  const storedUser =
    useMemo(
      () =>
        getStoredUser(),
      []
    );

  const userId =
    storedUser?.id ||
    storedUser?._id;

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const message =
        input.trim();

      if (
        !message ||
        isLoading
      ) {
        return;
      }

      setError(
        null
      );

      const userMessage:
        ChatMessage = {
        id:
          createMessageId(),

        role:
          "user",

        content:
          message,
      };

      setMessages(
        (
          current
        ) => [
          ...current,
          userMessage,
        ]
      );

      setInput(
        ""
      );

      setIsLoading(
        true
      );

      try {
        const response =
          await sendCareerAssistantMessage({
            sessionId,

            message,

            userId,

            customerName:
              storedUser?.fullName,

            email:
              storedUser?.email,
          });

        const assistantMessage:
          ChatMessage = {
          id:
            createMessageId(),

          role:
            "assistant",

          content:
            response.reply,

          response,
        };

        setMessages(
          (
            current
          ) => [
            ...current,
            assistantMessage,
          ]
        );
      } catch (
        requestError
      ) {
        console.error(
          "[Career Assistant] Request failed:",
          requestError
        );

        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Something went wrong while contacting the Career Assistant."
        );
      } finally {
        setIsLoading(
          false
        );
      }
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

        {/* ===============================================
            HEADER
        =============================================== */}

        <header className="career-assistant-header">
          <div>
            <span className="career-assistant-eyebrow">
              InterviewIQ
            </span>

            <h1>
              Career Assistant
            </h1>

            <p>
              Get personalized career guidance
              using your CV, job matches and
              interview performance.
            </p>
          </div>

          <div className="career-assistant-status">
            <span className="career-assistant-status-dot" />

            Career AI
          </div>
        </header>

        {/* ===============================================
            CHAT
        =============================================== */}

        <main className="career-assistant-chat">

          <div className="career-assistant-messages">

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
                          {
                            message.content
                          }
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

            {isLoading && (
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
            <div className="career-assistant-error">
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
                onChange={(
                  event
                ) =>
                  setInput(
                    event.target
                      .value
                  )
                }
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
                {isLoading
                  ? "..."
                  : "↑"}
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