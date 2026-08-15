import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  FiArrowRight,
  FiAward,
  FiBarChart2,
  FiBriefcase,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";

import "./dashboardHomePage.scss";

interface DashboardStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number;
  bestScore: number;
}

interface RecentInterview {
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

interface DashboardApiData {
  stats: {
    totalInterviews: number;
    completedInterviews: number;
    inProgressInterviews: number;
    averageScore: number;
    bestScore: number;
  };

  recentInterviews: RecentInterview[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardApiData;
}

interface StoredUser {
  fullName?: string;
  email?: string;
}

interface ScoreProgressionItem {
  interviewId: string;
  date: string;
  category: string;
  score: number;
}

interface ProgressResponse {
  success: boolean;

  data: {
    completedInterviewsCount: number;
    averageTechnicalAccuracy: number;
    averageCompleteness: number;
    averageCommunication: number;

    strongestCategory: {
      category: string;
      averageScore: number;
    } | null;

    weakestCategory: {
      category: string;
      averageScore: number;
    } | null;

    scoreProgression: ScoreProgressionItem[];

    categoryPerformance: {
      category: string;
      averageScore: number;
      interviewCount: number;
    }[];
  };
}

interface MomentumChartProps {
  interviews: ScoreProgressionItem[];
}

const DashboardHomePage = () => {
  const navigate = useNavigate();

  const [stats, setStats] =
    useState<DashboardStats>({
      totalInterviews: 0,
      completedInterviews: 0,
      averageScore: 0,
      bestScore: 0,
    });

  const [
    scoreHistory,
    setScoreHistory,
  ] = useState<
    ScoreProgressionItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const user =
    useMemo<StoredUser>(() => {
      const storedUser =
        localStorage.getItem(
          "interviewiq_user"
        );

      if (!storedUser) {
        return {};
      }

      try {
        return JSON.parse(
          storedUser
        ) as StoredUser;
      } catch {
        return {};
      }
    }, []);

  const firstName =
    user.fullName
      ?.trim()
      .split(/\s+/)[0] ||
    "there";

  const loadDashboardStats =
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          dashboardResponse,
          progressResponse,
        ] = await Promise.all([
          apiClient.get<DashboardResponse>(
            "/dashboard/stats"
          ),

          apiClient.get<ProgressResponse>(
            "/progress"
          ),
        ]);

        const {
          stats: apiStats,
        } =
          dashboardResponse.data.data;

        setStats({
          totalInterviews:
            apiStats.totalInterviews,

          completedInterviews:
            apiStats.completedInterviews,

          averageScore:
            apiStats.averageScore,

          bestScore:
            apiStats.bestScore,
        });

        const progression =
          progressResponse.data.data
            .scoreProgression || [];

        const now =
          new Date();

        const currentMonth =
          now.getMonth();

        const currentYear =
          now.getFullYear();

        const currentMonthInterviews =
          progression
            .filter(
              (interview) => {
                if (
                  !interview.date ||
                  typeof interview.score !==
                    "number"
                ) {
                  return false;
                }

                const interviewDate =
                  new Date(
                    interview.date
                  );

                if (
                  Number.isNaN(
                    interviewDate.getTime()
                  )
                ) {
                  return false;
                }

                return (
                  interviewDate.getMonth() ===
                    currentMonth &&
                  interviewDate.getFullYear() ===
                    currentYear
                );
              }
            )
            .sort(
              (a, b) =>
                new Date(
                  a.date
                ).getTime() -
                new Date(
                  b.date
                ).getTime()
            );

