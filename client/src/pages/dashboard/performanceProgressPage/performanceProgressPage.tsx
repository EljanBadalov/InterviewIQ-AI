import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiActivity,
  FiAward,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiCode,
  FiMessageCircle,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";

import apiClient from "../../../api/apiClient";

import "./performanceProgressPage.scss";

/* =========================================================
   TYPES
========================================================= */

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

interface ProgressTypeTrendItem {
  interviewId: string;
  date: string;
  category: string;
  score: number;
}

interface DifficultyProgressionItem {
  interviewId: string;
  date: string;
  difficulty:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "senior";
  score: number;
}

interface WeaknessPattern {
  label: string;
  count: number;
}

interface TypePerformance {
  averageScore: number;
  recentAverage: number;
  previousAverage: number;
  change: number;
  trend: ProgressTypeTrendItem[];
}

type RoleSkillStatus =
  | "not_assessed"
  | "beginner"
  | "developing"
  | "good"
  | "strong";

interface RoleSkillProgressItem {
  id: string;

  name: string;

  kind:
    | "core"
    | "role"
    | "tool"
    | "topic";

  score:
    number |
    null;

  status:
    RoleSkillStatus;

  confidence:
    number;

  evidenceCount:
    number;

  sources:
    string[];

  interviewVerified:
    boolean;

  presentInResume:
    boolean;

  importance?:
    string;

  level?:
    string;

  reason:
    string;
}

interface RoleSkillProgress {
  targetRole: string;

  roleTitle: string;

  roleReadiness: number;

  assessedAverage: number;

  coveragePercent: number;

  totalSkills: number;

  assessedSkills: number;

  strongSkills: number;

  priorityGaps: number;

  strongestSkills:
    RoleSkillProgressItem[];

  focusSkills:
    RoleSkillProgressItem[];

  notAssessedCount: number;

  skills:
    RoleSkillProgressItem[];
}

interface ProgressAIInsights {
  typeComparisonSummary: string;
  progressQualitySummary: string;
  difficultySummary: string;
  recurringPatternsSummary: string;
  nextPriority: string;
  roleSkillSummary: string;
  roleSkillNextFocus: string;
}

interface ProgressData {
  completedInterviewsCount: number;
  averageTechnicalAccuracy: number;
  averageCompleteness: number;
  averageCommunication: number;

  technicalPerformance: TypePerformance;
  behavioralPerformance: TypePerformance;
  technicalBehavioralDifference: number;

  lastFiveAverage: number;
  previousFiveAverage: number;
  recentChange: number;
  consistencyScore: number;
  bestStreak: number;

  currentDifficulty:
    | "beginner"
    | "intermediate"
    | "advanced"
    | "senior"
    | null;

  difficultyProgression: DifficultyProgressionItem[];
  recurringWeaknesses: WeaknessPattern[];

  roleSkillProgress:
    RoleSkillProgress |
    null;

  aiInsights: ProgressAIInsights;

  strongestCategory:
    CategorySummary |
    null;

  weakestCategory:
    CategorySummary |
    null;

  scoreProgression:
    ScoreProgressionItem[];

  categoryPerformance:
    CategoryPerformanceItem[];
}

interface ProgressResponse {
  success: boolean;

  data: ProgressData;
}

/* =========================================================
   HELPERS
========================================================= */

const categoryNames:
  Record<
    string,
    string
  > = {
  frontend:
    "Frontend Developer",

  "frontend-developer":
    "Frontend Developer",

  backend:
    "Backend Developer",

  "backend-developer":
    "Backend Developer",

  "software-engineer":
    "Software Engineer",

  "software-engineering":
    "Software Engineering",

  devops:
    "DevOps Engineer",

  "devops-engineer":
    "DevOps Engineer",

  "ui-ux":
    "UI/UX Designer",

  "ui-ux-designer":
    "UI/UX Designer",

  "machine-learning":
    "Machine Learning Engineer",

  "machine-learning-engineer":
    "Machine Learning Engineer",
};

const clampScore = (
  value:
    number
): number => {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value
      )
    )
  );
};

const formatCategory = (
  category:
    string
): string => {
  return (
    categoryNames[
      category
    ] ||
    category
      .split(
        "-"
      )
      .map(
        (
          word
        ) =>
          word
            .charAt(
              0
            )
            .toUpperCase() +
          word.slice(
            1
          )
      )
      .join(
        " "
      )
  );
};

const formatShortDate = (
  dateValue:
    string
): string => {
  const date =
    new Date(
      dateValue
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",
    }
  ).format(
    date
  );
};

const getScoreLabel = (
  score:
    number
): string => {
  if (
    score >=
    90
  ) {
    return "Excellent";
  }

  if (
    score >=
    80
  ) {
    return "Very Good";
  }

  if (
    score >=
    70
  ) {
    return "Good";
  }

  if (
    score >=
    60
  ) {
    return "Fair";
  }

  return "Needs Improvement";
};

const getTrendLabel = (
  difference:
    number
): string => {
  if (
    difference >=
    8
  ) {
    return "Strong improvement";
  }

  if (
    difference >=
    3
  ) {
    return "Improving";
  }

  if (
    difference <=
    -8
  ) {
    return "Needs attention";
  }

  if (
    difference <=
    -3
  ) {
    return "Slight decline";
  }

  return "Stable";
};

const formatDifficulty = (
  value:
    ProgressData["currentDifficulty"]
): string => {
  if (!value) {
    return "Not available";
  }

  return value
    .charAt(0)
    .toUpperCase() +
    value.slice(1);
};

const formatRoleSkillStatus = (
  status:
    RoleSkillStatus
): string => {
  if (
    status ===
    "not_assessed"
  ) {
    return "Not assessed";
  }

  return status
    .charAt(0)
    .toUpperCase() +
    status.slice(1);
};

