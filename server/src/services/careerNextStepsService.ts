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
  CareerAutomation,
  type CareerRoadmapCategory,
  type ICareerRoadmapMilestone,
} from "../models/CareerAutomation";

/* =========================================================
   TYPES
========================================================= */

export type CareerNextStepCategory =
  | "CV"
  | "JOB"
  | "INTERVIEW"
  | "SKILL"
  | "PROGRESS"
  | "CAREER";

export type CareerNextStepPriority =
  | "high"
  | "medium"
  | "low";

export interface ICareerNextStep {
  id: string;

  category:
    CareerNextStepCategory;

  priority:
    CareerNextStepPriority;

  title: string;

  description: string;

  reason: string;

  score?: number;

  resourceId?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICareerNextStepsContext {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;

  targetRole?: string;

  careerGoal?: string;

  contextIntent?: string;

  userMessage?: string;

  contextualMode?: string;

  personalizedRoadmapAvailable?:
    boolean;

  personalizedRoadmapSections?:
    number;

  steps:
    ICareerNextStep[];

  topStep?:
    ICareerNextStep;
}

export interface ICareerNextStepsResult {
  found: boolean;

  data?:
    ICareerNextStepsContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "NO_CAREER_DATA";
}

export interface ICareerNextStepsInput {
  userId?: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  contextIntent?: string;

