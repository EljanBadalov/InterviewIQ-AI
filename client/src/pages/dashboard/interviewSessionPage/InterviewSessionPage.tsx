import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiMessageSquare,
  FiBookmark,
  FiSend,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";
import "./interviewSessionPage.scss";

/* =========================================
   TYPES
========================================= */

interface InterviewQuestion {
  questionId: string;
  questionText: string;
}

interface InterviewSessionData {
  interviewId: string;
  status: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  question: InterviewQuestion;
}

interface LocationState {
  interview?: InterviewSessionData;
  category?: string;
  difficulty?: string;
  interviewType?: string;
}

interface EvaluationState {
  score?: number;
  technicalAccuracy?: number;
  completeness?: number;
  communication?: number;
  feedback?: string;
  improvedAnswer?: string;
  strengths?: string[];
  weaknesses?: string[];
}

interface SubmitAnswerData {
  status?: string;

  completed?: boolean;
  isCompleted?: boolean;

  currentQuestionIndex?: number;
  nextQuestionIndex?: number;

  totalQuestions?: number;

  question?: InterviewQuestion;
  nextQuestion?: InterviewQuestion;

  evaluation?: EvaluationState;

  score?: number;
  technicalAccuracy?: number;
  completeness?: number;
  communication?: number;
  feedback?: string;
  improvedAnswer?: string;
  strengths?: string[];
  weaknesses?: string[];

  overallScore?: number;

  finalReport?: {
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    recommendations?: string[];
  };

  answer?: {
    score?: number;
    technicalAccuracy?: number;
    completeness?: number;
    communication?: number;
    feedback?: string;
    improvedAnswer?: string;
    strengths?: string[];
    weaknesses?: string[];

    evaluation?: EvaluationState;
  };
}

interface SubmitAnswerResponse {
  success?: boolean;
  message?: string;
  data?: SubmitAnswerData;
}

interface BookmarkStatusResponse {
  success: boolean;
  data: {
    questionId: string;
    bookmarked: boolean;
  };
}

/* =========================================
   COMPONENT
========================================= */

