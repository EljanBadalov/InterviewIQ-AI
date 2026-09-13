import {
  Types,
} from "mongoose";

import {
  ResumeAnalysis,
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  UserSkillProfile,
  type IUserSkill,
  type SkillEvidenceSource,
  type SkillLevel,
} from "../models/UserSkillProfile";

/* =========================================================
   TYPES
========================================================= */

export type CareerSkillConfidenceLabel =
  | "low"
  | "medium"
  | "high"
  | "very-high";

export interface ICareerSkillProfileItem {
  name: string;

  normalizedName: string;

  /*
   * 0..100 strength score used for career/job matching.
   *
   * IMPORTANT:
   * This is NOT the CV ATS score, overall score,
   * content score, structure score or skills section score.
   */
  skillScore: number;

  /*
   * 0..1 confidence that InterviewIQ has enough evidence
   * to trust this skill for career matching.
   */
  confidence: number;

  confidenceLabel:
    CareerSkillConfidenceLabel;

  level: SkillLevel;

  evidenceCount: number;

  sources:
    SkillEvidenceSource[];

  interviewVerified: boolean;

  presentInResume: boolean;

  resumeAnalysisId?: string;

  latestEvidenceAt?: Date;
}

export interface ICareerSkillProfile {
  userId: string;

  resumeAnalysisId?: string;

  resumeFileName?: string;

  skills:
    ICareerSkillProfileItem[];

  strongestSkills:
    ICareerSkillProfileItem[];

  verifiedSkills:
    ICareerSkillProfileItem[];

  resumeSkills:
    ICareerSkillProfileItem[];

  totalSkills: number;

  generatedAt: Date;
}

interface BuildCareerSkillProfileParams {
  userId:
    | Types.ObjectId
    | string;

  /*
   * CareerAutomation.activeResumeId may not always be a
   * ResumeAnalysis._id. We try it first and gracefully
   * fall back to the user's latest ResumeAnalysis.
   */
  resumeAnalysisId?:
    | Types.ObjectId
    | string;

