import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiCheckCircle,
  FiCode,
  FiMessageCircle,
  FiRefreshCw,
  FiTarget,
} from "react-icons/fi";
import apiClient from "../../../api/apiClient";
import "./historyPage.scss";

interface ScoreProgressionItem {
  interviewId: string;
  date: string;
  category: string;
  score: number;
}

interface CategoryPerformanceItem {
  category: string;
  averageScore: number;
  interviewCount: number;
}

interface CategorySummary {
  category: string;
  averageScore: number;
}

interface ProgressData {
  completedInterviewsCount: number;
  averageTechnicalAccuracy: number;
  averageCompleteness: number;
  averageCommunication: number;
  strongestCategory: CategorySummary | null;
  weakestCategory: CategorySummary | null;
  scoreProgression: ScoreProgressionItem[];
  categoryPerformance: CategoryPerformanceItem[];
}

interface ProgressResponse {
  success: boolean;
  data: ProgressData;
}

const categoryNames: Record<string, string> = {
  frontend: "Frontend Developer",
  backend: "Backend Developer",
  "software-engineer": "Software Engineer",
  devops: "DevOps Engineer",
  "ui-ux": "UI/UX Designer",
  "machine-learning": "Machine Learning Engineer",
};

const formatCategory = (category: string): string => {
  return (
    categoryNames[category] ||
    category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
};

const formatDate = (dateValue: string): string => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const getRelativeDate = (dateValue: string): string => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const now = new Date();

  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const todayOnly = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diffMilliseconds =
    todayOnly.getTime() - dateOnly.getTime();

  const diffDays = Math.round(
    diffMilliseconds / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "1 day ago";
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);

    return weeks === 1
      ? "1 week ago"
      : `${weeks} weeks ago`;
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);

    return months === 1
      ? "1 month ago"
      : `${months} months ago`;
  }

  const years = Math.floor(diffDays / 365);

  return years === 1
    ? "1 year ago"
    : `${years} years ago`;
};

const getScoreLabel = (score: number): string => {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 80) {
    return "Very Good";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 60) {
    return "Fair";
  }

  return "Needs Improvement";
};