const formatRoleSkillKind = (
  kind:
    RoleSkillProgressItem["kind"]
): string => {
  if (
    kind ===
    "core"
  ) {
    return "Core skill";
  }

  if (
    kind ===
    "role"
  ) {
    return "Role skill";
  }

  if (
    kind ===
    "tool"
  ) {
    return "Tool";
  }

  return "Knowledge topic";
};

/* =========================================================
   COMPONENT
========================================================= */

const performanceProgressPage =
  () => {
    const [
      progress,
      setProgress,
    ] =
      useState<
        ProgressData |
        null
      >(
        null
      );

    const [
      loading,
      setLoading,
    ] =
      useState<boolean>(
        true
      );

    const [
      error,
      setError,
    ] =
      useState<string>(
        ""
      );

    const [
      showAllRoleSkills,
      setShowAllRoleSkills,
    ] =
      useState<boolean>(
        false
      );

    const roleSkills =
      useMemo(
        () =>
          progress
            ?.roleSkillProgress
            ?.skills ??
          [],
        [
          progress,
        ]
      );

    const visibleRoleSkills =
      useMemo(
        () =>
          showAllRoleSkills
            ? roleSkills
            : roleSkills.slice(
                0,
                6
              ),
        [
          roleSkills,
          showAllRoleSkills,
        ]
      );

    const hiddenRoleSkillCount =
      Math.max(
        0,
        roleSkills.length -
          6
      );

    const fetchProgress =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const response =
            await apiClient.get<ProgressResponse>(
              "/progress"
            );

          if (
            !response.data
              .success
          ) {
            setError(
              "Progress data could not be loaded."
            );

            return;
          }

          setProgress(
            response.data.data
          );

          setShowAllRoleSkills(
            false
          );
        } catch {
          setError(
            "We could not load your performance data. Please try again."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    useEffect(
      () => {
        void fetchProgress();
      },
      []
    );

    /* =====================================================
       DERIVED DATA
    ===================================================== */

    const progression =
      useMemo(
        () => {
          if (
            !progress
          ) {
            return [];
          }

          return [
            ...progress
              .scoreProgression,
          ].sort(
            (
              a,
              b
            ) =>
              new Date(
                a.date
              ).getTime() -
              new Date(
                b.date
              ).getTime()
          );
        },
        [
          progress,
        ]
      );

    const averageScore =
      useMemo(
        () => {
          if (
            progression.length ===
            0
          ) {
            return 0;
          }

          const total =
            progression.reduce(
              (
                sum,
                item
              ) =>
                sum +
                item.score,
              0
            );

          return clampScore(
            total /
              progression.length
          );
        },
        [
          progression,
        ]
      );

    const bestScore =
      useMemo(
        () => {
          if (
            progression.length ===
            0
          ) {
            return 0;
          }

          return Math.max(
            ...progression.map(
              (
                item
              ) =>
                item.score
            )
          );
        },
        [
          progression,
        ]
      );

    const trendDifference =
      useMemo(
        () => {
          if (
            progression.length <
            2
          ) {
            return 0;
          }

          const recent =
            progression.slice(
              -5
            );

          const first =
            recent[0]
              ?.score ??
            0;

          const last =
            recent[
              recent.length -
                1
            ]?.score ??
            first;

          return (
            last -
            first
          );
        },
        [
          progression,
        ]
      );

    const strongestSkill =
      useMemo(
        () => {
          if (
            !progress
          ) {
            return {
              name:
                "Not available",

              score:
                0,
            };
          }

          const skills = [
            {
              name:
                "Technical Accuracy",

              score:
                progress.averageTechnicalAccuracy,
            },

            {
              name:
                "Completeness",

              score:
                progress.averageCompleteness,
            },

            {
              name:
                "Communication",

              score:
                progress.averageCommunication,
            },
          ];

          return skills.sort(
            (
              a,
              b
            ) =>
              b.score -
              a.score
          )[0];
        },
        [
          progress,
        ]
      );

    const weakestSkill =
      useMemo(
        () => {
          if (
            !progress
          ) {
            return {
              name:
                "Not available",

              score:
                0,
            };
          }

          const skills = [
            {
              name:
                "Technical Accuracy",

              score:
                progress.averageTechnicalAccuracy,
            },

            {
              name:
                "Completeness",

              score:
                progress.averageCompleteness,
            },

            {
              name:
                "Communication",

              score:
                progress.averageCommunication,
            },
          ];

          return skills.sort(
            (
              a,
              b
            ) =>
              a.score -
              b.score
          )[0];
        },
        [
          progress,
        ]
      );

    const mostPracticedField =
      useMemo(
        () => {
          if (
            !progress ||
            progress.categoryPerformance.length ===
              0
          ) {
            return {
              name:
                "Not available",

              count:
                0,
            };
          }

          const mostPracticed =
            [
              ...progress.categoryPerformance,
            ].sort(
              (
                a,
                b
              ) =>
                b.interviewCount -
                a.interviewCount
            )[0];

          return {
            name:
              formatCategory(
                mostPracticed.category
              ),

            count:
              mostPracticed.interviewCount,
          };
        },
        [
          progress,
        ]
      );

    const difficultyChanges =
      useMemo(
        () => {
          const items =
            progress?.difficultyProgression ??
            [];

          return items.filter(
            (item, index) =>
              index === 0 ||
              items[index - 1]
                ?.difficulty !==
                item.difficulty
          );
        },
        [progress]
      );

    return (
      <main className="performance-page">
        {/* =================================================
            HEADER
        ================================================= */}

        <section className="performance-page__header">
          <div>
            <span className="performance-page__eyebrow">
              PERFORMANCE
            </span>

            <h1>
              Performance & Progress
            </h1>

            <p>
              Understand how your interview performance changes over time,
              where you are strongest, and what needs more practice.
            </p>
          </div>
        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error ? (
          <section className="performance-error-card">
            <div className="performance-error-card__icon">
              <FiActivity />
            </div>

            <div>
              <h2>
                Unable to load progress
              </h2>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void fetchProgress()
              }
            >
              <FiRefreshCw />

              Try Again
            </button>
          </section>
        ) : (
          <>
            {/* =================================================
                OVERALL SNAPSHOT
            ================================================= */}

            <section className="performance-snapshot">
              <div className="performance-snapshot__intro">
                <span>
                  PROGRESS SNAPSHOT
                </span>

                <h2>
                  Your interview performance at a glance
                </h2>

                <p>
                  A concise overview based on your completed mock interview
                  evaluations.
                </p>
              </div>

              <div className="performance-snapshot__score">
                <div className="performance-score-ring">
                  {loading ? (
                    <span className="performance-skeleton performance-skeleton--score" />
                  ) : (
                    <strong>
                      {averageScore}%
                    </strong>
                  )}

                  <span>
                    Average
                  </span>
                </div>

                <div className="performance-score-copy">
                  <span>
                    Overall Performance
                  </span>

                  {loading ? (
                    <span className="performance-skeleton performance-skeleton--text-lg" />
                  ) : (
                    <strong>
                      {getScoreLabel(
                        averageScore
                      )}
                    </strong>
                  )}

                  <small>
                    Based on{" "}
                    {progress?.completedInterviewsCount ??
                      0}{" "}
                    completed interviews
                  </small>
                </div>
              </div>

              <div className="performance-snapshot__stats">
                <div className="performance-stat">
                  <div>
                    <FiAward />
                  </div>

                  <span>
                    Best Score
                  </span>

                  <strong>
                    {loading
                      ? "—"
                      : `${bestScore}%`}
                  </strong>
                </div>

                <div className="performance-stat">
                  <div>
                    <FiCheckCircle />
                  </div>

                  <span>
                    Completed
                  </span>

                  <strong>
                    {loading
                      ? "—"
                      : progress
                          ?.completedInterviewsCount ??
                        0}
                  </strong>
                </div>

                <div className="performance-stat">
                  <div>
                    <FiTarget />
                  </div>

                  <span>
                    Most Practiced Field
                  </span>

                  <strong>
                    {loading
                      ? "—"
                      : mostPracticedField.name}
                  </strong>
                </div>
              </div>
            </section>

            {/* =================================================
                TREND + BREAKDOWN
            ================================================= */}

            <section className="performance-grid performance-grid--primary">
              {/* SCORE TREND */}

              <article className="performance-card performance-card--trend">
                <div className="performance-card__header">
                  <div>
                    <span>
                      SCORE TREND
                    </span>

                    <h2>
                      Performance over time
                    </h2>

                    <p>
                      Your most recent interview scores and overall direction.
                    </p>
                  </div>

                  <div className="performance-card__header-icon">
                    <FiTrendingUp />
                  </div>
                </div>

                {loading ? (
                  <div className="performance-momentum-loading-skeleton">
                    <div className="performance-momentum-loading-y-axis">
                      <span>100</span>
                      <span>75</span>
                      <span>50</span>
                      <span>25</span>
                      <span>0</span>
                    </div>

                    <div className="performance-momentum-loading-main">
                      <div className="performance-momentum-loading-grid">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>

                      <div className="performance-momentum-loading-line">
                        <span className="performance-momentum-loading-line__one" />
                        <span className="performance-momentum-loading-line__two" />
                        <span className="performance-momentum-loading-line__three" />
                        <span className="performance-momentum-loading-line__four" />
                      </div>

                      <div className="performance-momentum-loading-points">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>

                      <div className="performance-momentum-loading-x-axis">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                ) : progression.length === 0 ? (
                  <div className="performance-card__empty">
                    Complete more interviews to see your score trend.
                  </div>
                ) : (
                  <>
                    <div className="performance-trend-summary">
                      <div>
                        <span>
                          RECENT TREND
                        </span>

                        <strong>
                          {getTrendLabel(
                            trendDifference
                          )}
                        </strong>
                      </div>

                      <div
                        className={`performance-trend-delta ${
                          trendDifference >
                          0
                            ? "positive"
                            : trendDifference <
                                0
                              ? "negative"
                              : "neutral"
                        }`}
                      >
                        {trendDifference >
                        0
                          ? "+"
                          : ""}
                        {trendDifference}
                        %
                      </div>
                    </div>

                    <PerformanceMomentumChart
                      interviews={
                        progression
                      }
                    />
                  </>
                )}
              </article>


            </section>

            <section className="performance-card performance-card--skills performance-card--skills-full">
                <div className="performance-card__header">
                  <div>
                    <span>
                      SKILLS
                    </span>

                    <h2>
                      Performance Breakdown
                    </h2>

                    <p>
                      Average scores from AI answer evaluations.
                    </p>
                  </div>
                </div>

                <div className="performance-skill-list">
                  {[
                    {
                      name:
                        "Technical Accuracy",

                      score:
                        progress
                          ?.averageTechnicalAccuracy ??
                        0,

                      icon:
                        <FiCode />,
                    },

                    {
                      name:
                        "Completeness",

                      score:
                        progress
                          ?.averageCompleteness ??
                        0,

                      icon:
                        <FiCheckCircle />,
                    },

                    {
                      name:
                        "Communication",

                      score:
                        progress
                          ?.averageCommunication ??
                        0,

                      icon:
                        <FiMessageCircle />,
                    },
                  ].map(
                    (
                      item
                    ) => (
                      <div
                        className="performance-skill"
                        key={
                          item.name
                        }
                      >
                        <div className="performance-skill__top">
                          <div>
                            <span>
                              {
                                item.icon
                              }
                            </span>

                            <strong>
                              {
                                item.name
                              }
                            </strong>
                          </div>

                          <b>
                            {loading
                              ? "—"
                              : `${clampScore(
                                  item.score
                                )}%`}
                          </b>
                        </div>

                        <div className="performance-track">
                          <span
                            style={{
                              width:
                                `${clampScore(
                                  item.score
                                )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
            </section>

            {/* =================================================
                ROLE SKILL PROGRESS
            ================================================= */}

            <section className="performance-card performance-card--role-skills">
              <div className="performance-card__header performance-role-skill-header">
                <div>
                  <span>
                    ROLE SKILL PROGRESS
                  </span>

                  <h2>
                    {loading
                      ? "Role-specific skill mastery"
                      : progress?.roleSkillProgress
                        ? `${progress.roleSkillProgress.roleTitle} skill mastery`
                        : "Role-specific skill mastery"}
                  </h2>

                  {loading ? (
                    <div className="performance-copy-skeleton">
                      <span className="performance-skeleton performance-skeleton--copy-line" />
                      <span className="performance-skeleton performance-skeleton--copy-line performance-skeleton--copy-line-short" />
                    </div>
                  ) : (
                    <p>
                      {progress?.aiInsights.roleSkillSummary ??
                        "Complete role-specific technical interviews to unlock a detailed skill map."}
                    </p>
                  )}
                </div>

                <div className="performance-card__header-icon">
                  <FiCode />
                </div>
              </div>

              {loading ? (
                <>
                  <div className="performance-role-skill-stats">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        className="performance-role-skill-stat"
                        key={item}
                      >
                        <span className="performance-skeleton performance-skeleton--role-stat-label" />
                        <span className="performance-skeleton performance-skeleton--role-stat-value" />
                        <span className="performance-skeleton performance-skeleton--role-stat-copy" />
                      </div>
                    ))}
                  </div>

                  <div className="performance-role-skill-grid">
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <div
                        className="performance-role-skill-card"
                        key={item}
                      >
                        <div className="performance-role-skill-card__top">
                          <div>
                            <span className="performance-skeleton performance-skeleton--role-status" />
                            <span className="performance-skeleton performance-skeleton--role-skill-name" />
                          </div>

                          <span className="performance-skeleton performance-skeleton--role-skill-score" />
                        </div>

                        <span className="performance-skeleton performance-skeleton--progress" />

                        <div className="performance-role-skill-card__skeleton-copy">
                          <span className="performance-skeleton performance-skeleton--role-copy" />
                          <span className="performance-skeleton performance-skeleton--role-copy performance-skeleton--role-copy-short" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : progress?.roleSkillProgress ? (
                <>
                  <div className="performance-role-skill-stats">
                    <div className="performance-role-skill-stat">
                      <span>
                        ROLE READINESS
                      </span>

                      <strong>
                        {progress.roleSkillProgress.roleReadiness}%
                      </strong>

                      <small>
                        Mastery balanced with evidence coverage
                      </small>
                    </div>

                    <div className="performance-role-skill-stat">
                      <span>
                        EVIDENCE COVERAGE
                      </span>

                      <strong>
                        {progress.roleSkillProgress.coveragePercent}%
                      </strong>

                      <small>
                        {progress.roleSkillProgress.assessedSkills} of{" "}
                        {progress.roleSkillProgress.totalSkills} mapped skills assessed
                      </small>
                    </div>

                    <div className="performance-role-skill-stat">
                      <span>
                        ASSESSED AVERAGE
                      </span>

                      <strong>
                        {progress.roleSkillProgress.assessedAverage}%
                      </strong>

                      <small>
                        Average only across skills with evidence
                      </small>
                    </div>

                    <div className="performance-role-skill-stat">
                      <span>
                        NOT ASSESSED
                      </span>

                      <strong>
                        {progress.roleSkillProgress.notAssessedCount}
                      </strong>

                      <small>
                        Unknown skills are not counted as 0%
                      </small>
                    </div>
                  </div>

                  <div className="performance-role-skill-priority">
                    <FiTarget />

                    <div>
                      <span>
                        AI SKILL PRIORITY
                      </span>

                      <strong>
                        {progress.aiInsights.roleSkillNextFocus}
                      </strong>
                    </div>
                  </div>

                  <div className="performance-role-skill-section-heading">
                    <div>
                      <span>
                        REQUIRED SKILLS
                      </span>

                      <h3>
                        Skill-by-skill evidence
                      </h3>

                      <p>
                        Scores update as InterviewIQ collects technical interview evidence. Resume-only evidence stays clearly identified.
                      </p>
                    </div>

                    <div className="performance-role-skill-legend">
                      <span className="strong">
                        Strong
                      </span>

                      <span className="good">
                        Good
                      </span>

                      <span className="developing">
                        Developing
                      </span>

                      <span className="beginner">
                        Beginner
                      </span>

                      <span className="not-assessed">
                        Not assessed
                      </span>
                    </div>
                  </div>

                  <div className="performance-role-skill-grid">
                    {visibleRoleSkills.map(
                      (skill) => (
                        <article
                          className={`performance-role-skill-card performance-role-skill-card--${skill.status}`}
                          key={skill.id}
                        >
                          <div className="performance-role-skill-card__top">
                            <div>
                              <span
                                className={`performance-role-skill-status ${skill.status}`}
                              >
                                {formatRoleSkillStatus(
                                  skill.status
                                )}
                              </span>

                              <strong>
                                {skill.name}
                              </strong>
                            </div>

                            <b>
                              {skill.score === null
                                ? "—"
                                : `${skill.score}%`}
                            </b>
                          </div>

                          <div
                            className={`performance-track performance-role-skill-track ${
                              skill.score === null
                                ? "is-empty"
                                : ""
                            }`}
                          >
                            <span
                              style={{
                                width:
                                  skill.score === null
                                    ? "0%"
                                    : `${skill.score}%`,
                              }}
                            />
                          </div>

                          <p>
                            {skill.reason}
                          </p>

                          <div className="performance-role-skill-meta">
                            <span>
                              {formatRoleSkillKind(
                                skill.kind
                              )}
                            </span>

                            <span>
                              {skill.evidenceCount > 0
                                ? `${skill.evidenceCount} evidence`
                                : "No evidence yet"}
                            </span>

                            {skill.interviewVerified && (
                              <span className="verified">
                                <FiCheckCircle />
                                Interview verified
                              </span>
                            )}

                            {skill.presentInResume && (
                              <span>
                                Resume evidence
                              </span>
                            )}
                          </div>
                        </article>
                      )
                    )}
                  </div>

                  {hiddenRoleSkillCount > 0 && (
                    <div className="performance-role-skill-toggle-wrap">
                      <button
                        type="button"
                        className="performance-role-skill-toggle"
                        onClick={() =>
                          setShowAllRoleSkills(
                            (current) =>
                              !current
                          )
                        }
                        aria-expanded={
                          showAllRoleSkills
                        }
                      >
                        {showAllRoleSkills ? (
                          <>
                            <FiChevronUp />
                            <span>
                              Hide skills
                            </span>
                          </>
                        ) : (
                          <>
                            <FiChevronDown />
                            <span>
                              Show more
                            </span>

                            <small>
                              +{hiddenRoleSkillCount}
                            </small>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="performance-card__empty performance-role-skill-empty">
                  Complete technical interviews in a specific career field so InterviewIQ can compare your evidence against that role's required skills.
                </div>
              )}
            </section>

            {/* =================================================
                ADVANCED ANALYTICS
            ================================================= */}

            <section className="performance-grid performance-grid--advanced">
              <article className="performance-card performance-type-comparison">
                <div className="performance-card__header">
                  <div>
                    <span>INTERVIEW TYPES</span>
                    <h2>Technical vs Behavioral</h2>
                    {loading ? (
                      <div className="performance-copy-skeleton">
                        <span className="performance-skeleton performance-skeleton--copy-line" />
                        <span className="performance-skeleton performance-skeleton--copy-line performance-skeleton--copy-line-short" />
                      </div>
                    ) : (
                      <p>
                        {progress?.aiInsights.typeComparisonSummary ??
                          "Compare your technical and behavioral performance."}
                      </p>
                    )}
                  </div>

                  <div className="performance-card__header-icon">
                    <FiActivity />
                  </div>
                </div>

                <div className="performance-type-comparison__content">
                  <div className="performance-type-score">
                    <div className="performance-type-score__top">
                      <div>
                        <span className="performance-type-dot performance-type-dot--technical" />
                        <strong>Technical</strong>
                      </div>

                      {loading ? (
                        <span className="performance-skeleton performance-skeleton--metric-value" />
                      ) : (
                        <b>
                          {progress?.technicalPerformance.averageScore ?? 0}%
                        </b>
                      )}
                    </div>

                    <div className="performance-track">
                      <span
                        style={{
                          width:
                            `${progress?.technicalPerformance.averageScore ?? 0}%`,
                        }}
                      />
                    </div>

                    {loading ? (
                      <div className="performance-type-score__meta">
                        <span className="performance-skeleton performance-skeleton--meta" />
                        <span className="performance-skeleton performance-skeleton--meta-small" />
                      </div>
                    ) : (
                      <div className="performance-type-score__meta">
                        <span>
                          Last 5:{" "}
                          <strong>
                            {progress?.technicalPerformance.recentAverage ?? 0}%
                          </strong>
                        </span>

                        <span
                          className={
                            (progress?.technicalPerformance.change ?? 0) >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {(progress?.technicalPerformance.change ?? 0) > 0
                            ? "+"
                            : ""}
                          {progress?.technicalPerformance.change ?? 0}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="performance-type-score">
                    <div className="performance-type-score__top">
                      <div>
                        <span className="performance-type-dot performance-type-dot--behavioral" />
                        <strong>Behavioral</strong>
                      </div>

                      {loading ? (
                        <span className="performance-skeleton performance-skeleton--metric-value" />
                      ) : (
                        <b>
                          {progress?.behavioralPerformance.averageScore ?? 0}%
                        </b>
                      )}
                    </div>

                    <div className="performance-track">
                      <span
                        style={{
                          width:
                            `${progress?.behavioralPerformance.averageScore ?? 0}%`,
                        }}
                      />
                    </div>

                    {loading ? (
                      <div className="performance-type-score__meta">
                        <span className="performance-skeleton performance-skeleton--meta" />
                        <span className="performance-skeleton performance-skeleton--meta-small" />
                      </div>
                    ) : (
                      <div className="performance-type-score__meta">
                        <span>
                          Last 5:{" "}
                          <strong>
                            {progress?.behavioralPerformance.recentAverage ?? 0}%
                          </strong>
                        </span>

                        <span
                          className={
                            (progress?.behavioralPerformance.change ?? 0) >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {(progress?.behavioralPerformance.change ?? 0) > 0
                            ? "+"
                            : ""}
                          {progress?.behavioralPerformance.change ?? 0}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="performance-type-comparison__summary">
                    <FiTrendingUp />

                    <div>
                      <span>PERFORMANCE GAP</span>

                      {loading ? (
                        <span className="performance-skeleton performance-skeleton--summary-text" />
                      ) : (
                        <strong>
                          {(progress?.technicalBehavioralDifference ?? 0) === 0
                            ? "Technical and behavioral performance are balanced."
                            : (progress?.technicalBehavioralDifference ?? 0) > 0
                              ? `Behavioral performance is ${Math.abs(progress?.technicalBehavioralDifference ?? 0)}% stronger.`
                              : `Technical performance is ${Math.abs(progress?.technicalBehavioralDifference ?? 0)}% stronger.`}
                        </strong>
                      )}
                    </div>
                  </div>
                </div>
              </article>

              <article className="performance-card performance-advanced-stats">
                <div className="performance-card__header">
                  <div>
                    <span>ADVANCED METRICS</span>
                    <h2>Progress quality</h2>
                    {loading ? (
                      <div className="performance-copy-skeleton">
                        <span className="performance-skeleton performance-skeleton--copy-line" />
                        <span className="performance-skeleton performance-skeleton--copy-line performance-skeleton--copy-line-short" />
                      </div>
                    ) : (
                      <p>
                        {progress?.aiInsights.progressQualitySummary ??
                          "Review your recent performance quality and consistency."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="performance-advanced-stats__grid">
                  <div className="performance-advanced-stat">
                    <span>LAST 5 AVERAGE</span>
                    {loading ? (
                      <>
                        <span className="performance-skeleton performance-skeleton--advanced-value" />
                        <span className="performance-skeleton performance-skeleton--advanced-copy" />
                      </>
                    ) : (
                      <>
                        <strong>
                          {progress?.lastFiveAverage ?? 0}%
                        </strong>
                        <small>Your average across the 5 most recent completed interviews.</small>
                      </>
                    )}
                  </div>

                  <div className="performance-advanced-stat">
                    <span>PREVIOUS 5</span>
                    {loading ? (
                      <>
                        <span className="performance-skeleton performance-skeleton--advanced-value" />
                        <span className="performance-skeleton performance-skeleton--advanced-copy" />
                      </>
                    ) : (
                      <>
                        <strong>
                          {progress?.previousFiveAverage ?? 0}%
                        </strong>
                        <small>Your average across the 5 interviews immediately before the latest 5.</small>
                      </>
                    )}
                  </div>

                  <div className="performance-advanced-stat">
                    <span>CONSISTENCY</span>
                    {loading ? (
                      <>
                        <span className="performance-skeleton performance-skeleton--advanced-value" />
                        <span className="performance-skeleton performance-skeleton--advanced-copy" />
                      </>
                    ) : (
                      <>
                        <strong>
                          {progress?.consistencyScore ?? 0}%
                        </strong>
                        <small>Higher means your scores stay more stable from interview to interview.</small>
                      </>
                    )}
                  </div>

                  <div className="performance-advanced-stat">
                    <span>BEST STREAK</span>
                    {loading ? (
                      <>
                        <span className="performance-skeleton performance-skeleton--advanced-value" />
                        <span className="performance-skeleton performance-skeleton--advanced-copy" />
                      </>
                    ) : (
                      <>
                        <strong>
                          {progress?.bestStreak ?? 0}
                        </strong>
                        <small>Your longest run of consecutive interviews scoring 80% or higher.</small>
                      </>
                    )}
                  </div>
                </div>
              </article>
            </section>

            <section className="performance-grid performance-grid--development">
              <article className="performance-card performance-difficulty-card">
                <div className="performance-card__header">
                  <div>
                    <span>ADAPTIVE LEVEL</span>
                    <h2>Adaptive interview level</h2>
                    {loading ? (
                      <div className="performance-copy-skeleton">
                        <span className="performance-skeleton performance-skeleton--copy-line" />
                        <span className="performance-skeleton performance-skeleton--copy-line performance-skeleton--copy-line-short" />
                      </div>
                    ) : (
                      <p>
                        {progress?.aiInsights.difficultySummary ??
                          "Your level changes only when recent interview evidence supports moving up or down."}
                      </p>
                    )}
                  </div>

                  <div className="performance-card__header-icon">
                    <FiZap />
                  </div>
                </div>

                <div className="performance-difficulty-card__content">
                  <div className="performance-current-level">
                    <span>CURRENT INTERVIEW LEVEL</span>

                    {loading ? (
                      <span className="performance-skeleton performance-skeleton--current-level" />
                    ) : (
                      <strong>
                        {formatDifficulty(progress?.currentDifficulty ?? null)}
                      </strong>
                    )}
                  </div>

                  <div className="performance-level-help">
                    <span>Beginner <small>Foundational knowledge</small></span>
                    <span>Intermediate <small>Practical junior/mid-level work</small></span>
                    <span>Advanced <small>Complex scenarios and deeper reasoning</small></span>
                    <span>Senior <small>Architecture, leadership and trade-offs</small></span>
                  </div>

                  <div className="performance-level-stepper">
                    {[
                      "beginner",
                      "intermediate",
                      "advanced",
                      "senior",
                    ].map(
                      (
                        level,
                        index
                      ) => {
                        const levels = [
                          "beginner",
                          "intermediate",
                          "advanced",
                          "senior",
                        ];

                        const currentIndex =
                          levels.indexOf(
                            progress?.currentDifficulty ?? ""
                          );

                        const isReached =
                          currentIndex >= index;

                        const isCurrent =
                          progress?.currentDifficulty === level;

                        return (
                          <div
                            className={`performance-level-step ${
                              isReached ? "reached" : ""
                            } ${
                              isCurrent ? "current" : ""
                            }`}
                            key={level}
                          >
                            <span />

                            <strong>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </strong>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="performance-difficulty-history">
                    <div className="performance-difficulty-history__title">
                      <span>LEVEL CHANGES</span>
                      <small>Repeated sessions at the same level are grouped instead of shown again.</small>
                    </div>

                    {loading ? (
                      <div className="performance-difficulty-history__skeleton">
                        {[1, 2, 3].map((item) => (
                          <div
                            className="performance-difficulty-history__row"
                            key={item}
                          >
                            <span className="performance-skeleton performance-skeleton--history-date" />
                            <span className="performance-skeleton performance-skeleton--history-level" />
                            <span className="performance-skeleton performance-skeleton--history-score" />
                          </div>
                        ))}
                      </div>
                    ) : difficultyChanges.length > 0 ? (
                      difficultyChanges
                        .slice(-5)
                        .map(
                          (item, index) => {
                            const previous =
                              difficultyChanges[index - 1];

                            return (
                              <div
                                className="performance-difficulty-history__row"
                                key={item.interviewId}
                              >
                                <span>
                                  {formatShortDate(item.date)}
                                </span>

                                <strong>
                                  {previous
                                    ? `${formatDifficulty(previous.difficulty)} → ${formatDifficulty(item.difficulty)}`
                                    : `Started at ${formatDifficulty(item.difficulty)}`}
                                </strong>

                                <b>{item.score}%</b>
                              </div>
                            );
                          }
                        )
                    ) : (
                      <div className="performance-card__empty">
                        No level changes yet. Staying at the same level means the system is still collecting evidence before adjusting difficulty.
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <article className="performance-card performance-weakness-card">
                <div className="performance-card__header">
                  <div>
                    <span>RECURRING PATTERNS</span>
                    <h2>Areas that repeat</h2>
                    {loading ? (
                      <div className="performance-copy-skeleton">
                        <span className="performance-skeleton performance-skeleton--copy-line" />
                        <span className="performance-skeleton performance-skeleton--copy-line performance-skeleton--copy-line-short" />
                      </div>
                    ) : (
                      <p>
                        {progress?.aiInsights.recurringPatternsSummary ??
                          "Improvement themes that appear most often in AI evaluations."}
                      </p>
                    )}
                  </div>

                  <div className="performance-card__header-icon">
                    <FiTarget />
                  </div>
                </div>

                <div className="performance-weakness-list">
                  {loading ? (
                    <>
                      {[1, 2, 3, 4].map((item) => (
                        <div
                          className="performance-weakness-item performance-weakness-item--skeleton"
                          key={item}
                        >
                          <span className="performance-skeleton performance-skeleton--weakness-index" />
                          <span className="performance-skeleton performance-skeleton--weakness-text" />
                          <span className="performance-skeleton performance-skeleton--weakness-count" />
                        </div>
                      ))}
                    </>
                  ) : (progress?.recurringWeaknesses ?? []).length > 0 ? (
                    progress?.recurringWeaknesses.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="performance-weakness-item"
                          key={`${item.label}-${index}`}
                        >
                          <span>{index + 1}</span>
                          <p>{item.label}</p>
                          <strong>{item.count}x</strong>
                        </div>
                      )
                    )
                  ) : (
                    <div className="performance-card__empty">
                      Complete more evaluated interviews to identify recurring improvement patterns.
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="performance-card performance-next-priority">
              <div className="performance-next-priority__icon">
                <FiTarget />
              </div>

              <div>
                <span>AI NEXT PRIORITY</span>
                {loading ? (
                  <div className="performance-next-priority__skeleton">
                    <span className="performance-skeleton performance-skeleton--priority-line" />
                    <span className="performance-skeleton performance-skeleton--priority-line performance-skeleton--priority-line-short" />
                  </div>
                ) : (
                  <strong>
                    {progress?.aiInsights.nextPriority ??
                      "Complete more interviews to receive a personalized priority."}
                  </strong>
                )}
              </div>
            </section>

            {/* =================================================
                INSIGHTS
            ================================================= */}

            <section className="performance-grid performance-grid--insights">
              <article className="performance-card performance-insight-card">
                <div className="performance-insight-card__icon">
                  <FiAward />
                </div>

                <div>
                  <span>
                    STRONGEST AREA
                  </span>

                  {loading ? (
                    <div className="performance-insight-card__skeleton">
                      <span className="performance-skeleton performance-skeleton--insight-title" />
                      <span className="performance-skeleton performance-skeleton--insight-line" />
                      <span className="performance-skeleton performance-skeleton--insight-line performance-skeleton--insight-line-short" />
                    </div>
                  ) : (
                    <>
                      <h3>
                        {strongestSkill.name}
                      </h3>

                      <p>
                        {clampScore(
                          strongestSkill.score
                        )}% average. This is currently your strongest evaluated interview skill.
                      </p>
                    </>
                  )}
                </div>
              </article>

              <article className="performance-card performance-insight-card">
                <div className="performance-insight-card__icon">
                  <FiTarget />
                </div>

                <div>
                  <span>
                    FOCUS AREA
                  </span>

                  {loading ? (
                    <div className="performance-insight-card__skeleton">
                      <span className="performance-skeleton performance-skeleton--insight-title" />
                      <span className="performance-skeleton performance-skeleton--insight-line" />
                      <span className="performance-skeleton performance-skeleton--insight-line performance-skeleton--insight-line-short" />
                    </div>
                  ) : (
                    <>
                      <h3>
                        {weakestSkill.name}
                      </h3>

                      <p>
                        {clampScore(
                          weakestSkill.score
                        )}% average. Improving this area can raise your overall interview consistency.
                      </p>
                    </>
                  )}
                </div>
              </article>

              <article className="performance-card performance-insight-card">
                <div className="performance-insight-card__icon">
                  <FiZap />
                </div>

                <div>
                  <span>
                    RECENT PROGRESS
                  </span>

                  {loading ? (
                    <div className="performance-insight-card__skeleton">
                      <span className="performance-skeleton performance-skeleton--insight-title" />
                      <span className="performance-skeleton performance-skeleton--insight-line" />
                      <span className="performance-skeleton performance-skeleton--insight-line performance-skeleton--insight-line-short" />
                    </div>
                  ) : (
                    <>
                      <h3>
                        {getTrendLabel(
                          trendDifference
                        )}
                      </h3>

                      <p>
                        {progression.length < 2
                          ? "Complete more interviews to unlock a meaningful progress trend."
                          : trendDifference > 0
                            ? `Your recent score improved by ${trendDifference}% across the visible interview window.`
                            : trendDifference < 0
                              ? `Your recent score changed by ${trendDifference}%. Review lower-scoring answers before your next session.`
                              : "Your recent interview scores are stable. A harder adaptive session can help test the next level."}
                      </p>
                    </>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    );
  };


/* =========================================================
   PERFORMANCE MOMENTUM CHART
   Adapted from the Dashboard MomentumChart so both screens
   use the same visual language and curve behavior.
========================================================= */

interface PerformanceMomentumChartProps {
  interviews:
    ScoreProgressionItem[];
}

const PerformanceMomentumChart = ({
  interviews,
}: PerformanceMomentumChartProps) => {
  const chartHeight =
    210;

  const paddingX =
    35;

  const paddingY =
    20;

  /*
   * Keep approximately 70px for each interview.
   * Up to ~10 interviews fits naturally; more data
   * expands horizontally and uses the scroll container.
   */
  const pointSpacing =
    70;

  const chartWidth =
    Math.max(
      760,
      interviews.length *
        pointSpacing
    );

  const usableWidth =
    chartWidth -
    paddingX *
      2;

  const usableHeight =
    chartHeight -
    paddingY *
      2;

  const formatChartDate =
    (
      dateValue:
        string
    ): string => {
      const date =
        new Date(
          dateValue
        );

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return "";
      }

      return new Intl.DateTimeFormat(
        "en-US",
        {
          day:
            "numeric",

          month:
            "short",
        }
      ).format(
        date
      );
    };

  const points =
    interviews.map(
      (
        interview,
        index
      ) => {
        const safeScore =
          Math.max(
            0,
            Math.min(
              100,
              interview.score
            )
          );

        const x =
          interviews.length ===
          1
            ? chartWidth /
              2
            : paddingX +
              (
                index /
                (
                  interviews.length -
                  1
                )
              ) *
                usableWidth;

        const y =
          paddingY +
          (
            (
              100 -
              safeScore
            ) /
            100
          ) *
            usableHeight;

        return {
          x,

          y,

          score:
            safeScore,

          date:
            interview.date,

          category:
            interview.category,

          interviewId:
            interview.interviewId,
        };
      }
    );

  let linePath =
    "";

  if (
    points.length >
    0
  ) {
    const first =
      points[0];

    linePath =
      `M ${first.x} ${first.y}`;

    for (
      let i =
        1;
      i <
      points.length;
      i++
    ) {
      const previous =
        points[
          i -
            1
        ];

      const current =
        points[i];

      const middleX =
        (
          previous.x +
          current.x
        ) /
        2;

      linePath +=
        ` C ${middleX} ${previous.y},` +
        ` ${middleX} ${current.y},` +
        ` ${current.x} ${current.y}`;
    }
  }

  const firstPoint =
    points[0];

  const lastPoint =
    points[
      points.length -
        1
    ];

  const areaPath =
    points.length >=
      2 &&
    firstPoint &&
    lastPoint
      ? `${linePath}
         L ${lastPoint.x} ${chartHeight}
         L ${firstPoint.x} ${chartHeight}
         Z`
      : "";

  return (
    <div className="performance-momentum-chart">
      <div className="performance-momentum-y-axis">
        <span>100</span>
        <span>75</span>
        <span>50</span>
        <span>25</span>
        <span>0</span>
      </div>

      <div className="performance-momentum-chart-scroll">
        <div
          className="performance-momentum-chart-main"
          style={{
            minWidth:
              `${chartWidth}px`,
          }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width={
              chartWidth
            }
            height={
              chartHeight
            }
            preserveAspectRatio="none"
            aria-label="Interview performance progression"
          >
            <defs>
              <linearGradient
                id="performanceMomentumLine"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#7657ff"
                />

                <stop
                  offset="65%"
                  stopColor="#674bf1"
                />

                <stop
                  offset="100%"
                  stopColor="#67c9ee"
                />
              </linearGradient>

              <linearGradient
                id="performanceMomentumArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#7657ff"
                  stopOpacity="0.2"
                />

                <stop
                  offset="100%"
                  stopColor="#7657ff"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {[
              0,
              25,
              50,
              75,
              100,
            ].map(
              (
                value
              ) => {
                const y =
                  paddingY +
                  (
                    (
                      100 -
                      value
                    ) /
                    100
                  ) *
                    usableHeight;

                return (
                  <line
                    key={
                      value
                    }
                    x1="0"
                    x2={
                      chartWidth
                    }
                    y1={
                      y
                    }
                    y2={
                      y
                    }
                    stroke="rgba(30,30,55,0.06)"
                    strokeWidth="1"
                  />
                );
              }
            )}

            {areaPath && (
              <path
                d={
                  areaPath
                }
                fill="url(#performanceMomentumArea)"
              />
            )}

            {points.length >
              1 && (
              <path
                d={
                  linePath
                }
                fill="none"
                stroke="url(#performanceMomentumLine)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {points.map(
              (
                point,
                index
              ) => (
                <g
                  key={`${point.interviewId}-${index}`}
                >
                  <circle
                    cx={
                      point.x
                    }
                    cy={
                      point.y
                    }
                    r="8"
                    fill="rgba(108,76,245,0.12)"
                  />

                  <circle
                    cx={
                      point.x
                    }
                    cy={
                      point.y
                    }
                    r="4"
                    fill="#ffffff"
                    stroke="#6c4cf5"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      {`${formatChartDate(
                        point.date
                      )} • ${formatCategory(
                        point.category
                      )} • ${Math.round(
                        point.score
                      )}%`}
                    </title>
                  </circle>
                </g>
              )
            )}
          </svg>

          <div
            className="performance-momentum-x-axis"
            style={{
              gridTemplateColumns:
                `repeat(${points.length}, 1fr)`,
            }}
          >
            {points.map(
              (
                point,
                index
              ) => (
                <span
                  key={`${point.interviewId}-date-${index}`}
                  title={
                    formatChartDate(
                      point.date
                    )
                  }
                >
                  {formatChartDate(
                    point.date
                  )}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default performanceProgressPage;
