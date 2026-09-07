import mongoose, {
  type Types,
} from "mongoose";

import {
  UserSkillProfile,
  type IUserSkill,
  type SkillEvidenceSource,
  type SkillLevel,
} from "../models/UserSkillProfile";

/* =========================================
   TYPES
========================================= */

interface RecordInterviewSkillEvidenceParams {
  userId: Types.ObjectId;
  interviewId: Types.ObjectId;
  questionId: Types.ObjectId;
  questionTags: string[];
  score: number;
  technicalAccuracy?: number;
  interviewType: string;
  category?: string;
}

interface SkillVerificationResult {
  name: string;
  normalizedName: string;
  averageScore: number;
  confidence: number;
  evidenceCount: number;
  level: SkillLevel;
  verified: boolean;
}

/* =========================================
   CONSTANTS
========================================= */

const MIN_ACCEPTED_SCORE = 80;

const STRONG_SINGLE_EVIDENCE_SCORE =
  90;

const MIN_TECHNICAL_ACCURACY =
  80;

const MIN_MULTI_EVIDENCE_COUNT =
  2;

const MIN_MULTI_EVIDENCE_AVERAGE =
  80;

const INTERVIEW_SOURCE: SkillEvidenceSource =
  "technical-question";

/* =========================================
   NON-SKILL TAGS
========================================= */

/*
  These values may exist in the question
  dataset, but they should NOT become CV
  skills.
*/
const IGNORED_TAGS =
  new Set<string>([
    "",

    /* difficulty */
    "beginner",
    "intermediate",
    "advanced",
    "senior",

    /* interview metadata */
    "technical",
    "behavioral",
    "interview",
    "question",
    "general",

    /* platform categories */
    "frontend",
    "front-end",
    "frontend-development",
    "frontend development",

    "backend",
    "back-end",
    "backend-development",
    "backend development",

    "software-engineering",
    "software engineering",
    "software-development",
    "software development",

    "devops",
    "dev-ops",

    "ui-ux-design",
    "ui ux design",
    "ui/ux",
    "ui/ux design",

    "machine-learning",
    "machine learning category",

    /* generic concepts */
    "programming",
    "coding",
    "development",
    "developer",
    "engineering",
    "technology",
    "computer-science",
    "computer science",
    "web-development",
    "web development",
    "web",
    "application",
    "applications",
    "system",
    "systems",

    /* vague tags */
    "concept",
    "concepts",
    "fundamentals",
    "basics",
    "best-practices",
    "best practices",
    "problem-solving",
    "problem solving",
  ]);

/* =========================================
   NORMALIZATION
========================================= */

const normalizeSkillName = (
  value: string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
};