const interviewSessionPage = () => {
  const navigate = useNavigate();

  const location =
    useLocation() as {
      state: LocationState | null;
    };

  const { interviewId } =
    useParams<{
      interviewId: string;
    }>();

  const initialInterview =
    location.state?.interview;

  /* =========================================
     SESSION
  ========================================= */

  const [session, setSession] =
    useState<InterviewSessionData | null>(
      initialInterview ?? null
    );

  const [category] = useState(
    location.state?.category ??
      "Mock Interview"
  );

  const [difficulty] = useState(
    location.state?.difficulty ??
      "Interview"
  );

  const [interviewType] = useState(
    location.state?.interviewType ??
      "technical"
  );

  const [answer, setAnswer] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    sessionLoading,
    setSessionLoading,
  ] = useState(
    !initialInterview
  );

  const [error, setError] =
    useState("");

  const [bookmarked, setBookmarked] =
    useState(false);

  const [bookmarkLoading, setBookmarkLoading] =
    useState(false);

  const [bookmarkStatusLoading, setBookmarkStatusLoading] =
    useState(false);

  const [
    evaluation,
    setEvaluation,
  ] =
    useState<EvaluationState | null>(
      null
    );

  const [
    pendingNextQuestion,
    setPendingNextQuestion,
  ] =
    useState<InterviewQuestion | null>(
      null
    );

  const [
    pendingNextQuestionIndex,
    setPendingNextQuestionIndex,
  ] =
    useState<number | null>(
      null
    );

  /*
    Backend interview-i tamamlayıb?
  */

  const [
    completed,
    setCompleted,
  ] = useState(
    initialInterview?.status ===
      "completed"
  );

  /*
    Completion screen ayrıca state-dir.

    Bunun sayəsində son sual submit olunanda
    completed=true olsa belə evaluation
    əvvəlcə göstərilir.

    User "Finish Interview" basandan sonra
    completion screen açılır.
  */

  const [
    showCompletionScreen,
    setShowCompletionScreen,
  ] = useState(false);

  const [
    finalOverallScore,
    setFinalOverallScore,
  ] = useState<number | null>(
    null
  );

  /* =========================================
     LOAD INTERVIEW AFTER REFRESH
  ========================================= */

  useEffect(() => {
    if (
      session ||
      !interviewId
    ) {
      return;
    }

    const loadInterview =
      async () => {
        setSessionLoading(true);
        setError("");

        try {
          const response =
            await apiClient.get(
              `/interviews/${interviewId}`
            );

          const payload =
            response.data?.data ??
            response.data;

          const currentQuestion =
            payload.question ??
            payload.currentQuestion ??
            payload.data?.question;

          const loadedSession: InterviewSessionData =
            {
              interviewId:
                payload.interviewId ??
                payload._id ??
                interviewId,

              status:
                payload.status ??
                "in_progress",

              totalQuestions:
                payload.totalQuestions ??
                payload.answers
                  ?.length ??
                0,

              currentQuestionIndex:
                payload.currentQuestionIndex ??
                0,

              question:
                currentQuestion,
            };

          if (
            !loadedSession.question
          ) {
            throw new Error(
              "Current interview question was not returned."
            );
          }

          setSession(
            loadedSession
          );

          if (
            loadedSession.status ===
            "completed"
          ) {
            setCompleted(true);

            setShowCompletionScreen(
              true
            );

            if (
              typeof payload.overallScore ===
              "number"
            ) {
              setFinalOverallScore(
                payload.overallScore
              );
            }
          }
        } catch (err) {
          if (
            axios.isAxiosError(err)
          ) {
            setError(
              err.response?.data
                ?.message ||
                "Interview session could not be loaded."
            );
          } else if (
            err instanceof Error
          ) {
            setError(
              err.message
            );
          } else {
            setError(
              "Interview session could not be loaded."
            );
          }
        } finally {
          setSessionLoading(false);
        }
      };

    void loadInterview();
  }, [
    interviewId,
    session,
  ]);

  useEffect(() => {
    const questionId =
      session?.question.questionId;

    if (!questionId) {
      setBookmarked(false);
      return;
    }

    const loadBookmarkStatus = async () => {
      setBookmarkStatusLoading(true);

      try {
        const response =
          await apiClient.get<BookmarkStatusResponse>(
            `/bookmarks/${questionId}/status`
          );

        setBookmarked(
          response.data.data.bookmarked
        );
      } catch {
        setBookmarked(false);
      } finally {
        setBookmarkStatusLoading(false);
      }
    };

    void loadBookmarkStatus();
  }, [session?.question.questionId]);

  const toggleBookmark = async () => {
    const questionId =
      session?.question.questionId;

    if (
      !questionId ||
      bookmarkLoading ||
      bookmarkStatusLoading
    ) {
      return;
    }

    setBookmarkLoading(true);

    try {
      if (bookmarked) {
        await apiClient.delete(
          `/bookmarks/${questionId}`
        );

        setBookmarked(false);
      } else {
        await apiClient.post(
          `/bookmarks/${questionId}`
        );

        setBookmarked(true);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
            "Bookmark could not be updated."
        );
      } else {
        setError(
          "Bookmark could not be updated."
        );
      }
    } finally {
      setBookmarkLoading(false);
    }
  };

  /* =========================================
     COMPUTED VALUES
  ========================================= */

  const currentQuestionNumber =
    useMemo(() => {
      if (!session) {
        return 1;
      }

      return (
        session.currentQuestionIndex +
        1
      );
    }, [session]);

  const progress =
    useMemo(() => {
      if (
        !session ||
        session.totalQuestions <= 0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.round(
          (currentQuestionNumber /
            session.totalQuestions) *
            100
        )
      );
    }, [
      session,
      currentQuestionNumber,
    ]);

  const characterCount =
    answer.length;

  const canSubmit =
    answer.trim().length >= 10 &&
    !loading &&
    !evaluation &&
    !completed;

  /* =========================================
     SUBMIT ANSWER
  ========================================= */

  const submitAnswer =
    async () => {
      if (
        !session ||
        !interviewId ||
        !canSubmit
      ) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response =
          await apiClient.post<SubmitAnswerResponse>(
            `/interviews/${interviewId}/answers`,
            {
              questionId:
                session.question
                  .questionId,

              answerText:
                answer.trim(),
            }
          );

        const data =
          response.data.data;

        if (!data) {
          throw new Error(
            "Server returned an empty answer response."
          );
        }

        /* =====================================
           NORMALIZE AI EVALUATION
        ===================================== */

        const nestedEvaluation =
          data.evaluation ??
          data.answer?.evaluation;

        const normalizedEvaluation: EvaluationState =
          {
            score:
              nestedEvaluation
                ?.score ??
              data.answer?.score ??
              data.score,

            technicalAccuracy:
              nestedEvaluation
                ?.technicalAccuracy ??
              data.answer
                ?.technicalAccuracy ??
              data.technicalAccuracy,

            completeness:
              nestedEvaluation
                ?.completeness ??
              data.answer
                ?.completeness ??
              data.completeness,

            communication:
              nestedEvaluation
                ?.communication ??
              data.answer
                ?.communication ??
              data.communication,

            feedback:
              nestedEvaluation
                ?.feedback ??
              data.answer?.feedback ??
              data.feedback,

            improvedAnswer:
              nestedEvaluation
                ?.improvedAnswer ??
              data.answer
                ?.improvedAnswer ??
              data.improvedAnswer,

            strengths:
              nestedEvaluation
                ?.strengths ??
              data.answer?.strengths ??
              data.strengths ??
              [],

            weaknesses:
              nestedEvaluation
                ?.weaknesses ??
              data.answer?.weaknesses ??
              data.weaknesses ??
              [],
          };

        /* =====================================
           MAKE SURE ANALYSIS EXISTS
        ===================================== */

        const hasValidEvaluation =
          typeof normalizedEvaluation.score ===
            "number" &&
          typeof normalizedEvaluation.technicalAccuracy ===
            "number" &&
          typeof normalizedEvaluation.completeness ===
            "number" &&
          typeof normalizedEvaluation.communication ===
            "number" &&
          Boolean(
            normalizedEvaluation
              .feedback
          ) &&
          Boolean(
            normalizedEvaluation
              .improvedAnswer
          ) &&
          Boolean(
            normalizedEvaluation
              .strengths?.length
          ) &&
          Boolean(
            normalizedEvaluation
              .weaknesses?.length
          );

        if (
          !hasValidEvaluation
        ) {
          throw new Error(
            "AI evaluation was incomplete. Please submit your answer again."
          );
        }

        /*
          Evaluation həmişə göstərilir.
          Sonuncu sual olsa belə.
        */

        setEvaluation(
          normalizedEvaluation
        );

        /* =====================================
           NEXT QUESTION
        ===================================== */

        const returnedNextQuestion =
          data.nextQuestion ??
          data.question ??
          null;

        if (
          returnedNextQuestion
        ) {
          setPendingNextQuestion(
            returnedNextQuestion
          );

          setPendingNextQuestionIndex(
            data.nextQuestionIndex ??
              data.currentQuestionIndex ??
              session.currentQuestionIndex +
                1
          );
        } else {
          setPendingNextQuestion(
            null
          );

          setPendingNextQuestionIndex(
            null
          );
        }

        /* =====================================
           CHECK COMPLETION
        ===================================== */

        const backendCompleted =
          data.completed === true ||
          data.isCompleted === true ||
          data.status ===
            "completed";

        const reachedLastQuestion =
          session.totalQuestions >
            0 &&
          session.currentQuestionIndex >=
            session.totalQuestions -
              1;

        if (
          backendCompleted ||
          reachedLastQuestion
        ) {
          /*
            VACIB:

            Burada completion screen-i
            göstərmirik.

            Sadəcə interview completed
            kimi qeyd olunur.

            Evaluation ekranda qalır.
          */

          setCompleted(true);

          setPendingNextQuestion(
            null
          );

          setPendingNextQuestionIndex(
            null
          );

          if (
            typeof data.overallScore ===
            "number"
          ) {
            setFinalOverallScore(
              data.overallScore
            );
          }
        }
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
                "Your answer could not be analyzed. Please submit it again."
          );
        } else if (
          err instanceof Error
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Your answer could not be analyzed. Please submit it again."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  /* =========================================
     NEXT / FINISH
  ========================================= */

  const handleContinue = () => {
    if (
      !session ||
      loading
    ) {
      return;
    }

    /*
      Sonuncu sualdırsa:
      evaluation artıq göstərilib.

      User Finish Interview basır
      və bundan sonra completed screen açılır.
    */

    if (completed) {
      setShowCompletionScreen(
        true
      );

      return;
    }

    /*
      Normal next question.
    */

    if (!pendingNextQuestion) {
      setError(
        "The server did not return the next interview question."
      );

      return;
    }

    const nextIndex =
      pendingNextQuestionIndex ??
      session.currentQuestionIndex +
        1;

    setSession(
      (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,

          currentQuestionIndex:
            nextIndex,

          question:
            pendingNextQuestion,
        };
      }
    );

    setAnswer("");

    setEvaluation(null);

    setPendingNextQuestion(
      null
    );

    setPendingNextQuestionIndex(
      null
    );

    setError("");
  };

  /* =========================================
     LOADING
  ========================================= */

  if (sessionLoading) {
    return (
      <div className="interview-session-page interview-session-loading">
        <div className="session-loader" />

        <h2>
          Preparing your interview
        </h2>

        <p>
          Loading your interview
          session...
        </p>
      </div>
    );
  }

  /* =========================================
     FATAL ERROR
  ========================================= */

  if (
    !session &&
    error
  ) {
    return (
      <div className="interview-session-page">
        <div className="session-fatal-error">
          <div className="fatal-icon">
            <FiAlertCircle />
          </div>

          <h2>
            Interview could not be
            loaded
          </h2>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/dashboard/mock-interview"
              )
            }
          >
            <FiArrowLeft />

            Back to setup
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  /* =========================================
     UI
  ========================================= */

  return (
    <div className="interview-session-page">
      {/* HEADER */}

      <section className="session-top">
        <div>
          <button
            type="button"
            className="session-back"
            onClick={() =>
              navigate(
                "/dashboard/mock-interview"
              )
            }
          >
            <FiArrowLeft />

            Exit interview
          </button>

          <span className="session-eyebrow">
            AI Mock Interview
          </span>

          <h1>
            {category}
          </h1>

          <p>
            {difficulty} ·{" "}
            {interviewType ===
            "technical"
              ? "Technical"
              : "Behavioral"}{" "}
            interview
          </p>
        </div>

        <div className="session-progress-info">
          <div className="question-count">
            Question{" "}
            <strong>
              {currentQuestionNumber}
            </strong>{" "}
            of{" "}
            <strong>
              {
                session.totalQuestions
              }
            </strong>
          </div>

          <div className="progress-value">
            {progress}%
          </div>
        </div>
      </section>

      {/* PROGRESS */}

      <div className="session-progress-track">
        <div
          className="session-progress-fill"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {/* ERROR */}

      {error && (
        <div className="session-error">
          <FiAlertCircle />

          <span>
            {error}
          </span>
        </div>
      )}

      {/* MAIN */}

      <section className="session-grid">
        <main className="session-main-card">

          {/* =================================
              COMPLETION SCREEN
          ================================= */}

          {showCompletionScreen ? (
            <div className="interview-completed">
              <div className="completed-icon">
                <FiCheckCircle />
              </div>

              <span className="completed-eyebrow">
                Interview completed
              </span>

              <h2>
                Great work.
              </h2>

              {finalOverallScore !==
                null && (
                <div className="final-overall-score">
                  {finalOverallScore}
                  %
                </div>
              )}

              <p>
                You completed all{" "}
                {
                  session.totalQuestions
                }{" "}
                interview questions.
                Your answers were
                analyzed individually
                by AI.
              </p>

              <div className="completed-actions">
                <button
                  type="button"
                  className="review-results-btn"
                  onClick={() =>
                    navigate(
                      "/dashboard/history"
                    )
                  }
                >
                  <FiTrendingUp />

                  Review Results
                </button>

                <button
                  type="button"
                  className="new-session-btn"
                  onClick={() =>
                    navigate(
                      "/dashboard/mock-interview"
                    )
                  }
                >
                  New Interview

                  <FiArrowRight />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* QUESTION HEADER */}

              <div className="question-header">
                <div className="question-header__left">
                  <div className="question-icon">
                    <FiMessageSquare />
                  </div>

                  <div className="question-header__copy">
                    <span>
                      Interview question
                    </span>

                    <strong>
                      Question{" "}
                      {
                        currentQuestionNumber
                      }
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={`bookmark-question-btn${
                    bookmarked
                      ? " bookmark-question-btn--active"
                      : ""
                  }`}
                  onClick={() =>
                    void toggleBookmark()
                  }
                  disabled={
                    bookmarkLoading ||
                    bookmarkStatusLoading
                  }
                  aria-label={
                    bookmarked
                      ? "Remove question from bookmarks"
                      : "Save question to bookmarks"
                  }
                >
                  <FiBookmark />

                  <span>
                    {bookmarkStatusLoading
                      ? "Checking..."
                      : bookmarkLoading
                        ? "Saving..."
                        : bookmarked
                          ? "Saved"
                          : "Save question"}
                  </span>
                </button>
              </div>

              {/* QUESTION */}

              <div className="question-content">
                <h2>
                  {
                    session.question
                      .questionText
                  }
                </h2>

                <p>
                  Take a moment to
                  think through your
                  answer. Explain your
                  reasoning clearly
                  and use examples
                  where possible.
                </p>
              </div>

              {/* ANSWER */}

              {!evaluation &&
                !completed && (
                  <div className="answer-section">
                    <div className="answer-label-row">
                      <label htmlFor="interview-answer">
                        Your answer
                      </label>

                      <span>
                        {
                          characterCount
                        }{" "}
                        characters
                      </span>
                    </div>

                    <textarea
                      id="interview-answer"
                      value={answer}
                      onChange={(
                        event
                      ) =>
                        setAnswer(
                          event.target
                            .value
                        )
                      }
                      placeholder="Type your answer here. Explain your thought process as if you were speaking to a real interviewer..."
                      disabled={
                        loading
                      }
                      maxLength={
                        5000
                      }
                    />

                    <div className="answer-footer">
                      <span>
                        Minimum 10
                        characters
                      </span>

                      <button
                        type="button"
                        className="submit-answer-btn"
                        disabled={
                          !canSubmit
                        }
                        onClick={() =>
                          void submitAnswer()
                        }
                      >
                        {loading ? (
                          <>
                            <span className="small-loader" />

                            Analyzing...
                          </>
                        ) : (
                          <>
                            Submit
                            Answer

                            <FiSend />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              {/* =================================
                  AI EVALUATION

                  completed olsa belə göstərilir.
              ================================= */}

              {evaluation && (
                <div className="evaluation-card">
                  <div className="evaluation-header">
                    <div>
                      <span className="evaluation-eyebrow">
                        AI Evaluation
                      </span>

                      <h3>
                        Answer feedback
                      </h3>
                    </div>

                    {typeof
                      evaluation.score ===
                      "number" && (
                      <div className="evaluation-score">
                        <strong>
                          {Math.round(
                            evaluation.score
                          )}
                        </strong>

                        <span>
                          /100
                        </span>
                      </div>
                    )}
                  </div>

                  {/* FEEDBACK */}

                  {evaluation.feedback && (
                    <div className="feedback-block">
                      <span>
                        Feedback
                      </span>

                      <p>
                        {
                          evaluation.feedback
                        }
                      </p>
                    </div>
                  )}

                  {/* SCORE BREAKDOWN */}

                  <div className="score-breakdown">
                    <div>
                      <span>
                        Technical
                        accuracy
                      </span>

                      <strong>
                        {
                          evaluation.technicalAccuracy
                        }
                        %
                      </strong>
                    </div>

                    <div>
                      <span>
                        Completeness
                      </span>

                      <strong>
                        {
                          evaluation.completeness
                        }
                        %
                      </strong>
                    </div>

                    <div>
                      <span>
                        Communication
                      </span>

                      <strong>
                        {
                          evaluation.communication
                        }
                        %
                      </strong>
                    </div>
                  </div>

                  {/* STRENGTHS */}

                  {evaluation
                    .strengths &&
                    evaluation
                      .strengths
                      .length >
                      0 && (
                      <div className="evaluation-list strengths-list">
                        <span>
                          Strengths
                        </span>

                        {evaluation.strengths.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={
                                index
                              }
                            >
                              <FiCheck />

                              <p>
                                {
                                  item
                                }
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {/* IMPROVEMENTS */}

                  {evaluation
                    .weaknesses &&
                    evaluation
                      .weaknesses
                      .length >
                      0 && (
                      <div className="evaluation-list improvement-list">
                        <span>
                          Areas to
                          improve
                        </span>

                        {evaluation.weaknesses.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={
                                index
                              }
                            >
                              <FiTarget />

                              <p>
                                {
                                  item
                                }
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {/* IMPROVED ANSWER */}

                  {evaluation.improvedAnswer && (
                    <div className="improved-answer">
                      <span>
                        Example improved
                        answer
                      </span>

                      <p>
                        {
                          evaluation.improvedAnswer
                        }
                      </p>
                    </div>
                  )}

                  {/* CONTINUE BUTTON */}

                  <button
                    type="button"
                    className="next-question-btn"
                    onClick={
                      handleContinue
                    }
                  >
                    {completed
                      ? "Finish Interview"
                      : "Next Question"}

                    <FiArrowRight />
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* =====================================
            RIGHT SIDEBAR
        ===================================== */}

        <aside className="session-side">
          <div className="session-info-card">
            <span className="side-eyebrow">
              Session
            </span>

            <h3>
              Interview details
            </h3>

            <div className="session-detail-list">
              <div>
                <span>
                  Category
                </span>

                <strong>
                  {category}
                </strong>
              </div>

              <div>
                <span>
                  Difficulty
                </span>

                <strong>
                  {difficulty}
                </strong>
              </div>

              <div>
                <span>
                  Type
                </span>

                <strong>
                  {interviewType ===
                  "technical"
                    ? "Technical"
                    : "Behavioral"}
                </strong>
              </div>

              <div>
                <span>
                  Questions
                </span>

                <strong>
                  {
                    session.totalQuestions
                  }
                </strong>
              </div>
            </div>
          </div>

          <div className="session-tip-card">
            <div className="tip-icon">
              <FiTarget />
            </div>

            <span>
              Interview tip
            </span>

            <h3>
              Think out loud
            </h3>

            <p>
              Interviewers value your
              reasoning process.
              Explain why you choose
              an approach instead of
              only giving the final
              answer.
            </p>
          </div>

          <div className="session-status-card">
            <div>
              <FiClock />

              <span>
                Session status
              </span>
            </div>

            <strong>
              {completed
                ? "Completed"
                : "In Progress"}
            </strong>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default interviewSessionPage;