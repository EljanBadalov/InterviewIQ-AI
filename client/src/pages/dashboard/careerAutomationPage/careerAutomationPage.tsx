import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiTarget,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";

import {
  getCareerAutomation,
  getCareerAutomationSummary,
  isCareerAutomationNotFoundError,
  replanCareerAutomation,
  type ICareerAutomation,
  type ICareerAutomationSummary,
} from "../../../api/careerAutomationApi";

import "./careerAutomationPage.scss";

/* =========================================================
   TYPES
========================================================= */

type SkillStatus =
  | "strong"
  | "priority"
  | "next"
  | "later";

interface ISkillNode {
  id: string;

  label: string;

  status: SkillStatus;

  score: number;

  x: number;

  y: number;

  reason: string;
}

/* =========================================================
   HELPERS
========================================================= */

const TECH_SKILL_PATTERN =
  /\b(JavaScript|TypeScript|React(?:\.js)?|Next(?:\.js)?|Redux|HTML5?|CSS3?|SASS|SCSS|Tailwind(?:CSS)?|Git|GitHub|Node(?:\.js)?|Express(?:\.js)?|MongoDB|SQL|PostgreSQL|MySQL|REST|REST API|APIs?|Testing|Jest|Cypress|Docker|AWS|Python|Java|C\+\+|C#|Figma)\b/gi;

const SKILL_TOPICS:
  Record<
    string,
    string[]
  > = {
    javascript: [
      "Scope, closures, and execution context",
      "Promises, async/await, and the event loop",
      "Objects, prototypes, and this",
      "Array methods and functional patterns",
      "DOM, events, and browser APIs",
    ],

    typescript: [
      "Core types, interfaces, and type aliases",
      "Generics and reusable typed utilities",
      "Union, intersection, and narrowing",
      "Utility types and mapped types",
      "Typing React components, props, and hooks",
    ],

    react: [
      "Component composition and reusable architecture",
      "State, props, and controlled data flow",
      "useEffect and side-effect management",
      "useMemo, useCallback, and rendering performance",
      "Custom hooks and shared logic",
      "Forms, error states, and async UI",
    ],

    "next.js": [
      "App Router and routing patterns",
      "Server vs Client Components",
      "Data fetching and caching",
      "Rendering strategies and SEO",
      "Route handlers and API integration",
      "Deployment and performance optimization",
    ],

    redux: [
      "Global vs local state decisions",
      "Redux Toolkit slices and reducers",
      "Async logic with thunks",
      "Selectors and normalized state",
      "React-Redux integration",
    ],

    html: [
      "Semantic HTML structure",
      "Forms and native validation",
      "Accessibility fundamentals",
      "SEO-friendly document structure",
      "Responsive media and content",
    ],

    css: [
      "Box model, cascade, and specificity",
      "Flexbox and Grid layouts",
      "Responsive design and breakpoints",
      "Positioning and stacking contexts",
      "Animations and maintainable CSS architecture",
    ],

    "sass/scss": [
      "Variables, nesting, and partials",
      "Mixins and reusable patterns",
      "Functions and modular architecture",
      "Responsive utility patterns",
    ],

    "tailwind css": [
      "Utility-first responsive design",
      "Layout and spacing system",
      "Reusable component patterns",
      "Theme customization",
      "State and breakpoint variants",
    ],

    git: [
      "Branching and merge workflows",
      "Commit discipline and clean history",
      "Pull requests and code review",
      "Rebase, merge, and conflict resolution",
      "Reset, revert, stash, and recovery",
    ],

    github: [
      "Pull-request workflow",
      "Issues and project collaboration",
      "GitHub Actions basics",
      "Repository documentation and README quality",
      "Branch protection and review workflow",
    ],

    "node.js": [
      "Node runtime and event loop",
      "Modules and package management",
      "REST API architecture",
      "Async error handling",
      "Authentication and middleware",
    ],

    "rest apis": [
      "HTTP methods and status codes",
      "RESTful resource design",
      "Authentication and authorization",
      "Validation and error responses",
      "Pagination, filtering, and versioning",
    ],

    testing: [
      "Unit vs integration vs end-to-end testing",
      "Test structure and assertions",
      "Mocking and dependency isolation",
      "React component testing",
      "Critical user-flow coverage",
    ],

    jest: [
      "Test suites, assertions, and matchers",
      "Mocks, spies, and modules",
      "Async testing",
      "Coverage and reliable test design",
    ],

    cypress: [
      "End-to-end test structure",
      "Selectors and stable test strategy",
      "Network interception",
      "Authentication flows",
      "CI execution",
    ],

    docker: [
      "Images, containers, and Dockerfiles",
      "Volumes and networking",
      "Docker Compose",
      "Environment configuration",
      "Production-oriented container practices",
    ],

    aws: [
      "Core cloud concepts and IAM",
      "Compute and storage fundamentals",
      "Static/frontend deployment",
      "Monitoring and basic security",
      "Cost-aware architecture basics",
    ],

    python: [
      "Core syntax and data structures",
      "Functions, modules, and packages",
      "Object-oriented programming",
      "File and API handling",
      "Testing and virtual environments",
    ],

    sql: [
      "SELECT, filtering, and aggregation",
      "JOINs and relational modeling",
      "Indexes and query performance",
      "Transactions and constraints",
      "Subqueries and common table expressions",
    ],

    mongodb: [
      "Documents, collections, and schema design",
      "CRUD queries and operators",
      "Indexes and performance",
      "Aggregation pipeline",
      "Mongoose modeling patterns",
    ],
  };

const getImportantTopics = (
  skill:
    string
): string[] => {
  const normalized =
    normalizeSkill(
      skill
    )
      .toLowerCase();

  return (
    SKILL_TOPICS[
      normalized
    ] ||
    [
      `${skill} fundamentals and core concepts`,
      `Practical ${skill} patterns used in real projects`,
      `Common ${skill} interview questions`,
      `${skill} debugging and problem-solving`,
      `Build one portfolio-ready example using ${skill}`,
    ]
  );
};

const normalizeSkill = (
  value: string
): string => {
  const cleaned =
    value
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  const lower =
    cleaned
      .toLowerCase();

  if (
    lower === "react.js"
  ) {
    return "React";
  }

  if (
    lower === "next.js"
  ) {
    return "Next.js";
  }

  if (
    lower === "node.js"
  ) {
    return "Node.js";
  }

  if (
    lower === "tailwindcss"
  ) {
    return "Tailwind CSS";
  }

  if (
    lower === "api" ||
    lower === "apis" ||
    lower === "rest api"
  ) {
    return "REST APIs";
  }

  return cleaned;
};

const uniqueSkills = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const rawValue
    of values
  ) {
    const value =
      normalizeSkill(
        rawValue
      );

    if (
      !value
    ) {
      continue;
    }

    const key =
      value
        .toLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    result.push(
      value
    );
  }

  return result;
};

