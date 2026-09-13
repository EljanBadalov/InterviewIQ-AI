import dns from "node:dns";

dns.setServers([
  "1.1.1.1",
  "8.8.8.8",
]);

import mongoose from "mongoose";

import {
  env,
} from "../config/env";

import {
  CareerKnowledge,
  type CareerKnowledgeDomain,
  type CareerKnowledgeImportance,
  type CareerKnowledgeLevel,
  type CareerKnowledgeSource,
  type CareerKnowledgeTopicType,
  type CareerKnowledgeInterviewType,
  type ICareerKnowledgeTopic,
  type ICareerKnowledgeInterviewTopic,
  type ICareerKnowledgeScenario,
} from "../models/CareerKnowledge";

/* =========================================================
   HELPERS
========================================================= */

const slugify = (
  value:
    string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
};

const topic = ({
  name,
  category,
  level,
  importance,
  description,
  type =
    "skill",
  prerequisites =
    [],
  subtopics =
    [],
  practicalScenarios =
    [],
  expectedEvidence =
    [],
  relatedTools =
    [],
  relatedSkills =
    [],
}: {
  name: string;
  category: string;
  level: CareerKnowledgeLevel;
  importance: CareerKnowledgeImportance;
  description?: string;
  type?: CareerKnowledgeTopicType;
  prerequisites?: string[];
  subtopics?: string[];
  practicalScenarios?: string[];
  expectedEvidence?: string[];
  relatedTools?: string[];
  relatedSkills?: string[];
}): ICareerKnowledgeTopic => ({
  id:
    slugify(
      `${category}-${name}-${level}`
    ),

  name,

  normalizedName:
    name
      .trim()
      .toLowerCase(),

  type,

  category,

  description,

  level,

  importance,

  prerequisites,

  subtopics,

  practicalScenarios,

  expectedEvidence,

  relatedTools,

  relatedSkills,

  sourceReference:
    "InterviewIQ curated IT knowledge seed",

  sourceMetadata: {
    source:
      "internal-curated-it-v2",
  },
});

const interviewTopic = ({
  title,
  type,
  level,
  description,
  focusAreas =
    [],
  exampleQuestions =
    [],
  expectedSignals =
    [],
  commonWeaknesses =
    [],
  relatedSkills =
    [],
}: {
  title: string;
  type: CareerKnowledgeInterviewType;
  level: CareerKnowledgeLevel;
  description?: string;
  focusAreas?: string[];
  exampleQuestions?: string[];
  expectedSignals?: string[];
  commonWeaknesses?: string[];
  relatedSkills?: string[];
}): ICareerKnowledgeInterviewTopic => ({
  id:
    slugify(
      `${title}-${level}`
    ),

  title,

  type,

  level,

  description,

  focusAreas,

  exampleQuestions,

  expectedSignals,

  commonWeaknesses,

  relatedSkills,
});

const scenario = ({
  title,
  description,
  level,
  category,
  skillsTested =
    [],
  expectedOutcome,
}: {
  title: string;
  description: string;
  level: CareerKnowledgeLevel;
  category: string;
  skillsTested?: string[];
  expectedOutcome?: string;
}): ICareerKnowledgeScenario => ({
  id:
    slugify(
      `${category}-${title}-${level}`
    ),

  title,

  description,

  level,

  category,

  skillsTested,

  expectedOutcome,
});

interface ICareerKnowledgeSeedRole {
  domain: CareerKnowledgeDomain;
  source: CareerKnowledgeSource;
  sourceVersion: string;
  status: "active";

  role: {
    slug: string;
    title: string;
    aliases: string[];
    description: string;
    topics: ICareerKnowledgeTopic[];
    interviewTopics: ICareerKnowledgeInterviewTopic[];
    practicalScenarios: ICareerKnowledgeScenario[];
    coreSkills: string[];
    roleSkills: string[];
    tools: string[];
    knowledgeAreas: string[];
    responsibilities: string[];
    recommendedProjects: string[];
    metadata?: Record<string, unknown>;
  };

  tags: string[];

  importedAt: Date;
  lastSyncedAt: Date;
}

const makeRole = ({
  title,
  aliases,
  description,
  topics,
  interviewTopics,
  practicalScenarios,
  coreSkills,
  roleSkills,
  tools,
  knowledgeAreas,
  responsibilities,
  recommendedProjects,
  tags,
}: {
  title: string;
  aliases: string[];
  description: string;
  topics: ICareerKnowledgeTopic[];
  interviewTopics: ICareerKnowledgeInterviewTopic[];
  practicalScenarios: ICareerKnowledgeScenario[];
  coreSkills: string[];
  roleSkills: string[];
  tools: string[];
  knowledgeAreas: string[];
  responsibilities: string[];
  recommendedProjects: string[];
  tags: string[];
}): ICareerKnowledgeSeedRole => ({
  domain:
    "technology",

  source:
    "internal",

  sourceVersion:
    "interviewiq-it-v2",

  status:
    "active",

  role: {
    slug:
      slugify(
        title
      ),

    title,

    aliases,

    description,

    topics,

    interviewTopics,

    practicalScenarios,

    coreSkills,

    roleSkills,

    tools,

    knowledgeAreas,

    responsibilities,

    recommendedProjects,

    metadata: {
      curated:
        true,

      purpose:
        "role-first-personalized-roadmap",

      levelPolicy:
        "beginner-to-expert",
    },
  },

  tags,

  importedAt:
    new Date(),

  lastSyncedAt:
    new Date(),
});

/* =========================================================
   SHARED INTERVIEW / SCENARIO FACTORIES
========================================================= */

const standardInterviewSet = ({
  role,
  core,
  architecture,
  debugging,
}: {
  role: string;
  core: string[];
  architecture: string[];
  debugging: string[];
}): ICareerKnowledgeInterviewTopic[] => [
  interviewTopic({
    title:
      `${role} Production Debugging`,

    type:
      "scenario",

    level:
      "production",

    focusAreas:
      debugging,

    exampleQuestions: [
      `A production system owned by a ${role} team starts failing under load. How would you investigate the issue step by step?`,
    ],

    expectedSignals: [
      "Uses evidence before guessing",
      "Separates symptoms from root cause",
      "Explains observability and rollback strategy",
    ],

    commonWeaknesses: [
      "Jumps directly to code changes without diagnosis",
    ],

    relatedSkills:
      debugging,
  }),

  interviewTopic({
    title:
      `${role} Architecture Trade-offs`,

    type:
      "role_specific",

    level:
      "advanced",

    focusAreas:
      architecture,

    exampleQuestions: [
      `Describe an architecture decision a ${role} should make when requirements conflict.`,
    ],

    expectedSignals: [
      "Explains trade-offs",
      "Connects decisions to constraints",
      "Considers maintainability and failure modes",
    ],

    commonWeaknesses: [
      "Presents one technology as universally best",
    ],

    relatedSkills:
      architecture,
  }),

  interviewTopic({
    title:
      `${role} Core Technical Depth`,

    type:
      "technical",

    level:
      "advanced",

    focusAreas:
      core,

    exampleQuestions: [
      `Which advanced topics are most important for a production ${role}, and why?`,
    ],

    expectedSignals: [
      "Prioritizes production concerns",
      "Connects concepts to real systems",
    ],

    commonWeaknesses: [
      "Only describes beginner-course concepts",
    ],

    relatedSkills:
      core,
  }),
];

const standardScenarioSet = ({
  role,
  firstTitle,
  firstDescription,
  firstSkills,
  secondTitle,
  secondDescription,
  secondSkills,
}: {
  role: string;
  firstTitle: string;
  firstDescription: string;
  firstSkills: string[];
  secondTitle: string;
  secondDescription: string;
  secondSkills: string[];
}): ICareerKnowledgeScenario[] => [
  scenario({
    title:
      firstTitle,

    description:
      firstDescription,

    level:
      "advanced",

    category:
      `${role} Practice`,

    skillsTested:
      firstSkills,

    expectedOutcome:
      "The user makes a technically sound decision and explains trade-offs using production constraints.",
  }),

  scenario({
    title:
      secondTitle,

    description:
      secondDescription,

    level:
      "production",

    category:
      `${role} Practice`,

    skillsTested:
      secondSkills,

    expectedOutcome:
      "The user diagnoses the problem systematically and proposes a maintainable production-ready solution.",
  }),
];

/* =========================================================
   1. BACKEND DEVELOPER
========================================================= */

