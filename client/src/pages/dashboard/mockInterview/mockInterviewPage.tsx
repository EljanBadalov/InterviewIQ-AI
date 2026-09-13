import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiInfo,
  FiPlay,
  FiShield,
  FiTarget,
  FiChevronDown,
  FiClock,
  FiList,
  FiActivity,
  FiX,
  FiRefreshCw,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";

import {
  getCareerFields,
  type ICareerFieldOption,
} from "../../../api/careerAutomationApi";

import "./mockInterviewPage.scss";

interface StartInterviewResponse {
  success: boolean;
  message?: string;

  data: {
    interviewId: string;
    status: string;
    totalQuestions: number;
    currentQuestionIndex: number;

    roleSlug?: string;

    category?: string;

    difficultyMode?: "adaptive";

    detectedDifficulty?: string;

    stretchDifficulty?: string;

    difficultyScore?: number;

    difficultyReason?: string;

    format?: {
      technicalQuestions: number;
      behavioralQuestions: number;
      totalQuestions: number;
    };

    question: {
      questionId: string;
      questionText: string;
    };
  };
}

interface InterviewHistoryItem {
  _id: string;

  category: string;

  difficulty: string;

  interviewType: string;

  status: string;

  overallScore?: number;

  startedAt?: string;

  completedAt?: string;

  createdAt?: string;
}

interface InterviewHistoryResponse {
  success: boolean;

  data: InterviewHistoryItem[];
}

const START_INTERVIEW_ENDPOINT =
  "/interviews";

const INTERVIEW_HISTORY_ENDPOINT =
  "/interviews";