const extractSkillsFromAutomation = (
  automation:
    ICareerAutomation
): string[] => {
  const directSkills = [
    ...automation
      .roadmap
      .flatMap(
        (
          item
        ) =>
          item.relatedSkills ||
          []
      ),

    ...automation
      .tasks
      .map(
        (
          task
        ) =>
          task.relatedSkill ||
          ""
      ),
  ];

  const searchableText =
    automation
      .tasks
      .map(
        (
          task
        ) =>
          [
            task.title,
            task.description,
            task.reason,
          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )
      )
      .join(
        " "
      );

  const detected =
    searchableText
      .match(
        TECH_SKILL_PATTERN
      ) ||
    [];

  return uniqueSkills([
    ...directSkills,
    ...detected,
  ]).slice(
    0,
    8
  );
};

const getSkillStatus = (
  skill:
    string,
  automation:
    ICareerAutomation
): SkillStatus => {
  const matchingTasks =
    automation
      .tasks
      .filter(
        (
          task
        ) => {
          const haystack =
            [
              task.relatedSkill,
              task.title,
              task.description,
              task.reason,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase();

          return haystack
            .includes(
              skill
                .toLowerCase()
            );
        }
      );

  const hasHighPriority =
    matchingTasks
      .some(
        (
          task
        ) =>
          task.priority ===
            "high" &&
          task.status !==
            "completed"
      );

  const hasIncomplete =
    matchingTasks
      .some(
        (
          task
        ) =>
          task.status ===
            "pending" ||
          task.status ===
            "in_progress"
      );

  const hasCompleted =
    matchingTasks
      .some(
        (
          task
        ) =>
          task.status ===
          "completed"
      );

  if (
    hasHighPriority
  ) {
    return "priority";
  }

  if (
    hasIncomplete
  ) {
    return "next";
  }

  if (
    hasCompleted
  ) {
    return "strong";
  }

  return "later";
};

const getStatusScore = (
  status:
    SkillStatus
): number => {
  switch (
    status
  ) {
    case "strong":
      return 88;

    case "priority":
      return 42;

    case "next":
      return 58;

    case "later":
    default:
      return 70;
  }
};

const getStatusReason = (
  status:
    SkillStatus
): string => {
  switch (
    status
  ) {
    case "strong":
      return "Current evidence suggests this skill is already supported.";

    case "priority":
      return "High-priority gap for your current target role.";

    case "next":
      return "Recommended as one of your next learning steps.";

    case "later":
    default:
      return "Useful supporting skill after the higher-priority gaps.";
  }
};

const formatDate = (
  value?:
    string
): string => {
  if (
    !value
  ) {
    return "Not scheduled";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",
      }
    )
    .format(
      date
    );
};