const backendDeveloper =
  makeRole({
    title:
      "Backend Developer",

    aliases: [
      "Backend Engineer",
      "Backend Software Engineer",
      "Server-side Developer",
      "API Developer",
      "Node.js Backend Developer",
    ],

    description:
      "Builds reliable server-side services, APIs, data-access layers, background workers, and production backend systems.",

    topics: [
      topic({
        name:
          "REST API Design",

        category:
          "API Architecture",

        level:
          "intermediate",

        importance:
          "critical",

        subtopics: [
          "Resource-oriented endpoints",
          "Pagination",
          "Filtering",
          "Versioning",
          "Error contracts",
          "Idempotency",
        ],

        practicalScenarios: [
          "Design an API for a high-volume catalog",
          "Prevent duplicate side effects on retries",
        ],

        expectedEvidence: [
          "Can design and document a maintainable REST API",
        ],

        relatedTools: [
          "OpenAPI",
          "Postman",
        ],

        relatedSkills: [
          "HTTP",
          "REST APIs",
        ],
      }),

      topic({
        name:
          "Node.js Event Loop Under Load",

        category:
          "Runtime",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Event-loop phases",
          "Microtasks",
          "libuv",
          "Blocking operations",
          "Worker threads",
          "Event-loop lag",
        ],

        practicalScenarios: [
          "Diagnose latency caused by CPU-bound work",
          "Move expensive work away from the event loop",
        ],

        expectedEvidence: [
          "Can explain runtime bottlenecks under concurrency",
        ],

        relatedTools: [
          "Node.js",
          "clinic.js",
        ],

        relatedSkills: [
          "JavaScript",
          "Node.js",
          "Performance",
        ],
      }),

      topic({
        name:
          "Streams and Backpressure",

        category:
          "Runtime",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Process multi-gigabyte files without exhausting memory",
          "Stream large database exports safely",
        ],

        expectedEvidence: [
          "Can design a bounded streaming pipeline",
        ],

        relatedSkills: [
          "Node.js",
          "Performance",
        ],
      }),

      topic({
        name:
          "Database Indexing and Query Planning",

        category:
          "Databases",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Composite indexes",
          "Selectivity",
          "Execution plans",
          "N+1 queries",
          "Covering indexes",
        ],

        practicalScenarios: [
          "Reduce a multi-second query to milliseconds",
        ],

        expectedEvidence: [
          "Can interpret query plans and justify indexes",
        ],

        relatedTools: [
          "PostgreSQL EXPLAIN",
          "MongoDB explain",
        ],

        relatedSkills: [
          "SQL",
          "MongoDB",
          "Database Performance",
        ],
      }),

      topic({
        name:
          "Transactions and Concurrency Control",

        category:
          "Databases",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Isolation levels",
          "Deadlocks",
          "Atomic updates",
          "Optimistic locking",
          "Idempotency keys",
        ],

        practicalScenarios: [
          "Prevent overselling the final inventory item",
          "Avoid duplicate payment processing",
        ],

        expectedEvidence: [
          "Can design safe transactional boundaries",
        ],

        relatedSkills: [
          "Database Transactions",
          "Concurrency",
        ],
      }),

      topic({
        name:
          "Caching Strategy",

        category:
          "Performance",

        level:
          "advanced",

        importance:
          "high",

        subtopics: [
          "Cache-aside",
          "TTL strategy",
          "Invalidation",
          "Cache stampede",
        ],

        practicalScenarios: [
          "Reduce database pressure for a read-heavy API",
        ],

        expectedEvidence: [
          "Can explain invalidation and consistency trade-offs",
        ],

        relatedTools: [
          "Redis",
        ],

        relatedSkills: [
          "Caching",
          "Performance",
        ],
      }),

      topic({
        name:
          "Background Jobs and Message Queues",

        category:
          "Distributed Systems",

        level:
          "production",

        importance:
          "critical",

        subtopics: [
          "Retries",
          "Dead-letter queues",
          "At-least-once delivery",
          "Idempotent consumers",
        ],

        practicalScenarios: [
          "Process reports asynchronously and recover failures safely",
        ],

        expectedEvidence: [
          "Can build retry-safe background workers",
        ],

        relatedTools: [
          "BullMQ",
          "RabbitMQ",
          "Kafka",
          "SQS",
        ],

        relatedSkills: [
          "Queues",
          "Reliability",
        ],
      }),

      topic({
        name:
          "Authentication and Authorization Architecture",

        category:
          "Security",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Session vs token auth",
          "JWT trade-offs",
          "Refresh-token rotation",
          "RBAC",
          "ABAC",
        ],

        practicalScenarios: [
          "Prevent horizontal privilege escalation",
        ],

        expectedEvidence: [
          "Can design authorization independently from UI checks",
        ],

        relatedSkills: [
          "Authentication",
          "Authorization",
          "Security",
        ],
      }),

      topic({
        name:
          "Observability and Structured Logging",

        category:
          "Operations",

        level:
          "production",

        importance:
          "critical",

        subtopics: [
          "Structured logs",
          "Correlation IDs",
          "Metrics",
          "Tracing",
          "SLIs and SLOs",
        ],

        practicalScenarios: [
          "Trace one failed request across multiple dependencies",
        ],

        expectedEvidence: [
          "Can instrument services for production diagnostics",
        ],

        relatedTools: [
          "OpenTelemetry",
          "Prometheus",
          "Grafana",
        ],

        relatedSkills: [
          "Observability",
          "Logging",
        ],
      }),

      topic({
        name:
          "Graceful Shutdown and Failure Handling",

        category:
          "Reliability",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Deploy without dropping active requests or queue jobs",
        ],

        expectedEvidence: [
          "Can explain readiness, liveness, and connection draining",
        ],

        relatedTools: [
          "Docker",
          "Kubernetes",
        ],

        relatedSkills: [
          "Reliability",
          "Deployment",
        ],
      }),

      topic({
        name:
          "Load Testing and Performance Profiling",

        category:
          "Performance",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Investigate why p95 latency increases as traffic doubles",
        ],

        expectedEvidence: [
          "Can distinguish CPU, DB, memory, and dependency bottlenecks",
        ],

        relatedTools: [
          "k6",
          "Artillery",
          "Clinic.js",
        ],

        relatedSkills: [
          "Performance",
          "Observability",
        ],
      }),

      topic({
        name:
          "System Design and Service Boundaries",

        category:
          "Architecture",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Choose between modular monolith and microservices",
        ],

        expectedEvidence: [
          "Can define boundaries using business responsibilities",
        ],

        relatedSkills: [
          "System Design",
          "Software Architecture",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Backend Developer",

        core: [
          "Node.js",
          "Databases",
          "Queues",
          "Caching",
        ],

        architecture: [
          "System Design",
          "Service Boundaries",
          "Transactions",
        ],

        debugging: [
          "Observability",
          "Performance",
          "Database Performance",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Backend Developer",

        firstTitle:
          "Flash-Sale Inventory Race Condition",

        firstDescription:
          "Multiple users attempt to purchase the final units at the same time.",

        firstSkills: [
          "Concurrency",
          "Transactions",
          "Atomic Updates",
        ],

        secondTitle:
          "Production API Latency Incident",

        secondDescription:
          "p95 latency suddenly triples while traffic remains stable.",

        secondSkills: [
          "Observability",
          "Profiling",
          "Database Performance",
        ],
      }),

    coreSkills: [
      "Programming",
      "HTTP",
      "REST APIs",
      "Databases",
      "Git",
      "Testing",
      "Debugging",
    ],

    roleSkills: [
      "API Design",
      "Authentication",
      "Authorization",
      "Database Transactions",
      "Caching",
      "Queues",
      "Observability",
      "Security",
      "System Design",
      "Reliability",
    ],

    tools: [
      "Node.js",
      "Express",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "Docker",
      "OpenTelemetry",
    ],

    knowledgeAreas: [
      "Web protocols",
      "API architecture",
      "Database systems",
      "Distributed systems",
      "Production reliability",
    ],

    responsibilities: [
      "Design and maintain backend APIs",
      "Model and query data",
      "Build secure services",
      "Diagnose production issues",
      "Improve reliability and performance",
    ],

    recommendedProjects: [
      "Production REST API with authentication, RBAC, tests, Docker, and CI",
      "Queue-based background worker with retry and idempotency",
      "High-throughput API with caching, metrics, tracing, and load tests",
    ],

    tags: [
      "backend",
      "api",
      "nodejs",
      "databases",
      "production",
    ],
  });

/* =========================================================
   2. FRONTEND DEVELOPER
========================================================= */

const frontendDeveloper =
  makeRole({
    title:
      "Frontend Developer",

    aliases: [
      "Frontend Engineer",
      "React Developer",
      "JavaScript Developer",
      "UI Engineer",
    ],

    description:
      "Builds performant, accessible, maintainable browser applications and production user interfaces.",

    topics: [
      topic({
        name:
          "Browser Rendering Pipeline",

        category:
          "Browser Internals",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "DOM and CSSOM",
          "Layout",
          "Paint",
          "Compositing",
          "Reflow triggers",
        ],

        practicalScenarios: [
          "Diagnose layout thrashing and slow rendering",
        ],

        expectedEvidence: [
          "Can explain why UI work causes frame drops",
        ],

        relatedSkills: [
          "JavaScript",
          "Browser Performance",
        ],
      }),

      topic({
        name:
          "React Rendering and Reconciliation",

        category:
          "React Architecture",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Render cycles",
          "Reconciliation",
          "Memoization trade-offs",
          "State locality",
          "Concurrent rendering concepts",
        ],

        practicalScenarios: [
          "Fix unnecessary re-renders in a complex page",
        ],

        expectedEvidence: [
          "Can reason about rendering cost and component boundaries",
        ],

        relatedTools: [
          "React DevTools",
        ],

        relatedSkills: [
          "React",
          "Performance",
        ],
      }),

      topic({
        name:
          "State Management Architecture",

        category:
          "Application Architecture",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Local vs global state",
          "Server state",
          "Derived state",
          "Normalized state",
          "State machines",
        ],

        practicalScenarios: [
          "Choose between React state, Redux Toolkit, and server-state caching",
        ],

        expectedEvidence: [
          "Can avoid unnecessary global state",
        ],

        relatedTools: [
          "Redux Toolkit",
          "TanStack Query",
          "Zustand",
        ],

        relatedSkills: [
          "React",
          "State Management",
        ],
      }),

      topic({
        name:
          "Advanced TypeScript for UI Systems",

        category:
          "Type Safety",

        level:
          "advanced",

        importance:
          "high",

        subtopics: [
          "Generics",
          "Discriminated unions",
          "Mapped types",
          "Utility types",
          "Typed component APIs",
        ],

        practicalScenarios: [
          "Design a reusable type-safe form or table component",
        ],

        expectedEvidence: [
          "Can model complex component contracts safely",
        ],

        relatedSkills: [
          "TypeScript",
          "React",
        ],
      }),

      topic({
        name:
          "Frontend Performance Profiling",

        category:
          "Performance",

        level:
          "production",

        importance:
          "critical",

        subtopics: [
          "Core Web Vitals",
          "Long tasks",
          "Bundle analysis",
          "Code splitting",
          "Lazy loading",
        ],

        practicalScenarios: [
          "Improve LCP and reduce interaction delay on a production page",
        ],

        expectedEvidence: [
          "Can measure before optimizing",
        ],

        relatedTools: [
          "Lighthouse",
          "Chrome DevTools",
          "WebPageTest",
        ],

        relatedSkills: [
          "Performance",
          "React",
        ],
      }),

      topic({
        name:
          "Accessibility Engineering",

        category:
          "Accessibility",

        level:
          "production",

        importance:
          "high",

        subtopics: [
          "Semantic HTML",
          "Keyboard navigation",
          "Focus management",
          "ARIA",
          "Screen-reader behavior",
        ],

        practicalScenarios: [
          "Make a complex modal and navigation flow keyboard-accessible",
        ],

        expectedEvidence: [
          "Can test accessibility beyond automated checks",
        ],

        relatedTools: [
          "axe",
          "NVDA",
          "VoiceOver",
        ],

        relatedSkills: [
          "Accessibility",
          "HTML",
        ],
      }),

      topic({
        name:
          "Frontend Testing Strategy",

        category:
          "Testing",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Component tests",
          "Integration tests",
          "E2E tests",
          "Test boundaries",
          "Mocking strategy",
        ],

        practicalScenarios: [
          "Design test coverage for a checkout flow",
        ],

        expectedEvidence: [
          "Can choose appropriate test levels",
        ],

        relatedTools: [
          "Vitest",
          "React Testing Library",
          "Playwright",
        ],

        relatedSkills: [
          "Testing",
          "React",
        ],
      }),

      topic({
        name:
          "Frontend Security",

        category:
          "Security",

        level:
          "advanced",

        importance:
          "high",

        subtopics: [
          "XSS",
          "CSP",
          "Token storage",
          "CSRF",
          "Dependency risk",
        ],

        practicalScenarios: [
          "Prevent script injection in user-generated content",
        ],

        expectedEvidence: [
          "Can explain browser-side security boundaries",
        ],

        relatedSkills: [
          "Security",
          "JavaScript",
        ],
      }),

      topic({
        name:
          "Build Systems and Bundling",

        category:
          "Tooling",

        level:
          "advanced",

        importance:
          "medium",

        subtopics: [
          "ES modules",
          "Tree shaking",
          "Chunking",
          "Source maps",
          "Build caching",
        ],

        practicalScenarios: [
          "Reduce bundle size and improve build performance",
        ],

        expectedEvidence: [
          "Can diagnose bundle-growth regressions",
        ],

        relatedTools: [
          "Vite",
          "Webpack",
        ],

        relatedSkills: [
          "Frontend Tooling",
        ],
      }),

      topic({
        name:
          "Design Systems and Component APIs",

        category:
          "Architecture",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Build a reusable component system across multiple product teams",
        ],

        expectedEvidence: [
          "Can design stable component contracts",
        ],

        relatedSkills: [
          "React",
          "Design Systems",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Frontend Developer",

        core: [
          "React",
          "TypeScript",
          "Browser Internals",
        ],

        architecture: [
          "State Management",
          "Design Systems",
          "Rendering",
        ],

        debugging: [
          "Performance",
          "Accessibility",
          "Frontend Testing",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Frontend Developer",

        firstTitle:
          "Slow Dashboard Rendering",

        firstDescription:
          "A data-heavy dashboard becomes sluggish after adding more widgets.",

        firstSkills: [
          "React Rendering",
          "Performance Profiling",
          "State Management",
        ],

        secondTitle:
          "Accessibility Regression",

        secondDescription:
          "A redesign breaks keyboard and screen-reader interaction.",

        secondSkills: [
          "Accessibility",
          "Semantic HTML",
          "Focus Management",
        ],
      }),

    coreSkills: [
      "JavaScript",
      "TypeScript",
      "HTML",
      "CSS",
      "React",
      "Git",
    ],

    roleSkills: [
      "Rendering",
      "State Management",
      "Accessibility",
      "Testing",
      "Performance",
      "Frontend Security",
      "Design Systems",
    ],

    tools: [
      "React",
      "TypeScript",
      "Vite",
      "Redux Toolkit",
      "TanStack Query",
      "Playwright",
      "Lighthouse",
    ],

    knowledgeAreas: [
      "Browser internals",
      "UI architecture",
      "Web performance",
      "Accessibility",
      "Frontend testing",
    ],

    responsibilities: [
      "Build production UI",
      "Maintain component architecture",
      "Improve accessibility and performance",
      "Integrate APIs safely",
    ],

    recommendedProjects: [
      "Production React app with TypeScript, server-state caching, tests, and accessibility",
      "Reusable design system with documentation and visual regression testing",
    ],

    tags: [
      "frontend",
      "react",
      "typescript",
      "browser",
    ],
  });