  strongestSkillLimit?:
    number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const RESUME_ONLY_SCORE =
  68;

const RESUME_ONLY_CONFIDENCE =
  0.62;

const TECHNICAL_SOURCE:
  SkillEvidenceSource =
    "technical-question";

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

const normalizeSkillName = (
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

const getDisplaySkillName = (
  value:
    string
): string => {
  const trimmed =
    value.trim();

  const normalized =
    normalizeSkillName(
      trimmed
    );

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

  return (
    aliases[
      normalized
    ] ??
    trimmed
  );
};

const getCanonicalSkillName = (
  value:
    string
): string => {
  return normalizeSkillName(
    getDisplaySkillName(
      value
    )
  );
};

const isUsableSkill = (
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

/* =========================================================
   BASIC HELPERS
========================================================= */

const clamp = (
  value:
    number,
  min:
    number,
  max:
    number
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const roundScore = (
  value:
    number
): number => {
  return Math.round(
    clamp(
      value,
      0,
      100
    )
  );
};

const getConfidenceLabel = (
  confidence:
    number
): CareerSkillConfidenceLabel => {
  if (
    confidence >=
    0.9
  ) {
    return "very-high";
  }

  if (
    confidence >=
    0.72
  ) {
    return "high";
  }

  if (
    confidence >=
    0.5
  ) {
    return "medium";
  }

  return "low";
};

const levelRank:
  Record<
    SkillLevel,
    number
  > = {
    beginner:
      1,

    intermediate:
      2,

    advanced:
      3,

    expert:
      4,
  };

const getStrongerLevel = (
  first:
    SkillLevel,
  second:
    SkillLevel
): SkillLevel => {
  return (
    levelRank[
      first
    ] >=
    levelRank[
      second
    ]
      ? first
      : second
  );
};

/* =========================================================
   INTERVIEW VERIFICATION
========================================================= */

const isInterviewSkillVerified = (
  skill:
    IUserSkill
): boolean => {
  const scores =
    skill.evidence
      .filter(
        (
          evidence
        ) =>
          evidence.source ===
            TECHNICAL_SOURCE &&
          typeof evidence.score ===
            "number"
      )
      .map(
        (
          evidence
        ) =>
          evidence.score as number
      );

  if (
    scores.length ===
    0
  ) {
    return false;
  }

  /*
   * Strong single evidence.
   */
  if (
    scores.some(
      (
        score
      ) =>
        score >=
        90
    )
  ) {
    return true;
  }

  /*
   * Or repeated good technical evidence.
   */
  if (
    scores.length <
    2
  ) {
    return false;
  }

  const average =
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
    scores.length;

  return (
    average >=
    80
  );
};

/* =========================================================
   PLATFORM SKILL SCORE
========================================================= */

const getPlatformSkillScore = (
  skill:
    IUserSkill
): number => {
  const scored =
    skill.evidence.filter(
      (
        evidence
      ) =>
        typeof evidence.score ===
        "number"
    );

  if (
    scored.length >
    0
  ) {
    const weighted =
      scored.map(
        (
          evidence
        ) => {
          const weight =
            evidence.source ===
              "technical-question"
              ? 1
              : evidence.source ===
                  "mock-interview"
                ? 0.9
                : evidence.source ===
                    "project"
                  ? 0.85
                  : evidence.source ===
                      "quiz"
                    ? 0.8
                    : evidence.source ===
                        "resume"
                      ? 0.7
                      : 0.65;

          return {
            score:
              evidence.score as number,

            weight,
          };
        }
      );

    const numerator =
      weighted.reduce(
        (
          total,
          item
        ) =>
          total +
          item.score *
            item.weight,
        0
      );

    const denominator =
      weighted.reduce(
        (
          total,
          item
        ) =>
          total +
          item.weight,
        0
      );

    if (
      denominator >
      0
    ) {
      return roundScore(
        numerator /
        denominator
      );
    }
  }

  if (
    skill.confidence >
    0
  ) {
    return roundScore(
      55 +
      skill.confidence *
        35
    );
  }

  return 55;
};

/* =========================================================
   RESUME SELECTION
========================================================= */

/*
 * Important fix:
 *
 * CareerAutomation.activeResumeId is not guaranteed to be
 * ResumeAnalysis._id.
 *
 * Old behavior:
 *   activeResumeId exists
 *   -> search only by _id
 *   -> not found
 *   -> resume = null
 *   -> no CV skills
 *
 * New behavior:
 *   1. Try requested ResumeAnalysis._id
 *   2. If not found, fall back to latest ResumeAnalysis
 *   3. If no id was provided, use latest ResumeAnalysis
 */
const getResumeAnalysis =
  async (
    userId:
      Types.ObjectId,
    resumeAnalysisId?:
      | Types.ObjectId
      | string
  ): Promise<
    IResumeAnalysis |
    null
  > => {
    if (
      resumeAnalysisId
    ) {
      const rawId =
        resumeAnalysisId
          .toString();

      if (
        Types.ObjectId.isValid(
          rawId
        )
      ) {
        const requestedResume =
          await ResumeAnalysis.findOne({
            _id:
              new Types.ObjectId(
                rawId
              ),

            user:
              userId,
          }).lean();

        if (
          requestedResume
        ) {
          console.log(
            "[CAREER PROFILE] Active ResumeAnalysis selected:",
            {
              analysisId:
                requestedResume
                  ._id
                  ?.toString(),

              fileName:
                requestedResume
                  .fileName,

              skillsDetected:
                requestedResume
                  .skillsDetected,
            }
          );

          return requestedResume;
        }

        console.warn(
          "[CAREER PROFILE] activeResumeId did not match a ResumeAnalysis. Falling back to latest analysis.",
          {
            activeResumeId:
              rawId,
          }
        );
      } else {
        console.warn(
          "[CAREER PROFILE] activeResumeId is not a valid ObjectId. Falling back to latest ResumeAnalysis.",
          {
            activeResumeId:
              rawId,
          }
        );
      }
    }

    const latestResume =
      await ResumeAnalysis.findOne({
        user:
          userId,
      })
        .sort({
          createdAt:
            -1,
        })
        .lean();

    if (
      latestResume
    ) {
      console.log(
        "[CAREER PROFILE] Latest ResumeAnalysis selected:",
        {
          analysisId:
            latestResume
              ._id
              ?.toString(),

          fileName:
            latestResume
              .fileName,

          skillsDetected:
            latestResume
              .skillsDetected,
        }
      );
    } else {
      console.warn(
        "[CAREER PROFILE] No ResumeAnalysis found for user."
      );
    }

    return latestResume;
  };

/* =========================================================
   MERGE PLATFORM SKILL
========================================================= */

const addPlatformSkillToProfile = (
  merged:
    Map<
      string,
      ICareerSkillProfileItem
    >,
  skill:
    IUserSkill
): void => {
  if (
    !isUsableSkill(
      skill.name
    )
  ) {
    return;
  }

  const displayName =
    getDisplaySkillName(
      skill.name
    );

  const normalizedName =
    getCanonicalSkillName(
      displayName
    );

  const interviewVerified =
    isInterviewSkillVerified(
      skill
    );

  const latestEvidenceAt =
    skill.evidence
      .map(
        (
          evidence
        ) =>
          new Date(
            evidence.recordedAt
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.getTime() -
          a.getTime()
      )[0];

  merged.set(
    normalizedName,
    {
      name:
        displayName,

      normalizedName,

      skillScore:
        getPlatformSkillScore(
          skill
        ),

      confidence:
        clamp(
          skill.confidence,
          0,
          1
        ),

      confidenceLabel:
        getConfidenceLabel(
          skill.confidence
        ),

      level:
        skill.level,

      evidenceCount:
        skill.evidenceCount,

      sources: [
        ...new Set(
          skill.sources
        ),
      ],

      interviewVerified,

      presentInResume:
        skill.sources.includes(
          "resume"
        ),

      latestEvidenceAt,
    }
  );
};

/* =========================================================
   MERGE RESUME SKILL
========================================================= */

const addResumeSkillToProfile = (
  merged:
    Map<
      string,
      ICareerSkillProfileItem
    >,
  rawSkill:
    string,
  resume:
    IResumeAnalysis
): void => {
  if (
    !isUsableSkill(
      rawSkill
    )
  ) {
    return;
  }

  const displayName =
    getDisplaySkillName(
      rawSkill
    );

  const normalizedName =
    getCanonicalSkillName(
      displayName
    );

  const existing =
    merged.get(
      normalizedName
    );

  if (
    existing
  ) {
    const sources =
      new Set<
        SkillEvidenceSource
      >(
        existing.sources
      );

    sources.add(
      "resume"
    );

    /*
     * Resume confirms presence of the skill.
     * It raises confidence slightly, but NEVER uses:
     *
     * - overallScore
     * - atsScore
     * - structureScore
     * - contentScore
     * - skillsScore
     * - experienceScore
     */
    const improvedConfidence =
      clamp(
        Math.max(
          existing.confidence,
          RESUME_ONLY_CONFIDENCE
        ) +
        (
          existing
            .interviewVerified
            ? 0.04
            : 0.02
        ),
        0,
        1
      );

    existing.sources = [
      ...sources,
    ];

    existing.presentInResume =
      true;

    existing.resumeAnalysisId =
      resume
        ._id
        ?.toString();

    existing.confidence =
      Number(
        improvedConfidence.toFixed(
          2
        )
      );

    existing.confidenceLabel =
      getConfidenceLabel(
        existing.confidence
      );

    /*
     * Resume evidence may provide a minimum floor,
     * but can never lower a verified platform skill.
     */
    existing.skillScore =
      Math.max(
        existing.skillScore,
        RESUME_ONLY_SCORE
      );

    existing.level =
      getStrongerLevel(
        existing.level,
        "beginner"
      );

    /*
     * The resume is additional evidence if it was not
     * already represented in UserSkillProfile.
     */
    if (
      !existing.sources.includes(
        "resume"
      )
    ) {
      existing.evidenceCount +=
        1;
    }

    merged.set(
      normalizedName,
      existing
    );

    return;
  }

  merged.set(
    normalizedName,
    {
      name:
        displayName,

      normalizedName,

      skillScore:
        RESUME_ONLY_SCORE,

      confidence:
        RESUME_ONLY_CONFIDENCE,

      confidenceLabel:
        getConfidenceLabel(
          RESUME_ONLY_CONFIDENCE
        ),

      level:
        "beginner",

      evidenceCount:
        1,

      sources: [
        "resume",
      ],

      interviewVerified:
        false,

      presentInResume:
        true,

      resumeAnalysisId:
        resume
          ._id
          ?.toString(),

      latestEvidenceAt:
        resume.createdAt,
    }
  );
};

/* =========================================================
   BUILD CAREER SKILL PROFILE
========================================================= */

export const buildCareerSkillProfile =
  async ({
    userId,
    resumeAnalysisId,
    strongestSkillLimit =
      10,
  }: BuildCareerSkillProfileParams): Promise<ICareerSkillProfile> => {
    const rawUserId =
      userId.toString();

    if (
      !Types.ObjectId.isValid(
        rawUserId
      )
    ) {
      throw new Error(
        "A valid user ID is required."
      );
    }

    const userObjectId =
      new Types.ObjectId(
        rawUserId
      );

    const [
      resume,
      platformProfile,
    ] =
      await Promise.all([
        getResumeAnalysis(
          userObjectId,
          resumeAnalysisId
        ),

        UserSkillProfile.findOne({
          user:
            userObjectId,
        }).lean(),
      ]);

    const merged =
      new Map<
        string,
        ICareerSkillProfileItem
      >();

    /* =====================================================
       1. PLATFORM / INTERVIEW / PROJECT / QUIZ EVIDENCE
    ===================================================== */

    for (
      const rawSkill of
      platformProfile
        ?.skills ??
      []
    ) {
      addPlatformSkillToProfile(
        merged,
        rawSkill as IUserSkill
      );
    }

    /* =====================================================
       2. CV SKILLS

       IMPORTANT:
       We only use skillsDetected.
       CV quality scores NEVER affect job matching.
    ===================================================== */

    const resumeSkills =
      (
        resume
          ?.skillsDetected ??
        []
      )
        .filter(
          (
            skill
          ): skill is string =>
            typeof skill ===
              "string" &&
            Boolean(
              skill.trim()
            )
        );

    if (
      resume
    ) {
      for (
        const rawSkill of
        resumeSkills
      ) {
        addResumeSkillToProfile(
          merged,
          rawSkill,
          resume
        );
      }
    }

    /* =====================================================
       3. FINAL RANKING
    ===================================================== */

    const skills =
      [
        ...merged.values(),
      ]
        .sort(
          (
            a,
            b
          ) => {
            /*
             * Interview-verified skills first.
             */
            if (
              a.interviewVerified !==
              b.interviewVerified
            ) {
              return a
                .interviewVerified
                ? -1
                : 1;
            }

            /*
             * Strongest evidence score next.
             */
            if (
              b.skillScore !==
              a.skillScore
            ) {
              return (
                b.skillScore -
                a.skillScore
              );
            }

            /*
             * Then confidence.
             */
            if (
              b.confidence !==
              a.confidence
            ) {
              return (
                b.confidence -
                a.confidence
              );
            }

            return (
              b.evidenceCount -
              a.evidenceCount
            );
          }
        );

    const strongestSkills =
      skills.slice(
        0,
        Math.max(
          1,
          strongestSkillLimit
        )
      );

    const profile:
      ICareerSkillProfile = {
      userId:
        rawUserId,

      resumeAnalysisId:
        resume
          ?._id
          ?.toString(),

      resumeFileName:
        resume
          ?.fileName,

      skills,

      strongestSkills,

      verifiedSkills:
        skills.filter(
          (
            skill
          ) =>
            skill
              .interviewVerified
        ),

      resumeSkills:
        skills.filter(
          (
            skill
          ) =>
            skill
              .presentInResume
        ),

      totalSkills:
        skills.length,

      generatedAt:
        new Date(),
    };

    /* =====================================================
       DEBUG
    ===================================================== */

    console.log(
      "[CAREER PROFILE] Unified profile built:",
      {
        resumeAnalysisId:
          profile
            .resumeAnalysisId,

        resumeFileName:
          profile
            .resumeFileName,

        totalSkills:
          profile
            .totalSkills,

        resumeSkills:
          profile
            .resumeSkills
            .map(
              (
                skill
              ) =>
                skill.name
            ),

        verifiedSkills:
          profile
            .verifiedSkills
            .map(
              (
                skill
              ) =>
                skill.name
            ),

        strongestSkills:
          profile
            .strongestSkills
            .map(
              (
                skill
              ) => ({
                name:
                  skill.name,

                score:
                  skill.skillScore,

                confidence:
                  skill.confidence,

                sources:
                  skill.sources,

                verified:
                  skill
                    .interviewVerified,
              })
            ),
      }
    );

    return profile;
  };

/* =========================================================
   LIGHTWEIGHT HELPERS
========================================================= */

export const getCareerSkillNames =
  (
    profile:
      ICareerSkillProfile
  ): string[] => {
    return profile.skills.map(
      (
        skill
      ) =>
        skill.name
    );
  };

export const getCareerSkillMap =
  (
    profile:
      ICareerSkillProfile
  ): Map<
    string,
    ICareerSkillProfileItem
  > => {
    return new Map(
      profile.skills.map(
        (
          skill
        ) => [
          skill.normalizedName,
          skill,
        ]
      )
    );
  };

export default {
  buildCareerSkillProfile,
  getCareerSkillNames,
  getCareerSkillMap,
};
