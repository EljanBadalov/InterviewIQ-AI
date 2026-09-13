import {
  resolveResumeContext,
  type ICareerResumeContext,
} from "./careerContextService";

import {
  getCareerJobMatches,
  type ICareerJobMatchingResult,
} from "./careerJobContextService";

import {
  resolveCareerInterviewContext,
  type ICareerInterviewContext,
} from "./careerInterviewContextService";

import {
  buildCareerProgressContext,
  type ICareerProgressContext,
} from "./careerProgressService";

import {
  generateQwenJSON,
} from "./qwenService";

import {
  buildCareerSkillProfile,
  type ICareerSkillProfile,
} from "./careerSkillProfileService";

import {
  buildCareerKnowledgeContext,
  type ICareerKnowledgeContext,
  type ICareerKnowledgeTopicMatch,
} from "./careerKnowledgeService";

import type {
  CareerRoadmapCategory,
  CareerRoadmapGeneratedBy,
  CareerRoadmapInsightSource,
  CareerRoadmapPriority,
} from "../models/CareerAutomation";

/* =========================================================
   TYPES
========================================================= */

export type CareerGoalReadinessLevel =
  | "very_high"
  | "high"
  | "moderate"
  | "developing"
  | "early";

export type CareerGoalStatus =
  | "well_aligned"
  | "realistic_with_improvements"
  | "needs_development"
  | "insufficient_data";

export type CareerGoalPriority =
  | "high"
  | "medium"
  | "low";

export interface ICareerGoalGap {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  priority:
    CareerGoalPriority;

  title: string;

  description: string;

  reason: string;

  score?: number;
}

export interface ICareerGoalStrength {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  title: string;

  description: string;

  score?: number;
}

export interface ICareerGoalRoadmapRecommendation {
  title: string;

  whyItMatters: string;

  whatToLearn: string[];

  action: string;

  proofOfCompletion?: string;

  priority:
    CareerRoadmapPriority;

  source:
    CareerRoadmapInsightSource;

  evidence?: string[];
}

export interface ICareerGoalMilestone {
  order: number;

  category:
    CareerRoadmapCategory;

  title: string;

  description: string;

  reason: string;

  readinessScore?: number;

  completed: boolean;

  relatedSkills: string[];

  recommendations:
    ICareerGoalRoadmapRecommendation[];

  generatedBy:
    CareerRoadmapGeneratedBy;
}

export interface ICareerGoalContext {
  targetRole?: string;

  careerGoal?: string;

  readinessScore: number;

  readinessLevel:
    CareerGoalReadinessLevel;

  status:
    CareerGoalStatus;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;

  careerKnowledge?:
    ICareerKnowledgeContext;

  strengths:
    ICareerGoalStrength[];

  gaps:
    ICareerGoalGap[];

  milestones:
    ICareerGoalMilestone[];

  summary: string;
}

export interface ICareerGoalResult {
  found: boolean;

  data?:
    ICareerGoalContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "TARGET_ROLE_REQUIRED"
    | "NO_CAREER_DATA";
}

export interface ICareerGoalInput {
  userId?: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value:
    | string
    | undefined
    | null
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized ||
    undefined;
};

const clamp = (
  value: number,
  min = 0,
  max = 100
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const round = (
  value: number
): number => {
  return Math.round(
    value
  );
};

const uniqueStrings = (
  values: string[]
): string[] => {
  return Array.from(
    new Set(
      values
        .map(
          (
            value
          ) =>
            value.trim()
        )
        .filter(
          Boolean
        )
    )
  );
};

/* =========================================================
   READINESS LEVEL
========================================================= */

const getReadinessLevel = (
  score: number
): CareerGoalReadinessLevel => {
  if (
    score >= 90
  ) {
    return "very_high";
  }

  if (
    score >= 80
  ) {
    return "high";
  }

  if (
    score >= 65
  ) {
    return "moderate";
  }

  if (
    score >= 50
  ) {
    return "developing";
  }

  return "early";
};

/* =========================================================
   GOAL STATUS
========================================================= */

const getGoalStatus = (
  score: number,
  hasData: boolean
): CareerGoalStatus => {
  if (
    !hasData
  ) {
    return "insufficient_data";
  }

  if (
    score >= 80
  ) {
    return "well_aligned";
  }

  if (
    score >= 60
  ) {
    return "realistic_with_improvements";
  }

  return "needs_development";
};

/* =========================================================
   RESUME READINESS
========================================================= */

const calculateResumeReadiness = (
  resume?: ICareerResumeContext
): number | undefined => {
  if (
    !resume
  ) {
    return undefined;
  }

  const score =
    (
      resume.overallScore *
        0.25
    ) +
    (
      resume.atsScore *
        0.20
    ) +
    (
      resume.skillsScore *
        0.20
    ) +
    (
      resume.experienceScore *
        0.20
    ) +
    (
      resume.contentScore *
        0.10
    ) +
    (
      resume.structureScore *
        0.05
    );

  return round(
    clamp(
      score
    )
  );
};

/* =========================================================
   JOB READINESS
========================================================= */

const calculateJobReadiness = (
  jobMatches?:
    ICareerJobMatchingResult
): number | undefined => {
  if (
    !jobMatches?.found ||
    !jobMatches.bestMatch
  ) {
    return undefined;
  }

  return round(
    clamp(
      jobMatches
        .bestMatch
        .match
        .matchScore
    )
  );
};

/* =========================================================
   INTERVIEW READINESS
========================================================= */

const calculateInterviewReadiness = (
  interview?:
    ICareerInterviewContext
): number | undefined => {
  if (
    !interview
  ) {
    return undefined;
  }

  const values:
    number[] = [];

  if (
    typeof interview.overallScore ===
    "number"
  ) {
    values.push(
      interview.overallScore
    );
  }

  if (
    typeof interview
      .averageTechnicalAccuracy ===
    "number"
  ) {
    values.push(
      interview
        .averageTechnicalAccuracy
    );
  }

  if (
    typeof interview
      .averageCompleteness ===
    "number"
  ) {
    values.push(
      interview
        .averageCompleteness
    );
  }

  if (
    typeof interview
      .averageCommunication ===
    "number"
  ) {
    values.push(
      interview
        .averageCommunication
    );
  }

  if (
    values.length ===
    0
  ) {
    return undefined;
  }

  const average =
    values.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
    values.length;

  return round(
    clamp(
      average
    )
  );
};

/* =========================================================
   PROGRESS READINESS ADJUSTMENT
========================================================= */

const calculateProgressAdjustment = (
  progress?:
    ICareerProgressContext
): number => {
  if (
    !progress
  ) {
    return 0;
  }

  let adjustment =
    0;

  const metrics = [
    progress.resume
      .overallScore,

    progress.resume
      .atsScore,

    progress.resume
      .skillsScore,

    progress.interview
      .overallScore,

    progress.interview
      .technicalAccuracy,

    progress.interview
      .communication,
  ];

  for (
    const metric
    of metrics
  ) {
    if (
      metric.direction ===
      "improved"
    ) {
      adjustment +=
        1;
    }

    if (
      metric.direction ===
      "declined"
    ) {
      adjustment -=
        1;
    }
  }

  return clamp(
    adjustment,
    -5,
    5
  );
};

/* =========================================================
   TOTAL READINESS SCORE
========================================================= */

const calculateReadinessScore = ({
  resume,
  jobMatches,
  interview,
  progress,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;
}): number => {
  const resumeScore =
    calculateResumeReadiness(
      resume
    );

  const jobScore =
    calculateJobReadiness(
      jobMatches
    );

  const interviewScore =
    calculateInterviewReadiness(
      interview
    );

  const weightedValues: Array<{
    score: number;
    weight: number;
  }> = [];

  if (
    typeof resumeScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        resumeScore,

      weight:
        0.35,
    });
  }

  if (
    typeof jobScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        jobScore,

      weight:
        0.40,
    });
  }

  if (
    typeof interviewScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        interviewScore,

      weight:
        0.25,
    });
  }

  if (
    weightedValues.length ===
    0
  ) {
    return 0;
  }

  const totalWeight =
    weightedValues.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.weight,
      0
    );

  const weightedScore =
    weightedValues.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          item.score *
          item.weight
        ),
      0
    ) /
    totalWeight;

  const progressAdjustment =
    calculateProgressAdjustment(
      progress
    );

  return round(
    clamp(
      weightedScore +
        progressAdjustment
    )
  );
};