/* =========================================================
   3. FULL STACK DEVELOPER
========================================================= */

const fullStackDeveloper =
  makeRole({
    title:
      "Full Stack Developer",

    aliases: [
      "Full Stack Engineer",
      "Fullstack Developer",
      "Fullstack Engineer",
    ],

    description:
      "Builds complete web systems across browser, API, database, testing, deployment, and production operations.",

    topics: [
      topic({
        name:
          "End-to-End Application Architecture",

        category:
          "Architecture",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design boundaries between UI, API, domain logic, and persistence",
        ],

        expectedEvidence: [
          "Can explain full request lifecycle and responsibility boundaries",
        ],

        relatedSkills: [
          "Frontend Architecture",
          "Backend Architecture",
        ],
      }),

      topic({
        name:
          "Type-Safe Client-Server Contracts",

        category:
          "Integration",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Prevent frontend/backend contract drift",
        ],

        expectedEvidence: [
          "Can maintain shared schemas without unsafe duplication",
        ],

        relatedTools: [
          "OpenAPI",
          "Zod",
          "tRPC",
        ],

        relatedSkills: [
          "TypeScript",
          "API Design",
        ],
      }),

      topic({
        name:
          "Authentication Across the Stack",

        category:
          "Security",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Implement secure login, session renewal, protected routes, and backend authorization",
        ],

        expectedEvidence: [
          "Can distinguish UI auth state from server authorization",
        ],

        relatedSkills: [
          "Authentication",
          "Authorization",
        ],
      }),

      topic({
        name:
          "Full-Stack Testing Strategy",

        category:
          "Testing",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Test a user workflow across frontend, API, and database",
        ],

        expectedEvidence: [
          "Can balance unit, integration, and E2E coverage",
        ],

        relatedTools: [
          "Vitest",
          "Playwright",
          "Supertest",
        ],

        relatedSkills: [
          "Testing",
        ],
      }),

      topic({
        name:
          "Database Performance and API Efficiency",

        category:
          "Performance",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Fix a slow page caused by inefficient backend data access",
        ],

        expectedEvidence: [
          "Can trace frontend slowness to backend query behavior",
        ],

        relatedSkills: [
          "SQL",
          "API Performance",
        ],
      }),

      topic({
        name:
          "SSR, Hydration, and Server Components",

        category:
          "Rendering",

        level:
          "advanced",

        importance:
          "medium",

        practicalScenarios: [
          "Choose client rendering vs SSR vs server components for a product requirement",
        ],

        expectedEvidence: [
          "Can explain rendering trade-offs",
        ],

        relatedTools: [
          "Next.js",
        ],

        relatedSkills: [
          "React",
          "Rendering",
        ],
      }),

      topic({
        name:
          "CI/CD and Deployment",

        category:
          "Delivery",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Deploy frontend, API, and database changes safely",
        ],

        expectedEvidence: [
          "Can explain build, migration, rollback, and environment strategy",
        ],

        relatedTools: [
          "Docker",
          "GitHub Actions",
        ],

        relatedSkills: [
          "CI/CD",
          "Deployment",
        ],
      }),

      topic({
        name:
          "Observability Across Client and Server",

        category:
          "Operations",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Trace a user-visible failure from browser to API to database",
        ],

        expectedEvidence: [
          "Can correlate frontend and backend telemetry",
        ],

        relatedTools: [
          "Sentry",
          "OpenTelemetry",
        ],

        relatedSkills: [
          "Observability",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Full Stack Developer",

        core: [
          "React",
          "APIs",
          "Databases",
          "TypeScript",
        ],

        architecture: [
          "End-to-End Architecture",
          "Authentication",
          "Deployment",
        ],

        debugging: [
          "Observability",
          "Performance",
          "Testing",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Full Stack Developer",

        firstTitle:
          "Slow End-to-End Checkout",

        firstDescription:
          "A checkout flow is slow but the bottleneck location is unknown.",

        firstSkills: [
          "Frontend Performance",
          "API Performance",
          "Database Performance",
        ],

        secondTitle:
          "Cross-Layer Authentication Bug",

        secondDescription:
          "Users appear logged in on the client but unauthorized requests still occur.",

        secondSkills: [
          "Authentication",
          "Authorization",
          "Session Management",
        ],
      }),

    coreSkills: [
      "JavaScript",
      "TypeScript",
      "React",
      "APIs",
      "Databases",
      "Git",
    ],

    roleSkills: [
      "Full-Stack Architecture",
      "Authentication",
      "Testing",
      "Deployment",
      "Observability",
    ],

    tools: [
      "React",
      "Next.js",
      "Node.js",
      "PostgreSQL",
      "Docker",
    ],

    knowledgeAreas: [
      "Frontend architecture",
      "Backend architecture",
      "Database systems",
      "Deployment",
    ],

    responsibilities: [
      "Build complete product features",
      "Maintain client-server contracts",
      "Own deployment and production quality",
    ],

    recommendedProjects: [
      "Full-stack SaaS app with authentication, billing-style workflows, tests, and deployment",
    ],

    tags: [
      "fullstack",
      "react",
      "nodejs",
    ],
  });

/* =========================================================
   4. DEVOPS ENGINEER
========================================================= */

const devOpsEngineer =
  makeRole({
    title:
      "DevOps Engineer",

    aliases: [
      "Platform Engineer",
      "DevOps Specialist",
      "Infrastructure Engineer",
    ],

    description:
      "Automates delivery, infrastructure, observability, reliability, and operational workflows for software systems.",

    topics: [
      topic({
        name:
          "Linux Systems Internals",

        category:
          "Operating Systems",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Processes",
          "Signals",
          "Memory",
          "File descriptors",
          "Systemd",
          "Namespaces",
        ],

        practicalScenarios: [
          "Diagnose a process leak or resource exhaustion",
        ],

        expectedEvidence: [
          "Can troubleshoot Linux resource issues",
        ],

        relatedSkills: [
          "Linux",
        ],
      }),

      topic({
        name:
          "Advanced Networking",

        category:
          "Networking",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "DNS",
          "TCP",
          "TLS",
          "Load balancing",
          "NAT",
          "Routing",
        ],

        practicalScenarios: [
          "Debug intermittent service-to-service connectivity",
        ],

        expectedEvidence: [
          "Can isolate DNS, routing, firewall, and application issues",
        ],

        relatedSkills: [
          "Networking",
        ],
      }),

      topic({
        name:
          "Docker Image and Runtime Hardening",

        category:
          "Containers",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Reduce image size and remove unnecessary privileges",
        ],

        expectedEvidence: [
          "Can build secure reproducible container images",
        ],

        relatedTools: [
          "Docker",
        ],

        relatedSkills: [
          "Containers",
          "Security",
        ],
      }),

      topic({
        name:
          "Kubernetes Workload Operations",

        category:
          "Orchestration",

        level:
          "production",

        importance:
          "critical",

        subtopics: [
          "Deployments",
          "Services",
          "Ingress",
          "Probes",
          "Autoscaling",
          "Pod disruption",
        ],

        practicalScenarios: [
          "Recover a rollout causing unavailable pods",
        ],

        expectedEvidence: [
          "Can operate workloads safely in Kubernetes",
        ],

        relatedTools: [
          "Kubernetes",
          "Helm",
        ],

        relatedSkills: [
          "Kubernetes",
        ],
      }),

      topic({
        name:
          "Infrastructure as Code at Scale",

        category:
          "Infrastructure",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Manage reusable infrastructure modules across environments",
        ],

        expectedEvidence: [
          "Can control drift and reusable IaC design",
        ],

        relatedTools: [
          "Terraform",
        ],

        relatedSkills: [
          "Infrastructure as Code",
        ],
      }),

      topic({
        name:
          "CI/CD Pipeline Design",

        category:
          "Delivery",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Design gated deployment with safe rollback",
        ],

        expectedEvidence: [
          "Can build reliable deployment pipelines",
        ],

        relatedTools: [
          "GitHub Actions",
          "GitLab CI",
          "Argo CD",
        ],

        relatedSkills: [
          "CI/CD",
        ],
      }),

      topic({
        name:
          "Observability Platform Design",

        category:
          "Observability",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Design logs, metrics, traces, dashboards, and alerts for a platform",
        ],

        expectedEvidence: [
          "Can create actionable telemetry",
        ],

        relatedTools: [
          "Prometheus",
          "Grafana",
          "OpenTelemetry",
        ],

        relatedSkills: [
          "Observability",
        ],
      }),

      topic({
        name:
          "Incident Response and Reliability",

        category:
          "SRE",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Coordinate mitigation during a production outage",
        ],

        expectedEvidence: [
          "Can prioritize mitigation, communication, and postmortem learning",
        ],

        relatedSkills: [
          "Incident Response",
          "SRE",
        ],
      }),

      topic({
        name:
          "Secrets and Supply-Chain Security",

        category:
          "Security",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Rotate leaked credentials and secure CI pipelines",
        ],

        expectedEvidence: [
          "Can manage secrets and reduce CI/CD attack surface",
        ],

        relatedSkills: [
          "Security",
          "DevSecOps",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "DevOps Engineer",

        core: [
          "Linux",
          "Networking",
          "Kubernetes",
          "Terraform",
        ],

        architecture: [
          "CI/CD",
          "Infrastructure as Code",
          "Platform Architecture",
        ],

        debugging: [
          "Observability",
          "Incident Response",
          "Networking",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "DevOps Engineer",

        firstTitle:
          "Broken Kubernetes Rollout",

        firstDescription:
          "A deployment introduces failing pods and partial outage.",

        firstSkills: [
          "Kubernetes",
          "Rollbacks",
          "Observability",
        ],

        secondTitle:
          "Production Incident Coordination",

        secondDescription:
          "Multiple services fail after an infrastructure change.",

        secondSkills: [
          "Incident Response",
          "IaC",
          "Observability",
        ],
      }),

    coreSkills: [
      "Linux",
      "Networking",
      "Git",
      "Scripting",
      "Cloud",
    ],

    roleSkills: [
      "Docker",
      "Kubernetes",
      "Terraform",
      "CI/CD",
      "Observability",
      "Incident Response",
    ],

    tools: [
      "Docker",
      "Kubernetes",
      "Terraform",
      "Prometheus",
      "Grafana",
      "GitHub Actions",
    ],

    knowledgeAreas: [
      "Infrastructure",
      "Networking",
      "Containers",
      "Cloud",
      "SRE",
    ],

    responsibilities: [
      "Automate infrastructure",
      "Operate deployment pipelines",
      "Improve reliability",
      "Respond to production incidents",
    ],

    recommendedProjects: [
      "Kubernetes platform with Terraform, GitOps, monitoring, and safe deployment workflow",
    ],

    tags: [
      "devops",
      "kubernetes",
      "terraform",
      "sre",
    ],
  });