const getDisplaySkillName = (
  value: string
): string => {
  const trimmed =
    value.trim();

  const normalized =
    normalizeSkillName(trimmed);

  const aliases: Record<
    string,
    string
  > = {
    /* JavaScript */
    javascript: "JavaScript",
    js: "JavaScript",
    "es6": "JavaScript",
    "es6+": "JavaScript",

    /* TypeScript */
    typescript: "TypeScript",
    ts: "TypeScript",

    /* React */
    react: "React",
    reactjs: "React",
    "react.js": "React",

    /* Next */
    next: "Next.js",
    nextjs: "Next.js",
    "next.js": "Next.js",

    /* Node */
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",

    /* Express */
    express: "Express.js",
    expressjs: "Express.js",
    "express.js": "Express.js",

    /* Databases */
    mongodb: "MongoDB",
    mongo: "MongoDB",

    mongoose: "Mongoose",

    postgres: "PostgreSQL",
    postgresql: "PostgreSQL",

    mysql: "MySQL",

    sql: "SQL",

    redis: "Redis",

    /* Web */
    html: "HTML",
    html5: "HTML5",

    css: "CSS",
    css3: "CSS3",

    sass: "Sass",
    scss: "SCSS",

    tailwind: "Tailwind CSS",
    "tailwind css":
      "Tailwind CSS",

    bootstrap: "Bootstrap",

    /* Languages */
    python: "Python",
    java: "Java",
    "c++": "C++",
    cpp: "C++",
    "c#": "C#",
    csharp: "C#",

    /* Version control */
    git: "Git",
    github: "GitHub",

    /* Infrastructure */
    docker: "Docker",

    kubernetes:
      "Kubernetes",
    k8s: "Kubernetes",

    aws: "AWS",
    azure: "Azure",

    gcp: "Google Cloud",
    "google cloud":
      "Google Cloud",

    /* APIs */
    rest: "REST APIs",
    "rest api": "REST APIs",
    "rest APIs": "REST APIs",
    "restful api":
      "REST APIs",
    "restful APIs":
      "REST APIs",

    graphql: "GraphQL",

    /* Auth */
    jwt: "JWT",
    oauth: "OAuth",
    oauth2: "OAuth",

    /* ORMs / services */
    prisma: "Prisma",

    firebase: "Firebase",
    supabase: "Supabase",

    /* AI / ML */
    ml:
      "Machine Learning",

    "machine learning":
      "Machine Learning",

    ai:
      "Artificial Intelligence",

    "artificial intelligence":
      "Artificial Intelligence",

    tensorflow:
      "TensorFlow",

    pytorch:
      "PyTorch",

    sklearn:
      "scikit-learn",

    "scikit learn":
      "scikit-learn",

    "scikit-learn":
      "scikit-learn",

    pandas:
      "Pandas",

    numpy:
      "NumPy",

    /* Testing */
    jest: "Jest",

    vitest:
      "Vitest",

    cypress:
      "Cypress",

    playwright:
      "Playwright",

    /* Build tools */
    vite: "Vite",
    webpack: "Webpack",

    /* Backend concepts */
    "jwt authentication":
      "JWT Authentication",

    authentication:
      "Authentication",

    authorization:
      "Authorization",

    middleware:
      "Middleware",

    /* CS topics that may be CV-relevant */
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

    /* DevOps */
    cicd:
      "CI/CD",

    "ci/cd":
      "CI/CD",

    githubactions:
      "GitHub Actions",

    "github actions":
      "GitHub Actions",
  };

  return (
    aliases[normalized] ??
    trimmed
  );
};

const getCanonicalNormalizedName = (
  value: string
): string => {
  return normalizeSkillName(
    getDisplaySkillName(value)
  );
};

/* =========================================
   SKILL VALIDATION
========================================= */

const isIgnoredSkillTag = (
  value: string
): boolean => {
  const rawNormalized =
    normalizeSkillName(value);

  const canonicalNormalized =
    getCanonicalNormalizedName(
      value
    );

  return (
    IGNORED_TAGS.has(
      rawNormalized
    ) ||
    IGNORED_TAGS.has(
      canonicalNormalized
    )
  );
};

/*
  Avoid very weak / meaningless tags.

  We do NOT use a strict whitelist because
  future question datasets may contain new
  technologies that are valid skills.
*/
const looksLikeRealSkill = (
  value: string
): boolean => {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return false;
  }

  if (
    isIgnoredSkillTag(
      trimmed
    )
  ) {
    return false;
  }

  /*
    Reject tags that are only punctuation.
  */
  if (
    !/[a-zA-Z0-9+#./]/.test(
      trimmed
    )
  ) {
    return false;
  }

  return true;
};

/* =========================================
   SCORE HELPERS
========================================= */

const calculateAverage = (
  scores: number[]
): number => {
  if (
    scores.length === 0
  ) {
    return 0;
  }

  return Math.round(
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
      scores.length
  );
};

const calculateConfidence = (
  averageScore: number,
  evidenceCount: number
): number => {
  if (
    averageScore <= 0 ||
    evidenceCount <= 0
  ) {
    return 0;
  }

  const scoreFactor =
    Math.min(
      averageScore / 100,
      1
    );

  /*
    More independent evidence means
    stronger confidence.
  */
  const evidenceFactor =
    Math.min(
      0.65 +
        Math.max(
          evidenceCount - 1,
          0
        ) *
          0.12,
      1
    );

  return Number(
    (
      scoreFactor *
      evidenceFactor
    ).toFixed(2)
  );
};