/* =========================================================
   BUILD STRENGTHS
========================================================= */

const buildGoalStrengths = ({
  resume,
  jobMatches,
  interview,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;
}): ICareerGoalStrength[] => {
  const strengths:
    ICareerGoalStrength[] = [];

  /* =====================================================
     CV
  ===================================================== */

  if (
    resume
  ) {
    if (
      resume.experienceScore >=
      75
    ) {
      strengths.push({
        category:
          "CV",

        title:
          "Relevant experience profile",

        description:
          `Your experience score is ${resume.experienceScore}/100, which supports your target role readiness.`,

        score:
          resume.experienceScore,
      });
    }

    if (
      resume.skillsScore >=
      70
    ) {
      strengths.push({
        category:
          "SKILL",

        title:
          "Solid technical skill base",

        description:
          `Your current CV skills score is ${resume.skillsScore}/100.`,

        score:
          resume.skillsScore,
      });
    }

    if (
      resume.skillsDetected
        .length >
      0
    ) {
      strengths.push({
        category:
          "SKILL",

        title:
          "Detected technical skills",

        description:
          `Your CV currently highlights ${resume.skillsDetected
            .slice(
              0,
              6
            )
            .join(
              ", "
            )}.`,
      });
    }
  }

  /* =====================================================
     JOB MATCH
  ===================================================== */

  if (
    jobMatches?.bestMatch
  ) {
    const best =
      jobMatches.bestMatch;

    if (
      best.match.matchScore >=
      75
    ) {
      strengths.push({
        category:
          "JOB",

        title:
          "Strong job-market alignment",

        description:
          `Your strongest active match is ${best.title} at ${best.company} with a ${best.match.matchScore}% match.`,

        score:
          best.match
            .matchScore,
      });
    }

    if (
      best.match
        .matchedSkills
        .length >
      0
    ) {
      strengths.push({
        category:
          "JOB",

        title:
          "Skills already aligned with jobs",

        description:
          `Your strongest job match recognizes skills including ${best.match.matchedSkills
            .slice(
              0,
              5
            )
            .join(
              ", "
            )}.`,
      });
    }
  }

  /* =====================================================
     INTERVIEW
  ===================================================== */

  if (
    interview
  ) {
    if (
      typeof interview
        .overallScore ===
        "number" &&
      interview.overallScore >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong interview performance",

        description:
          `Your latest completed interview score is ${interview.overallScore}/100.`,

        score:
          interview.overallScore,
      });
    }

    if (
      typeof interview
        .averageCommunication ===
        "number" &&
      interview
        .averageCommunication >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong communication",

        description:
          `Your average interview communication score is ${interview.averageCommunication}/100.`,

        score:
          interview
            .averageCommunication,
      });
    }

    if (
      typeof interview
        .averageTechnicalAccuracy ===
        "number" &&
      interview
        .averageTechnicalAccuracy >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong technical interview accuracy",

        description:
          `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100.`,

        score:
          interview
            .averageTechnicalAccuracy,
      });
    }
  }

  return strengths.slice(
    0,
    8
  );
};

/* =========================================================
   BUILD GAPS
========================================================= */