/* =========================================================
   5. CLOUD ENGINEER
========================================================= */

const cloudEngineer =
  makeRole({
    title:
      "Cloud Engineer",

    aliases: [
      "Cloud Infrastructure Engineer",
      "Cloud Platform Engineer",
      "AWS Engineer",
      "Azure Engineer",
    ],

    description:
      "Designs secure, scalable, resilient, and cost-aware cloud infrastructure and platform services.",

    topics: [
      topic({
        name:
          "Cloud Networking Architecture",

        category:
          "Networking",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design private/public network boundaries across multiple environments",
        ],

        expectedEvidence: [
          "Can reason about subnets, routing, NAT, load balancers, and private connectivity",
        ],

        relatedSkills: [
          "Cloud Networking",
        ],
      }),

      topic({
        name:
          "Identity and Access Management",

        category:
          "Security",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design least-privilege access for services and engineers",
        ],

        expectedEvidence: [
          "Can avoid broad permanent credentials",
        ],

        relatedSkills: [
          "IAM",
          "Security",
        ],
      }),

      topic({
        name:
          "High Availability and Disaster Recovery",

        category:
          "Reliability",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Design recovery after regional service failure",
        ],

        expectedEvidence: [
          "Can explain RTO, RPO, replication, and failover",
        ],

        relatedSkills: [
          "Disaster Recovery",
          "Reliability",
        ],
      }),

      topic({
        name:
          "Cloud Cost Optimization",

        category:
          "FinOps",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Reduce cloud spend without harming availability",
        ],

        expectedEvidence: [
          "Can analyze utilization and architecture trade-offs",
        ],

        relatedSkills: [
          "FinOps",
          "Cloud Cost",
        ],
      }),

      topic({
        name:
          "Infrastructure as Code",

        category:
          "Infrastructure",

        level:
          "production",

        importance:
          "critical",

        relatedTools: [
          "Terraform",
          "CloudFormation",
        ],

        practicalScenarios: [
          "Provision repeatable environments with policy and review",
        ],

        expectedEvidence: [
          "Can manage drift, modules, and environment promotion",
        ],

        relatedSkills: [
          "Infrastructure as Code",
        ],
      }),

      topic({
        name:
          "Cloud Observability",

        category:
          "Operations",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Diagnose cross-service latency in cloud workloads",
        ],

        expectedEvidence: [
          "Can use metrics, logs, traces, and cloud-native telemetry",
        ],

        relatedSkills: [
          "Observability",
        ],
      }),

      topic({
        name:
          "Managed Services Architecture",

        category:
          "Architecture",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Choose managed DB, queue, cache, and serverless services appropriately",
        ],

        expectedEvidence: [
          "Can explain operational and vendor trade-offs",
        ],

        relatedSkills: [
          "Cloud Architecture",
        ],
      }),

      topic({
        name:
          "Cloud Security Posture",

        category:
          "Security",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Harden a cloud account after discovering public resources",
        ],

        expectedEvidence: [
          "Can apply least privilege, encryption, logging, and policy controls",
        ],

        relatedSkills: [
          "Cloud Security",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Cloud Engineer",

        core: [
          "Cloud Networking",
          "IAM",
          "IaC",
          "Managed Services",
        ],

        architecture: [
          "High Availability",
          "Disaster Recovery",
          "Cloud Architecture",
        ],

        debugging: [
          "Cloud Observability",
          "Networking",
          "Security",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Cloud Engineer",

        firstTitle:
          "Regional Failure Design",

        firstDescription:
          "A business-critical workload must tolerate a regional outage.",

        firstSkills: [
          "Disaster Recovery",
          "Replication",
          "Cloud Networking",
        ],

        secondTitle:
          "Unexpected Cloud Cost Spike",

        secondDescription:
          "Monthly infrastructure cost doubles without a matching traffic increase.",

        secondSkills: [
          "FinOps",
          "Observability",
          "Architecture",
        ],
      }),

    coreSkills: [
      "Networking",
      "Linux",
      "Security",
      "Scripting",
      "Cloud Fundamentals",
    ],

    roleSkills: [
      "IAM",
      "IaC",
      "High Availability",
      "Disaster Recovery",
      "FinOps",
      "Cloud Security",
    ],

    tools: [
      "AWS",
      "Azure",
      "GCP",
      "Terraform",
      "Docker",
      "Kubernetes",
    ],

    knowledgeAreas: [
      "Cloud architecture",
      "Networking",
      "Security",
      "Reliability",
      "Cost optimization",
    ],

    responsibilities: [
      "Design cloud infrastructure",
      "Secure cloud environments",
      "Improve availability and cost efficiency",
    ],

    recommendedProjects: [
      "Multi-environment cloud platform with Terraform, private networking, monitoring, and DR plan",
    ],

    tags: [
      "cloud",
      "aws",
      "azure",
      "terraform",
    ],
  });

/* =========================================================
   6. CYBERSECURITY ENGINEER
========================================================= */

const cybersecurityEngineer =
  makeRole({
    title:
      "Cybersecurity Engineer",

    aliases: [
      "Security Engineer",
      "Cyber Security Engineer",
      "Information Security Engineer",
    ],

    description:
      "Protects systems, applications, infrastructure, identity, and data through preventive controls, detection, response, and secure engineering.",

    topics: [
      topic({
        name:
          "Threat Modeling",

        category:
          "Security Architecture",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Threat-model a public web application and its dependencies",
        ],

        expectedEvidence: [
          "Can identify assets, trust boundaries, threats, and mitigations",
        ],

        relatedSkills: [
          "Threat Modeling",
        ],
      }),

      topic({
        name:
          "Identity and Access Security",

        category:
          "Identity",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Reduce privilege escalation risk in an enterprise environment",
        ],

        expectedEvidence: [
          "Can design least privilege and strong identity controls",
        ],

        relatedSkills: [
          "IAM",
          "Authentication",
          "Authorization",
        ],
      }),

      topic({
        name:
          "Web Application Security",

        category:
          "Application Security",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Injection",
          "XSS",
          "CSRF",
          "SSRF",
          "Authorization flaws",
          "Secrets",
        ],

        practicalScenarios: [
          "Review an API for high-risk security flaws",
        ],

        expectedEvidence: [
          "Can map weaknesses to concrete mitigations",
        ],

        relatedTools: [
          "Burp Suite",
          "OWASP",
        ],

        relatedSkills: [
          "Application Security",
        ],
      }),

      topic({
        name:
          "Detection Engineering",

        category:
          "Detection",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Create high-signal detections for suspicious authentication behavior",
        ],

        expectedEvidence: [
          "Can balance signal, false positives, and context",
        ],

        relatedTools: [
          "SIEM",
          "Sigma",
        ],

        relatedSkills: [
          "Detection Engineering",
        ],
      }),

      topic({
        name:
          "Incident Response",

        category:
          "Operations",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Contain a compromised endpoint and preserve evidence",
        ],

        expectedEvidence: [
          "Can sequence triage, containment, eradication, and recovery",
        ],

        relatedSkills: [
          "Incident Response",
        ],
      }),

      topic({
        name:
          "Cloud Security Architecture",

        category:
          "Cloud Security",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Harden a cloud account after public exposure is discovered",
        ],

        expectedEvidence: [
          "Can secure IAM, network, storage, and audit controls",
        ],

        relatedSkills: [
          "Cloud Security",
        ],
      }),

      topic({
        name:
          "Vulnerability Management",

        category:
          "Risk",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Prioritize vulnerabilities beyond CVSS alone",
        ],

        expectedEvidence: [
          "Can prioritize using exploitability, exposure, and business impact",
        ],

        relatedSkills: [
          "Vulnerability Management",
        ],
      }),

      topic({
        name:
          "Security Automation",

        category:
          "Automation",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Automate repetitive triage and response workflows safely",
        ],

        expectedEvidence: [
          "Can automate without hiding security context",
        ],

        relatedSkills: [
          "Python",
          "Security Automation",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Cybersecurity Engineer",

        core: [
          "Application Security",
          "IAM",
          "Detection",
          "Incident Response",
        ],

        architecture: [
          "Threat Modeling",
          "Cloud Security",
          "Security Architecture",
        ],

        debugging: [
          "Incident Response",
          "Detection Engineering",
          "Forensics",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Cybersecurity Engineer",

        firstTitle:
          "Compromised Account Investigation",

        firstDescription:
          "A privileged account shows impossible-travel and unusual access patterns.",

        firstSkills: [
          "Detection",
          "IAM",
          "Incident Response",
        ],

        secondTitle:
          "Public Cloud Exposure",

        secondDescription:
          "Sensitive cloud resources are accidentally exposed publicly.",

        secondSkills: [
          "Cloud Security",
          "Threat Modeling",
          "Incident Response",
        ],
      }),

    coreSkills: [
      "Networking",
      "Linux",
      "Security Fundamentals",
      "Scripting",
      "Authentication",
    ],

    roleSkills: [
      "Threat Modeling",
      "Application Security",
      "Detection",
      "Incident Response",
      "Cloud Security",
      "Vulnerability Management",
    ],

    tools: [
      "Burp Suite",
      "SIEM",
      "EDR",
      "Wireshark",
      "Python",
    ],

    knowledgeAreas: [
      "Security architecture",
      "Application security",
      "Detection and response",
      "Cloud security",
    ],

    responsibilities: [
      "Identify and reduce security risk",
      "Build security controls",
      "Investigate incidents",
      "Improve detection and response",
    ],

    recommendedProjects: [
      "Security monitoring lab with detections, response playbooks, and threat-model documentation",
    ],

    tags: [
      "cybersecurity",
      "security",
      "appsec",
      "incident-response",
    ],
  });

