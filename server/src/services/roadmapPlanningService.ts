// Existing deterministic rules; no database or inference calls.
import type { ICareerResumeContext } from './careerContextService';
import type { ICareerJobMatchingResult } from './careerJobContextService';
import type { ICareerInterviewContext } from './careerInterviewContextService';
import type { ICareerProgressContext } from './careerProgressService';
import type { ICareerKnowledgeContext, ICareerKnowledgeTopicMatch } from './careerKnowledgeService';
import type { CareerRoadmapCategory, CareerRoadmapGeneratedBy, CareerRoadmapInsightSource, CareerRoadmapPriority } from '../models/CareerAutomation';
import type { CareerGoalReadinessLevel, CareerGoalStatus, CareerGoalPriority, ICareerGoalStrength, ICareerGoalGap, ICareerGoalMilestone, ICareerGoalRoadmapRecommendation } from './careerGoalService';
export const normalizeString = (
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

export const clamp = (
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

export const round = (
  value: number
): number => {
  return Math.round(
    value
  );
};

export const uniqueStrings = (
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

export const getReadinessLevel = (
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

export const getGoalStatus = (
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

export const calculateResumeReadiness = (
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

export const calculateJobReadiness = (
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

export const calculateInterviewReadiness = (
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

export const calculateProgressAdjustment = (
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

export const calculateReadinessScore = ({
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

export const buildGoalStrengths = ({
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

export const buildGoalGaps = ({
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

export interface IRoadmapSectionSeed {
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

export const asString = (
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

export const asStringArray = (
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

export const getRoadmapPriorityFromReadiness = (
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

export const getCategoryLabel = (
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

export const getAverage = (
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

export const topicMatchReadiness = (
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

export const averageTopicReadiness = (
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

export const roadmapKnowledgeEvidence = (
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

export const splitKnowledgeTopics = (
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

export const buildRoadmapSectionSeeds = ({
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

export const buildFallbackRecommendation = (
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

export const buildFallbackMilestone = (
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

export const buildGoalSummary = ({
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