const buildGoalGaps = ({
  resume,
  jobMatches,
  interview,
  progress,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;
}): ICareerGoalGap[] => {
  const gaps:
    ICareerGoalGap[] = [];

  /* =====================================================
     CV ATS
  ===================================================== */

  if (
    resume &&
    resume.atsScore <
    70
  ) {
    gaps.push({
      category:
        "CV",

      priority:
        resume.atsScore <
        60
          ? "high"
          : "medium",

      title:
        "ATS readiness needs improvement",

      description:
        `Your current ATS score is ${resume.atsScore}/100.`,

      reason:
        "Improving ATS alignment can make your CV more competitive for target-role applications.",

      score:
        resume.atsScore,
    });
  }

  /* =====================================================
     CV STRUCTURE
  ===================================================== */

  if (
    resume &&
    resume.structureScore <
    70
  ) {
    gaps.push({
      category:
        "CV",

      priority:
        "medium",

      title:
        "CV structure can be stronger",

      description:
        `Your current CV structure score is ${resume.structureScore}/100.`,

      reason:
        "Better structure improves readability and ATS compatibility.",

      score:
        resume.structureScore,
    });
  }

  /* =====================================================
     RESUME MISSING SKILLS
  ===================================================== */

  if (
    resume &&
    resume.missingSkills.length >
      0
  ) {
    gaps.push({
      category:
        "SKILL",

      priority:
        "high",

      title:
        "Close CV skill gaps",

      description:
        `Your CV analysis identified these possible missing skills: ${resume.missingSkills
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "Skill gaps can reduce job matching quality.",
    });
  }

  /* =====================================================
     JOB MISSING SKILLS
  ===================================================== */

  if (
    jobMatches?.bestMatch &&
    jobMatches
      .bestMatch
      .match
      .missingSkills
      .length >
      0
  ) {
    const missing =
      uniqueStrings(
        jobMatches
          .bestMatch
          .match
          .missingSkills
      );

    gaps.push({
      category:
        "JOB",

      priority:
        "high",

      title:
        "Close target-job skill gaps",

      description:
        `For your strongest current job match, focus on ${missing
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "These skills are relevant to the job but are not strongly represented in your current CV.",
    });
  }

  /* =====================================================
     JOB IMPROVEMENT AREAS
  ===================================================== */

  if (
    jobMatches?.bestMatch &&
    jobMatches
      .bestMatch
      .match
      .improvementAreas
      .length >
      0
  ) {
    gaps.push({
      category:
        "JOB",

      priority:
        "medium",

      title:
        "Improve target-job alignment",

      description:
        jobMatches
          .bestMatch
          .match
          .improvementAreas[0],

      reason:
        "Improving this area can increase your compatibility with similar roles.",
    });
  }

  /* =====================================================
     INTERVIEW TECHNICAL
  ===================================================== */

  if (
    interview &&
    typeof interview
      .averageTechnicalAccuracy ===
      "number" &&
    interview
      .averageTechnicalAccuracy <
      75
  ) {
    gaps.push({
      category:
        "INTERVIEW",

      priority:
        "high",

      title:
        "Improve technical interview accuracy",

      description:
        `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100.`,

      reason:
        "Technical accuracy is important for reaching your target role.",

      score:
        interview
          .averageTechnicalAccuracy,
    });
  }

  /* =====================================================
     INTERVIEW COMMUNICATION
  ===================================================== */

  if (
    interview &&
    typeof interview
      .averageCommunication ===
      "number" &&
    interview
      .averageCommunication <
      75
  ) {
    gaps.push({
      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Improve interview communication",

      description:
        `Your average communication score is ${interview.averageCommunication}/100.`,

      reason:
        "Clear communication helps turn technical knowledge into stronger interview performance.",

      score:
        interview
          .averageCommunication,
    });
  }

  /* =====================================================
     PROGRESS
  ===================================================== */

  if (
    progress
  ) {
    if (
      progress.resume
        .atsScore
        .direction ===
        "declined" &&
      typeof progress.resume
        .atsScore
        .change ===
        "number"
    ) {
      gaps.push({
        category:
          "PROGRESS",

        priority:
          Math.abs(
            progress.resume
              .atsScore
              .change
          ) >= 15
            ? "high"
            : "medium",

        title:
          "Reverse the recent ATS decline",

        description:
          `Your ATS score decreased by ${Math.abs(
            progress.resume
              .atsScore
              .change
          )} points between your last two CV analyses.`,

        reason:
          "This negative trend could reduce application effectiveness.",

        score:
          progress.resume
            .atsScore
            .current,
      });
    }
  }

  const priorityWeight = (
    priority:
      CareerGoalPriority
  ): number => {
    switch (priority) {
      case "high":
        return 3;

      case "medium":
        return 2;

      case "low":
        return 1;

      default:
        return 0;
    }
  };

  return gaps
    .sort(
      (
        a,
        b
      ) =>
        priorityWeight(
          b.priority
        ) -
        priorityWeight(
          a.priority
        )
    )
    .slice(
      0,
      8
    );
};

/* =========================================================
   PERSONALIZED ROADMAP TYPES
========================================================= */

interface IRoadmapSectionSeed {
  category:
    CareerRoadmapCategory;

  readinessScore?:
    number;

  completed:
    boolean;

  relatedSkills:
    string[];

  evidence:
    string[];

  source:
    CareerRoadmapInsightSource;
}

interface IQwenRoadmapRecommendation {
  title?: unknown;

  whyItMatters?: unknown;

  whatToLearn?: unknown;

  action?: unknown;

  proofOfCompletion?: unknown;

  priority?: unknown;

  source?: unknown;

  evidence?: unknown;
}

interface IQwenRoadmapMilestone {
  category?: unknown;

  title?: unknown;

  description?: unknown;

  reason?: unknown;

  recommendations?: unknown;
}

interface IQwenRoadmapOutput {
  milestones?: unknown;
}

/* =========================================================
   PERSONALIZED ROADMAP HELPERS
========================================================= */

const ROADMAP_CATEGORIES =
  new Set<
    CareerRoadmapCategory
  >([
    "CORE_SKILLS",
    "ROLE_SKILLS",
    "PROJECTS",
    "CV",
    "INTERVIEW",
    "JOB_SEARCH",
  ]);

const ROADMAP_PRIORITIES =
  new Set<
    CareerRoadmapPriority
  >([
    "high",
    "medium",
    "low",
  ]);

const ROADMAP_SOURCES =
  new Set<
    CareerRoadmapInsightSource
  >([
    "resume",
    "resume_analysis",
    "job_market",
    "interview",
    "progress",
    "career_profile",
    "combined",
  ]);

const asString = (
  value:
    unknown
): string => {
  return typeof value ===
    "string"
    ? value
        .replace(
          /\s+/g,
          " "
        )
        .trim()
    : "";
};

const asStringArray = (
  value:
    unknown,
  limit =
    8
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return uniqueStrings(
    value
      .map(
        asString
      )
      .filter(
        Boolean
      )
  ).slice(
    0,
    limit
  );
};

const normalizeRoadmapPriority = (
  value:
    unknown,
  fallback:
    CareerRoadmapPriority =
      "medium"
): CareerRoadmapPriority => {
  const normalized =
    asString(
      value
    ) as
      CareerRoadmapPriority;

  return ROADMAP_PRIORITIES.has(
    normalized
  )
    ? normalized
    : fallback;
};

const normalizeRoadmapSource = (
  value:
    unknown,
  fallback:
    CareerRoadmapInsightSource
): CareerRoadmapInsightSource => {
  const normalized =
    asString(
      value
    ) as
      CareerRoadmapInsightSource;

  return ROADMAP_SOURCES.has(
    normalized
  )
    ? normalized
    : fallback;
};

const getRoadmapPriorityFromReadiness = (
  readinessScore?:
    number
): CareerRoadmapPriority => {
  if (
    typeof readinessScore !==
    "number"
  ) {
    return "medium";
  }

  if (
    readinessScore <
    60
  ) {
    return "high";
  }

  if (
    readinessScore <
    78
  ) {
    return "medium";
  }

  return "low";
};

const getCategoryLabel = (
  category:
    CareerRoadmapCategory
): string => {
  switch (
    category
  ) {
    case "CORE_SKILLS":
      return "technical foundation";

    case "ROLE_SKILLS":
      return "target-role skills";

    case "PROJECTS":
      return "portfolio evidence";

    case "CV":
      return "CV and application evidence";

    case "INTERVIEW":
      return "interview readiness";

    case "JOB_SEARCH":
      return "job-search execution";

    default:
      return "career readiness";
  }
};

const getAverage = (
  values:
    Array<
      number |
      undefined
    >
): number | undefined => {
  const valid =
    values.filter(
      (
        value
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(
          value
        )
    );

  if (
    valid.length ===
    0
  ) {
    return undefined;
  }

  return round(
    valid.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    valid.length
  );
};

const topicMatchReadiness = (
  item:
    ICareerKnowledgeTopicMatch
): number => {
  if (
    typeof item.readinessScore ===
    "number"
  ) {
    return clamp(
      item.readinessScore
    );
  }

  switch (
    item.status
  ) {
    case "weak":
      return 30;

    case "developing":
      return 55;

    case "strong":
      return 85;

    case "missing":
    case "unknown":
    default:
      return 20;
  }
};

const averageTopicReadiness = (
  items:
    ICareerKnowledgeTopicMatch[]
): number | undefined => {
  if (
    items.length ===
    0
  ) {
    return undefined;
  }

  return round(
    items.reduce(
      (
        total,
        item
      ) =>
        total +
        topicMatchReadiness(
          item
        ),
      0
    ) /
    items.length
  );
};

const roadmapKnowledgeEvidence = (
  items:
    ICareerKnowledgeTopicMatch[],
  limit =
    6
): string[] => {
  return items
    .slice(
      0,
      limit
    )
    .map(
      (
        item
      ) => {
        const readiness =
          typeof item.readinessScore ===
            "number"
            ? ` Current evidence: ${item.readinessScore}/100.`
            : " No strong user evidence was found yet.";

        return `${item.topic.name} (${item.topic.level}, ${item.topic.importance}). ${item.reason}${readiness}`;
      }
    );
};

const splitKnowledgeTopics = (
  careerKnowledge?:
    ICareerKnowledgeContext
): {
  core:
    ICareerKnowledgeTopicMatch[];

  role:
    ICareerKnowledgeTopicMatch[];
} => {
  if (
    !careerKnowledge?.found
  ) {
    return {
      core:
        [],

      role:
        [],
    };
  }

  const coreKeys =
    new Set(
      careerKnowledge
        .coreSkills
        .map(
          (
            item
          ) =>
            item
              .toLowerCase()
              .trim()
        )
    );

  const priority =
    careerKnowledge
      .priorityTopics;

  const core =
    priority.filter(
      (
        item
      ) => {
        const candidates =
          uniqueStrings([
            item.topic.name,
            ...item.topic.relatedSkills,
            ...item.topic.prerequisites,
          ])
            .map(
              (
                value
              ) =>
                value
                  .toLowerCase()
                  .trim()
            );

        return candidates.some(
          (
            candidate
          ) =>
            coreKeys.has(
              candidate
            )
        );
      }
    );

  /*
   * If the curated role has no direct name overlap between coreSkills and
   * topics, use the highest-priority foundational/advanced role topics.
   * This still comes from the target-role knowledge base, never from
   * unrelated CV skills.
   */
  const resolvedCore =
    core.length >
      0
      ? core
      : priority.slice(
          0,
          Math.min(
            4,
            priority.length
          )
        );

  const coreIds =
    new Set(
      resolvedCore.map(
        (
          item
        ) =>
          item.topic.id
      )
    );

  const role =
    priority.filter(
      (
        item
      ) =>
        !coreIds.has(
          item.topic.id
        )
    );

  return {
    core:
      resolvedCore,

    role,
  };
};

const buildRoadmapSectionSeeds = ({
  targetRole,
  careerGoal,
  resume,
  jobMatches,
  interview,
  gaps,
  careerKnowledge,
}: {
  targetRole:
    string;

  careerGoal?:
    string;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  gaps:
    ICareerGoalGap[];

  careerKnowledge?:
    ICareerKnowledgeContext;
}): IRoadmapSectionSeed[] => {
  const seeds:
    IRoadmapSectionSeed[] =
      [];

  const bestMatch =
    jobMatches
      ?.bestMatch;

  const jobMissingSkills =
    uniqueStrings(
      bestMatch
        ?.match
        .missingSkills ||
      []
    );

  const matchedSkills =
    uniqueStrings(
      bestMatch
        ?.match
        .matchedSkills ||
      []
    );

  const knowledgeSplit =
    splitKnowledgeTopics(
      careerKnowledge
    );

  const knowledgePriorityTopics =
    careerKnowledge
      ?.priorityTopics ||
    [];

  const roleKnowledgeAvailable =
    Boolean(
      careerKnowledge?.found &&
      careerKnowledge
        .resolvedRole
    );

  /*
   * =====================================================
   * CORE SKILLS — ROLE FIRST
   * =====================================================
   *
   * The selected target role defines the skill universe.
   * A frontend-heavy CV must never turn a Backend Developer roadmap into
   * HTML/CSS/Responsive Design training.
   */
  if (
    roleKnowledgeAvailable &&
    knowledgeSplit
      .core
      .length >
      0
  ) {
    const readiness =
      averageTopicReadiness(
        knowledgeSplit.core
      );

    seeds.push({
      category:
        "CORE_SKILLS",

      readinessScore:
        readiness,

      completed:
        knowledgeSplit
          .core
          .every(
            (
              item
            ) =>
              item.status ===
                "strong"
          ),

      relatedSkills:
        knowledgeSplit
          .core
          .map(
            (
              item
            ) =>
              item.topic.name
          )
          .slice(
            0,
            8
          ),

      evidence:
        [
          `Target-role knowledge source: ${careerKnowledge!.resolvedRole!.title} (${careerKnowledge!.resolvedRole!.source}).`,

          ...roadmapKnowledgeEvidence(
            knowledgeSplit.core,
            5
          ),
        ],

      source:
        "career_profile",
    });
  } else if (
    resume
  ) {
    /*
     * Legacy fallback only when CareerKnowledge has not been seeded for
     * the requested role.
     */
    seeds.push({
      category:
        "CORE_SKILLS",

      readinessScore:
        clamp(
          resume.skillsScore
        ),

      completed:
        resume.skillsScore >=
        85,

      relatedSkills:
        uniqueStrings(
          resume
            .missingSkills
        ).slice(
          0,
          8
        ),

      evidence:
        [
          `No CareerKnowledge record was resolved for ${targetRole}.`,
          `Fallback resume skill score: ${resume.skillsScore}/100.`,
        ],

      source:
        "resume_analysis",
    });
  }

  /*
   * =====================================================
   * ROLE SKILLS — TARGET ROLE KNOWLEDGE + REAL JOB MARKET
   * =====================================================
   */
  if (
    roleKnowledgeAvailable &&
    (
      knowledgeSplit
        .role
        .length >
        0 ||
      knowledgePriorityTopics
        .length >
        0
    )
  ) {
    const roleTopics =
      knowledgeSplit
        .role
        .length >
        0
        ? knowledgeSplit.role
        : knowledgePriorityTopics;

    const readiness =
      averageTopicReadiness(
        roleTopics
      );

    const jobEvidence =
      bestMatch
        ? [
            `Strongest current matching vacancy: ${bestMatch.title} at ${bestMatch.company} (${bestMatch.match.matchScore}%).`,

            jobMissingSkills.length >
              0
              ? `Job-market gaps: ${jobMissingSkills
                  .slice(
                    0,
                    6
                  )
                  .join(
                    ", "
                  )}.`
              : "",

            matchedSkills.length >
              0
              ? `Existing matching evidence: ${matchedSkills
                  .slice(
                    0,
                    6
                  )
                  .join(
                    ", "
                  )}.`
              : "",
          ].filter(
            Boolean
          )
        : [];

    seeds.push({
      category:
        "ROLE_SKILLS",

      readinessScore:
        readiness,

      completed:
        roleTopics.every(
          (
            item
          ) =>
            item.status ===
              "strong"
        ),

      relatedSkills:
        roleTopics
          .map(
            (
              item
            ) =>
              item.topic.name
          )
          .slice(
            0,
            10
          ),

      evidence:
        [
          `Use the ${careerKnowledge!.resolvedRole!.title} knowledge base as the authority for role-specific learning priorities.`,
          ...roadmapKnowledgeEvidence(
            roleTopics,
            6
          ),
          ...jobEvidence,
        ],

      source:
        bestMatch
          ? "combined"
          : "career_profile",
    });
  } else if (
    bestMatch
  ) {
    seeds.push({
      category:
        "ROLE_SKILLS",

      readinessScore:
        clamp(
          bestMatch
            .match
            .matchScore
        ),

      completed:
        bestMatch
          .match
          .matchScore >=
          85 &&
        jobMissingSkills.length ===
          0,

      relatedSkills:
        uniqueStrings([
          ...jobMissingSkills,
          ...matchedSkills,
        ]).slice(
          0,
          10
        ),

      evidence:
        [
          `No CareerKnowledge record was resolved for ${targetRole}; using live job-match evidence.`,
          `Strongest current target-role match: ${bestMatch.title} at ${bestMatch.company} (${bestMatch.match.matchScore}%).`,
        ],

      source:
        "job_market",
    });
  }

  /*
   * =====================================================
   * PROJECTS — PROVE TARGET-ROLE GAPS
   * =====================================================
   */
  const knowledgeProjectSkills =
    knowledgePriorityTopics
      .slice(
        0,
        6
      )
      .map(
        (
          item
        ) =>
          item.topic.name
      );

  const recommendedProjects =
    careerKnowledge
      ?.recommendedProjects ||
    [];

  if (
    recommendedProjects.length >
      0 ||
    knowledgeProjectSkills.length >
      0 ||
    (
      resume &&
      resume.experienceScore <
        80
    )
  ) {
    seeds.push({
      category:
        "PROJECTS",

      readinessScore:
        resume
          ? clamp(
              resume.experienceScore
            )
          : averageTopicReadiness(
              knowledgePriorityTopics
            ),

      completed:
        Boolean(
          resume &&
          resume.experienceScore >=
            85 &&
          knowledgePriorityTopics
            .filter(
              (
                item
              ) =>
                item.status !==
                  "strong"
            )
            .length ===
            0
        ),

      relatedSkills:
        knowledgeProjectSkills,

      evidence:
        [
          `Projects must prove capability for the selected target role: ${targetRole}.`,

          recommendedProjects.length >
            0
            ? `Curated role projects: ${recommendedProjects
                .slice(
                  0,
                  3
                )
                .join(
                  " | "
                )}.`
            : "",

          knowledgeProjectSkills.length >
            0
            ? `Priority capabilities to demonstrate in projects: ${knowledgeProjectSkills.join(
                ", "
              )}.`
            : "",

          resume
            ? `Current experience-evidence score: ${resume.experienceScore}/100.`
            : "",
        ].filter(
          Boolean
        ),

      source:
        roleKnowledgeAvailable
          ? "combined"
          : "resume_analysis",
    });
  }

  /*
   * =====================================================
   * CV — APPLICATION EVIDENCE, NOT TECHNICAL ABILITY
   * =====================================================
   */
  if (
    resume
  ) {
    const cvReadiness =
      getAverage([
        resume.atsScore,
        resume.contentScore,
        resume.structureScore,
        resume.experienceScore,
      ]);

    const hasCVGap =
      resume.atsScore <
        80 ||
      resume.contentScore <
        80 ||
      resume.structureScore <
        80 ||
      resume.experienceScore <
        70;

    if (
      hasCVGap
    ) {
      const cvGaps =
        gaps
          .filter(
            (
              gap
            ) =>
              gap.category ===
                "CV"
          )
          .map(
            (
              gap
            ) =>
              `${gap.title}: ${gap.description}`
          )
          .slice(
            0,
            5
          );

      seeds.push({
        category:
          "CV",

        readinessScore:
          cvReadiness,

        completed:
          false,

        relatedSkills:
          knowledgePriorityTopics
            .slice(
              0,
              4
            )
            .map(
              (
                item
              ) =>
                item.topic.name
            ),

        evidence:
          [
            `The CV must show evidence relevant to ${targetRole}; CV weakness is not treated as proof of weak technical ability.`,
            `ATS score: ${resume.atsScore}/100.`,
            `Content score: ${resume.contentScore}/100.`,
            `Structure score: ${resume.structureScore}/100.`,
            `Experience evidence score: ${resume.experienceScore}/100.`,
            ...cvGaps,
          ],

        source:
          roleKnowledgeAvailable
            ? "combined"
            : "resume_analysis",
      });
    }
  }

  /*
   * =====================================================
   * INTERVIEW — USE CURATED ROLE INTERVIEW KNOWLEDGE
   * =====================================================
   */
  const interviewReadiness =
    interview
      ? getAverage([
          interview.overallScore,
          interview.averageTechnicalAccuracy,
          interview.averageCommunication,
        ])
      : undefined;

  const knowledgeInterviewTopics =
    careerKnowledge
      ?.interviewTopics ||
    [];

  const practicalScenarios =
    careerKnowledge
      ?.practicalScenarios ||
    [];

  seeds.push({
    category:
      "INTERVIEW",

    readinessScore:
      interviewReadiness,

    completed:
      typeof interviewReadiness ===
        "number" &&
      interviewReadiness >=
        85,

    relatedSkills:
      uniqueStrings([
        ...knowledgeInterviewTopics
          .flatMap(
            (
              item
            ) =>
              item.relatedSkills
          ),
        ...knowledgePriorityTopics
          .slice(
            0,
            5
          )
          .map(
            (
              item
            ) =>
              item.topic.name
          ),
      ]).slice(
        0,
        10
      ),

    evidence:
      [
        interview
          ? typeof interview.overallScore ===
              "number"
            ? `Latest interview overall score: ${interview.overallScore}/100.`
            : "A completed interview context exists."
          : `No completed interview evidence is available yet for ${targetRole}; treat these as preparation priorities, not diagnosed weaknesses.`,

        typeof interview
          ?.averageTechnicalAccuracy ===
          "number"
          ? `Technical accuracy: ${interview!.averageTechnicalAccuracy}/100.`
          : "",

        typeof interview
          ?.averageCommunication ===
          "number"
          ? `Communication: ${interview!.averageCommunication}/100.`
          : "",

        knowledgeInterviewTopics.length >
          0
          ? `Curated ${targetRole} interview areas: ${knowledgeInterviewTopics
              .slice(
                0,
                5
              )
              .map(
                (
                  item
                ) =>
                  item.title
              )
              .join(
                " | "
              )}.`
          : "",

        practicalScenarios.length >
          0
          ? `Real-world interview scenarios: ${practicalScenarios
              .slice(
                0,
                4
              )
              .map(
                (
                  item
                ) =>
                  item.title
              )
              .join(
                " | "
              )}.`
          : "",
      ].filter(
        Boolean
      ),

    source:
      roleKnowledgeAvailable
        ? interview
          ? "combined"
          : "career_profile"
        : interview
          ? "interview"
          : "job_market",
  });

  /*
   * =====================================================
   * JOB SEARCH
   * =====================================================
   */
  if (
    bestMatch
  ) {
    seeds.push({
      category:
        "JOB_SEARCH",

      readinessScore:
        clamp(
          bestMatch
            .match
            .matchScore
        ),

      completed:
        false,

      relatedSkills:
        uniqueStrings([
          ...knowledgePriorityTopics
            .slice(
              0,
              5
            )
            .map(
              (
                item
              ) =>
                item.topic.name
            ),
          ...matchedSkills,
          ...jobMissingSkills,
        ]).slice(
          0,
          8
        ),

      evidence:
        [
          `Current strongest opportunity: ${bestMatch.title} at ${bestMatch.company}.`,
          `Current match score: ${bestMatch.match.matchScore}%.`,
          careerGoal
            ? `User career goal: ${careerGoal}.`
            : `Target role: ${targetRole}.`,
        ],

      source:
        "job_market",
    });
  }

  return seeds.slice(
    0,
    6
  );
};

const buildFallbackRecommendation = (
  seed:
    IRoadmapSectionSeed,
  targetRole:
    string
): ICareerGoalRoadmapRecommendation => {
  const firstSkills =
    seed.relatedSkills
      .slice(
        0,
        4
      );

  const skillText =
    firstSkills.length >
      0
      ? firstSkills.join(
          ", "
        )
      : targetRole;

  const priority =
    getRoadmapPriorityFromReadiness(
      seed.readinessScore
    );

  switch (
    seed.category
  ) {
    case "CORE_SKILLS":
      return {
        title:
          firstSkills[0]
            ? `Strengthen ${firstSkills[0]} with practical evidence`
            : `Strengthen the technical foundation for ${targetRole}`,

        whyItMatters:
          seed.evidence[0] ||
          `Your technical foundation should directly support ${targetRole} work.`,

        whatToLearn:
          firstSkills.length >
            0
            ? firstSkills
            : [
                `Core technical requirements for ${targetRole}`,
              ],

        action:
          firstSkills[0]
            ? `Build a focused feature or exercise that uses ${firstSkills[0]} in a realistic ${targetRole} scenario.`
            : `Complete one role-specific technical exercise and document what you learned.`,

        proofOfCompletion:
          "Keep the completed code or project evidence and add it to your portfolio/CV when it materially demonstrates the skill.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };

    case "ROLE_SKILLS":
      return {
        title:
          `Close the highest-impact ${targetRole} skill gap`,

        whyItMatters:
          seed.evidence[0] ||
          "Real job-match evidence shows a role-specific gap that can affect job compatibility.",

        whatToLearn:
          firstSkills.length >
            0
            ? firstSkills
            : [
                `${targetRole} role requirements from current job matches`,
              ],

        action:
          `Choose the highest-priority missing role skill and implement it in a small production-style feature.`,

        proofOfCompletion:
          "Demonstrate the skill in a project, GitHub repository, or measurable CV bullet rather than only listing it.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };

    case "PROJECTS":
      return {
        title:
          `Build stronger ${targetRole} project evidence`,

        whyItMatters:
          seed.evidence[0] ||
          "Your current experience evidence can be strengthened with a role-focused project.",

        whatToLearn:
          firstSkills.length >
            0
            ? firstSkills
            : [
                `${targetRole} project architecture`,
                "Deployment and documentation",
              ],

        action:
          `Build or upgrade one project that demonstrates ${skillText} in a realistic end-to-end use case.`,

        proofOfCompletion:
          "Deploy the project, keep a public or reviewable repository, and describe the technical decisions and outcome on your CV.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };

    case "CV":
      return {
        title:
          "Strengthen the evidence shown on your CV",

        whyItMatters:
          seed.evidence[0] ||
          "Your CV currently has a measurable application-readiness weakness.",

        whatToLearn:
          [
            "Role-specific achievement writing",
            "Clear technical evidence",
            "ATS-friendly wording",
          ],

        action:
          `Rewrite the weakest CV section so it clearly shows what you built, the technologies used, and the result relevant to ${targetRole}.`,

        proofOfCompletion:
          "Re-run the CV analysis and verify that the weak scoring area and its recommendations improve.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };

    case "INTERVIEW":
      return {
        title:
          `Prepare for ${targetRole} interviews using your real gaps`,

        whyItMatters:
          seed.evidence[0] ||
          "Interview preparation should target the same skills that affect role readiness.",

        whatToLearn:
          firstSkills.length >
            0
            ? firstSkills
            : [
                `${targetRole} technical questions`,
                "Project explanation",
                "Structured communication",
              ],

        action:
          "Complete a focused mock interview and review technical accuracy, completeness, and communication separately.",

        proofOfCompletion:
          "Use the next mock-interview report to confirm improvement in the specific weak areas.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };

    case "JOB_SEARCH":
    default:
      return {
        title:
          `Target stronger ${targetRole} opportunities`,

        whyItMatters:
          seed.evidence[0] ||
          "Current job-market evidence should guide where you invest application effort.",

        whatToLearn:
          firstSkills.length >
            0
            ? firstSkills
            : [
                "Role requirements",
                "Company-specific requirements",
              ],

        action:
          "Prioritize roles where your existing evidence is strong, then tailor your CV around the actual requirements of each vacancy.",

        proofOfCompletion:
          "Track applications and compare new match scores as your profile and roadmap progress improve.",

        priority,

        source:
          seed.source,

        evidence:
          seed.evidence,
      };
  }
};

const buildFallbackMilestone = (
  seed:
    IRoadmapSectionSeed,
  targetRole:
    string,
  order:
    number
): ICareerGoalMilestone => {
  const mainRecommendation =
    buildFallbackRecommendation(
      seed,
      targetRole
    );

  const readinessText =
    typeof seed.readinessScore ===
      "number"
      ? ` Current readiness for this area is ${seed.readinessScore}/100.`
      : "";

  return {
    order,

    category:
      seed.category,

    title:
      mainRecommendation.title,

    description:
      `${mainRecommendation.whyItMatters}${readinessText}`,

    reason:
      seed.evidence[0] ||
      `This ${getCategoryLabel(
        seed.category
      )} section is included because it supports your ${targetRole} goal.`,

    readinessScore:
      seed.readinessScore,

    completed:
      seed.completed,

    relatedSkills:
      seed.relatedSkills,

    recommendations: [
      mainRecommendation,
    ],

    generatedBy:
      "fallback",
  };
};

const normalizeQwenRecommendation = ({
  raw,
  seed,
  targetRole,
}: {
  raw:
    IQwenRoadmapRecommendation;

  seed:
    IRoadmapSectionSeed;

  targetRole:
    string;
}): ICareerGoalRoadmapRecommendation | null => {
  const fallback =
    buildFallbackRecommendation(
      seed,
      targetRole
    );

  const title =
    asString(
      raw.title
    );

  const whyItMatters =
    asString(
      raw.whyItMatters
    );

  const action =
    asString(
      raw.action
    );

  if (
    !title ||
    !whyItMatters ||
    !action
  ) {
    return null;
  }

  const whatToLearn =
    asStringArray(
      raw.whatToLearn,
      8
    );

  return {
    title,

    whyItMatters,

    whatToLearn:
      whatToLearn.length >
        0
        ? whatToLearn
        : fallback
            .whatToLearn,

    action,

    proofOfCompletion:
      asString(
        raw.proofOfCompletion
      ) ||
      fallback
        .proofOfCompletion,

    priority:
      normalizeRoadmapPriority(
        raw.priority,
        fallback.priority
      ),

    /*
     * Qwen may choose among allowed evidence-source labels, but fallback
     * to the backend seed source when it omits or mistypes the value.
     */
    source:
      normalizeRoadmapSource(
        raw.source,
        seed.source
      ),

    evidence:
      asStringArray(
        raw.evidence,
        6
      ).length >
        0
        ? asStringArray(
            raw.evidence,
            6
          )
        : seed.evidence,
  };
};

const normalizeQwenMilestone = ({
  raw,
  seed,
  targetRole,
  order,
}: {
  raw:
    IQwenRoadmapMilestone;

  seed:
    IRoadmapSectionSeed;

  targetRole:
    string;

  order:
    number;
}): ICareerGoalMilestone | null => {
  const category =
    asString(
      raw.category
    ) as
      CareerRoadmapCategory;

  if (
    category !==
    seed.category ||
    !ROADMAP_CATEGORIES.has(
      category
    )
  ) {
    return null;
  }

  const title =
    asString(
      raw.title
    );

  const description =
    asString(
      raw.description
    );

  const reason =
    asString(
      raw.reason
    );

  if (
    !title ||
    !description ||
    !reason
  ) {
    return null;
  }

  const rawRecommendations =
    Array.isArray(
      raw.recommendations
    )
      ? raw.recommendations
      : [];

  const recommendations =
    rawRecommendations
      .map(
        (
          recommendation
        ) =>
          normalizeQwenRecommendation({
            raw:
              (
                recommendation ||
                {}
              ) as
                IQwenRoadmapRecommendation,

            seed,

            targetRole,
          })
      )
      .filter(
        (
          recommendation
        ): recommendation is
          ICareerGoalRoadmapRecommendation =>
            Boolean(
              recommendation
            )
      )
      .slice(
        0,
        7
      );

  if (
    recommendations.length <
    2
  ) {
    /*
     * A single generic item is exactly the limitation we are replacing.
     * If Qwen does not produce enough useful structured detail, let the
     * caller fall back to deterministic content for this section.
     */
    return null;
  }

  return {
    order,

    category:
      seed.category,

    title,

    description,

    reason,

    readinessScore:
      seed.readinessScore,

    completed:
      seed.completed,

    relatedSkills:
      seed.relatedSkills,

    recommendations,

    generatedBy:
      "qwen",
  };
};

const buildQwenRoadmapPrompt = ({
  targetRole,
  careerGoal,
  readinessScore,
  strengths,
  gaps,
  seeds,
  careerKnowledge,
}: {
  targetRole:
    string;

  careerGoal?:
    string;

  readinessScore:
    number;

  strengths:
    ICareerGoalStrength[];

  gaps:
    ICareerGoalGap[];

  seeds:
    IRoadmapSectionSeed[];

  careerKnowledge?:
    ICareerKnowledgeContext;
}): string => {
  const compactContext = {
    targetRole,

    careerGoal:
      careerGoal ||
      null,

    overallCareerReadiness:
      readinessScore,

    strengths:
      strengths
        .slice(
          0,
          6
        )
        .map(
          (
            item
          ) => ({
            category:
              item.category,

            title:
              item.title,

            description:
              item.description,

            score:
              item.score ??
              null,
          })
        ),

    gaps:
      gaps
        .slice(
          0,
          8
        )
        .map(
          (
            item
          ) => ({
            category:
              item.category,

            priority:
              item.priority,

            title:
              item.title,

            description:
              item.description,

            reason:
              item.reason,

            score:
              item.score ??
              null,
          })
        ),

    targetRoleKnowledge:
      careerKnowledge?.found
        ? {
            resolvedRole:
              careerKnowledge
                .resolvedRole,

            coreSkills:
              careerKnowledge
                .coreSkills,

            roleSkills:
              careerKnowledge
                .roleSkills,

            priorityTopics:
              careerKnowledge
                .priorityTopics
                .slice(
                  0,
                  12
                )
                .map(
                  (
                    item
                  ) => ({
                    name:
                      item.topic.name,

                    level:
                      item.topic.level,

                    importance:
                      item.topic.importance,

                    readinessScore:
                      item.readinessScore ??
                      null,

                    status:
                      item.status,

                    reason:
                      item.reason,

                    subtopics:
                      item.topic
                        .subtopics
                        .slice(
                          0,
                          6
                        ),

                    practicalScenarios:
                      item.topic
                        .practicalScenarios
                        .slice(
                          0,
                          3
                        ),

                    expectedEvidence:
                      item.topic
                        .expectedEvidence
                        .slice(
                          0,
                          3
                        ),
                  })
                ),

            recommendedProjects:
              careerKnowledge
                .recommendedProjects
                .slice(
                  0,
                  4
                ),

            interviewTopics:
              careerKnowledge
                .interviewTopics
                .slice(
                  0,
                  6
                )
                .map(
                  (
                    item
                  ) => ({
                    title:
                      item.title,

                    level:
                      item.level,

                    type:
                      item.type,

                    focusAreas:
                      item.focusAreas,

                    relatedSkills:
                      item.relatedSkills,
                  })
                ),

            practicalScenarios:
              careerKnowledge
                .practicalScenarios
                .slice(
                  0,
                  5
                )
                .map(
                  (
                    item
                  ) => ({
                    title:
                      item.title,

                    level:
                      item.level,

                    skillsTested:
                      item.skillsTested,
                  })
                ),
          }
        : null,

    sections:
      seeds.map(
        (
          seed,
          index
        ) => ({
          order:
            index +
            1,

          category:
            seed.category,

          readinessScore:
            seed.readinessScore ??
            null,

          completed:
            seed.completed,

          relatedSkills:
            seed.relatedSkills,

          evidence:
            seed.evidence,

          evidenceSource:
            seed.source,
        })
      ),
  };

  return [
    "Create a personalized career roadmap from the supplied evidence.",
    "",
    "IMPORTANT RULES:",
    `1. The target role is "${targetRole}". Every recommendation must be relevant to this role and the supplied evidence.`,
    "2. Do NOT invent skills, scores, employers, interview results, CV problems, or job requirements that are not supported by the input.",
    "3. Do NOT change category names, readiness scores, completion state, or evidence. Those decisions belong to the backend.",
    "4. Do NOT use generic filler such as:",
    '   - "learn fundamentals and core concepts"',
    '   - "practice common patterns"',
    '   - "prepare common interview questions"',
    '   - "improve core skills"',
    "   unless the input contains no more specific evidence.",
    "5. Each section must be meaningfully different. CORE_SKILLS, ROLE_SKILLS, PROJECTS, CV, INTERVIEW and JOB_SEARCH must not repeat the same recommendations using different wording.",
    "6. Use specific technology/topic names when they exist in relatedSkills or evidence.",
    "7. PROJECTS recommendations must describe what practical evidence to build, not repeat a learning list.",
    "8. CV recommendations must focus on how the candidate presents evidence. Do not treat a weak CV score as proof of weak technical ability.",
    "9. INTERVIEW recommendations must use actual interview weaknesses when scores exist. If no interview evidence exists, explicitly frame the items as preparation rather than diagnosed weaknesses.",
    "10. Produce 2 to 5 useful recommendations per section. Do not force the same number for every section.",
    "11. Keep text concise enough for a UI side panel, but specific enough that the user knows exactly what to do.",
    "12. TARGET ROLE OVERRIDES CV DOMAIN. If the CV is frontend-heavy but targetRole is Backend Developer, do not create frontend learning topics unless they are explicitly present in the target-role knowledge base.",
    "13. Treat targetRoleKnowledge.priorityTopics as the authoritative learning universe whenever it is provided.",
    "14. Do not recommend beginner/common-course material to a user with readiness >= 70 for that skill. Prefer advanced, production, debugging, performance, architecture, security, reliability, or real-work scenarios.",
    "15. For CORE_SKILLS and ROLE_SKILLS, recommendation titles should normally be concrete target-role topic names from targetRoleKnowledge rather than labels such as Core Skills, Fundamentals, or Role Skills.",
    "16. PROJECTS must turn target-role gaps into portfolio evidence. Prefer recommendedProjects and practicalScenarios from targetRoleKnowledge.",
    "17. INTERVIEW must prefer curated interviewTopics and practicalScenarios from targetRoleKnowledge. Do not generate generic interview-question lists when specific role scenarios are available.",
    "18. Strong existing skills should not consume roadmap space unless the recommendation advances them to production/expert depth.",
    "",
    "Return ONLY raw JSON in this exact shape:",
    "{",
    '  "milestones": [',
    "    {",
    '      "category": "CORE_SKILLS | ROLE_SKILLS | PROJECTS | CV | INTERVIEW | JOB_SEARCH",',
    '      "title": "specific user-facing milestone title",',
    '      "description": "1-2 sentence specific overview",',
    '      "reason": "why this section exists for this user based on evidence",',
    '      "recommendations": [',
    "        {",
    '          "title": "specific topic/action title",',
    '          "whyItMatters": "why it matters for this user and target role",',
    '          "whatToLearn": ["specific topic 1", "specific topic 2"],',
    '          "action": "concrete next action",',
    '          "proofOfCompletion": "how the user can prove completion",',
    '          "priority": "high | medium | low",',
    '          "source": "resume | resume_analysis | job_market | interview | progress | career_profile | combined",',
    '          "evidence": ["short supporting evidence copied/paraphrased from input"]',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "You MUST return exactly one milestone for every section supplied in sections, in the same order.",
    "",
    "CAREER EVIDENCE:",
    JSON.stringify(
      compactContext,
      null,
      2
    ),
  ].join(
    "\n"
  );
};

const buildPersonalizedGoalMilestones = async ({
  targetRole,
  careerGoal,
  readinessScore,
  resume,
  jobMatches,
  interview,
  strengths,
  gaps,
  careerKnowledge,
}: {
  targetRole:
    string;

  careerGoal?:
    string;

  readinessScore:
    number;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  strengths:
    ICareerGoalStrength[];

  gaps:
    ICareerGoalGap[];

  careerKnowledge?:
    ICareerKnowledgeContext;
}): Promise<ICareerGoalMilestone[]> => {
  const seeds =
    buildRoadmapSectionSeeds({
      targetRole,
      careerGoal,
      resume,
      jobMatches,
      interview,
      gaps,
      careerKnowledge,
    });

  if (
    seeds.length ===
    0
  ) {
    return [];
  }

  const fallback =
    seeds.map(
      (
        seed,
        index
      ) =>
        buildFallbackMilestone(
          seed,
          targetRole,
          index +
            1
        )
    );

  try {
    console.log(
      "[Career Goal] Generating personalized roadmap with Qwen...",
      {
        targetRole,
        sectionCount:
          seeds.length,
      }
    );

    const result =
      await generateQwenJSON<
        IQwenRoadmapOutput
      >({
        messages: [
          {
            role:
              "system",

            content:
              "You are InterviewIQ's career-roadmap writing engine. Use only the supplied evidence. Your job is to turn backend-determined career gaps into specific, non-repetitive, actionable roadmap language.",
          },
          {
            role:
              "user",

            content:
              buildQwenRoadmapPrompt({
                targetRole,
                careerGoal,
                readinessScore,
                strengths,
                gaps,
                seeds,
                careerKnowledge,
              }),
          },
        ],

        /*
         * Lower temperature reduces hallucination while still allowing
         * natural, non-template phrasing.
         */
        temperature:
          0.35,

        topP:
          0.9,

        maxCompletionTokens:
          1800,

        timeoutMs:
          300_000,

        retries:
          0,
      });

    if (
      !result.success ||
      !result.data
    ) {
      console.warn(
        "[Career Goal] Qwen roadmap generation failed. Using deterministic fallback.",
        result.error
      );

      return fallback;
    }

    const rawMilestones =
      Array.isArray(
        result.data
          .milestones
      )
        ? result.data
            .milestones
        : [];

    /*
     * Map by category instead of trusting array position. This protects
     * against a small local model reordering sections.
     */
    const byCategory =
      new Map<
        CareerRoadmapCategory,
        IQwenRoadmapMilestone
      >();

    for (
      const raw
      of rawMilestones
    ) {
      const candidate =
        (
          raw ||
          {}
        ) as
          IQwenRoadmapMilestone;

      const category =
        asString(
          candidate
            .category
        ) as
          CareerRoadmapCategory;

      if (
        ROADMAP_CATEGORIES.has(
          category
        ) &&
        !byCategory.has(
          category
        )
      ) {
        byCategory.set(
          category,
          candidate
        );
      }
    }

    const normalized =
      seeds.map(
        (
          seed,
          index
        ) => {
          const raw =
            byCategory.get(
              seed.category
            );

          if (
            !raw
          ) {
            return fallback[
              index
            ];
          }

          return (
            normalizeQwenMilestone({
              raw,
              seed,
              targetRole,
              order:
                index +
                1,
            }) ||
            fallback[
              index
            ]
          );
        }
      );

    console.log(
      "[Career Goal] Personalized roadmap generated.",
      {
        qwenSections:
          normalized.filter(
            (
              item
            ) =>
              item.generatedBy ===
              "qwen"
          ).length,

        fallbackSections:
          normalized.filter(
            (
              item
            ) =>
              item.generatedBy ===
              "fallback"
          ).length,
      }
    );

    return normalized;
  } catch (
    error
  ) {
    console.warn(
      "[Career Goal] Personalized roadmap generation crashed. Using deterministic fallback.",
      error
    );

    return fallback;
  }
};

/* =========================================================
   BUILD MILESTONES
========================================================= */

/*
 * The previous roadmap used the same five static milestones for every
 * user. Personalized milestones are now generated by
 * buildPersonalizedGoalMilestones() above using deterministic evidence
 * plus Qwen wording/organization with a deterministic fallback.
 */

/* =========================================================
   BUILD SUMMARY
========================================================= */

const buildGoalSummary = ({
  targetRole,
  readinessScore,
  status,
  jobMatches,
  gaps,
}: {
  targetRole: string;

  readinessScore: number;

  status:
    CareerGoalStatus;

  jobMatches?:
    ICareerJobMatchingResult;

  gaps:
    ICareerGoalGap[];
}): string => {
  const bestMatch =
    jobMatches?.bestMatch;

  if (
    status ===
    "well_aligned"
  ) {
    return bestMatch
      ? `Your current profile is strongly aligned with a ${targetRole} goal. Your readiness score is ${readinessScore}/100, and your strongest current job match is ${bestMatch.title} at ${bestMatch.company} with a ${bestMatch.match.matchScore}% match.`
      : `Your current profile is strongly aligned with a ${targetRole} goal, with a readiness score of ${readinessScore}/100.`;
  }

  if (
    status ===
    "realistic_with_improvements"
  ) {
    const priorityGap =
      gaps[0];

    return priorityGap
      ? `Becoming a ${targetRole} is realistic based on your current InterviewIQ data. Your readiness score is ${readinessScore}/100. Your highest-priority improvement is: ${priorityGap.title}.`
      : `Becoming a ${targetRole} is realistic based on your current InterviewIQ data. Your readiness score is ${readinessScore}/100.`;
  }

  if (
    status ===
    "needs_development"
  ) {
    return `A ${targetRole} goal is possible, but your current readiness score is ${readinessScore}/100, so I would strengthen your CV, target-role skills, and interview readiness before making it your primary application focus.`;
  }

  return `I need more InterviewIQ data before I can reliably evaluate your readiness for ${targetRole}.`;
};

/* =========================================================
   MAIN CAREER GOAL CONTEXT
========================================================= */

export const buildCareerGoalContext =
  async (
    input:
      ICareerGoalInput
  ): Promise<
    ICareerGoalResult
  > => {
    const userId =
      normalizeString(
        input.userId
      );

    const targetRole =
      normalizeString(
        input.targetRole
      );

    const careerGoal =
      normalizeString(
        input.careerGoal
      );

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !userId
    ) {
      return {
        found:
          false,

        reason:
          "USER_ID_REQUIRED",
      };
    }

    if (
      !targetRole
    ) {
      return {
        found:
          false,

        reason:
          "TARGET_ROLE_REQUIRED",
      };
    }

    let resume:
      ICareerResumeContext | undefined;

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    let interview:
      ICareerInterviewContext | undefined;

    let progress:
      ICareerProgressContext | undefined;

    let careerSkillProfile:
      ICareerSkillProfile | undefined;

    let careerKnowledge:
      ICareerKnowledgeContext | undefined;

    /* =====================================================
       RESUME
    ===================================================== */

    try {
      const result =
        await resolveResumeContext({
          userId,

          activeResumeId:
            input.activeResumeId,
        });

      if (
        result.found &&
        result.data
      ) {
        resume =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Resume context failed:",
        error
      );
    }

    /* =====================================================
       UNIFIED SKILL PROFILE
    ===================================================== */

    try {
      careerSkillProfile =
        await buildCareerSkillProfile({
          userId,

          resumeAnalysisId:
            resume
              ?.id,

          strongestSkillLimit:
            25,
        });
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Career skill profile failed:",
        error
      );
    }

    /* =====================================================
       TARGET-ROLE KNOWLEDGE

       IMPORTANT:
       This is now the primary skill/topic universe for roadmap
       generation. The selected target role wins over the user's previous
       CV domain.
    ===================================================== */

    try {
      const userSkills =
        careerSkillProfile
          ?.skills
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

              verified:
                skill.interviewVerified,

              sources:
                skill.sources.map(
                  (
                    source
                  ) =>
                    String(
                      source
                    )
                ),
            })
          ) ||
        [];

      careerKnowledge =
        await buildCareerKnowledgeContext({
          targetRole,

          userSkills,

          maxTopics:
            18,

          maxPriorityTopics:
            10,

          maxInterviewTopics:
            6,

          maxScenarios:
            5,

          includeStrongTopics:
            false,
        });

      if (
        !careerKnowledge.found
      ) {
        console.warn(
          "[Career Goal] No CareerKnowledge role resolved:",
          {
            targetRole,
          }
        );
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Career knowledge context failed:",
        error
      );
    }

    /* =====================================================
       JOB MATCHING
    ===================================================== */

    if (
      resume
    ) {
      try {
        const result =
          await getCareerJobMatches({
            userId,

            activeResumeId:
              resume.id,

            targetRole,

            limit:
              5,
          });

        if (
          result.found
        ) {
          jobMatches =
            result;
        }
      } catch (
        error
      ) {
        console.error(
          "[Career Goal] Job matching failed:",
          error
        );
      }
    }

    /* =====================================================
       INTERVIEW
    ===================================================== */

    try {
      const result =
        await resolveCareerInterviewContext({
          userId,

          activeInterviewId:
            input.activeInterviewId,
        });

      if (
        result.found &&
        result.data
      ) {
        interview =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Interview context failed:",
        error
      );
    }

    /* =====================================================
       PROGRESS
    ===================================================== */

    try {
      const result =
        await buildCareerProgressContext(
          userId
        );

      if (
        result.found &&
        result.data
      ) {
        progress =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Progress context failed:",
        error
      );
    }

    /* =====================================================
       NO DATA
    ===================================================== */

    if (
      !resume &&
      !jobMatches &&
      !interview &&
      !progress &&
      !careerKnowledge?.found
    ) {
      return {
        found:
          false,

        reason:
          "NO_CAREER_DATA",
      };
    }

    /* =====================================================
       SCORE
    ===================================================== */

    const readinessScore =
      calculateReadinessScore({
        resume,
        jobMatches,
        interview,
        progress,
      });

    const readinessLevel =
      getReadinessLevel(
        readinessScore
      );

    const status =
      getGoalStatus(
        readinessScore,
        true
      );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    const strengths =
      buildGoalStrengths({
        resume,
        jobMatches,
        interview,
      });

    /* =====================================================
       GAPS
    ===================================================== */

    const gaps =
      buildGoalGaps({
        resume,
        jobMatches,
        interview,
        progress,
      });

    /* =====================================================
       MILESTONES
    ===================================================== */

    const milestones =
      await buildPersonalizedGoalMilestones({
        targetRole,

        careerGoal,

        readinessScore,

        resume,

        jobMatches,

        interview,

        strengths,

        gaps,

        careerKnowledge,
      });

    /* =====================================================
       SUMMARY
    ===================================================== */

    const summary =
      buildGoalSummary({
        targetRole,
        readinessScore,
        status,
        jobMatches,
        gaps,
      });

    return {
      found:
        true,

      data: {
        targetRole,

        careerGoal,

        readinessScore,

        readinessLevel,

        status,

        resume,

        jobMatches,

        interview,

        progress,

        careerKnowledge,

        strengths,

        gaps,

        milestones,

        summary,
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerGoalReply =
  (
    context:
      ICareerGoalContext
  ): string => {
    const parts:
      string[] = [];

    parts.push(
      context.summary
    );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    if (
      context.strengths.length >
      0
    ) {
      parts.push(
        `Your strongest readiness signals are: ${context.strengths
          .slice(
            0,
            3
          )
          .map(
            (
              strength
            ) =>
              strength.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       GAPS
    ===================================================== */

    if (
      context.gaps.length >
      0
    ) {
      parts.push(
        `Your top areas to improve are: ${context.gaps
          .slice(
            0,
            3
          )
          .map(
            (
              gap
            ) =>
              gap.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       NEXT MILESTONE
    ===================================================== */

    const nextMilestone =
      context.milestones.find(
        (
          milestone
        ) =>
          !milestone.completed
      );

    if (
      nextMilestone
    ) {
      parts.push(
        `Your next milestone should be: ${nextMilestone.title}. ${nextMilestone.description}`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerGoalSummary =
  (
    context:
      ICareerGoalContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      careerGoal:
        context.careerGoal,

      readinessScore:
        context.readinessScore,

      readinessLevel:
        context.readinessLevel,

      status:
        context.status,

      summary:
        context.summary,

      strengths:
        context.strengths,

      gaps:
        context.gaps,

      milestones:
        context.milestones,

      careerKnowledge: {
        found:
          Boolean(
            context
              .careerKnowledge
              ?.found
          ),

        resolvedRole:
          context
            .careerKnowledge
            ?.resolvedRole,

        priorityTopics:
          context
            .careerKnowledge
            ?.priorityTopics
            .slice(
              0,
              10
            )
            .map(
              (
                item
              ) => ({
                name:
                  item.topic.name,

                level:
                  item.topic.level,

                importance:
                  item.topic.importance,

                readinessScore:
                  item.readinessScore,

                status:
                  item.status,

                priorityScore:
                  item.priorityScore,
              })
            ) ||
          [],
      },

      roadmapGeneration: {
        personalized:
          context.milestones
            .some(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "qwen"
            ),

        qwenSections:
          context.milestones
            .filter(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "qwen"
            )
            .length,

        fallbackSections:
          context.milestones
            .filter(
              (
                milestone
              ) =>
                milestone.generatedBy ===
                "fallback"
            )
            .length,
      },

      sources: {
        resume:
          Boolean(
            context.resume
          ),

        jobs:
          Boolean(
            context.jobMatches
          ),

        interview:
          Boolean(
            context.interview
          ),

        progress:
          Boolean(
            context.progress
          ),

        careerKnowledge:
          Boolean(
            context
              .careerKnowledge
              ?.found
          ),
      },

      bestJobMatch:
        context.jobMatches
          ?.bestMatch
        ? {
            id:
              context
                .jobMatches
                .bestMatch
                ?.id,

            title:
              context
                .jobMatches
                .bestMatch
                ?.title,

            company:
              context
                .jobMatches
                .bestMatch
                ?.company,

            matchScore:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchScore,

            matchedSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchedSkills,

            missingSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .missingSkills,
          }
        : null,

      resumeReadiness:
        context.resume
        ? {
            overallScore:
              context.resume
                .overallScore,

            atsScore:
              context.resume
                .atsScore,

            skillsScore:
              context.resume
                .skillsScore,

            experienceScore:
              context.resume
                .experienceScore,
          }
        : null,

      interviewReadiness:
        context.interview
        ? {
            overallScore:
              context.interview
                .overallScore,

            technicalAccuracy:
              context.interview
                .averageTechnicalAccuracy,

            completeness:
              context.interview
                .averageCompleteness,

            communication:
              context.interview
                .averageCommunication,
          }
        : null,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerGoalContext,

  buildCareerGoalReply,

  buildCareerGoalSummary,
};