/* =========================================================
   7. DATA ANALYST
========================================================= */

const dataAnalyst =
  makeRole({
    title:
      "Data Analyst",

    aliases: [
      "Business Data Analyst",
      "BI Analyst",
      "Analytics Analyst",
    ],

    description:
      "Transforms raw business data into reliable analysis, metrics, dashboards, and decision support.",

    topics: [
      topic({
        name:
          "Advanced SQL Analytics",

        category:
          "SQL",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "Window functions",
          "CTEs",
          "Cohort queries",
          "Conditional aggregation",
        ],

        practicalScenarios: [
          "Build retention and cohort analysis from transactional data",
        ],

        expectedEvidence: [
          "Can write analytical SQL without excessive manual processing",
        ],

        relatedSkills: [
          "SQL",
        ],
      }),

      topic({
        name:
          "Data Quality and Validation",

        category:
          "Data Quality",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Detect metric drift caused by broken source data",
        ],

        expectedEvidence: [
          "Can validate assumptions before presenting insights",
        ],

        relatedSkills: [
          "Data Quality",
        ],
      }),

      topic({
        name:
          "Metric Design",

        category:
          "Analytics",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Define a KPI that cannot be gamed by a single team",
        ],

        expectedEvidence: [
          "Can define numerator, denominator, scope, and edge cases",
        ],

        relatedSkills: [
          "Metrics",
          "Business Analysis",
        ],
      }),

      topic({
        name:
          "Experiment Analysis",

        category:
          "Statistics",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Evaluate whether an A/B test result is practically meaningful",
        ],

        expectedEvidence: [
          "Can discuss significance, power, bias, and effect size",
        ],

        relatedSkills: [
          "Statistics",
          "A/B Testing",
        ],
      }),

      topic({
        name:
          "Dashboard Design for Decisions",

        category:
          "BI",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Redesign a dashboard that shows many charts but does not support decisions",
        ],

        expectedEvidence: [
          "Can prioritize signal, context, and actionability",
        ],

        relatedTools: [
          "Power BI",
          "Tableau",
        ],

        relatedSkills: [
          "Data Visualization",
        ],
      }),

      topic({
        name:
          "Stakeholder Requirements Translation",

        category:
          "Business Analysis",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Turn an ambiguous business question into measurable analysis",
        ],

        expectedEvidence: [
          "Can clarify business intent and define analysis scope",
        ],

        relatedSkills: [
          "Communication",
          "Business Analysis",
        ],
      }),

      topic({
        name:
          "Analytics Reproducibility",

        category:
          "Workflow",

        level:
          "advanced",

        importance:
          "medium",

        practicalScenarios: [
          "Make recurring analysis repeatable and auditable",
        ],

        expectedEvidence: [
          "Can version queries and analysis logic",
        ],

        relatedTools: [
          "Python",
          "Git",
        ],

        relatedSkills: [
          "Analytics Engineering",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Data Analyst",

        core: [
          "SQL",
          "Statistics",
          "Metrics",
          "Visualization",
        ],

        architecture: [
          "Metric Design",
          "Analytics Workflow",
          "BI Design",
        ],

        debugging: [
          "Data Quality",
          "SQL",
          "Experiment Analysis",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Data Analyst",

        firstTitle:
          "KPI Drop Investigation",

        firstDescription:
          "A core business KPI falls sharply with no known product change.",

        firstSkills: [
          "SQL",
          "Data Quality",
          "Metric Design",
        ],

        secondTitle:
          "Conflicting Dashboard Metrics",

        secondDescription:
          "Two dashboards show different revenue numbers for the same period.",

        secondSkills: [
          "Data Validation",
          "Metric Definitions",
          "Stakeholder Communication",
        ],
      }),

    coreSkills: [
      "SQL",
      "Excel",
      "Statistics",
      "Data Visualization",
    ],

    roleSkills: [
      "Metric Design",
      "Experiment Analysis",
      "Data Quality",
      "Business Communication",
    ],

    tools: [
      "SQL",
      "Python",
      "Power BI",
      "Tableau",
      "Excel",
    ],

    knowledgeAreas: [
      "Analytics",
      "Statistics",
      "Business metrics",
      "Visualization",
    ],

    responsibilities: [
      "Analyze business data",
      "Build reliable metrics",
      "Create decision-ready dashboards",
      "Communicate findings",
    ],

    recommendedProjects: [
      "End-to-end business analytics project with SQL, KPI definitions, dashboard, and written recommendations",
    ],

    tags: [
      "data-analyst",
      "sql",
      "analytics",
      "bi",
    ],
  });

/* =========================================================
   8. DATA ENGINEER
========================================================= */

const dataEngineer =
  makeRole({
    title:
      "Data Engineer",

    aliases: [
      "Analytics Engineer",
      "ETL Engineer",
      "Data Platform Engineer",
    ],

    description:
      "Builds reliable data pipelines, storage systems, transformation layers, and data platforms.",

    topics: [
      topic({
        name:
          "Data Modeling for Analytics",

        category:
          "Data Modeling",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Model facts and dimensions for scalable analytics",
        ],

        expectedEvidence: [
          "Can explain grain, facts, dimensions, and slowly changing dimensions",
        ],

        relatedSkills: [
          "Data Modeling",
        ],
      }),

      topic({
        name:
          "Reliable Batch Pipelines",

        category:
          "Pipelines",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Recover a failed daily pipeline without duplicating data",
        ],

        expectedEvidence: [
          "Can design idempotent, restartable pipelines",
        ],

        relatedSkills: [
          "ETL",
          "Data Pipelines",
        ],
      }),

      topic({
        name:
          "Streaming Data Systems",

        category:
          "Streaming",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Process high-volume events with replay and late-arriving data",
        ],

        expectedEvidence: [
          "Can explain offsets, partitions, ordering, and delivery semantics",
        ],

        relatedTools: [
          "Kafka",
        ],

        relatedSkills: [
          "Streaming",
        ],
      }),

      topic({
        name:
          "Data Quality Engineering",

        category:
          "Quality",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Stop bad upstream data from silently corrupting downstream reports",
        ],

        expectedEvidence: [
          "Can implement automated quality checks and contracts",
        ],

        relatedSkills: [
          "Data Quality",
        ],
      }),

      topic({
        name:
          "Warehouse Performance Optimization",

        category:
          "Warehousing",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Reduce warehouse cost and query latency",
        ],

        expectedEvidence: [
          "Can reason about partitioning, clustering, and materialization",
        ],

        relatedTools: [
          "Snowflake",
          "BigQuery",
          "Redshift",
        ],

        relatedSkills: [
          "Data Warehouse",
        ],
      }),

      topic({
        name:
          "Orchestration and Dependency Management",

        category:
          "Orchestration",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Coordinate pipelines with retries, SLAs, and dependencies",
        ],

        expectedEvidence: [
          "Can design observable DAGs and failure recovery",
        ],

        relatedTools: [
          "Airflow",
          "Dagster",
        ],

        relatedSkills: [
          "Orchestration",
        ],
      }),

      topic({
        name:
          "Data Platform Observability",

        category:
          "Operations",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Detect stale or delayed data before consumers report it",
        ],

        expectedEvidence: [
          "Can monitor freshness, volume, schema, and lineage",
        ],

        relatedSkills: [
          "Observability",
          "Data Quality",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Data Engineer",

        core: [
          "SQL",
          "Data Modeling",
          "Pipelines",
          "Warehousing",
        ],

        architecture: [
          "Streaming",
          "Orchestration",
          "Data Platform",
        ],

        debugging: [
          "Data Quality",
          "Pipeline Reliability",
          "Observability",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Data Engineer",

        firstTitle:
          "Duplicate Data After Retry",

        firstDescription:
          "A failed pipeline retry creates duplicate records in downstream tables.",

        firstSkills: [
          "Idempotency",
          "ETL",
          "Data Modeling",
        ],

        secondTitle:
          "Late Data in Streaming Pipeline",

        secondDescription:
          "Events arrive out of order and dashboards become inconsistent.",

        secondSkills: [
          "Streaming",
          "Event Time",
          "Data Quality",
        ],
      }),

    coreSkills: [
      "SQL",
      "Python",
      "Databases",
      "Data Modeling",
    ],

    roleSkills: [
      "ETL",
      "Streaming",
      "Orchestration",
      "Warehousing",
      "Data Quality",
    ],

    tools: [
      "Airflow",
      "Kafka",
      "dbt",
      "Snowflake",
      "BigQuery",
      "Spark",
    ],

    knowledgeAreas: [
      "Data pipelines",
      "Warehousing",
      "Streaming",
      "Data quality",
    ],

    responsibilities: [
      "Build and operate data pipelines",
      "Model analytics data",
      "Improve reliability and observability",
    ],

    recommendedProjects: [
      "Batch + streaming data platform with orchestration, quality checks, lineage, and warehouse modeling",
    ],

    tags: [
      "data-engineer",
      "etl",
      "kafka",
      "warehouse",
    ],
  });

/* =========================================================
   9. DATA SCIENTIST
========================================================= */