  userMessage?: string;
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

const uniqueStrings = (
  values: string[]
): string[] => {
  return Array.from(
    new Set(
      values
        .map(
          (
            item
          ) =>
            item
              .trim()
        )
        .filter(
          Boolean
        )
    )
  );
};

const createStepId = (
  category:
    CareerNextStepCategory,
  key: string
): string => {
  return `${category.toLowerCase()}-${key
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )}`;
};

const priorityWeight = (
  priority:
    CareerNextStepPriority
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


/* =========================================================
   CONTEXTUAL FOLLOW-UP HELPERS
========================================================= */

const CONTEXTUAL_JOB_INTENTS =
  new Set<string>([
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "SKILL_GAP",
  ]);

const CONTEXTUAL_CV_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
  ]);

const CONTEXTUAL_INTERVIEW_INTENTS =
  new Set<string>([
    "INTERVIEW_FEEDBACK",
    "INTERVIEW_PREP",
  ]);

const isRoadmapOrImprovementRequest = (
  message?: string
): boolean => {
  const normalized =
    normalizeString(
      message
    )
      ?.toLowerCase();

  if (
    !normalized
  ) {
    return false;
  }

  return (
    /\broad\s*map\b/i.test(
      normalized
    ) ||
    /\broadmap\b/i.test(
      normalized
    ) ||
    /\bstep[- ]by[- ]step\b/i.test(
      normalized
    ) ||
    /\baction plan\b/i.test(
      normalized
    ) ||
    /\blearning plan\b/i.test(
      normalized
    ) ||
    /\bimprovement plan\b/i.test(
      normalized
    ) ||
    /\bhow can i improve\b/i.test(
      normalized
    ) ||
    /\bhow should i improve\b/i.test(
      normalized
    ) ||
    /\bhelp me improve\b/i.test(
      normalized
    ) ||
    /\bimprove (this|that|these|those)\b/i.test(
      normalized
    ) ||
    /\bwhat should i learn\b/i.test(
      normalized
    ) ||
    /\bwhat should i practice\b/i.test(
      normalized
    )
  );
};

/* =========================================================
   PERSONALIZED ROADMAP HELPERS

   The roadmap is generated upstream by careerGoalService using:
   - deterministic CV/job/interview/progress evidence
   - Qwen for specific, non-repetitive wording
   - validated structured fallback

   This service should NOT regenerate generic roadmap prose.
   It converts the stored personalized roadmap into actionable next steps.
========================================================= */

const normalizeKey = (
  value:
    string | undefined | null
): string => {
  return (
    normalizeString(
      value
    ) ||
    ""
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
};

const roadmapCategoryToNextStepCategory = (
  category:
    CareerRoadmapCategory
): CareerNextStepCategory => {
  switch (
    category
  ) {
    case "CORE_SKILLS":
    case "ROLE_SKILLS":
      return "SKILL";

    case "CV":
      return "CV";

    case "INTERVIEW":
      return "INTERVIEW";

    case "JOB_SEARCH":
      return "JOB";

    case "PROJECTS":
    default:
      /*
       * CareerNextStepCategory does not currently have a PORTFOLIO
       * value. Keep PROJECTS under CAREER and preserve the precise
       * roadmap category in metadata. careerAutomationService can
       * continue creating tasks without a breaking type change.
       */
      return "CAREER";
  }
};

const resolveStoredRoadmap = async (
  userId:
    string
): Promise<
  ICareerRoadmapMilestone[]
> => {
  try {
    const automation =
      await CareerAutomation
        .findOne({
          userId,

          status: {
            $in: [
              "active",
              "paused",
            ],
          },
        })
        .select({
          roadmap:
            1,
        })
        .lean();

    if (
      !automation ||
      !Array.isArray(
        automation.roadmap
      )
    ) {
      return [];
    }

    return (
      automation.roadmap as
        ICareerRoadmapMilestone[]
    );
  } catch (
    error
  ) {
    console.error(
      "[Career Next Steps] Stored personalized roadmap failed:",
      error
    );

    return [];
  }
};

const buildPersonalizedRoadmapSteps = ({
  roadmap,
  categories,
  maxSteps =
    12,
}: {
  roadmap:
    ICareerRoadmapMilestone[];

  categories?:
    CareerRoadmapCategory[];

  maxSteps?:
    number;
}): ICareerNextStep[] => {
  const categoryFilter =
    categories
      ? new Set<
          CareerRoadmapCategory
        >(
          categories
        )
      : undefined;

  const result:
    ICareerNextStep[] =
      [];

  const seen =
    new Set<string>();

  const sortedMilestones =
    [
      ...roadmap,
    ].sort(
      (
        a,
        b
      ) =>
        a.order -
        b.order
    );

  for (
    const milestone
    of sortedMilestones
  ) {
    if (
      !milestone.category
    ) {
      continue;
    }

    if (
      categoryFilter &&
      !categoryFilter.has(
        milestone.category
      )
    ) {
      continue;
    }

    const recommendations =
      milestone
        .recommendations ||
      [];

    for (
      const [
        index,
        recommendation,
      ]
      of recommendations.entries()
    ) {
      const title =
        normalizeString(
          recommendation.title
        );

      const whyItMatters =
        normalizeString(
          recommendation
            .whyItMatters
        );

      const action =
        normalizeString(
          recommendation.action
        );

      if (
        !title ||
        !whyItMatters ||
        !action
      ) {
        continue;
      }

      const dedupeKey =
        [
          milestone.category,
          normalizeKey(
            title
          ),
          normalizeKey(
            action
          ),
        ].join(
          "|"
        );

      if (
        seen.has(
          dedupeKey
        )
      ) {
        continue;
      }

      seen.add(
        dedupeKey
      );

      const whatToLearn =
        uniqueStrings(
          recommendation
            .whatToLearn ||
          []
        );

      const evidence =
        uniqueStrings(
          recommendation
            .evidence ||
          []
        );

      const proofOfCompletion =
        normalizeString(
          recommendation
            .proofOfCompletion
        );

      const milestoneReason =
        normalizeString(
          milestone.reason
        );

      result.push({
        id:
          createStepId(
            roadmapCategoryToNextStepCategory(
              milestone.category
            ),
            `${milestone.id}-${index}-${title}`
          ),

        category:
          roadmapCategoryToNextStepCategory(
            milestone.category
          ),

        priority:
          recommendation
            .priority,

        title,

        /*
         * description is the concrete thing the user should do.
         * reason separately explains why the recommendation exists.
         */
        description:
          action,

        reason:
          whyItMatters,

        score:
          typeof milestone
            .readinessScore ===
            "number"
            ? milestone
                .readinessScore
            : undefined,

        metadata: {
          personalized:
            true,

          roadmapMilestoneId:
            milestone.id,

          roadmapCategory:
            milestone.category,

          roadmapTitle:
            milestone.title,

          milestoneDescription:
            milestone.description,

          milestoneReason,

          readinessScore:
            milestone
              .readinessScore,

          relatedSkills:
            milestone
              .relatedSkills,

          whatToLearn,

          action,

          proofOfCompletion,

          recommendationSource:
            recommendation
              .source,

          evidence,

          generatedBy:
            milestone
              .generatedBy,

          generatedAt:
            milestone
              .generatedAt,

          recommendationIndex:
            index,
        },
      });

      if (
        result.length >=
        maxSteps
      ) {
        return result;
      }
    }
  }

  return result;
};

const mergeUniqueSteps = (
  groups:
    ICareerNextStep[][]
): ICareerNextStep[] => {
  const result:
    ICareerNextStep[] =
      [];

  const seen =
    new Set<string>();

  for (
    const group
    of groups
  ) {
    for (
      const step
      of group
    ) {
      const key =
        [
          step.category,
          normalizeKey(
            step.title
          ),
          normalizeKey(
            step.description
          ),
        ].join(
          "|"
        );

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
        step
      );
    }
  }

  return result;
};

const resolveContextualMode = (
  contextIntent?: string,
  userMessage?: string
):
  | "JOB_SKILL_ROADMAP"
  | "CV_FOCUS"
  | "INTERVIEW_FOCUS"
  | "GENERAL" => {
  if (
    contextIntent &&
    CONTEXTUAL_JOB_INTENTS.has(
      contextIntent
    ) &&
    isRoadmapOrImprovementRequest(
      userMessage
    )
  ) {
    return "JOB_SKILL_ROADMAP";
  }

  if (
    contextIntent &&
    CONTEXTUAL_CV_INTENTS.has(
      contextIntent
    )
  ) {
    return "CV_FOCUS";
  }

  if (
    contextIntent &&
    CONTEXTUAL_INTERVIEW_INTENTS.has(
      contextIntent
    )
  ) {
    return "INTERVIEW_FOCUS";
  }

  return "GENERAL";
};

/* =========================================================
   CV NEXT STEPS
========================================================= */

const buildCVSteps = (
  resume?: ICareerResumeContext
): ICareerNextStep[] => {
  if (
    !resume
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  /* =====================================================
     ATS
  ===================================================== */

  if (
    resume.atsScore <
    70
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          "improve-ats-score"
        ),

      category:
        "CV",

      priority:
        resume.atsScore <
        60
          ? "high"
          : "medium",

      title:
        "Improve your ATS score",

      description:
        `Your current ATS score is ${resume.atsScore}/100. Focus on ATS-friendly wording, section headings, and vacancy-specific keywords.`,

      reason:
        "Your ATS score is below the recommended target.",

      score:
        resume.atsScore,

      resourceId:
        resume.id,

      metadata: {
        atsSuggestions:
          resume.atsSuggestions,
      },
    });
  }

  /* =====================================================
     STRUCTURE
  ===================================================== */

  if (
    resume.structureScore <
    70
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          "improve-structure"
        ),

      category:
        "CV",

      priority:
        resume.structureScore <
        60
          ? "high"
          : "medium",

      title:
        "Improve CV structure",

      description:
        `Your structure score is ${resume.structureScore}/100. Review formatting, section order, readability, and ATS-safe layout.`,

      reason:
        "CV structure is one of the weaker scoring areas.",

      score:
        resume.structureScore,

      resourceId:
        resume.id,

      metadata: {
        formattingFeedback:
          resume.formattingFeedback,
      },
    });
  }

  /* =====================================================
     SKILLS SCORE
  ===================================================== */

  if (
    resume.skillsScore <
    75
  ) {
    steps.push({
      id:
        createStepId(
          "SKILL",
          "strengthen-skill-profile"
        ),

      category:
        "SKILL",

      priority:
        resume.skillsScore <
        60
          ? "high"
          : "medium",

      title:
        "Strengthen your skill profile",

      description:
        `Your CV skills score is ${resume.skillsScore}/100. Focus on relevant technical skills that are missing or underrepresented.`,

      reason:
        "A stronger skill profile can improve both CV quality and job matching.",

      score:
        resume.skillsScore,

      resourceId:
        resume.id,

      metadata: {
        missingSkills:
          resume.missingSkills,
      },
    });
  }

  /* =====================================================
     RESUME RECOMMENDATIONS
  ===================================================== */

  for (
    const recommendation
    of resume.recommendations
      .slice(
        0,
        2
      )
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          recommendation
        ),

      category:
        "CV",

      priority:
        "medium",

      title:
        "Apply a CV recommendation",

      description:
        recommendation,

      reason:
        "This recommendation comes from your latest saved CV analysis.",

      resourceId:
        resume.id,
    });
  }

  return steps;
};

