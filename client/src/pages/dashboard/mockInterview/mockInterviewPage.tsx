import {
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCode,
  FiCpu,
  FiInfo,
  FiLayers,
  FiMessageSquare,
  FiPlay,
  FiServer,
  FiShield,
  FiTarget,
  FiUsers,
} from "react-icons/fi";

import axios from "axios";

import apiClient from "../../../api/apiClient";
import "./mockInterviewPage.scss";

type InterviewType =
  | "technical"
  | "behavioral";

type Difficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "senior";

interface StartInterviewResponse {
  success: boolean;
  message?: string;

  data: {
    interviewId: string;
    status: string;
    totalQuestions: number;
    currentQuestionIndex: number;

    question: {
      questionId: string;
      questionText: string;
    };
  };
}

interface CategoryOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface DifficultyOption {
  value: Difficulty;
  title: string;
  description: string;
  recommended?: boolean;
}

const START_INTERVIEW_ENDPOINT =
  "/interviews";

const categories: CategoryOption[] = [
  {
    id: "frontend",
    title: "Frontend Developer",
    description:
      "HTML, CSS, JavaScript, React, accessibility, performance and browser concepts.",
    icon: <FiCode />,
  },
  {
    id: "backend",
    title: "Backend Developer",
    description:
      "APIs, databases, authentication, server-side architecture and backend systems.",
    icon: <FiServer />,
  },
  {
    id: "software-engineering",
    title: "Software Engineer",
    description:
      "Algorithms, software design, testing, architecture and engineering principles.",
    icon: <FiBriefcase />,
  },
  {
    id: "devops",
    title: "DevOps Engineer",
    description:
      "CI/CD, Docker, Kubernetes, cloud infrastructure, monitoring and deployment.",
    icon: <FiCpu />,
  },
  {
    id: "ui-ux-design",
    title: "UI/UX Designer",
    description:
      "User research, interaction design, accessibility, usability and design systems.",
    icon: <FiUsers />,
  },
  {
    id: "machine-learning",
    title: "Machine Learning Engineer",
    description:
      "Machine learning, model training, evaluation, MLOps and production ML systems.",
    icon: <FiLayers />,
  },
];

const difficulties: DifficultyOption[] = [
  {
    value: "beginner",
    title: "Beginner",
    description:
      "Fundamentals and junior-level concepts.",
  },
  {
    value: "intermediate",
    title: "Intermediate",
    description:
      "Practical questions for junior and mid-level roles.",
    recommended: true,
  },
  {
    value: "advanced",
    title: "Advanced",
    description:
      "Deeper technical concepts and challenging scenarios.",
  },
  {
    value: "senior",
    title: "Senior",
    description:
      "Architecture, trade-offs and leadership-level reasoning.",
  },
];

const mockInterviewPage = () => {
  const navigate = useNavigate();

  const [category, setCategory] =
    useState("frontend");

  const [
    interviewType,
    setInterviewType,
  ] = useState<InterviewType>(
    "technical"
  );

  const [
    difficulty,
    setDifficulty,
  ] =
    useState<Difficulty>(
      "intermediate"
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const selectedCategory =
    useMemo(
      () =>
        categories.find(
          (item) =>
            item.id === category
        ) ?? categories[0],
      [category]
    );

  const selectedDifficulty =
    useMemo(
      () =>
        difficulties.find(
          (item) =>
            item.value ===
            difficulty
        ) ?? difficulties[1],
      [difficulty]
    );

  const startInterview =
    async () => {
      if (loading) {
        return;
      }

      setError("");
      setLoading(true);

      try {
        const response =
          await apiClient.post<StartInterviewResponse>(
            START_INTERVIEW_ENDPOINT,
            {
              category,
              difficulty,
              interviewType,
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
              category:
                selectedCategory.title,
              difficulty:
                selectedDifficulty.title,
              interviewType,
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
                  Choose a category
                </h2>

                <p>
                  Select the area you
                  want to practice.
                </p>
              </div>
            </div>

            <div className="category-grid">
              {categories.map(
                (item) => {
                  const isActive =
                    category === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`category-card ${
                        isActive
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setCategory(
                          item.id
                        )
                      }
                    >
                      <div className="category-icon">
                        {item.icon}
                      </div>

                      <div className="category-copy">
                        <strong>
                          {item.title}
                        </strong>

                        <span>
                          {
                            item.description
                          }
                        </span>
                      </div>

                      <div className="category-check">
                        {isActive && (
                          <FiCheck />
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="setup-divider" />

          {/* INTERVIEW TYPE */}

          <div className="setup-section">
            <div className="section-heading">
              <div className="section-number">
                02
              </div>

              <div>
                <h2>
                  Interview type
                </h2>

                <p>
                  Choose the style of
                  interview you want
                  to practice.
                </p>
              </div>
            </div>

            <div className="type-grid">
              <button
                type="button"
                className={`type-card ${
                  interviewType ===
                  "technical"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setInterviewType(
                    "technical"
                  )
                }
              >
                <div className="type-icon">
                  <FiCode />
                </div>

                <div>
                  <strong>
                    Technical
                  </strong>

                  <span>
                    Technical
                    knowledge,
                    problem solving
                    and engineering
                    concepts.
                  </span>
                </div>

                <div className="type-radio">
                  <span />
                </div>
              </button>

              <button
                type="button"
                className={`type-card ${
                  interviewType ===
                  "behavioral"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setInterviewType(
                    "behavioral"
                  )
                }
              >
                <div className="type-icon">
                  <FiMessageSquare />
                </div>

                <div>
                  <strong>
                    Behavioral
                  </strong>

                  <span>
                    Communication,
                    teamwork,
                    situations and
                    experience-based
                    questions.
                  </span>
                </div>

                <div className="type-radio">
                  <span />
                </div>
              </button>
            </div>
          </div>

          <div className="setup-divider" />

          {/* DIFFICULTY */}

          <div className="setup-section">
            <div className="section-heading">
              <div className="section-number">
                03
              </div>

              <div>
                <h2>
                  Difficulty level
                </h2>

                <p>
                  Match the interview
                  difficulty to your
                  experience.
                </p>
              </div>
            </div>

            <div className="difficulty-grid">
              {difficulties.map(
                (item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`difficulty-card ${
                      difficulty ===
                      item.value
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setDifficulty(
                        item.value
                      )
                    }
                  >
                    <div className="difficulty-top">
                      <strong>
                        {item.title}
                      </strong>

                      {item.recommended && (
                        <span className="recommended-badge">
                          Recommended
                        </span>
                      )}
                    </div>

                    <p>
                      {
                        item.description
                      }
                    </p>

                    <div className="difficulty-selector">
                      <span />
                    </div>
                  </button>
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
                {
                  selectedCategory.icon
                }
              </div>

              <div>
                <span>
                  Category
                </span>

                <strong>
                  {
                    selectedCategory.title
                  }
                </strong>
              </div>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span>
                  Interview type
                </span>

                <strong>
                  {interviewType ===
                  "technical"
                    ? "Technical"
                    : "Behavioral"}
                </strong>
              </div>

              <div className="summary-row">
                <span>
                  Difficulty
                </span>

                <strong>
                  {
                    selectedDifficulty.title
                  }
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
              disabled={loading}
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
    </div>
  );
};

export default mockInterviewPage;