const dataScientist =
  makeRole({
    title:
      "Data Scientist",

    aliases: [
      "Applied Data Scientist",
      "Product Data Scientist",
      "Decision Scientist",
    ],

    description:
      "Uses statistics, experimentation, modeling, and domain knowledge to solve business and product problems.",

    topics: [
      topic({
        name:
          "Experimental Design",

        category:
          "Statistics",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design an experiment with limited traffic and multiple success metrics",
        ],

        expectedEvidence: [
          "Can reason about power, bias, and metric choice",
        ],

        relatedSkills: [
          "Statistics",
          "A/B Testing",
        ],
      }),

      topic({
        name:
          "Causal Inference",

        category:
          "Statistics",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Estimate impact when randomized experiments are impossible",
        ],

        expectedEvidence: [
          "Can discuss confounding and identification assumptions",
        ],

        relatedSkills: [
          "Causal Inference",
        ],
      }),

      topic({
        name:
          "Feature Engineering",

        category:
          "Machine Learning",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Build robust features from noisy business data",
        ],

        expectedEvidence: [
          "Can prevent leakage and encode domain knowledge",
        ],

        relatedSkills: [
          "Machine Learning",
          "Feature Engineering",
        ],
      }),

      topic({
        name:
          "Model Evaluation Beyond Accuracy",

        category:
          "Machine Learning",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Choose metrics for an imbalanced fraud model",
        ],

        expectedEvidence: [
          "Can align metrics with decision costs",
        ],

        relatedSkills: [
          "Model Evaluation",
        ],
      }),

      topic({
        name:
          "Model Interpretability",

        category:
          "Machine Learning",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Explain model behavior to stakeholders and identify harmful shortcuts",
        ],

        expectedEvidence: [
          "Can use local/global interpretation appropriately",
        ],

        relatedTools: [
          "SHAP",
        ],

        relatedSkills: [
          "Interpretability",
        ],
      }),

      topic({
        name:
          "Data Leakage and Validation Design",

        category:
          "Machine Learning",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Prevent future information from leaking into training features",
        ],

        expectedEvidence: [
          "Can design temporal and grouped validation correctly",
        ],

        relatedSkills: [
          "Model Validation",
        ],
      }),

      topic({
        name:
          "Communicating Uncertainty",

        category:
          "Communication",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Present an uncertain forecast to executives without overstating confidence",
        ],

        expectedEvidence: [
          "Can communicate assumptions and uncertainty clearly",
        ],

        relatedSkills: [
          "Communication",
          "Statistics",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Data Scientist",

        core: [
          "Statistics",
          "Experimentation",
          "Machine Learning",
          "SQL",
        ],

        architecture: [
          "Validation Design",
          "Feature Engineering",
          "Model Evaluation",
        ],

        debugging: [
          "Data Leakage",
          "Bias",
          "Model Diagnostics",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Data Scientist",

        firstTitle:
          "Imbalanced Fraud Model",

        firstDescription:
          "Accuracy is high but the model misses most fraud cases.",

        firstSkills: [
          "Model Evaluation",
          "Imbalanced Data",
          "Decision Metrics",
        ],

        secondTitle:
          "Experiment Result Disagreement",

        secondDescription:
          "An A/B test is statistically significant but business impact is tiny.",

        secondSkills: [
          "Experimentation",
          "Statistics",
          "Business Judgment",
        ],
      }),

    coreSkills: [
      "Python",
      "SQL",
      "Statistics",
      "Machine Learning",
    ],

    roleSkills: [
      "Experimentation",
      "Causal Inference",
      "Model Evaluation",
      "Feature Engineering",
      "Interpretability",
    ],

    tools: [
      "Python",
      "pandas",
      "scikit-learn",
      "Jupyter",
      "SQL",
    ],

    knowledgeAreas: [
      "Statistics",
      "Experimentation",
      "Machine learning",
      "Business analysis",
    ],

    responsibilities: [
      "Design analyses and experiments",
      "Build and evaluate models",
      "Communicate findings and uncertainty",
    ],

    recommendedProjects: [
      "End-to-end product experiment analysis plus predictive model with leakage-safe validation and business recommendations",
    ],

    tags: [
      "data-science",
      "statistics",
      "machine-learning",
    ],
  });

/* =========================================================
   10. DATABASE ENGINEER
========================================================= */

const databaseEngineer =
  makeRole({
    title:
      "Database Engineer",

    aliases: [
      "Database Administrator",
      "DBA",
      "Database Reliability Engineer",
    ],

    description:
      "Designs, operates, secures, tunes, and recovers database systems for reliable production workloads.",

    topics: [
      topic({
        name:
          "Advanced Index Design",

        category:
          "Performance",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Tune mixed read/write workloads without over-indexing",
        ],

        expectedEvidence: [
          "Can choose composite indexes from query patterns",
        ],

        relatedSkills: [
          "Indexing",
        ],
      }),

      topic({
        name:
          "Query Plan Analysis",

        category:
          "Performance",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Diagnose a query that regresses after data growth",
        ],

        expectedEvidence: [
          "Can interpret execution plans",
        ],

        relatedSkills: [
          "SQL",
          "Query Optimization",
        ],
      }),

      topic({
        name:
          "Replication and High Availability",

        category:
          "Reliability",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Design failover for a critical relational database",
        ],

        expectedEvidence: [
          "Can explain replication lag and failover trade-offs",
        ],

        relatedSkills: [
          "Replication",
          "High Availability",
        ],
      }),

      topic({
        name:
          "Backup and Point-in-Time Recovery",

        category:
          "Recovery",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Recover from accidental destructive data changes",
        ],

        expectedEvidence: [
          "Can design tested backup and restore procedures",
        ],

        relatedSkills: [
          "Backup",
          "Disaster Recovery",
        ],
      }),

      topic({
        name:
          "Transaction Isolation and Locking",

        category:
          "Concurrency",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Investigate deadlocks and blocking transactions",
        ],

        expectedEvidence: [
          "Can tune transaction behavior safely",
        ],

        relatedSkills: [
          "Transactions",
          "Locking",
        ],
      }),

      topic({
        name:
          "Database Capacity Planning",

        category:
          "Operations",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Plan storage, memory, and throughput for 10x growth",
        ],

        expectedEvidence: [
          "Can forecast capacity using workload evidence",
        ],

        relatedSkills: [
          "Capacity Planning",
        ],
      }),

      topic({
        name:
          "Database Security",

        category:
          "Security",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Reduce excessive database privileges and audit access",
        ],

        expectedEvidence: [
          "Can apply least privilege and encryption",
        ],

        relatedSkills: [
          "Database Security",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Database Engineer",

        core: [
          "SQL",
          "Indexes",
          "Transactions",
          "Replication",
        ],

        architecture: [
          "High Availability",
          "Recovery",
          "Capacity Planning",
        ],

        debugging: [
          "Query Plans",
          "Locking",
          "Performance",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Database Engineer",

        firstTitle:
          "Deadlock Incident",

        firstDescription:
          "A production workload begins generating frequent deadlocks.",

        firstSkills: [
          "Transactions",
          "Locking",
          "Query Analysis",
        ],

        secondTitle:
          "Accidental Data Deletion",

        secondDescription:
          "Critical data is deleted and must be recovered with minimal loss.",

        secondSkills: [
          "Backup",
          "PITR",
          "Disaster Recovery",
        ],
      }),

    coreSkills: [
      "SQL",
      "Database Design",
      "Linux",
      "Networking",
    ],

    roleSkills: [
      "Query Optimization",
      "Replication",
      "Backup",
      "Transactions",
      "Database Security",
    ],

    tools: [
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "pg_stat_statements",
    ],

    knowledgeAreas: [
      "Database internals",
      "Performance",
      "Reliability",
      "Recovery",
    ],

    responsibilities: [
      "Operate production databases",
      "Tune performance",
      "Protect data",
      "Plan capacity and recovery",
    ],

    recommendedProjects: [
      "Production database lab with replication, backup/restore, query tuning, and monitoring",
    ],

    tags: [
      "database",
      "dba",
      "sql",
      "postgresql",
    ],
  });

/* =========================================================
   11. MACHINE LEARNING ENGINEER
========================================================= */

const machineLearningEngineer =
  makeRole({
    title:
      "Machine Learning Engineer",

    aliases: [
      "ML Engineer",
      "AI Engineer",
      "Applied ML Engineer",
    ],

    description:
      "Builds, deploys, scales, monitors, and maintains machine-learning systems in production.",

    topics: [
      topic({
        name:
          "Feature Pipelines and Training Data",

        category:
          "Data",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Prevent training-serving skew",
        ],

        expectedEvidence: [
          "Can design consistent feature generation",
        ],

        relatedSkills: [
          "Feature Engineering",
          "Data Pipelines",
        ],
      }),

      topic({
        name:
          "Model Serving Architecture",

        category:
          "Serving",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Serve low-latency predictions under variable traffic",
        ],

        expectedEvidence: [
          "Can explain batching, latency, throughput, and autoscaling trade-offs",
        ],

        relatedSkills: [
          "Model Serving",
        ],
      }),

      topic({
        name:
          "Model Monitoring and Drift",

        category:
          "MLOps",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Detect performance degradation after data distribution changes",
        ],

        expectedEvidence: [
          "Can monitor input, prediction, and outcome drift",
        ],

        relatedSkills: [
          "Model Monitoring",
        ],
      }),

      topic({
        name:
          "Experiment Tracking and Reproducibility",

        category:
          "MLOps",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Reproduce a model trained months earlier",
        ],

        expectedEvidence: [
          "Can version code, data, parameters, and artifacts",
        ],

        relatedTools: [
          "MLflow",
          "Weights & Biases",
        ],

        relatedSkills: [
          "MLOps",
        ],
      }),

      topic({
        name:
          "Inference Optimization",

        category:
          "Performance",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Reduce model latency without unacceptable quality loss",
        ],

        expectedEvidence: [
          "Can reason about quantization, batching, caching, and hardware",
        ],

        relatedSkills: [
          "Inference",
          "Performance",
        ],
      }),

      topic({
        name:
          "ML System Reliability",

        category:
          "Reliability",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Design fallback behavior when the model service is unavailable",
        ],

        expectedEvidence: [
          "Can separate model failure from application failure",
        ],

        relatedSkills: [
          "Reliability",
          "System Design",
        ],
      }),

      topic({
        name:
          "LLM Application Evaluation",

        category:
          "AI Systems",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Evaluate an LLM workflow beyond anecdotal examples",
        ],

        expectedEvidence: [
          "Can design task-specific evaluation and regression tests",
        ],

        relatedSkills: [
          "LLM Evaluation",
          "AI Engineering",
        ],
      }),

      topic({
        name:
          "Retrieval-Augmented Generation Systems",

        category:
          "AI Systems",

        level:
          "advanced",

        importance:
          "medium",

        practicalScenarios: [
          "Improve answer quality while controlling retrieval noise",
        ],

        expectedEvidence: [
          "Can explain chunking, retrieval, reranking, and grounding",
        ],

        relatedSkills: [
          "RAG",
          "Embeddings",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Machine Learning Engineer",

        core: [
          "Machine Learning",
          "Model Serving",
          "Feature Pipelines",
          "MLOps",
        ],

        architecture: [
          "ML Systems",
          "Model Monitoring",
          "Inference Architecture",
        ],

        debugging: [
          "Drift",
          "Serving Latency",
          "Data Quality",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Machine Learning Engineer",

        firstTitle:
          "Training-Serving Skew",

        firstDescription:
          "Offline metrics are strong but production predictions degrade.",

        firstSkills: [
          "Feature Pipelines",
          "Data Validation",
          "Monitoring",
        ],

        secondTitle:
          "Inference Latency Spike",

        secondDescription:
          "Prediction latency rises sharply under traffic growth.",

        secondSkills: [
          "Model Serving",
          "Performance",
          "Autoscaling",
        ],
      }),

    coreSkills: [
      "Python",
      "Machine Learning",
      "Statistics",
      "Data Pipelines",
    ],

    roleSkills: [
      "MLOps",
      "Model Serving",
      "Monitoring",
      "Inference Optimization",
      "AI Systems",
    ],

    tools: [
      "Python",
      "PyTorch",
      "TensorFlow",
      "MLflow",
      "Docker",
      "Kubernetes",
    ],

    knowledgeAreas: [
      "Machine learning systems",
      "MLOps",
      "Model serving",
      "Monitoring",
    ],

    responsibilities: [
      "Deploy and operate ML models",
      "Build training and feature pipelines",
      "Monitor model quality",
    ],

    recommendedProjects: [
      "Production ML service with experiment tracking, model API, monitoring, drift checks, and CI/CD",
    ],

    tags: [
      "ml-engineer",
      "ai-engineer",
      "mlops",
    ],
  });

