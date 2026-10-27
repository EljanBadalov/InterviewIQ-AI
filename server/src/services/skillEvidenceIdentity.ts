// Shared matching aliases. Scores and weights remain outside this identity module.
/*
 * These are categories / generic concepts, not concrete
 * user skills that should influence job matching.
 *
 * Be careful not to ignore useful skill-like concepts
 * such as architecture/testing/design patterns because
 * interview evidence may legitimately verify them.
 */
const IGNORED_SKILLS =
  new Set<string>([
    "",
    "frontend",
    "front-end",
    "backend",
    "back-end",
    "developer",
    "development",
    "engineering",
    "programming",
    "coding",
    "technical",
    "behavioral",
    "interview",
    "general",
    "web",
    "technology",
    "computer science",
  ]);

/* =========================================================
   NORMALIZATION
========================================================= */

export const normalizeSkillName = (
  value:
    string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
};

const aliases:
    Record<
      string,
      string
    > = {
    javascript:
      "JavaScript",

    js:
      "JavaScript",

    es6:
      "JavaScript",

    "es6+":
      "JavaScript",

    typescript:
      "TypeScript",

    ts:
      "TypeScript",

    react:
      "React",

    reactjs:
      "React",

    "react.js":
      "React",

    next:
      "Next.js",

    nextjs:
      "Next.js",

    "next.js":
      "Next.js",

    node:
      "Node.js",

    nodejs:
      "Node.js",

    "node.js":
      "Node.js",

    express:
      "Express.js",

    expressjs:
      "Express.js",

    "express.js":
      "Express.js",

    mongodb:
      "MongoDB",

    mongo:
      "MongoDB",

    mongoose:
      "Mongoose",

    postgres:
      "PostgreSQL",

    postgresql:
      "PostgreSQL",

    mysql:
      "MySQL",

    sql:
      "SQL",

    redis:
      "Redis",

    html:
      "HTML",

    html5:
      "HTML",

    css:
      "CSS",

    css3:
      "CSS",

    sass:
      "Sass",

    scss:
      "SCSS",

    tailwind:
      "Tailwind CSS",

    "tailwind css":
      "Tailwind CSS",

    bootstrap:
      "Bootstrap",

    python:
      "Python",

    java:
      "Java",

    "c++":
      "C++",

    cpp:
      "C++",

    "c#":
      "C#",

    csharp:
      "C#",

    git:
      "Git",

    github:
      "GitHub",

    docker:
      "Docker",

    kubernetes:
      "Kubernetes",

    k8s:
      "Kubernetes",

    aws:
      "AWS",

    azure:
      "Azure",

    gcp:
      "Google Cloud",

    "google cloud":
      "Google Cloud",

    graphql:
      "GraphQL",

    rest:
      "REST APIs",

    "rest api":
      "REST APIs",

    "rest APIs":
      "REST APIs",

    "restful api":
      "REST APIs",

    "restful APIs":
      "REST APIs",

    jwt:
      "JWT",

    oauth:
      "OAuth",

    oauth2:
      "OAuth",

    prisma:
      "Prisma",

    firebase:
      "Firebase",

    supabase:
      "Supabase",

    tensorflow:
      "TensorFlow",

    pytorch:
      "PyTorch",

    pandas:
      "Pandas",

    numpy:
      "NumPy",

    jest:
      "Jest",

    vitest:
      "Vitest",

    cypress:
      "Cypress",

    playwright:
      "Playwright",

    vite:
      "Vite",

    webpack:
      "Webpack",

    cicd:
      "CI/CD",

    "ci/cd":
      "CI/CD",

    githubactions:
      "GitHub Actions",

    "github actions":
      "GitHub Actions",

    oop:
      "Object-Oriented Programming",

    "object oriented programming":
      "Object-Oriented Programming",

    "object-oriented programming":
      "Object-Oriented Programming",

    dsa:
      "Data Structures & Algorithms",

    "data structures":
      "Data Structures & Algorithms",

    algorithms:
      "Data Structures & Algorithms",

    "design-patterns":
      "Design Patterns",

    "design patterns":
      "Design Patterns",

    "dependency-injection":
      "Dependency Injection",

    "dependency injection":
      "Dependency Injection",

    architecture:
      "Software Architecture",

    "software-engineering":
      "Software Engineering",

    "solid-principles":
      "SOLID Principles",

    "solid principles":
      "SOLID Principles",

    testing:
      "Testing",

    mocking:
      "Mocking",

    integration:
      "Integration Testing",

    "integration testing":
      "Integration Testing",

    "composition-over-inheritance":
      "Composition Over Inheritance",

    "composition over inheritance":
      "Composition Over Inheritance",
  };

export const getDisplaySkillName = (
  value:
    string
): string => {
  const trimmed =
    value.trim();

  const normalized =
    normalizeSkillName(
      trimmed
    );


  return (
    Object.hasOwn(aliases, normalized) ? aliases[normalized] : trimmed
  );
};

export const getCanonicalSkillName = (
  value:
    string
): string => {
  return normalizeSkillName(
    getDisplaySkillName(
      value
    )
  );
};

export const isUsableSkill = (
  value:
    string
): boolean => {
  const normalized =
    getCanonicalSkillName(
      value
    );

  return (
    Boolean(
      normalized
    ) &&
    !IGNORED_SKILLS.has(
      normalized
    ) &&
    /[a-zA-Z0-9+#./]/.test(
      value
    )
  );
};