const calculateLevel = (
  averageScore: number,
  evidenceCount: number
): SkillLevel => {
  if (
    averageScore >= 92 &&
    evidenceCount >= 3
  ) {
    return "expert";
  }

  if (
    averageScore >= 86 &&
    evidenceCount >= 2
  ) {
    return "advanced";
  }

  if (
    averageScore >= 80
  ) {
    return "intermediate";
  }

  return "beginner";
};

/* =========================================
   VERIFIED INTERVIEW SKILL
========================================= */

export const isInterviewSkillVerified =
  (
    skill: Pick<
      IUserSkill,
      | "averageScore"
      | "evidenceCount"
      | "evidence"
    >
  ): boolean => {
    const scores =
      skill.evidence
        .filter(
          (evidence) =>
            evidence.source ===
              INTERVIEW_SOURCE &&
            typeof evidence.score ===
              "number"
        )
        .map(
          (evidence) =>
            evidence.score as number
        );

    if (
      scores.length === 0
    ) {
      return false;
    }

    const average =
      calculateAverage(
        scores
      );

    const strongSingleEvidence =
      scores.some(
        (score) =>
          score >=
          STRONG_SINGLE_EVIDENCE_SCORE
      );

    const repeatedEvidence =
      scores.length >=
        MIN_MULTI_EVIDENCE_COUNT &&
      average >=
        MIN_MULTI_EVIDENCE_AVERAGE;

    return (
      strongSingleEvidence ||
      repeatedEvidence
    );
  };

/* =========================================
   QUESTION TAG → SKILL TAG
========================================= */

const getUniqueSkillTags = (
  tags: string[]
): string[] => {
  const uniqueSkills =
    new Map<
      string,
      string
    >();

  for (
    const rawTag of tags
  ) {
    if (
      typeof rawTag !==
      "string"
    ) {
      continue;
    }

    const trimmed =
      rawTag.trim();

    if (
      !looksLikeRealSkill(
        trimmed
      )
    ) {
      continue;
    }

    const displayName =
      getDisplaySkillName(
        trimmed
      );

    const normalizedName =
      getCanonicalNormalizedName(
        displayName
      );

    if (
      !normalizedName ||
      isIgnoredSkillTag(
        normalizedName
      )
    ) {
      continue;
    }

    if (
      !uniqueSkills.has(
        normalizedName
      )
    ) {
      uniqueSkills.set(
        normalizedName,
        displayName
      );
    }
  }

  return [
    ...uniqueSkills.values(),
  ];
};

/* =========================================
   RECALCULATE SKILL
========================================= */

const recalculateSkill = (
  skill: IUserSkill
): void => {
  const scores =
    skill.evidence
      .map(
        (evidence) =>
          evidence.score
      )
      .filter(
        (
          score
        ): score is number =>
          typeof score ===
          "number"
      );

  skill.evidenceCount =
    skill.evidence.length;

  skill.averageScore =
    calculateAverage(
      scores
    );

  skill.confidence =
    calculateConfidence(
      skill.averageScore,
      skill.evidenceCount
    );

  skill.level =
    calculateLevel(
      skill.averageScore,
      skill.evidenceCount
    );

  skill.sources = [
    ...new Set(
      skill.evidence.map(
        (evidence) =>
          evidence.source
      )
    ),
  ];

  skill.lastEvaluatedAt =
    new Date();
};

/* =========================================
   RECORD INTERVIEW SKILL EVIDENCE
========================================= */