/* =========================================================
   12. MOBILE DEVELOPER
========================================================= */

const mobileDeveloper =
  makeRole({
    title:
      "Mobile Developer",

    aliases: [
      "Mobile Engineer",
      "iOS Developer",
      "Android Developer",
      "React Native Developer",
      "Flutter Developer",
    ],

    description:
      "Builds performant, reliable, secure, and maintainable mobile applications for production devices.",

    topics: [
      topic({
        name:
          "Mobile Application Architecture",

        category:
          "Architecture",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Separate UI, domain, and data concerns in a growing app",
        ],

        expectedEvidence: [
          "Can explain architecture and testability trade-offs",
        ],

        relatedSkills: [
          "Mobile Architecture",
        ],
      }),

      topic({
        name:
          "Offline-First Data Synchronization",

        category:
          "Data",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Allow users to edit data offline and reconcile conflicts later",
        ],

        expectedEvidence: [
          "Can handle sync conflicts and retries",
        ],

        relatedSkills: [
          "Offline Storage",
          "Synchronization",
        ],
      }),

      topic({
        name:
          "Mobile Performance Profiling",

        category:
          "Performance",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Investigate slow startup and dropped frames",
        ],

        expectedEvidence: [
          "Can profile CPU, memory, rendering, and network behavior",
        ],

        relatedSkills: [
          "Mobile Performance",
        ],
      }),

      topic({
        name:
          "Memory and Resource Management",

        category:
          "Runtime",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Diagnose memory growth and crashes on low-memory devices",
        ],

        expectedEvidence: [
          "Can identify leaks and resource lifecycle problems",
        ],

        relatedSkills: [
          "Memory Management",
        ],
      }),

      topic({
        name:
          "Mobile Security",

        category:
          "Security",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Protect local secrets and sensitive API communication",
        ],

        expectedEvidence: [
          "Can secure storage, transport, and session handling",
        ],

        relatedSkills: [
          "Mobile Security",
        ],
      }),

      topic({
        name:
          "Push Notifications and Background Work",

        category:
          "Platform",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Deliver reliable notifications and background sync under OS constraints",
        ],

        expectedEvidence: [
          "Can explain platform lifecycle limits",
        ],

        relatedSkills: [
          "Push Notifications",
          "Background Tasks",
        ],
      }),

      topic({
        name:
          "Mobile Testing Strategy",

        category:
          "Testing",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Test critical flows across devices and network conditions",
        ],

        expectedEvidence: [
          "Can design unit, integration, and UI test boundaries",
        ],

        relatedSkills: [
          "Testing",
        ],
      }),

      topic({
        name:
          "Release and Crash Monitoring",

        category:
          "Operations",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Detect and mitigate a crash introduced in a new release",
        ],

        expectedEvidence: [
          "Can use staged rollout and crash analytics",
        ],

        relatedTools: [
          "Firebase Crashlytics",
          "Sentry",
        ],

        relatedSkills: [
          "Mobile Operations",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Mobile Developer",

        core: [
          "Mobile Architecture",
          "Performance",
          "Offline Data",
          "Security",
        ],

        architecture: [
          "State Management",
          "Data Synchronization",
          "Platform Lifecycle",
        ],

        debugging: [
          "Memory",
          "Crashes",
          "Network",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Mobile Developer",

        firstTitle:
          "Offline Sync Conflict",

        firstDescription:
          "A user edits the same data on two devices while offline.",

        firstSkills: [
          "Synchronization",
          "Conflict Resolution",
          "Local Storage",
        ],

        secondTitle:
          "Release Crash Regression",

        secondDescription:
          "A new app version increases crash rate on a subset of devices.",

        secondSkills: [
          "Crash Monitoring",
          "Rollout Strategy",
          "Debugging",
        ],
      }),

    coreSkills: [
      "Programming",
      "Mobile UI",
      "Networking",
      "Git",
    ],

    roleSkills: [
      "Mobile Architecture",
      "Offline Data",
      "Performance",
      "Security",
      "Testing",
    ],

    tools: [
      "React Native",
      "Flutter",
      "Swift",
      "Kotlin",
      "Firebase",
    ],

    knowledgeAreas: [
      "Mobile architecture",
      "Device constraints",
      "Performance",
      "Platform lifecycle",
    ],

    responsibilities: [
      "Build mobile features",
      "Improve performance and reliability",
      "Manage releases and crashes",
    ],

    recommendedProjects: [
      "Offline-capable mobile app with secure auth, sync, push notifications, tests, and crash monitoring",
    ],

    tags: [
      "mobile",
      "react-native",
      "flutter",
      "ios",
      "android",
    ],
  });

/* =========================================================
   13. QA ENGINEER
========================================================= */

const qaEngineer =
  makeRole({
    title:
      "QA Engineer",

    aliases: [
      "Quality Assurance Engineer",
      "Software Test Engineer",
      "Automation QA Engineer",
      "SDET",
    ],

    description:
      "Designs test strategy, automation, quality controls, and defect-prevention practices across the software lifecycle.",

    topics: [
      topic({
        name:
          "Risk-Based Test Strategy",

        category:
          "Test Strategy",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Prioritize testing for a high-risk release with limited time",
        ],

        expectedEvidence: [
          "Can prioritize by impact and likelihood",
        ],

        relatedSkills: [
          "Test Strategy",
        ],
      }),

      topic({
        name:
          "API Test Automation",

        category:
          "Automation",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Build regression coverage for a changing REST API",
        ],

        expectedEvidence: [
          "Can validate contracts, data, authorization, and error behavior",
        ],

        relatedTools: [
          "Postman",
          "Playwright",
          "Supertest",
        ],

        relatedSkills: [
          "API Testing",
        ],
      }),

      topic({
        name:
          "UI Automation Architecture",

        category:
          "Automation",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Reduce flaky end-to-end tests",
        ],

        expectedEvidence: [
          "Can design resilient selectors and test boundaries",
        ],

        relatedTools: [
          "Playwright",
          "Cypress",
        ],

        relatedSkills: [
          "UI Automation",
        ],
      }),

      topic({
        name:
          "Performance Testing",

        category:
          "Non-Functional Testing",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Validate system behavior before a major traffic event",
        ],

        expectedEvidence: [
          "Can define workload, thresholds, and bottleneck analysis",
        ],

        relatedTools: [
          "k6",
          "JMeter",
        ],

        relatedSkills: [
          "Performance Testing",
        ],
      }),

      topic({
        name:
          "Contract and Integration Testing",

        category:
          "Integration",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Prevent breaking API changes between teams",
        ],

        expectedEvidence: [
          "Can design service-boundary tests",
        ],

        relatedSkills: [
          "Contract Testing",
          "Integration Testing",
        ],
      }),

      topic({
        name:
          "Test Data Management",

        category:
          "Data",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Create isolated repeatable test data across environments",
        ],

        expectedEvidence: [
          "Can avoid brittle shared fixtures",
        ],

        relatedSkills: [
          "Test Data",
        ],
      }),

      topic({
        name:
          "Quality Observability",

        category:
          "Operations",

        level:
          "production",

        importance:
          "medium",

        practicalScenarios: [
          "Use production signals to improve test coverage",
        ],

        expectedEvidence: [
          "Can connect escaped defects to missing test coverage",
        ],

        relatedSkills: [
          "Quality Engineering",
          "Observability",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "QA Engineer",

        core: [
          "Test Strategy",
          "Automation",
          "API Testing",
          "Integration Testing",
        ],

        architecture: [
          "Automation Architecture",
          "Contract Testing",
          "Test Data",
        ],

        debugging: [
          "Flaky Tests",
          "Performance Testing",
          "Defect Analysis",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "QA Engineer",

        firstTitle:
          "Flaky E2E Suite",

        firstDescription:
          "A large E2E suite fails randomly and blocks releases.",

        firstSkills: [
          "Automation Architecture",
          "Test Isolation",
          "Debugging",
        ],

        secondTitle:
          "High-Risk Release Under Time Pressure",

        secondDescription:
          "A major release must ship with limited testing time.",

        secondSkills: [
          "Risk-Based Testing",
          "Prioritization",
          "Communication",
        ],
      }),

    coreSkills: [
      "Testing Fundamentals",
      "Bug Reporting",
      "API Testing",
      "Git",
    ],

    roleSkills: [
      "Automation",
      "Test Strategy",
      "Performance Testing",
      "Contract Testing",
      "Quality Engineering",
    ],

    tools: [
      "Playwright",
      "Cypress",
      "Postman",
      "k6",
      "Jira",
    ],

    knowledgeAreas: [
      "Test strategy",
      "Automation",
      "Non-functional testing",
      "Quality engineering",
    ],

    responsibilities: [
      "Design test coverage",
      "Automate regression testing",
      "Prevent and analyze defects",
    ],

    recommendedProjects: [
      "Automated quality suite covering API, UI, performance, and contract tests with CI integration",
    ],

    tags: [
      "qa",
      "testing",
      "automation",
      "sdet",
    ],
  });

/* =========================================================
   14. SOFTWARE ENGINEER
========================================================= */