        setScoreHistory(
          currentMonthInterviews
        );
      } catch (err) {
        if (
          axios.isAxiosError(err)
        ) {
          setError(
            err.response?.data
              ?.message ||
              "Dashboard statistics could not be loaded."
          );
        } else {
          setError(
            "Dashboard statistics could not be loaded."
          );
        }

        setStats({
          totalInterviews: 0,
          completedInterviews: 0,
          averageScore: 0,
          bestScore: 0,
        });

        setScoreHistory([]);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadDashboardStats();
  }, []);

  const averageScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          stats.averageScore
        )
      )
    );

  const bestScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          stats.bestScore
        )
      )
    );

  return (
    <div className="dashboard-home">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="dashboard-eyebrow">
            Overview
          </span>

          <h1>
            Ready to practice,{" "}
            <span>
              {firstName}?
            </span>
          </h1>

          <p>
            Keep practicing,
            identify your weak
            areas, and get one step
            closer to your next
            opportunity.
          </p>
        </div>

        <button
          type="button"
          className="new-interview-btn"
          onClick={() =>
            navigate(
              "/dashboard/mock-interview"
            )
          }
        >
          <FiPlus />

          <span>
            New Interview
          </span>

          <FiArrowRight />
        </button>
      </section>

      {error && (
        <div className="dashboard-error">
          <div>
            <strong>
              Unable to load statistics
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadDashboardStats()
            }
          >
            <FiRefreshCw />
            Retry
          </button>
        </div>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon">
              <FiTarget />
            </div>

            <span className="stat-label">
              Average Score
            </span>
          </div>

          <div className="stat-value">
            {loading ? (
              <span className="dashboard-skeleton dashboard-skeleton--stat-value" />
            ) : (
              `${averageScore}%`
            )}
          </div>

          <div className="stat-footer">
            <FiTrendingUp />

            <span>
              Overall interview
              performance
            </span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon">
              <FiBriefcase />
            </div>

            <span className="stat-label">
              Interviews
            </span>
          </div>

          <div className="stat-value">
            {loading ? (
              <span className="dashboard-skeleton dashboard-skeleton--stat-value dashboard-skeleton--stat-small" />
            ) : (
              stats.totalInterviews
            )}
          </div>

          <div className="stat-footer">
            <span>
              Total practice sessions
            </span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon">
              <FiBarChart2 />
            </div>

            <span className="stat-label">
              Completed
            </span>
          </div>

          <div className="stat-value">
            {loading ? (
              <span className="dashboard-skeleton dashboard-skeleton--stat-value dashboard-skeleton--stat-small" />
            ) : (
              stats.completedInterviews
            )}
          </div>

          <div className="stat-footer">
            <span>
              Finished interview
              sessions
            </span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon">
              <FiAward />
            </div>

            <span className="stat-label">
              Best Score
            </span>
          </div>

          <div className="stat-value">
            {loading ? (
              <span className="dashboard-skeleton dashboard-skeleton--stat-value" />
            ) : (
              `${bestScore}%`
            )}
          </div>

          <div className="stat-footer">
            <span>
              Your strongest
              performance
            </span>
          </div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel progress-panel">
          <div className="panel-header">
            <div>
              <span className="panel-eyebrow">
                Performance
              </span>

              <h2>
                Interview Momentum
              </h2>
            </div>

            <button
              type="button"
              className="panel-link"
              onClick={() =>
                navigate(
                  "/dashboard/history"
                )
              }
            >
              View progress

              <FiArrowRight />
            </button>
          </div>

          {loading ? (
            <div className="momentum-loading-skeleton">
              <div className="momentum-loading-y-axis">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>

              <div className="momentum-loading-main">
                <div className="momentum-loading-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="momentum-loading-line">
                  <span className="momentum-loading-line__one" />
                  <span className="momentum-loading-line__two" />
                  <span className="momentum-loading-line__three" />
                  <span className="momentum-loading-line__four" />
                </div>

                <div className="momentum-loading-points">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="momentum-loading-x-axis">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          ) : scoreHistory.length ===
            0 ? (
            <div className="chart-empty-state">
              <div className="empty-chart-icon">
                <FiTrendingUp />
              </div>

              <h3>
                No interview data
                this month
              </h3>

              <p>
                Complete a mock
                interview to start
                tracking your monthly
                performance.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dashboard/mock-interview"
                  )
                }
              >
                Start Interview

                <FiArrowRight />
              </button>
            </div>
          ) : (
            <MomentumChart
              interviews={
                scoreHistory
              }
            />
          )}
        </article>

        <article className="dashboard-panel quick-actions-panel">
          <div className="panel-header">
            <div>
              <span className="panel-eyebrow">
                Shortcuts
              </span>

              <h2>
                Quick Actions
              </h2>
            </div>
          </div>

          <div className="quick-actions">
            <button
              type="button"
              className="quick-action"
              onClick={() =>
                navigate(
                  "/dashboard/mock-interview"
                )
              }
            >
              <div className="quick-action-icon">
                <FiBriefcase />
              </div>

              <div>
                <strong>
                  Start Mock Interview
                </strong>

                <span>
                  Practice a new AI
                  interview session.
                </span>
              </div>

              <FiArrowRight className="quick-arrow" />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                navigate(
                  "/dashboard/resume-analysis"
                )
              }
            >
              <div className="quick-action-icon">
                <FiFileText />
              </div>

              <div>
                <strong>
                  Analyze Resume
                </strong>

                <span>
                  Get AI-powered resume
                  feedback.
                </span>
              </div>

              <FiArrowRight className="quick-arrow" />
            </button>

            <button
              type="button"
              className="quick-action"
              onClick={() =>
                navigate(
                  "/dashboard/history"
                )
              }
            >
              <div className="quick-action-icon">
                <FiTrendingUp />
              </div>

              <div>
                <strong>
                  Review Progress
                </strong>

                <span>
                  See your interview
                  performance history.
                </span>
              </div>

              <FiArrowRight className="quick-arrow" />
            </button>
          </div>
        </article>
      </section>
    </div>
  );
};