export const recordInterviewSkillEvidence =
  async ({
    userId,
    interviewId,
    questionId,
    questionTags,
    score,
    technicalAccuracy,
    interviewType,
    category,
  }: RecordInterviewSkillEvidenceParams): Promise<
    SkillVerificationResult[]
  > => {
    /* -------------------------------------
       Only technical interviews
    ------------------------------------- */

    if (
      interviewType !==
      "technical"
    ) {
      return [];
    }

    /* -------------------------------------
       Overall answer threshold
    ------------------------------------- */

    if (
      typeof score !==
        "number" ||
      score <
        MIN_ACCEPTED_SCORE
    ) {
      return [];
    }

    /* -------------------------------------
       Technical accuracy threshold
    ------------------------------------- */

    if (
      typeof technicalAccuracy ===
        "number" &&
      technicalAccuracy <
        MIN_TECHNICAL_ACCURACY
    ) {
      return [];
    }

    /* -------------------------------------
       Extract valid skills
    ------------------------------------- */

    const skillTags =
      getUniqueSkillTags(
        questionTags
      );

    if (
      skillTags.length === 0
    ) {
      return [];
    }

    /* -------------------------------------
       Load / create skill profile
    ------------------------------------- */

    let profile =
      await UserSkillProfile.findOne(
        {
          user: userId,
        }
      );

    if (!profile) {
      profile =
        await UserSkillProfile.create(
          {
            user: userId,

            skills: [],

            totalEvidenceCount:
              0,
          }
        );
    }

    /* -------------------------------------
       Add evidence
    ------------------------------------- */

    for (
      const skillName of
      skillTags
    ) {
      const displayName =
        getDisplaySkillName(
          skillName
        );

      const normalizedName =
        getCanonicalNormalizedName(
          displayName
        );

      /*
        Safety check in case a category
        somehow reaches this point.
      */
      if (
        isIgnoredSkillTag(
          normalizedName
        )
      ) {
        continue;
      }

      let skill =
        profile.skills.find(
          (item) =>
            item.normalizedName ===
            normalizedName
        );

      if (!skill) {
        skill = {
          name:
            displayName,

          normalizedName,

          confidence: 0,

          level:
            "beginner",

          evidenceCount: 0,

          averageScore: 0,

          sources: [],

          evidence: [],

          lastEvaluatedAt:
            new Date(),
        };

        profile.skills.push(
          skill
        );
      }

      /* -----------------------------------
         Duplicate prevention
      ----------------------------------- */

      const alreadyRecorded =
        skill.evidence.some(
          (item) =>
            item.source ===
              INTERVIEW_SOURCE &&
            Boolean(
              item.sourceId
            ) &&
            String(
              item.sourceId
            ) ===
              String(
                questionId
              )
        );

      if (
        alreadyRecorded
      ) {
        continue;
      }

      /* -----------------------------------
         Evidence
      ----------------------------------- */

      skill.evidence.push({
        source:
          INTERVIEW_SOURCE,

        sourceId:
          new mongoose.Types.ObjectId(
            String(
              questionId
            )
          ),

        score,

        note: [
          `Interview ${String(
            interviewId
          )}`,

          category
            ? `Category: ${category}`
            : null,

          typeof technicalAccuracy ===
          "number"
            ? `Technical accuracy: ${technicalAccuracy}`
            : null,
        ]
          .filter(
            (
              value
            ): value is string =>
              typeof value ===
                "string"
          )
          .join(
            " | "
          ),

        recordedAt:
          new Date(),
      });

      recalculateSkill(
        skill
      );
    }

    /* -------------------------------------
       Profile totals
    ------------------------------------- */

    profile.totalEvidenceCount =
      profile.skills.reduce(
        (
          total,
          skill
        ) =>
          total +
          skill.evidence.length,
        0
      );

    profile.markModified(
      "skills"
    );

    await profile.save();

    /* -------------------------------------
       Return verified interview skills only
    ------------------------------------- */

    return profile.skills
      .filter(
        (skill) =>
          !isIgnoredSkillTag(
            skill.normalizedName
          )
      )
      .filter(
        (skill) =>
          isInterviewSkillVerified(
            skill
          )
      )
      .map(
        (skill) => ({
          name:
            skill.name,

          normalizedName:
            skill.normalizedName,

          averageScore:
            skill.averageScore,

          confidence:
            skill.confidence,

          evidenceCount:
            skill.evidenceCount,

          level:
            skill.level,

          verified:
            true,
        })
      );
  };