const softwareEngineer =
  makeRole({
    title:
      "Software Engineer",

    aliases: [
      "Software Developer",
      "Application Engineer",
      "Software Development Engineer",
    ],

    description:
      "Designs and maintains production software using sound engineering, architecture, testing, collaboration, and operational practices.",

    topics: [
      topic({
        name:
          "Software Design Principles",

        category:
          "Design",

        level:
          "advanced",

        importance:
          "critical",

        subtopics: [
          "SOLID",
          "Composition",
          "Cohesion",
          "Coupling",
          "Dependency direction",
        ],

        practicalScenarios: [
          "Refactor a tightly coupled feature without breaking behavior",
        ],

        expectedEvidence: [
          "Can improve design without overengineering",
        ],

        relatedSkills: [
          "Software Design",
        ],
      }),

      topic({
        name:
          "Design Patterns in Context",

        category:
          "Design",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Choose a pattern only when the problem justifies it",
        ],

        expectedEvidence: [
          "Can explain trade-offs rather than pattern memorization",
        ],

        relatedSkills: [
          "Design Patterns",
        ],
      }),

      topic({
        name:
          "Testing Architecture",

        category:
          "Testing",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design maintainable tests for a changing codebase",
        ],

        expectedEvidence: [
          "Can choose test boundaries and avoid brittle mocking",
        ],

        relatedSkills: [
          "Testing",
          "Mocking",
        ],
      }),

      topic({
        name:
          "Concurrency and Asynchronous Design",

        category:
          "Concurrency",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Prevent race conditions in asynchronous workflows",
        ],

        expectedEvidence: [
          "Can reason about shared state and synchronization",
        ],

        relatedSkills: [
          "Concurrency",
        ],
      }),

      topic({
        name:
          "Code Review and Maintainability",

        category:
          "Engineering Practice",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Review a change that works but increases long-term maintenance risk",
        ],

        expectedEvidence: [
          "Can give precise actionable review feedback",
        ],

        relatedSkills: [
          "Code Review",
          "Maintainability",
        ],
      }),

      topic({
        name:
          "Observability for Software Engineers",

        category:
          "Production",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Diagnose a failure using logs, metrics, and traces",
        ],

        expectedEvidence: [
          "Can design software for diagnosability",
        ],

        relatedSkills: [
          "Observability",
        ],
      }),

      topic({
        name:
          "System Design Fundamentals",

        category:
          "Architecture",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Design a system that must scale while remaining maintainable",
        ],

        expectedEvidence: [
          "Can discuss boundaries, data, failure, and scaling trade-offs",
        ],

        relatedSkills: [
          "System Design",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "Software Engineer",

        core: [
          "Software Design",
          "Testing",
          "Concurrency",
          "Data Structures",
        ],

        architecture: [
          "System Design",
          "Maintainability",
          "Design Patterns",
        ],

        debugging: [
          "Observability",
          "Debugging",
          "Testing",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "Software Engineer",

        firstTitle:
          "Tightly Coupled Legacy Feature",

        firstDescription:
          "A feature is difficult to change without breaking unrelated code.",

        firstSkills: [
          "Refactoring",
          "Design Principles",
          "Testing",
        ],

        secondTitle:
          "Production Regression",

        secondDescription:
          "A release introduces an intermittent failure that tests did not catch.",

        secondSkills: [
          "Debugging",
          "Observability",
          "Testing Strategy",
        ],
      }),

    coreSkills: [
      "Programming",
      "Data Structures",
      "Algorithms",
      "Git",
      "Testing",
    ],

    roleSkills: [
      "Software Design",
      "Design Patterns",
      "Concurrency",
      "System Design",
      "Code Review",
      "Observability",
    ],

    tools: [
      "Git",
      "CI/CD",
      "Debugger",
      "Profilers",
    ],

    knowledgeAreas: [
      "Software design",
      "Testing",
      "Architecture",
      "Engineering practices",
    ],

    responsibilities: [
      "Design and implement maintainable software",
      "Review code",
      "Test and debug systems",
      "Improve production quality",
    ],

    recommendedProjects: [
      "Production-style application demonstrating modular design, tests, observability, and CI",
    ],

    tags: [
      "software-engineer",
      "architecture",
      "testing",
    ],
  });

/* =========================================================
   15. UI/UX DESIGNER
========================================================= */

const uiUxDesigner =
  makeRole({
    title:
      "UI/UX Designer",

    aliases: [
      "Product Designer",
      "UX Designer",
      "UI Designer",
      "UX/UI Designer",
    ],

    description:
      "Designs usable, accessible, research-informed digital experiences and scalable interface systems.",

    topics: [
      topic({
        name:
          "User Research Synthesis",

        category:
          "Research",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Turn conflicting interview feedback into actionable design insights",
        ],

        expectedEvidence: [
          "Can separate user evidence from assumptions",
        ],

        relatedSkills: [
          "User Research",
        ],
      }),

      topic({
        name:
          "Information Architecture",

        category:
          "UX Architecture",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Restructure a complex product so users can find tasks faster",
        ],

        expectedEvidence: [
          "Can organize content around user mental models",
        ],

        relatedSkills: [
          "Information Architecture",
        ],
      }),

      topic({
        name:
          "Interaction Design",

        category:
          "Interaction",

        level:
          "advanced",

        importance:
          "critical",

        practicalScenarios: [
          "Design clear state transitions for a complex workflow",
        ],

        expectedEvidence: [
          "Can explain interaction states and feedback",
        ],

        relatedSkills: [
          "Interaction Design",
        ],
      }),

      topic({
        name:
          "Design Systems",

        category:
          "Systems",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Create scalable component and token rules across product teams",
        ],

        expectedEvidence: [
          "Can balance consistency with flexibility",
        ],

        relatedTools: [
          "Figma",
          "Storybook",
        ],

        relatedSkills: [
          "Design Systems",
        ],
      }),

      topic({
        name:
          "Accessibility in Product Design",

        category:
          "Accessibility",

        level:
          "production",

        importance:
          "critical",

        practicalScenarios: [
          "Redesign a workflow for keyboard, low-vision, and screen-reader users",
        ],

        expectedEvidence: [
          "Can incorporate accessibility before implementation",
        ],

        relatedSkills: [
          "Accessibility",
        ],
      }),

      topic({
        name:
          "Usability Testing",

        category:
          "Validation",

        level:
          "advanced",

        importance:
          "high",

        practicalScenarios: [
          "Test whether users can complete a critical workflow",
        ],

        expectedEvidence: [
          "Can design tasks and interpret behavioral evidence",
        ],

        relatedSkills: [
          "Usability Testing",
        ],
      }),

      topic({
        name:
          "Product Metrics for Designers",

        category:
          "Product",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Measure whether a redesign actually improves user outcomes",
        ],

        expectedEvidence: [
          "Can connect design changes to measurable behavior",
        ],

        relatedSkills: [
          "Product Metrics",
          "Analytics",
        ],
      }),

      topic({
        name:
          "Design Handoff and Engineering Collaboration",

        category:
          "Collaboration",

        level:
          "production",

        importance:
          "high",

        practicalScenarios: [
          "Resolve conflicts between design intent and implementation constraints",
        ],

        expectedEvidence: [
          "Can communicate behavior, states, and constraints clearly",
        ],

        relatedSkills: [
          "Design Handoff",
          "Collaboration",
        ],
      }),
    ],

    interviewTopics:
      standardInterviewSet({
        role:
          "UI/UX Designer",

        core: [
          "User Research",
          "Interaction Design",
          "Accessibility",
          "Usability",
        ],

        architecture: [
          "Information Architecture",
          "Design Systems",
          "Product Thinking",
        ],

        debugging: [
          "Usability Testing",
          "Accessibility",
          "Product Metrics",
        ],
      }),

    practicalScenarios:
      standardScenarioSet({
        role:
          "UI/UX Designer",

        firstTitle:
          "Low Conversion Checkout",

        firstDescription:
          "Users abandon a multi-step checkout flow at a high rate.",

        firstSkills: [
          "User Research",
          "Interaction Design",
          "Analytics",
        ],

        secondTitle:
          "Conflicting Stakeholder Requests",

        secondDescription:
          "Multiple stakeholders request incompatible changes to a core workflow.",

        secondSkills: [
          "Product Thinking",
          "Research Synthesis",
          "Communication",
        ],
      }),

    coreSkills: [
      "User Research",
      "Wireframing",
      "Prototyping",
      "Visual Design",
      "Figma",
    ],

    roleSkills: [
      "Interaction Design",
      "Information Architecture",
      "Accessibility",
      "Design Systems",
      "Usability Testing",
      "Product Metrics",
    ],

    tools: [
      "Figma",
      "FigJam",
      "Maze",
      "Storybook",
    ],

    knowledgeAreas: [
      "User experience",
      "Interaction design",
      "Research",
      "Accessibility",
      "Design systems",
    ],

    responsibilities: [
      "Research users",
      "Design product flows",
      "Validate usability",
      "Collaborate with engineering",
    ],

    recommendedProjects: [
      "Complete product case study with research, prototype, usability test, accessibility review, and measurable design rationale",
    ],

    tags: [
      "uiux",
      "product-design",
      "ux",
      "design-system",
    ],
  });

/* =========================================================
   ALL 15 IT ROLES
========================================================= */

const IT_ROLES:
  ICareerKnowledgeSeedRole[] = [
    backendDeveloper,
    cloudEngineer,
    cybersecurityEngineer,
    dataAnalyst,
    dataEngineer,
    dataScientist,
    databaseEngineer,
    devOpsEngineer,
    frontendDeveloper,
    fullStackDeveloper,
    machineLearningEngineer,
    mobileDeveloper,
    qaEngineer,
    softwareEngineer,
    uiUxDesigner,
  ];

/* =========================================================
   MAIN SEED
========================================================= */

const seedCareerKnowledgeIT =
  async (): Promise<void> => {
    try {
      console.log(
        "========================================================="
      );

      console.log(
        " InterviewIQ Career Knowledge IT Seed"
      );

      console.log(
        "========================================================="
      );

      console.log({
        roles:
          IT_ROLES.length,

        roleNames:
          IT_ROLES.map(
            (
              item
            ) =>
              item.role.title
          ),
      });

      await mongoose.connect(
        env.MONGO_URI
      );

      console.log(
        "✅ MongoDB connected for Career Knowledge seed."
      );

      let insertedOrUpdated =
        0;

      let failed =
        0;

      const summary:
        Array<{
          role: string;
          topics: number;
          interviewTopics: number;
          practicalScenarios: number;
          advancedOrHigherTopics: number;
        }> = [];

      for (
        const document
        of IT_ROLES
      ) {
        try {
          console.log(
            `Seeding ${document.role.title}...`
          );

          const result =
            await CareerKnowledge
              .findOneAndUpdate(
                {
                  domain:
                    document.domain,

                  "role.slug":
                    document
                      .role
                      .slug,
                },
                {
                  $set:
                    document,
                },
                {
                  upsert:
                    true,

                  returnDocument:
                    "after",

                  runValidators:
                    true,

                  setDefaultsOnInsert:
                    true,
                }
              );

          if (
            !result
          ) {
            throw new Error(
              "MongoDB did not return the seeded document."
            );
          }

          insertedOrUpdated +=
            1;

          const advancedOrHigherTopics =
            result.role
              .topics
              .filter(
                (
                  item
                ) =>
                  [
                    "advanced",
                    "production",
                    "expert",
                  ].includes(
                    item.level
                  )
              )
              .length;

          summary.push({
            role:
              result.role
                .title,

            topics:
              result.role
                .topics
                .length,

            interviewTopics:
              result.role
                .interviewTopics
                .length,

            practicalScenarios:
              result.role
                .practicalScenarios
                .length,

            advancedOrHigherTopics,
          });

          console.log(
            `✅ ${result.role.title}: ${result.role.topics.length} topics`
          );
        } catch (
          error
        ) {
          failed +=
            1;

          console.error(
            `❌ ${document.role.title} failed:`,
            error
          );
        }
      }

      const totalActiveITRoles =
        await CareerKnowledge
          .countDocuments({
            domain:
              "technology",

            status:
              "active",
          });

      console.log(
        ""
      );

      console.log(
        "========================================================="
      );

      console.log(
        " Seed complete"
      );

      console.log(
        "========================================================="
      );

      console.log({
        requestedRoles:
          IT_ROLES.length,

        insertedOrUpdated,

        failed,

        totalActiveITRoles,
      });

      console.table(
        summary
      );

      if (
        totalActiveITRoles <
        15
      ) {
        console.warn(
          `⚠️ Expected at least 15 active IT CareerKnowledge roles, found ${totalActiveITRoles}.`
        );
      } else {
        console.log(
          "✅ 15-role IT Career Knowledge target reached."
        );
      }
    } catch (
      error
    ) {
      console.error(
        "❌ Career Knowledge IT seed failed:",
        error
      );

      process.exitCode =
        1;
    } finally {
      await mongoose.disconnect();

      console.log(
        "MongoDB disconnected."
      );
    }
  };

void seedCareerKnowledgeIT();