/* =========================================================
   JOB NEXT STEPS
========================================================= */

const buildJobSteps = (
  jobMatches?:
    ICareerJobMatchingResult
): ICareerNextStep[] => {
  if (
    !jobMatches?.found ||
    !jobMatches.bestMatch
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  const best =
    jobMatches.bestMatch;

  /* =====================================================
     HIGH MATCH JOB
  ===================================================== */

  if (
    best.match.matchScore >=
    80
  ) {
    steps.push({
      id:
        createStepId(
          "JOB",
          `apply-${best.id}`
        ),

      category:
        "JOB",

      priority:
        best.match.matchScore >=
        90
          ? "high"
          : "medium",

      title:
        `Review ${best.title} at ${best.company}`,

      description:
        `This role has a ${best.match.matchScore}% match with your current CV. Review the job details and prepare a tailored application.`,

      reason:
        "This is currently one of your strongest job matches.",

      score:
        best.match.matchScore,

      resourceId:
        best.id,

      metadata: {
        company:
          best.company,

        matchedSkills:
          best.match
            .matchedSkills,

        missingSkills:
          best.match
            .missingSkills,
      },
    });
  }

  /* =====================================================
     MISSING JOB SKILLS
  ===================================================== */

  const missingSkills =
    uniqueStrings(
      best.match
        .missingSkills
    );

  if (
    missingSkills.length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "SKILL",
          "job-missing-skills"
        ),

      category:
        "SKILL",

      priority:
        "high",

      title:
        "Close the biggest job skill gaps",

      description:
        `For your strongest current job match, focus on: ${missingSkills
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "These skills were required by the job but were not detected strongly enough in your CV.",

      resourceId:
        best.id,

      metadata: {
        missingSkills,
      },
    });
  }

  /* =====================================================
     MATCHING IMPROVEMENT AREAS
  ===================================================== */

  if (
    best.match
      .improvementAreas
      .length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "JOB",
          "improve-match-quality"
        ),

      category:
        "JOB",

      priority:
        "medium",

      title:
        "Improve your strongest job match",

      description:
        best.match
          .improvementAreas[0],

      reason:
        "Improving this area can increase your match quality for similar roles.",

      resourceId:
        best.id,

      metadata: {
        improvementAreas:
          best.match
            .improvementAreas,
      },
    });
  }

  return steps;
};

/* =========================================================
   INTERVIEW NEXT STEPS
========================================================= */

const buildInterviewSteps = (
  interview?:
    ICareerInterviewContext
): ICareerNextStep[] => {
  if (
    !interview
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  /* =====================================================
     TECHNICAL ACCURACY
  ===================================================== */

  if (
    typeof interview
      .averageTechnicalAccuracy ===
      "number" &&
    interview
      .averageTechnicalAccuracy <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "technical-accuracy"
        ),

      category:
        "INTERVIEW",

      priority:
        interview
          .averageTechnicalAccuracy <
          70
          ? "high"
          : "medium",

      title:
        "Improve technical interview accuracy",

      description:
        `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100. Practice role-specific technical questions and explain your reasoning step by step.`,

      reason:
        "Technical accuracy is below your target interview level.",

      score:
        interview
          .averageTechnicalAccuracy,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     COMMUNICATION
  ===================================================== */

  if (
    typeof interview
      .averageCommunication ===
      "number" &&
    interview
      .averageCommunication <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "communication"
        ),

      category:
        "INTERVIEW",

      priority:
        interview
          .averageCommunication <
          70
          ? "high"
          : "medium",

      title:
        "Practice clearer interview communication",

      description:
        `Your average communication score is ${interview.averageCommunication}/100. Focus on concise explanations and structured examples.`,

      reason:
        "Communication can materially affect otherwise strong interview answers.",

      score:
        interview
          .averageCommunication,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     COMPLETENESS
  ===================================================== */

  if (
    typeof interview
      .averageCompleteness ===
      "number" &&
    interview
      .averageCompleteness <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "answer-completeness"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Give more complete interview answers",

      description:
        `Your average answer completeness is ${interview.averageCompleteness}/100. Practice covering the full question before ending your response.`,

      reason:
        "Some answers may be correct but still incomplete.",

      score:
        interview
          .averageCompleteness,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     FINAL REPORT RECOMMENDATION
  ===================================================== */

  if (
    interview
      .finalReport
      .recommendations
      .length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "report-recommendation"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Follow your latest interview recommendation",

      description:
        interview
          .finalReport
          .recommendations[0],

      reason:
        "This recommendation comes from your latest completed interview report.",

      resourceId:
        interview.id,
    });
  }

  return steps;
};

/* =========================================================
   PROGRESS NEXT STEPS
========================================================= */

const buildProgressSteps = (
  progress?:
    ICareerProgressContext
): ICareerNextStep[] => {
  if (
    !progress
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  const ats =
    progress.resume
      .atsScore;

  if (
    ats.direction ===
      "declined" &&
    typeof ats.change ===
      "number"
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "recover-ats-decline"
        ),

      category:
        "PROGRESS",

      priority:
        Math.abs(
          ats.change
        ) >= 15
          ? "high"
          : "medium",

      title:
        "Recover your ATS score",

      description:
        `Your ATS score dropped by ${Math.abs(
          ats.change
        )} points between your last two CV analyses.`,

      reason:
        "This is one of the clearest negative trends in your recent progress.",

      score:
        ats.current,
    });
  }

  const structure =
    progress.resume
      .structureScore;

  if (
    structure.direction ===
      "declined" &&
    typeof structure.change ===
      "number"
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "recover-cv-structure"
        ),

      category:
        "PROGRESS",

      priority:
        Math.abs(
          structure.change
        ) >= 15
          ? "high"
          : "medium",

      title:
        "Recover CV structure quality",

      description:
        `Your CV structure score decreased by ${Math.abs(
          structure.change
        )} points.`,

      reason:
        "The latest CV version scored materially lower on structure.",

      score:
        structure.current,
    });
  }

  const communication =
    progress.interview
      .communication;

  if (
    communication.direction ===
      "declined" &&
    typeof communication.change ===
      "number" &&
    Math.abs(
      communication.change
    ) >= 5
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "interview-communication-trend"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Protect your interview communication performance",

      description:
        `Your interview communication score decreased by ${Math.abs(
          communication.change
        )} points.`,

      reason:
        "A downward interview communication trend is worth correcting early.",

      score:
        communication.current,
    });
  }

  return steps;
};

/* =========================================================
   CAREER GOAL STEP
========================================================= */

const buildCareerGoalSteps = (
  targetRole?: string,
  careerGoal?: string
): ICareerNextStep[] => {
  const steps:
    ICareerNextStep[] = [];

  if (
    !targetRole
  ) {
    steps.push({
      id:
        createStepId(
          "CAREER",
          "define-target-role"
        ),

      category:
        "CAREER",

      priority:
        "medium",

      title:
        "Define your target role",

      description:
        "Choose a specific target role so InterviewIQ can make job matching, CV improvement, and interview preparation more focused.",

      reason:
        "A clear target role improves the quality of personalized career guidance.",
    });
  }

  if (
    targetRole &&
    !careerGoal
  ) {
    steps.push({
      id:
        createStepId(
          "CAREER",
          "define-career-goal"
        ),

      category:
        "CAREER",

      priority:
        "low",

      title:
        "Turn your target role into a career goal",

      description:
        `You are targeting ${targetRole}. Define a measurable career goal around that role.`,

      reason:
        "A concrete career goal makes progress easier to evaluate.",
    });
  }

  return steps;
};

/* =========================================================
   SORT NEXT STEPS
========================================================= */

const sortSteps = (
  steps:
    ICareerNextStep[]
): ICareerNextStep[] => {
  return [
    ...steps,
  ].sort(
    (
      a,
      b
    ) => {
      const priorityDifference =
        priorityWeight(
          b.priority
        ) -
        priorityWeight(
          a.priority
        );

      if (
        priorityDifference !==
        0
      ) {
        return priorityDifference;
      }

      /*
       * When priority is equal,
       * lower score generally means greater urgency.
       */

      if (
        typeof a.score ===
          "number" &&
        typeof b.score ===
          "number"
      ) {
        return (
          a.score -
          b.score
        );
      }

      return 0;
    }
  );
};

/* =========================================================
   MAIN NEXT STEPS CONTEXT
========================================================= */

export const buildCareerNextStepsContext =
  async (
    input:
      ICareerNextStepsInput
  ): Promise<
    ICareerNextStepsResult
  > => {
    const userId =
      normalizeString(
        input.userId
      );

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

    let resume:
      ICareerResumeContext | undefined;

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    let interview:
      ICareerInterviewContext | undefined;

    let progress:
      ICareerProgressContext | undefined;

    let storedRoadmap:
      ICareerRoadmapMilestone[] =
        [];

    /* =====================================================
       PERSONALIZED STORED ROADMAP
    ===================================================== */

    storedRoadmap =
      await resolveStoredRoadmap(
        userId
      );

    /* =====================================================
       RESUME
    ===================================================== */

    try {
      const resumeResult =
        await resolveResumeContext({
          userId,

          activeResumeId:
            input.activeResumeId,
        });

      if (
        resumeResult.found &&
        resumeResult.data
      ) {
        resume =
          resumeResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Next Steps] Resume context failed:",
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
        const jobResult =
          await getCareerJobMatches({
            userId,

            activeResumeId:
              resume.id,

            targetRole:
              input.targetRole,

            limit:
              5,
          });

        if (
          jobResult.found
        ) {
          jobMatches =
            jobResult;
        }
      } catch (
        error
      ) {
        console.error(
          "[Career Next Steps] Job context failed:",
          error
        );
      }
    }

    /* =====================================================
       INTERVIEW
    ===================================================== */

    try {
      const interviewResult =
        await resolveCareerInterviewContext({
          userId,

          activeInterviewId:
            input.activeInterviewId,
        });

      if (
        interviewResult.found &&
        interviewResult.data
      ) {
        interview =
          interviewResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Next Steps] Interview context failed:",
        error
      );
    }

    /* =====================================================
       CAREER PROGRESS
    ===================================================== */

    try {
      const progressResult =
        await buildCareerProgressContext(
          userId
        );

      if (
        progressResult.found &&
        progressResult.data
      ) {
        progress =
          progressResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Next Steps] Progress context failed:",
        error
      );
    }

    /* =====================================================
       NO DATA AT ALL
    ===================================================== */

    if (
      !resume &&
      !jobMatches &&
      !interview &&
      !progress &&
      storedRoadmap.length ===
        0 &&
      !input.targetRole &&
      !input.careerGoal
    ) {
      return {
        found:
          false,

        reason:
          "NO_CAREER_DATA",
      };
    }

    /* =====================================================
       GENERATE CONTEXT-AWARE STEPS
    ===================================================== */

    const contextualMode =
      resolveContextualMode(
        input.contextIntent,
        input.userMessage
      );

    let steps:
      ICareerNextStep[] = [];

    /*
     * Personalized roadmap steps are the primary source whenever a
     * roadmap has already been generated for this automation.
     *
     * Deterministic CV/job/interview/progress builders remain as safe
     * fallbacks and as additional evidence-based steps. The old
     * hardcoded per-skill prose is intentionally no longer used.
     */
    const personalizedAll =
      buildPersonalizedRoadmapSteps({
        roadmap:
          storedRoadmap,

        maxSteps:
          14,
      });

    switch (
      contextualMode
    ) {
      case "JOB_SKILL_ROADMAP": {
        const personalizedSkillRoadmap =
          buildPersonalizedRoadmapSteps({
            roadmap:
              storedRoadmap,

            categories: [
              "CORE_SKILLS",
              "ROLE_SKILLS",
              "PROJECTS",
              "CV",
            ],

            maxSteps:
              12,
          });

        steps =
          personalizedSkillRoadmap.length >
            0
            ? sortSteps(
                personalizedSkillRoadmap
              )
            : sortSteps(
                mergeUniqueSteps([
                  buildJobSteps(
                    jobMatches
                  ),

                  buildCVSteps(
                    resume
                  ),
                ])
              );

        break;
      }

      case "CV_FOCUS": {
        const personalizedCV =
          buildPersonalizedRoadmapSteps({
            roadmap:
              storedRoadmap,

            categories: [
              "CV",
            ],

            maxSteps:
              8,
          });

        steps =
          sortSteps(
            mergeUniqueSteps([
              personalizedCV,

              buildCVSteps(
                resume
              ),

              buildJobSteps(
                jobMatches
              ),
            ])
          )
            .slice(
              0,
              12
            );

        break;
      }

      case "INTERVIEW_FOCUS": {
        const personalizedInterview =
          buildPersonalizedRoadmapSteps({
            roadmap:
              storedRoadmap,

            categories: [
              "INTERVIEW",
            ],

            maxSteps:
              8,
          });

        steps =
          sortSteps(
            mergeUniqueSteps([
              personalizedInterview,

              buildInterviewSteps(
                interview
              ),

              buildJobSteps(
                jobMatches
              ),
            ])
          )
            .slice(
              0,
              12
            );

        break;
      }

      case "GENERAL":
      default:
        steps =
          sortSteps(
            mergeUniqueSteps([
              personalizedAll,

              buildCVSteps(
                resume
              ),

              buildJobSteps(
                jobMatches
              ),

              buildInterviewSteps(
                interview
              ),

              buildProgressSteps(
                progress
              ),

              buildCareerGoalSteps(
                input.targetRole,
                input.careerGoal
              ),
            ])
          )
            .slice(
              0,
              16
            );

        break;
    }

    return {
      found:
        true,

      data: {
        resume,

        jobMatches,

        interview,

        progress,

        targetRole:
          input.targetRole,

        careerGoal:
          input.careerGoal,

        contextIntent:
          input.contextIntent,

        userMessage:
          input.userMessage,

        contextualMode,

        personalizedRoadmapAvailable:
          storedRoadmap.some(
            (
              milestone
            ) =>
              (
                milestone
                  .recommendations
                  ?.length ||
                0
              ) >
              0
          ),

        personalizedRoadmapSections:
          storedRoadmap.filter(
            (
              milestone
            ) =>
              (
                milestone
                  .recommendations
                  ?.length ||
                0
              ) >
              0
          ).length,

        steps,

        topStep:
          steps[0],
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerNextStepsReply =
  (
    context:
      ICareerNextStepsContext
  ): string => {
    if (
      context.steps.length ===
      0
    ) {
      return "Your current data looks stable. Keep applying to suitable roles, continue interview practice, and update your CV as your skills and experience grow.";
    }

    const topSteps =
      context.steps.slice(
        0,
        4
      );

    const formatted =
      topSteps.map(
        (
          step,
          index
        ) =>
          `${index + 1}. ${step.title}: ${step.description}`
      );

    const prefix =
      context.contextualMode ===
        "JOB_SKILL_ROADMAP"
        ? context.targetRole
          ? `Based on the ${context.targetRole} job-search direction we were discussing, here is a focused roadmap for the skills you should strengthen:`
          : "Based on the job-search direction we were discussing, here is a focused roadmap for the skills you should strengthen:"
        : context.contextualMode ===
            "CV_FOCUS"
          ? "Based on the CV topic we were discussing, these should be your next CV priorities:"
          : context.contextualMode ===
              "INTERVIEW_FOCUS"
            ? "Based on the interview topic we were discussing, these should be your next interview priorities:"
            : context.targetRole
              ? `Based on your current InterviewIQ data and your target role of ${context.targetRole}, these should be your next priorities:`
              : "Based on your current InterviewIQ data, these should be your next priorities:";

    return [
      prefix,
      ...formatted,
    ].join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerNextStepsSummary =
  (
    context:
      ICareerNextStepsContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      careerGoal:
        context.careerGoal,

      contextIntent:
        context.contextIntent,

      contextualMode:
        context.contextualMode,

      userMessage:
        context.userMessage,

      totalSteps:
        context.steps.length,

      personalizedRoadmapAvailable:
        context
          .personalizedRoadmapAvailable,

      personalizedRoadmapSections:
        context
          .personalizedRoadmapSections,

      topStep:
        context.topStep,

      steps:
        context.steps,

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

        personalizedRoadmap:
          Boolean(
            context
              .personalizedRoadmapAvailable
          ),
      },
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerNextStepsContext,

  buildCareerNextStepsReply,

  buildCareerNextStepsSummary,
};