const historyPage = () => {
  const [progress, setProgress] =
    useState<ProgressData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const fetchProgress = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await apiClient.get<ProgressResponse>("/progress");

      if (!response.data.success) {
        setError("Progress data could not be loaded.");
        return;
      }

      setProgress(response.data.data);
    } catch {
      setError(
        "We could not load your interview history. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProgress();
  }, []);

  const allSessions = useMemo(() => {
    if (!progress) {
      return [];
    }

    return [...progress.scoreProgression].sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [progress]);

  const averageScore = useMemo(() => {
    if (
      !progress ||
      progress.scoreProgression.length === 0
    ) {
      return 0;
    }

    const total =
      progress.scoreProgression.reduce(
        (sum, item) => sum + item.score,
        0
      );

    return Math.round(
      total / progress.scoreProgression.length
    );
  }, [progress]);

  const bestScore = useMemo(() => {
    if (
      !progress ||
      progress.scoreProgression.length === 0
    ) {
      return 0;
    }

    return Math.max(
      ...progress.scoreProgression.map(
        (item) => item.score
      )
    );
  }, [progress]);

  return (
    <main className="history-page">
      <section className="history-page__header">
        <div>
          <span className="history-page__eyebrow">
            PROGRESS
          </span>

          <h1>History & Progress</h1>

          <p>
            Track your interview performance and see how your
            skills improve over time.
          </p>
        </div>
      </section>

      {error ? (
        <section className="history-error-card">
          <div className="history-page__error-icon">
            <FiActivity />
          </div>

          <div>
            <h2>Unable to load progress</h2>

            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() => void fetchProgress()}
            className="history-page__retry-button"
          >
            <FiRefreshCw />
            Try Again
          </button>
        </section>
      ) : (
        <>
          <section className="progress-snapshot">
            <div className="progress-snapshot__main">
              <div className="progress-snapshot__heading">
                <span>PROGRESS SNAPSHOT</span>

                <h2>
                  Your interview performance at a glance
                </h2>

                <p>
                  A quick overview based on all of your completed
                  mock interview sessions.
                </p>
              </div>

              <div className="progress-snapshot__score">
                <div className="progress-snapshot__score-circle">
                  {loading ? (
                    <span className="history-skeleton history-skeleton--score" />
                  ) : (
                    <strong>{averageScore}%</strong>
                  )}

                  <span>Average</span>
                </div>

                <div className="progress-snapshot__score-copy">
                  <span>Overall Performance</span>

                  {loading ? (
                    <span className="history-skeleton history-skeleton--text-lg" />
                  ) : (
                    <strong>
                      {getScoreLabel(averageScore)}
                    </strong>
                  )}

                  {loading ? (
                    <span className="history-skeleton history-skeleton--text-sm" />
                  ) : (
                    <small>
                      Based on{" "}
                      {progress?.completedInterviewsCount ?? 0}{" "}
                      completed{" "}
                      {progress?.completedInterviewsCount === 1
                        ? "interview"
                        : "interviews"}
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className="progress-snapshot__details">
              <div className="snapshot-detail">
                <div className="snapshot-detail__icon">
                  <FiAward />
                </div>

                <div>
                  <span>Best Score</span>

                  {loading ? (
                    <span className="history-skeleton history-skeleton--value" />
                  ) : (
                    <strong>{bestScore}%</strong>
                  )}
                </div>
              </div>

              <div className="snapshot-detail">
                <div className="snapshot-detail__icon">
                  <FiCheckCircle />
                </div>

                <div>
                  <span>Completed</span>

                  {loading ? (
                    <span className="history-skeleton history-skeleton--value" />
                  ) : (
                    <strong>
                      {progress?.completedInterviewsCount ?? 0}
                    </strong>
                  )}
                </div>
              </div>

              <div className="snapshot-detail">
                <div className="snapshot-detail__icon">
                  <FiTarget />
                </div>

                <div>
                  <span>Strongest Area</span>

                  {loading ? (
                    <>
                      <span className="history-skeleton history-skeleton--text-lg" />
                      <span className="history-skeleton history-skeleton--text-sm" />
                    </>
                  ) : (
                    <>
                      <strong>
                        {progress?.strongestCategory
                          ? formatCategory(
                              progress.strongestCategory.category
                            )
                          : "Not available"}
                      </strong>

                      {progress?.strongestCategory && (
                        <small>
                          {
                            progress.strongestCategory
                              .averageScore
                          }
                          % average
                        </small>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="history-grid">
            <div className="history-card history-card--categories">
              <div className="history-card__header">
                <div>
                  <span className="history-card__label">
                    CATEGORIES
                  </span>

                  <h2>Category Performance</h2>

                  <p>
                    Compare your average performance across
                    interview categories.
                  </p>
                </div>

                <div className="history-card__header-icon">
                  <FiBarChart2 />
                </div>
              </div>

              {loading ? (
                <div className="category-performance">
                  {[1, 2, 3].map((item) => (
                    <div
                      className="category-performance__item"
                      key={item}
                    >
                      <div className="category-performance__top">
                        <div>
                          <span className="history-skeleton history-skeleton--category-title" />
                          <span className="history-skeleton history-skeleton--category-subtitle" />
                        </div>

                        <span className="history-skeleton history-skeleton--category-score" />
                      </div>

                      <div className="history-skeleton history-skeleton--progress" />
                    </div>
                  ))}
                </div>
              ) : progress &&
                progress.categoryPerformance.length > 0 ? (
                <div className="category-performance">
                  {progress.categoryPerformance
                    .slice()
                    .sort(
                      (a, b) =>
                        b.averageScore - a.averageScore
                    )
                    .map((item) => (
                      <article
                        className="category-performance__item"
                        key={item.category}
                      >
                        <div className="category-performance__top">
                          <div>
                            <strong>
                              {formatCategory(item.category)}
                            </strong>

                            <span>
                              {item.interviewCount}{" "}
                              {item.interviewCount === 1
                                ? "interview"
                                : "interviews"}
                            </span>
                          </div>

                          <div className="category-performance__score">
                            {item.averageScore}%
                          </div>
                        </div>

                        <div className="category-performance__track">
                          <div
                            className="category-performance__fill"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  item.averageScore
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <div className="history-card__empty">
                  Complete interviews in different categories to
                  see category performance.
                </div>
              )}
            </div>

            <div className="history-card history-card--skills">
              <div className="history-card__header">
                <div>
                  <span className="history-card__label">
                    SKILLS
                  </span>

                  <h2>Performance Breakdown</h2>

                  <p>
                    Average scores from AI answer evaluations.
                  </p>
                </div>
              </div>

              <div className="skill-progress-list">
                {loading ? (
                  <>
                    {[1, 2, 3].map((item) => (
                      <div className="skill-progress" key={item}>
                        <div className="skill-progress__top">
                          <div className="skill-progress__name">
                            <span className="skill-progress__icon history-skeleton-icon" />

                            <span className="history-skeleton history-skeleton--skill-name" />
                          </div>

                          <span className="history-skeleton history-skeleton--skill-score" />
                        </div>

                        <span className="history-skeleton history-skeleton--progress" />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="skill-progress">
                      <div className="skill-progress__top">
                        <div className="skill-progress__name">
                          <span className="skill-progress__icon">
                            <FiCode />
                          </span>

                          <span>Technical Accuracy</span>
                        </div>

                        <strong>
                          {progress?.averageTechnicalAccuracy ?? 0}%
                        </strong>
                      </div>

                      <div className="skill-progress__track">
                        <div
                          className="skill-progress__fill"
                          style={{
                            width: `${
                              progress?.averageTechnicalAccuracy ??
                              0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="skill-progress">
                      <div className="skill-progress__top">
                        <div className="skill-progress__name">
                          <span className="skill-progress__icon">
                            <FiCheckCircle />
                          </span>

                          <span>Completeness</span>
                        </div>

                        <strong>
                          {progress?.averageCompleteness ?? 0}%
                        </strong>
                      </div>

                      <div className="skill-progress__track">
                        <div
                          className="skill-progress__fill"
                          style={{
                            width: `${
                              progress?.averageCompleteness ?? 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="skill-progress">
                      <div className="skill-progress__top">
                        <div className="skill-progress__name">
                          <span className="skill-progress__icon">
                            <FiMessageCircle />
                          </span>

                          <span>Communication</span>
                        </div>

                        <strong>
                          {progress?.averageCommunication ?? 0}%
                        </strong>
                      </div>

                      <div className="skill-progress__track">
                        <div
                          className="skill-progress__fill"
                          style={{
                            width: `${
                              progress?.averageCommunication ?? 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="history-insight">
                <FiAward />

                <div>
                  <span>Strongest Category</span>

                  {loading ? (
                    <>
                      <span className="history-skeleton history-skeleton--text-lg" />
                      <span className="history-skeleton history-skeleton--text-sm" />
                    </>
                  ) : (
                    <>
                      <strong>
                        {progress?.strongestCategory
                          ? formatCategory(
                              progress.strongestCategory.category
                            )
                          : "Not available"}
                      </strong>

                      {progress?.strongestCategory && (
                        <small>
                          {
                            progress.strongestCategory
                              .averageScore
                          }
                          % average score
                        </small>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="history-insight history-insight--weak">
                <FiTarget />

                <div>
                  <span>Needs More Practice</span>

                  {loading ? (
                    <>
                      <span className="history-skeleton history-skeleton--text-lg" />
                      <span className="history-skeleton history-skeleton--text-sm" />
                    </>
                  ) : (
                    <>
                      <strong>
                        {progress?.weakestCategory
                          ? formatCategory(
                              progress.weakestCategory.category
                            )
                          : "Not available"}
                      </strong>

                      {progress?.weakestCategory && (
                        <small>
                          {
                            progress.weakestCategory
                              .averageScore
                          }
                          % average score
                        </small>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="history-card history-card--sessions">
            <div className="history-card__header">
              <div>
                <span className="history-card__label">
                  HISTORY
                </span>

                <h2>Interview History</h2>

                <p>
                  All of your completed mock interview sessions.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="recent-sessions">
                {[1, 2, 3].map((item) => (
                  <div
                    className="recent-session"
                    key={item}
                  >
                    <div className="recent-session__left">
                      <span className="recent-session__icon history-skeleton-icon" />

                      <div className="recent-session__content">
                        <span className="history-skeleton history-skeleton--session-title" />

                        <div className="recent-session__meta">
                          <span className="history-skeleton history-skeleton--session-meta" />
                        </div>
                      </div>
                    </div>

                    <span className="history-skeleton history-skeleton--session-score" />
                  </div>
                ))}
              </div>
            ) : allSessions.length > 0 ? (
              <div className="recent-sessions">
                {allSessions.map((session) => (
                  <article
                    className="recent-session"
                    key={session.interviewId}
                  >
                    <div className="recent-session__left">
                      <div className="recent-session__icon">
                        <FiActivity />
                      </div>

                      <div className="recent-session__content">
                        <strong>
                          {formatCategory(session.category)}
                        </strong>

                        <div className="recent-session__meta">
                          <span>
                            {formatDate(session.date)}
                          </span>

                          <span className="recent-session__dot" />

                          <span>
                            {getRelativeDate(session.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="recent-session__score">
                      <span>Score</span>
                      <strong>{session.score}%</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="history-card__empty">
                No completed interview sessions yet.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default historyPage;