const normalizeDomainLabel =
  (
    value?: string
  ): string => {
    const normalized =
      (
        value ||
        "other"
      )
        .replace(
          /[_-]+/g,
          " "
        )
        .trim();

    return normalized
      .split(" ")
      .filter(Boolean)
      .map(
        (
          word
        ) =>
          word
            .charAt(0)
            .toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  };

const mockInterviewPage = () => {
  const navigate = useNavigate();

  const [
    careerRoles,
    setCareerRoles,
  ] =
    useState<
      ICareerFieldOption[]
    >([]);

  const [
    selectedRoleSlug,
    setSelectedRoleSlug,
  ] =
    useState("");

  const [
    rolesLoading,
    setRolesLoading,
  ] =
    useState(true);

  const [
    rolesError,
    setRolesError,
  ] =
    useState("");

  const [
    interviewHistory,
    setInterviewHistory,
  ] =
    useState<
      InterviewHistoryItem[]
    >([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(true);

  const [
    historyError,
    setHistoryError,
  ] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    resumeInterview,
    setResumeInterview,
  ] =
    useState<
      InterviewHistoryItem |
      null
    >(null);

  const [
    restartLoading,
    setRestartLoading,
  ] =
    useState(false);

  const [
    restartError,
    setRestartError,
  ] =
    useState("");

  const selectedRole =
    useMemo(
      () =>
        careerRoles.find(
          (
            item
          ) =>
            item.slug ===
            selectedRoleSlug
        ) ||
        careerRoles[0] ||
        null,
      [
        careerRoles,
        selectedRoleSlug,
      ]
    );

  const groupedCareerRoles =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            ICareerFieldOption[]
          >();

        for (
          const role
          of careerRoles
        ) {
          const domain =
            normalizeDomainLabel(
              role.category
            );

          const existing =
            groups.get(
              domain
            ) ||
            [];

          existing.push(
            role
          );

          groups.set(
            domain,
            existing
          );
        }

        return Array.from(
          groups.entries()
        )
          .map(
            (
              [
                domain,
                roles,
              ]
            ) => ({
              domain,

              roles:
                [...roles].sort(
                  (
                    a,
                    b
                  ) =>
                    a.name.localeCompare(
                      b.name
                    )
                ),
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              a.domain.localeCompare(
                b.domain
              )
          );
      },
      [
        careerRoles,
      ]
    );

  useEffect(
    () => {
      let cancelled =
        false;

      const loadCareerRoles =
        async () => {
          try {
            setRolesLoading(
              true
            );

            setRolesError(
              ""
            );

            /*
             * Reuse the exact same DB-backed Career Fields source
             * already used by Career Automation:
             *
             * GET /api/v1/career-automation/fields
             *
             * getCareerFields() returns:
             * {
             *   fields: [{ slug, name, category, description }],
             *   total
             * }
             */
            const result =
              await getCareerFields();

            const cleanRoles =
              (
                result.fields ||
                []
              )
                .filter(
                  (
                    item
                  ) =>
                    Boolean(
                      item?.slug &&
                      item?.name
                    )
                )
                .sort(
                  (
                    a,
                    b
                  ) => {
                    const categoryCompare =
                      (
                        a.category ||
                        ""
                      ).localeCompare(
                        b.category ||
                        ""
                      );

                    if (
                      categoryCompare !==
                      0
                    ) {
                      return categoryCompare;
                    }

                    return a.name.localeCompare(
                      b.name
                    );
                  }
                );

            if (
              cancelled
            ) {
              return;
            }

            setCareerRoles(
              cleanRoles
            );

            setSelectedRoleSlug(
              (
                current
              ) => {
                if (
                  current &&
                  cleanRoles.some(
                    (
                      role
                    ) =>
                      role.slug ===
                      current
                  )
                ) {
                  return current;
                }

                return (
                  cleanRoles[0]
                    ?.slug ||
                  ""
                );
              }
            );

            if (
              cleanRoles.length ===
              0
            ) {
              setRolesError(
                "No active career fields are available yet."
              );
            }
          } catch (
            err
          ) {
            if (
              cancelled
            ) {
              return;
            }

            if (
              axios.isAxiosError(
                err
              )
            ) {
              setRolesError(
                err.response?.data
                  ?.message ||
                  "Unable to load career fields from the server."
              );
            } else {
              setRolesError(
                "Unable to load career fields from the server."
              );
            }

            setCareerRoles(
              []
            );

            setSelectedRoleSlug(
              ""
            );
          } finally {
            if (
              !cancelled
            ) {
              setRolesLoading(
                false
              );
            }
          }
        };

      void loadCareerRoles();

      return () => {
        cancelled =
          true;
      };
    },
    []
  );

  useEffect(
    () => {
      let cancelled =
        false;

      const loadInterviewHistory =
        async () => {
          try {
            setHistoryLoading(
              true
            );

            setHistoryError(
              ""
            );

            const response =
              await apiClient.get<InterviewHistoryResponse>(
                INTERVIEW_HISTORY_ENDPOINT
              );

            if (
              cancelled
            ) {
              return;
            }

            const items =
              Array.isArray(
                response.data.data
              )
                ? response.data.data
                : [];

            setInterviewHistory(
              items
            );
          } catch (
            err
          ) {
            if (
              cancelled
            ) {
              return;
            }

            if (
              axios.isAxiosError(
                err
              )
            ) {
              setHistoryError(
                err.response?.data
                  ?.message ||
                  "Unable to load interview history."
              );
            } else {
              setHistoryError(
                "Unable to load interview history."
              );
            }

            setInterviewHistory(
              []
            );
          } finally {
            if (
              !cancelled
            ) {
              setHistoryLoading(
                false
              );
            }
          }
        };

      void loadInterviewHistory();

      return () => {
        cancelled =
          true;
      };
    },
    []
  );

  const closeResumeModal =
    (): void => {
      if (
        restartLoading
      ) {
        return;
      }

      setResumeInterview(
        null
      );

      setRestartError(
        ""
      );
    };

  const handleContinueInterview =
    (): void => {
      if (
        !resumeInterview
      ) {
        return;
      }

      const interviewId =
        resumeInterview._id;

      setResumeInterview(
        null
      );

      setRestartError(
        ""
      );

      navigate(
        `/dashboard/mock-interview/${interviewId}`
      );
    };

  const handleRestartInterview =
    async (): Promise<void> => {
      if (
        !resumeInterview ||
        restartLoading
      ) {
        return;
      }

      const oldInterview =
        resumeInterview;

      try {
        setRestartLoading(
          true
        );

        setRestartError(
          ""
        );

        /*
         * Delete the unfinished attempt first, then create
         * a fresh adaptive interview for the same career field.
         */
        await apiClient.delete(
          `/interviews/${oldInterview._id}`
        );

        const response =
          await apiClient.post<StartInterviewResponse>(
            START_INTERVIEW_ENDPOINT,
            {
              roleSlug:
                oldInterview.category,
            }
          );

        const newInterviewId =
          response.data.data.interviewId;

        if (
          !newInterviewId
        ) {
          throw new Error(
            "Interview ID was not returned by the server."
          );
        }

        setResumeInterview(
          null
        );

        navigate(
          `/dashboard/mock-interview/${newInterviewId}`,
          {
            state: {
              interview:
                response.data.data,

              careerField:
                oldInterview.category,

              roleSlug:
                oldInterview.category,

              difficulty:
                response.data.data.detectedDifficulty ||
                "Adaptive",

              difficultyMode:
                response.data.data.difficultyMode ||
                "adaptive",

              interviewFormat:
                response.data.data.format ||
                {
                  technicalQuestions:
                    3,

                  behavioralQuestions:
                    3,

                  totalQuestions:
                    6,
                },
            },
          }
        );
      } catch (
        err
      ) {
        if (
          axios.isAxiosError(
            err
          )
        ) {
          setRestartError(
            err.response?.data
              ?.message ||
              "Unable to restart this interview."
          );
        } else if (
          err instanceof Error
        ) {
          setRestartError(
            err.message
          );
        } else {
          setRestartError(
            "Unable to restart this interview."
          );
        }
      } finally {
        setRestartLoading(
          false
        );
      }
    };

  const startInterview =
    async () => {
      if (
        loading ||
        rolesLoading
      ) {
        return;
      }

      if (
        !selectedRole
      ) {
        setError(
          "Please choose a career field before starting the interview."
        );

        return;
      }

      setError("");
      setLoading(true);

      try {
        const response =
          await apiClient.post<StartInterviewResponse>(
            START_INTERVIEW_ENDPOINT,
            {
              roleSlug:
                selectedRole.slug,
            }
          );

        const interviewId =
          response.data.data.interviewId;

        if (!interviewId) {
          throw new Error(
            "Interview ID was not returned by the server."
          );
        }

        navigate(
          `/dashboard/mock-interview/${interviewId}`,
          {
            state: {
              interview:
                response.data.data,

              careerField:
                selectedRole.name,

              roleSlug:
                selectedRole.slug,

              careerCategory:
                selectedRole.category,

              difficulty:
                response.data.data.detectedDifficulty ||
                "Adaptive",

              difficultyMode:
                response.data.data.difficultyMode ||
                "adaptive",

              interviewFormat:
                response.data.data.format ||
                {
                  technicalQuestions: 3,
                  behavioralQuestions: 3,
                  totalQuestions: 6,
                },
            },
          }
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Unable to start the interview. Please try again."
          );
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Unable to start the interview. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="mock-interview-page">
      {/* =========================
          PAGE HEADER
      ========================= */}

      <section className="mock-page-header">
        <div>
          <span className="page-eyebrow">
            AI Interview Practice
          </span>

          <h1>
            Start a mock interview
          </h1>

          <p>
            Customize your session
            and practice with
            AI-generated interview
            questions tailored to your
            goals.
          </p>
        </div>

        <div className="header-status">
          <div className="status-icon">
            <FiShield />
          </div>

          <div>
            <strong>
              AI-powered practice
            </strong>

            <span>
              Personalized questions
              and feedback
            </span>
          </div>
        </div>
      </section>

      {/* =========================
          ERROR
      ========================= */}

      {error && (
        <div className="mock-error">
          <FiInfo />

          <div>
            <strong>
              Interview could not
              start
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      )}

      {/* =========================
          CONTENT
      ========================= */}

      <section className="mock-content-grid">
        {/* LEFT */}

        <div className="mock-setup-card">
          <div className="setup-section">
            <div className="section-heading">
              <div className="section-number">
                01
              </div>

              <div>
                <h2>
                  Choose a career field
                </h2>

                <p>
                  Select the area you
                  want to practice.
                </p>
              </div>
            </div>

            <div className="career-role-picker">
              <div
                className={`career-role-select-shell ${
                  rolesError
                    ? "has-error"
                    : ""
                }`}
              >
                <FiBriefcase />

                <select
                  value={
                    selectedRoleSlug
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setSelectedRoleSlug(
                        event.target.value
                      )
                  }
                  disabled={
                    rolesLoading ||
                    careerRoles.length ===
                      0
                  }
                >
                  {rolesLoading ? (
                    <option value="">
                      Loading career fields...
                    </option>
                  ) : careerRoles.length ===
                    0 ? (
                    <option value="">
                      No career fields available
                    </option>
                  ) : (
                    groupedCareerRoles.map(
                      (
                        group
                      ) => (
                        <optgroup
                          key={
                            group.domain
                          }
                          label={
                            group.domain
                          }
                        >
                          {group.roles.map(
                            (
                              role
                            ) => (
                              <option
                                key={
                                  role.slug
                                }
                                value={
                                  role.slug
                                }
                              >
                                {
                                  role.name
                                }
                              </option>
                            )
                          )}
                        </optgroup>
                      )
                    )
                  )}
                </select>

                <FiChevronDown className="career-role-chevron" />
              </div>

              {rolesError && (
                <div className="career-role-load-error">
                  <FiInfo />

                  <span>
                    {rolesError}
                  </span>
                </div>
              )}

              {selectedRole && (
                <div className="career-role-selected-card">
                  <div className="career-role-selected-icon">
                    <FiBriefcase />
                  </div>

                  <div className="career-role-selected-copy">
                    <div className="career-role-selected-top">
                      <div>
                        <span>
                          SELECTED CAREER FIELD
                        </span>

                        <strong>
                          {selectedRole.name}
                        </strong>
                      </div>

                      <span className="career-role-domain-badge">
                        {normalizeDomainLabel(
                          selectedRole.category
                        )}
                      </span>
                    </div>

                    {selectedRole.description && (
                      <p>
                        {
                          selectedRole.description
                        }
                      </p>
                    )}

                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="setup-divider" />

          {/* INTERVIEW HISTORY */}

          <div className="setup-section interview-history-classic">
            <div className="history-classic-header">
              <span>
                HISTORY
              </span>

              <h2>
                Interview History
              </h2>

              <p>
                All of your mock interview sessions, including unfinished interviews.
              </p>
            </div>

            <div className="history-classic-list">
              {historyLoading ? (
                <div className="history-classic-state">
                  <FiClock />

                  <span>
                    Loading interview history...
                  </span>
                </div>
              ) : historyError ? (
                <div className="history-classic-state error">
                  <FiInfo />

                  <span>
                    {historyError}
                  </span>
                </div>
              ) : interviewHistory.length === 0 ? (
                <div className="history-classic-state">
                  <FiList />

                  <span>
                    No mock interviews yet.
                  </span>
                </div>
              ) : (
                interviewHistory.map(
                  (
                    interview
                  ) => {
                    const dateValue =
                      interview.completedAt ||
                      interview.startedAt ||
                      interview.createdAt;

                    const interviewDate =
                      dateValue
                        ? new Date(
                            dateValue
                          )
                        : null;

                    const formattedDate =
                      interviewDate
                        ? interviewDate.toLocaleDateString(
                            undefined,
                            {
                              month:
                                "short",
                              day:
                                "numeric",
                              year:
                                "numeric",
                            }
                          )
                        : "—";

                    const relativeTime =
                      interviewDate
                        ? (() => {
                            const differenceMs =
                              Date.now() -
                              interviewDate.getTime();

                            const days =
                              Math.max(
                                0,
                                Math.floor(
                                  differenceMs /
                                    86_400_000
                                )
                              );

                            if (
                              days ===
                              0
                            ) {
                              return "Today";
                            }

                            if (
                              days ===
                              1
                            ) {
                              return "1 day ago";
                            }

                            if (
                              days <
                              7
                            ) {
                              return `${days} days ago`;
                            }

                            const weeks =
                              Math.floor(
                                days /
                                  7
                              );

                            if (
                              weeks ===
                              1
                            ) {
                              return "1 week ago";
                            }

                            return `${weeks} weeks ago`;
                          })()
                        : "";

                    const roleLabel =
                      interview.category
                        .replace(
                          /[_-]+/g,
                          " "
                        )
                        .replace(
                          /\b\w/g,
                          (
                            char
                          ) =>
                            char.toUpperCase()
                        );

                    const isInProgress =
                      interview.status ===
                      "in_progress";

                    return (
                      <div
                        key={
                          interview._id
                        }
                        className={`history-classic-row ${
                          isInProgress
                            ? "in-progress"
                            : ""
                        }`}
                      >
                        <div className="history-classic-icon">
                          <FiActivity />
                        </div>

                        <div className="history-classic-copy">
                          <div className="history-classic-title-row">
                            <strong>
                              {roleLabel}
                            </strong>

                            {isInProgress && (
                              <span className="history-classic-progress-badge">
                                In progress
                              </span>
                            )}
                          </div>

                          <div>
                            <span>
                              {formattedDate}
                            </span>

                            {relativeTime && (
                              <>
                                <i>
                                  •
                                </i>

                                <span>
                                  {relativeTime}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {isInProgress ? (
                          <button
                            type="button"
                            className="history-classic-continue-button"
                            onClick={() => {
                              setRestartError(
                                ""
                              );

                              setResumeInterview(
                                interview
                              );
                            }}
                          >
                            Continue
                            <FiArrowRight />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="history-classic-result-button"
                            onClick={() =>
                              navigate(
                                `/dashboard/mock-interview/${interview._id}`
                              )
                            }
                          >
                            <span>
                              Score
                            </span>

                            <strong>
                              {typeof interview.overallScore ===
                              "number"
                                ? `${interview.overallScore}%`
                                : "View"}
                            </strong>
                          </button>
                        )}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>

        {/* =========================
            RIGHT
        ========================= */}

        <aside className="mock-sidebar">
          <div className="session-card">
            <div className="session-card-header">
              <span className="summary-eyebrow">
                Session Summary
              </span>

              <h2>
                Your interview
              </h2>
            </div>

            <div className="session-preview">
              <div className="preview-icon">
                <FiBriefcase />
              </div>

              <div>
                <span>
                  Category
                </span>

                <strong>
                  {
                    selectedRole
                      ?.name ||
                    "Select a career field"
                  }
                </strong>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span>
                  Interview format
                </span>

                <strong>
                  3 Technical + 3 Behavioral
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Difficulty
                </span>

                <strong>
                  Adaptive
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Questions
                </span>

                <strong>
                  6
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Feedback
                </span>

                <strong>
                  AI Analysis
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="start-interview-btn"
              disabled={
                loading ||
                rolesLoading ||
                !selectedRole
              }
              onClick={() =>
                void startInterview()
              }
            >
              {loading ? (
                <>
                  <span className="button-loader" />

                  Preparing...
                </>
              ) : (
                <>
                  <FiPlay />

                  Start Interview

                  <FiArrowRight />
                </>
              )}
            </button>

            <p className="start-note">
              Your answers will be
              analyzed to generate
              personalized feedback
              and a final performance
              report.
            </p>
          </div>

          {/* TIPS */}

          <div className="tips-card">
            <div className="tips-heading">
              <div className="tips-icon">
                <FiTarget />
              </div>

              <div>
                <span>
                  Before you start
                </span>

                <strong>
                  Quick tips
                </strong>
              </div>
            </div>

            <div className="tips-list">
              <div>
                <FiCheck />

                <span>
                  Answer naturally and
                  explain your
                  reasoning.
                </span>
              </div>

              <div>
                <FiCheck />

                <span>
                  Give specific
                  examples whenever
                  possible.
                </span>
              </div>

              <div>
                <FiCheck />

                <span>
                  Treat the session
                  like a real
                  interview.
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {resumeInterview && (
        <div
          className="interview-resume-modal-backdrop"
          role="presentation"
          onMouseDown={
            (
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeResumeModal();
              }
            }
          }
        >
          <section
            className="interview-resume-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-interview-title"
          >
            <button
              type="button"
              className="interview-resume-modal-close"
              onClick={
                closeResumeModal
              }
              aria-label="Close"
              disabled={
                restartLoading
              }
            >
              <FiX />
            </button>

            <div className="interview-resume-modal-icon">
              <FiActivity />
            </div>

            <span className="interview-resume-modal-eyebrow">
              UNFINISHED INTERVIEW
            </span>

            <h2 id="resume-interview-title">
              Continue where you left off?
            </h2>

            <p>
              You already have an unfinished{" "}
              <strong>
                {resumeInterview.category
                  .replace(
                    /[_-]+/g,
                    " "
                  )
                  .replace(
                    /\b\w/g,
                    (
                      char
                    ) =>
                      char.toUpperCase()
                  )}
              </strong>{" "}
              interview. Choose how you want to proceed.
            </p>

            {restartError && (
              <div className="interview-resume-modal-error">
                <FiInfo />

                <span>
                  {restartError}
                </span>
              </div>
            )}

            <div className="interview-resume-modal-actions">
              <button
                type="button"
                className="interview-resume-restart-button"
                onClick={() =>
                  void handleRestartInterview()
                }
                disabled={
                  restartLoading
                }
              >
                <FiRefreshCw
                  className={
                    restartLoading
                      ? "spin"
                      : ""
                  }
                />

                <span>
                  <strong>
                    Start over
                  </strong>
                </span>
              </button>

              <button
                type="button"
                className="interview-resume-continue-button"
                onClick={
                  handleContinueInterview
                }
                disabled={
                  restartLoading
                }
              >
                <FiPlay />

                <span>
                  <strong>
                    Continue interview
                  </strong>
                </span>

                <FiArrowRight className="interview-resume-action-arrow" />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default mockInterviewPage;