const MomentumChart = ({
  interviews,
}: MomentumChartProps) => {
  const chartHeight = 210;

  const paddingX = 35;
  const paddingY = 20;

  /*
    Hər interview üçün təxminən
    70px horizontal sahə saxlayırıq.

    1-10 interview olduqda minimum
    760px qalacaq.

    15 interview olduqda chart
    təxminən 1050px olacaq və
    tarixlər sıxılmayacaq.
  */
  const pointSpacing = 70;

  const chartWidth =
    Math.max(
      760,
      interviews.length *
        pointSpacing
    );

  const usableWidth =
    chartWidth -
    paddingX * 2;

  const usableHeight =
    chartHeight -
    paddingY * 2;

  const formatDate = (
    dateValue: string
  ): string => {
    const date =
      new Date(dateValue);

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
        day: "numeric",
        month: "short",
      }
    ).format(date);
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
          interviews.length === 1
            ? chartWidth / 2
            : paddingX +
              (index /
                (interviews.length -
                  1)) *
                usableWidth;

        const y =
          paddingY +
          ((100 - safeScore) /
            100) *
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

  let linePath = "";

  if (
    points.length > 0
  ) {
    const first =
      points[0];

    linePath =
      `M ${first.x} ${first.y}`;

    for (
      let i = 1;
      i < points.length;
      i++
    ) {
      const previous =
        points[i - 1];

      const current =
        points[i];

      const middleX =
        (
          previous.x +
          current.x
        ) / 2;

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
      points.length - 1
    ];

  const areaPath =
    points.length >= 2 &&
    firstPoint &&
    lastPoint
      ? `${linePath}
         L ${lastPoint.x} ${chartHeight}
         L ${firstPoint.x} ${chartHeight}
         Z`
      : "";

  return (
    <div className="momentum-chart">
      <div className="momentum-y-axis">
        <span>100</span>
        <span>75</span>
        <span>50</span>
        <span>25</span>
        <span>0</span>
      </div>

      <div className="momentum-chart-scroll">
        <div
          className="momentum-chart-main"
          style={{
            minWidth:
              `${chartWidth}px`,
          }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            width={chartWidth}
            height={chartHeight}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="momentumLine"
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
                id="momentumArea"
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
              (value) => {
                const y =
                  paddingY +
                  ((100 -
                    value) /
                    100) *
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
                    y1={y}
                    y2={y}
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
                fill="url(#momentumArea)"
              />
            )}

            {points.length >
              1 && (
              <path
                d={
                  linePath
                }
                fill="none"
                stroke="url(#momentumLine)"
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
                      {`${formatDate(
                        point.date
                      )} • ${
                        point.category
                      } • ${Math.round(
                        point.score
                      )}%`}
                    </title>
                  </circle>
                </g>
              )
            )}
          </svg>

          <div
            className="momentum-x-axis"
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
                    formatDate(
                      point.date
                    )
                  }
                >
                  {formatDate(
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

export default DashboardHomePage;