/* =========================================================
   COMPONENT
========================================================= */

const CareerAutomationPage:
  React.FC = () => {
    const [
      automation,
      setAutomation,
    ] =
      useState<
        ICareerAutomation |
        null
      >(
        null
      );

    const [
      summary,
      setSummary,
    ] =
      useState<
        ICareerAutomationSummary |
        null
      >(
        null
      );

    const [
      loading,
      setLoading,
    ] =
      useState(
        true
      );

    const [
      actionKey,
      setActionKey,
    ] =
      useState<
        string |
        null
      >(
        null
      );

    const [
      selectedSkillId,
      setSelectedSkillId,
    ] =
      useState<
        string |
        null
      >(
        null
      );

    const [
      error,
      setError,
    ] =
      useState<
        string |
        null
      >(
        null
      );

    const loadAutomation =
      useCallback(
        async () => {
          try {
            setLoading(
              true
            );

            setError(
              null
            );

            const [
              automationData,
              summaryData,
            ] =
              await Promise.all([
                getCareerAutomation(),
                getCareerAutomationSummary(),
              ]);

            setAutomation(
              automationData
            );

            setSummary(
              summaryData
            );
          } catch (
            requestError
          ) {
            if (
              isCareerAutomationNotFoundError(
                requestError
              )
            ) {
              setAutomation(
                null
              );

              setSummary(
                null
              );

              return;
            }

            console.error(
              "[Career Automation Page] Load failed:",
              requestError
            );

            setError(
              "Career roadmap could not be loaded."
            );
          } finally {
            setLoading(
              false
            );
          }
        },
        []
      );

    useEffect(
      () => {
        void loadAutomation();
      },
      [
        loadAutomation,
      ]
    );

    const skills =
      useMemo(
        () => {
          if (
            !automation
          ) {
            return [];
          }

          return extractSkillsFromAutomation(
            automation
          );
        },
        [
          automation,
        ]
      );

    const skillNodes:
      ISkillNode[] =
      useMemo(
        () => {
          if (
            !automation
          ) {
            return [];
          }

          const graphSkills =
            skills.length >
              0
              ? skills
              : [
                  "Core Skills",
                  "Role Skills",
                  "Projects",
                  "Interview",
                ];

          const yPattern = [
            84,
            170,
            112,
            218,
            142,
            246,
            176,
            112,
          ];

          return graphSkills
            .map(
              (
                skill,
                index
              ) => {
                const status =
                  getSkillStatus(
                    skill,
                    automation
                  );

                return {
                  id:
                    `${skill}-${index}`,

                  label:
                    skill,

                  status,

                  score:
                    getStatusScore(
                      status
                    ),

                  x:
                    70 +
                    index *
                      145,

                  y:
                    yPattern[
                      index %
                      yPattern.length
                    ],

                  reason:
                    getStatusReason(
                      status
                    ),
                };
              }
            );
        },
        [
          automation,
          skills,
        ]
      );

    const selectedSkill =
      skillNodes
        .find(
          (
            node
          ) =>
            node.id ===
            selectedSkillId
        ) ||
      skillNodes[0];

    useEffect(
      () => {
        if (
          skillNodes.length >
            0 &&
          !selectedSkillId
        ) {
          setSelectedSkillId(
            skillNodes[0].id
          );
        }
      },
      [
        selectedSkillId,
        skillNodes,
      ]
    );

    const handleReplan =
      async () => {
        try {
          setActionKey(
            "replan"
          );

          setError(
            null
          );

          const result =
            await replanCareerAutomation(
              "Recalculate the roadmap around my target role, weakest skill gaps, and current career progress."
            );

          setAutomation(
            result.automation
          );

          setSummary(
            result.summary
          );
        } catch (
          requestError
        ) {
          console.error(
            requestError
          );

          setError(
            "Career roadmap could not be recalculated."
          );
        } finally {
          setActionKey(
            null
          );
        }
      };

    if (
      loading
    ) {
      return (
        <section className="career-graph-page">
          <div className="career-graph-loading">
            <FiRefreshCw />

            <span>
              Building your career roadmap...
            </span>
          </div>
        </section>
      );
    }

    if (
      !automation
    ) {
      return (
        <section className="career-graph-page">
          <div className="career-graph-empty">
            <FiTarget />

            <h1>
              Career Automation
            </h1>

            <p>
              Create your Career Automation profile first so
              InterviewIQ can build a personalized skill roadmap.
            </p>
          </div>
        </section>
      );
    }

    const readiness =
      Math.round(
        summary
          ?.currentReadinessScore ??
        automation
          .currentReadinessScore ??
        0
      );

    const selectedTopics =
      selectedSkill
        ? getImportantTopics(
            selectedSkill.label
          )
        : [];


    return (
      <section className="career-graph-page">
        <header className="career-graph-header">
          <div>
            <span className="career-graph-eyebrow">
              AI CAREER ROADMAP
            </span>

            <h1>
              {automation.targetRole}
            </h1>

            <p>
              A visual path built around your current strengths,
              skill gaps, and target role.
            </p>
          </div>

          <div className="career-graph-header-actions">
            <div className="career-readiness-pill">
              <FiTrendingUp />

              <span>
                Readiness
              </span>

              <strong>
                {readiness}%
              </strong>
            </div>

            <button
              type="button"
              className="career-replan-button"
              onClick={
                handleReplan
              }
              disabled={
                actionKey ===
                "replan"
              }
            >
              <FiRefreshCw
                className={
                  actionKey ===
                    "replan"
                    ? "spin"
                    : ""
                }
              />

              Rebuild roadmap
            </button>
          </div>
        </header>

        {error && (
          <div className="career-graph-alert">
            <FiAlertCircle />

            <span>
              {error}
            </span>
          </div>
        )}

        <div className="career-graph-layout">
          <article className="career-skill-map-card">
            <div className="career-section-heading">
              <div>
                <span>
                  YOUR SKILL PATH
                </span>

                <h2>
                  Personalized Skill Roadmap
                </h2>

                <p>
                  Click any skill to understand why it matters
                  and where it sits in your path.
                </p>
              </div>

              <div className="career-skill-legend">
                <span className="strong">
                  Strong
                </span>

                <span className="priority">
                  Priority gap
                </span>

                <span className="next">
                  Next
                </span>

                <span className="later">
                  Later
                </span>
              </div>
            </div>

            <div className="career-skill-map-scroll">
              <div
                className="career-skill-map-canvas"
                style={{
                  minWidth:
                    `${
                      Math.max(
                        980,
                        skillNodes.length *
                          155 +
                        100
                      )
                    }px`,
                }}
              >
                <svg
                  className="career-skill-map-lines"
                  viewBox={`0 0 ${
                    Math.max(
                      980,
                      skillNodes.length *
                        155 +
                      100
                    )
                  } 340`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {skillNodes
                    .slice(
                      0,
                      -1
                    )
                    .map(
                      (
                        node,
                        index
                      ) => {
                        const next =
                          skillNodes[
                            index +
                            1
                          ];

                        if (
                          !next
                        ) {
                          return null;
                        }

                        const startX =
                          node.x +
                          105;

                        const startY =
                          node.y +
                          29;

                        const endX =
                          next.x;

                        const endY =
                          next.y +
                          29;

                        const middleX =
                          (
                            startX +
                            endX
                          ) /
                          2;

                        const path =
                          `M ${startX} ${startY}
                           C ${middleX} ${startY},
                             ${middleX} ${endY},
                             ${endX} ${endY}`;

                        return (
                          <path
                            key={
                              `${node.id}-${next.id}`
                            }
                            d={
                              path
                            }
                          />
                        );
                      }
                    )}
                </svg>

                {skillNodes.map(
                  (
                    node
                  ) => (
                    <button
                      key={
                        node.id
                      }
                      type="button"
                      className={`career-skill-node ${node.status} ${
                        selectedSkill
                          ?.id ===
                          node.id
                          ? "selected"
                          : ""
                      }`}
                      style={{
                        left:
                          `${node.x}px`,

                        top:
                          `${node.y}px`,
                      }}
                      onClick={() =>
                        setSelectedSkillId(
                          node.id
                        )
                      }
                    >
                      <span className="career-skill-node-index">
                        {node.status ===
                        "strong"
                          ? <FiCheck />
                          : node.status ===
                              "priority"
                            ? "!"
                            : null}
                      </span>

                      <strong>
                        {node.label}
                      </strong>

                      <small>
                        {node.score}% readiness
                      </small>
                    </button>
                  )
                )}
              </div>
            </div>
          </article>

          <aside className="career-skill-detail-card">
            <div className="career-detail-header-row">
              <span className="career-detail-label">
                SELECTED SKILL
              </span>

              <div className={`career-detail-status ${selectedSkill?.status || "later"}`}>
                {selectedSkill
                  ?.status ===
                  "priority"
                  ? "High priority"
                  : selectedSkill
                      ?.status ===
                      "strong"
                    ? "Strong"
                    : selectedSkill
                        ?.status ===
                        "next"
                      ? "Next to learn"
                      : "Later"}
              </div>
            </div>

            <h2>
              {selectedSkill
                ?.label ||
                "Skill"}
            </h2>

            <p>
              {selectedSkill
                ?.reason ||
                "This skill supports your target role."}
            </p>

            <div className="career-detail-score">
              <div>
                <span>
                  Current readiness
                </span>

                <strong>
                  {selectedSkill
                    ?.score ||
                    0}%
                </strong>
              </div>

              <div className="career-detail-score-track">
                <span
                  style={{
                    width:
                      `${selectedSkill?.score || 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="career-important-topics">
              <div className="career-important-topics-heading">
                <FiZap />

                <div>
                  <span>
                    IMPORTANT TOPICS
                  </span>

                  <strong>
                    Learn these first
                  </strong>
                </div>
              </div>

              <div className="career-important-topic-list">
                {selectedTopics.map(
                  (
                    topic,
                    index
                  ) => (
                    <div
                      key={
                        `${selectedSkill?.id || "skill"}-${topic}`
                      }
                      className="career-important-topic"
                    >
                      <span>
                        {index + 1}
                      </span>

                      <p>
                        {topic}
                      </p>
                    </div>
                  )
                )}
              </div>

              <small>
                Focus on these topics when researching or
                practicing {selectedSkill?.label || "this skill"}.
              </small>
            </div>
          </aside>
        </div>

        <div className="career-opportunities-section">
          <article className="career-job-card">
            <div className="career-section-heading compact">
              <div>
                <span>
                  MATCHING OPPORTUNITIES
                </span>

                <h2>
                  Jobs for your roadmap
                </h2>

                <p>
                  New jobs will be ranked against your skill path.
                </p>
              </div>

              <FiBriefcase />
            </div>

            <div className="career-job-list">
              {automation
                .jobMatches
                .length >
              0
                ? automation
                    .jobMatches
                    .slice(
                      0,
                      5
                    )
                    .map(
                      (
                        match,
                        index
                      ) => (
                        <div
                          key={
                            `${match.jobId}-${index}`
                          }
                          className="career-job-row"
                        >
                          <div className="career-job-score">
                            {Math.round(
                              match.matchScore
                            )}%
                          </div>

                          <div>
                            <strong>
                              Matching opportunity
                            </strong>

                            <span>
                              Job ID: {String(
                                match.jobId
                              ).slice(
                                -8
                              )}
                            </span>
                          </div>

                          <FiArrowRight />
                        </div>
                      )
                    )
                : (
                  <div className="career-job-empty">
                    <FiBriefcase />

                    <h3>
                      No external job matches yet
                    </h3>

                    <p>
                      The next backend phase will collect fresh
                      vacancies from external sources and place the
                      best matches here automatically.
                    </p>
                  </div>
                )}
            </div>
          </article>
        </div>

        <footer className="career-roadmap-footer">
          <div>
            <FiClock />

            <span>
              Next plan refresh:
            </span>

            <strong>
              {formatDate(
                summary
                  ?.nextDailyPlanAt
              )}
            </strong>
          </div>

          <div>
            <FiTarget />

            <span>
              Career goal:
            </span>

            <strong>
              {automation.careerGoal}
            </strong>
          </div>
        </footer>
      </section>
    );
  };

export default CareerAutomationPage;
