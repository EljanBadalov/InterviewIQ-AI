import {
  type CareerResponseFocus,
} from "./careerResponseFocusService";

import {
  type ICareerResumeContext,
} from "./careerContextService";

import {
  type ICareerJobMatchingResult,
} from "./careerJobContextService";

import {
  type ICareerInterviewContext,
} from "./careerInterviewContextService";

import {
  type ICareerProgressContext,
} from "./careerProgressService";

import {
  type ICareerNextStepsContext,
} from "./careerNextStepsService";

import {
  type ICareerGoalContext,
} from "./careerGoalService";

import {
  type ICareerJobSearchHelpContext,
} from "./careerJobSearchHelpService";


import qwenService from "./qwenService";

import {
  isCareerIntentCacheable,
  trySaveCareerResponseCache,
  type ICareerCacheContext,
} from "./careerResponseCacheService";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerDynamicResponseInput {
  message: string;

  intent: string;

  focus: CareerResponseFocus;

  targetRole?: string;
  /** Per-turn subject; independent of the account's active career. */
  conversationSubject?: string;
  activeCareer?: {targetRole:string;roleKey:string|null;revision:number};

  resume?: ICareerResumeContext;

  jobMatches?: ICareerJobMatchingResult;

  interview?: ICareerInterviewContext;

  progress?: ICareerProgressContext;

  nextSteps?: ICareerNextStepsContext;

  careerGoal?: ICareerGoalContext;

  jobSearchHelp?: ICareerJobSearchHelpContext;
}


export interface ICareerConversationTurn {
  role: "user" | "assistant";
  content: string;

  metadata?: {
    careerSubject?: string;
    recommendedTopics?: string[];
  };
}

/*
 * Optional smart-generation context is kept separate from the existing
 * ICareerDynamicResponseInput so the original interface remains
 * backward-compatible.
 */
export interface ICareerSmartResponseInput
  extends ICareerDynamicResponseInput {
  userId?: string;

  customerName?: string;

  careerGoalText?: string;

  skillsFocus?: string[];

  conversationHistory?: ICareerConversationTurn[];

  careerRecommendationHistory?: ICareerConversationTurn[];

  fullAssistantAnswerHistory?: string[];

  resumeId?: string;

  interviewId?: string;

  resumeUpdatedAt?: Date;

  interviewUpdatedAt?: Date;

  cacheTtlMinutes?: number;

  cacheSimilarityThreshold?: number;
}

export interface ICareerDynamicResponseResult {
  generated: boolean;

  reply?: string;

  focus: CareerResponseFocus;

  metadata: {
    strategy: string;

    dataSources: string[];

    careerSubject?: string;

    recommendedTopics?: string[];
  };
}

/* =========================================================
   HELPERS
========================================================= */

const formatList = (
  items: string[],
  limit = 4
): string => {
  return items
    .slice(
      0,
      limit
    )
    .join(", ");
};

const getScoreDirection = (
  score: number
): "strong" | "moderate" | "weak" => {
  if (
    score >=
    80
  ) {
    return "strong";
  }

  if (
    score >=
    65
  ) {
    return "moderate";
  }

  return "weak";
};

const getLowestResumeArea = (
  resume: ICareerResumeContext
) => {
  const areas = [
    {
      label:
        "ATS readiness",

      score:
        resume.atsScore,
    },

    {
      label:
        "content quality",

      score:
        resume.contentScore,
    },

    {
      label:
        "structure",

      score:
        resume.structureScore,
    },

    {
      label:
        "skills presentation",

      score:
        resume.skillsScore,
    },

    {
      label:
        "experience presentation",

      score:
        resume.experienceScore,
    },
  ];

  return areas.sort(
    (
      a,
      b
    ) =>
      a.score -
      b.score
  )[0];
};

const getHighestResumeArea = (
  resume: ICareerResumeContext
) => {
  const areas = [
    {
      label:
        "ATS readiness",

      score:
        resume.atsScore,
    },

    {
      label:
        "content quality",

      score:
        resume.contentScore,
    },

    {
      label:
        "structure",

      score:
        resume.structureScore,
    },

    {
      label:
        "skills presentation",

      score:
        resume.skillsScore,
    },

    {
      label:
        "experience presentation",

      score:
        resume.experienceScore,
    },
  ];

  return areas.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score
  )[0];
};

/* =========================================================
   CV ANALYSIS
========================================================= */

const buildCVAnalysisDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const resume =
    input.resume;

  if (!resume) {
    return undefined;
  }

  switch (
  input.focus
  ) {
    case "OVERVIEW": {
      const lowest =
        getLowestResumeArea(
          resume
        );

      const highest =
        getHighestResumeArea(
          resume
        );

      const parts:
        string[] = [];

      parts.push(
        `Your CV currently scores ${resume.overallScore}/100 overall.`
      );

      parts.push(
        `Your strongest measurable area is ${highest.label} at ${highest.score}/100, while your weakest area is ${lowest.label} at ${lowest.score}/100.`
      );

      if (
        resume.strengths.length >
        0
      ) {
        parts.push(
          `The analysis also highlights strengths such as ${formatList(
            resume.strengths,
            3
          )}.`
        );
      }

      if (
        resume.recommendations.length >
        0
      ) {
        parts.push(
          `The most useful next improvement is: ${resume.recommendations[0]}`
        );
      }

      return parts.join(
        " "
      );
    }

    case "WEAKNESSES": {
      const lowest =
        getLowestResumeArea(
          resume
        );

      const parts:
        string[] = [];

      parts.push(
        `The weakest measurable area in your current CV is ${lowest.label} at ${lowest.score}/100.`
      );

      if (
        resume.weaknesses.length >
        0
      ) {
        parts.push(
          `The detailed analysis also flags: ${formatList(
            resume.weaknesses,
            3
          )}.`
        );
      }

      if (
        resume.atsSuggestions.length >
        0 &&
        lowest.label ===
        "ATS readiness"
      ) {
        parts.push(
          `For ATS specifically, I would focus on ${formatList(
            resume.atsSuggestions,
            2
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "STRENGTHS": {
      const highest =
        getHighestResumeArea(
          resume
        );

      const parts:
        string[] = [];

      parts.push(
        `Your strongest measurable CV area is ${highest.label} at ${highest.score}/100.`
      );

      if (
        resume.strengths.length >
        0
      ) {
        parts.push(
          `Your strongest qualitative signals are ${formatList(
            resume.strengths,
            4
          )}.`
        );
      }

      if (
        resume.skillsDetected.length >
        0
      ) {
        parts.push(
          `Your CV also shows useful skills including ${formatList(
            resume.skillsDetected,
            6
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "ATS": {
      const level =
        getScoreDirection(
          resume.atsScore
        );

      const parts:
        string[] = [];

      parts.push(
        `Your ATS score is ${resume.atsScore}/100, which I would classify as ${level}.`
      );

      if (
        resume.atsSuggestions.length >
        0
      ) {
        parts.push(
          `The highest-value ATS improvements are ${formatList(
            resume.atsSuggestions,
            3
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "SKILLS": {
      const parts:
        string[] = [];

      parts.push(
        `Your current skills score is ${resume.skillsScore}/100.`
      );

      if (
        resume.skillsDetected.length >
        0
      ) {
        parts.push(
          `Your CV currently demonstrates ${formatList(
            resume.skillsDetected,
            7
          )}.`
        );
      }

      if (
        resume.missingSkills.length >
        0
      ) {
        parts.push(
          `The main skills worth strengthening or adding are ${formatList(
            resume.missingSkills,
            5
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "EXPERIENCE": {
      const parts:
        string[] = [];

      parts.push(
        `Your experience score is ${resume.experienceScore}/100.`
      );

      if (
        resume.strengths.some(
          (
            item
          ) =>
            item
              .toLowerCase()
              .includes(
                "experience"
              )
        )
      ) {
        parts.push(
          "Professional experience is already one of the positive signals detected in your CV."
        );
      }

      return parts.join(
        " "
      );
    }

    case "STRUCTURE": {
      const parts:
        string[] = [];

      parts.push(
        `Your CV structure score is ${resume.structureScore}/100.`
      );

      if (
        resume.formattingFeedback.length >
        0
      ) {
        parts.push(
          `The most relevant structural feedback is ${formatList(
            resume.formattingFeedback,
            3
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "CONTENT": {
      const parts:
        string[] = [];

      parts.push(
        `Your CV content score is ${resume.contentScore}/100.`
      );

      if (
        resume.recommendations.length >
        0
      ) {
        parts.push(
          `For content improvement, I would prioritize ${formatList(
            resume.recommendations,
            3
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "PRIORITIES": {
      const lowest =
        getLowestResumeArea(
          resume
        );

      const parts:
        string[] = [];

      parts.push(
        `I would start with ${lowest.label}, because it is currently your lowest-scoring CV area at ${lowest.score}/100.`
      );

      if (
        resume.recommendations.length >
        0
      ) {
        parts.push(
          `After that, work through these recommendations: ${formatList(
            resume.recommendations,
            3
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    case "JOB_ALIGNMENT": {
      const role =
        input.targetRole;

      const parts:
        string[] = [];

      if (role) {
        parts.push(
          `For ${role} roles, your CV currently has an overall score of ${resume.overallScore}/100 and a skills score of ${resume.skillsScore}/100.`
        );
      } else {
        parts.push(
          `Your CV currently has an overall score of ${resume.overallScore}/100 and a skills score of ${resume.skillsScore}/100.`
        );
      }

      if (
        resume.skillsDetected.length >
        0
      ) {
        parts.push(
          `The strongest role-relevant signals are ${formatList(
            resume.skillsDetected,
            6
          )}.`
        );
      }

      return parts.join(
        " "
      );
    }

    default:
      return undefined;
  }
};

/* =========================================================
   JOB SEARCH HELP
========================================================= */

const buildJobSearchDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const data =
    input.jobSearchHelp;

  if (!data) {
    return undefined;
  }

  const strategy =
    data.strategy;

  const recommendedTitles =
    strategy.recommendedTitles ?? [];

  const extendedStrategy =
    strategy as typeof strategy & {
      prioritySkills?: string[];
      strongestMatchedSkills?: string[];
      suggestedApproach?: string[];
    };

  const prioritySkills =
    extendedStrategy.prioritySkills ?? [];

  const strongestMatchedSkills =
    extendedStrategy.strongestMatchedSkills ?? [];

  const suggestedApproach =
    extendedStrategy.suggestedApproach ?? [];

  switch (
  input.focus
  ) {
    case "JOB_ALIGNMENT":
    case "OVERVIEW": {
      const parts:
        string[] = [];

      if (
        strategy.bestMatchScore !==
        undefined
      ) {
        parts.push(
          `Your strongest current job match is ${strategy.bestMatchScore}%.`
        );
      }

      if (
        recommendedTitles.length >
        0
      ) {
        parts.push(
          `Based on your current InterviewIQ data, I would focus your search on roles such as ${formatList(
            recommendedTitles,
            5
          )}.`
        );
      }

      if (
        prioritySkills.length >
        0
      ) {
        parts.push(
          `The main skills worth strengthening while you search are ${formatList(
            prioritySkills,
            4
          )}.`
        );
      }

      return parts.length >
        0
        ? parts.join(
          " "
        )
        : undefined;
    }

    case "SKILLS": {
      const parts:
        string[] = [];

      if (
        strongestMatchedSkills.length >
        0
      ) {
        parts.push(
          `Your strongest job-aligned skills are ${formatList(
            strongestMatchedSkills,
            6
          )}.`
        );
      }

      if (
        prioritySkills.length >
        0
      ) {
        parts.push(
          `The next skills I would strengthen are ${formatList(
            prioritySkills,
            5
          )}.`
        );
      }

      if (
        parts.length ===
        0 &&
        recommendedTitles.length >
        0
      ) {
        parts.push(
          `Your current profile is best aligned with roles such as ${formatList(
            recommendedTitles,
            5
          )}. Use the missing-skill information from individual job matches to decide which technical skills to strengthen first.`
        );
      }

      return parts.length >
        0
        ? parts.join(
          " "
        )
        : undefined;
    }

    case "PRIORITIES": {
      if (
        suggestedApproach.length >
        0
      ) {
        return `Your highest-value job-search priorities are: ${formatList(
          suggestedApproach,
          4
        )}.`;
      }

      const parts:
        string[] = [];

      if (
        recommendedTitles.length >
        0
      ) {
        parts.push(
          `Prioritize applications for ${formatList(
            recommendedTitles,
            4
          )}.`
        );
      }

      if (
        prioritySkills.length >
        0
      ) {
        parts.push(
          `At the same time, strengthen ${formatList(
            prioritySkills,
            4
          )}.`
        );
      }

      return parts.length >
        0
        ? parts.join(
          " "
        )
        : undefined;
    }

    default:
      return undefined;
  }
};

/* =========================================================
   INTERVIEW FEEDBACK
========================================================= */

const buildInterviewDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const interview =
    input.interview;

  if (!interview) {
    return undefined;
  }

  const technicalAccuracy =
    interview.averageTechnicalAccuracy;

  const completeness =
    interview.averageCompleteness;

  const communication =
    interview.averageCommunication;

  const improvements =
    interview.finalReport
      ?.improvements ?? [];

  const recommendations =
    interview.finalReport
      ?.recommendations ?? [];

  const strengths =
    interview.finalReport
      ?.strengths ?? [];

  const summary =
    interview.finalReport
      ?.summary;

  switch (
  input.focus
  ) {
    case "OVERVIEW": {
      const parts:
        string[] = [];

      parts.push(
        `Your latest completed interview score is ${interview.overallScore}/100.`
      );

      parts.push(
        `Technical accuracy is ${technicalAccuracy}/100, completeness is ${completeness}/100, and communication is ${communication}/100.`
      );

      if (summary) {
        parts.push(
          summary
        );
      }

      if (
        recommendations.length >
        0
      ) {
        parts.push(
          `A high-priority next step is: ${recommendations[0]}`
        );
      }

      return parts.join(
        " "
      );
    }

    case "INTERVIEW_TECHNICAL":
      return `Your technical accuracy score is ${technicalAccuracy}/100. ${improvements.length >
        0
        ? `A useful technical improvement area is: ${improvements[0]}`
        : "Your saved feedback does not currently identify a specific technical weakness."
        }`;

    case "INTERVIEW_COMMUNICATION":
      return `Your communication score is ${communication}/100. ${recommendations.length >
        0
        ? `A useful next step is: ${recommendations[0]}`
        : "Your communication performance is currently strong."
        }`;

    case "INTERVIEW_COMPLETENESS":
      return `Your completeness score is ${completeness}/100. ${improvements.length >
        0
        ? `One useful area to improve is: ${improvements[0]}`
        : "Focus on answering every part of the question and supporting your reasoning with concrete examples."
        }`;

    case "WEAKNESSES":
      if (
        improvements.length >
        0
      ) {
        return `The main areas to improve from your latest interview are ${formatList(
          improvements,
          4
        )}.`;
      }

      return "Your latest interview feedback does not currently list major improvement areas.";

    case "STRENGTHS":
      if (
        strengths.length >
        0
      ) {
        return `Your strongest interview signals are ${formatList(
          strengths,
          4
        )}. Your technical accuracy is ${technicalAccuracy}/100 and communication is ${communication}/100.`;
      }

      return `Your strongest measurable interview signals are technical accuracy at ${technicalAccuracy}/100 and communication at ${communication}/100.`;

    default:
      return undefined;
  }
};

/* =========================================================
   CAREER PROGRESS
========================================================= */

const buildProgressDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const progress =
    input.progress;

  if (!progress) {
    return undefined;
  }

  if (
    input.focus !==
    "PROGRESS" &&
    input.focus !==
    "COMPARISON" &&
    input.focus !==
    "OVERVIEW"
  ) {
    return undefined;
  }

  const parts:
    string[] = [];

  if (
    progress.strongestImprovements.length >
    0
  ) {
    parts.push(
      `Your strongest recent improvements are ${formatList(
        progress.strongestImprovements,
        3
      )}.`
    );
  }

  if (
    progress.areasToWatch.length >
    0
  ) {
    parts.push(
      `The main areas to watch are ${formatList(
        progress.areasToWatch,
        3
      )}.`
    );
  }

  if (
    progress.highlights.length >
    0
  ) {
    parts.push(
      `${formatList(
        progress.highlights,
        2
      )}`
    );
  }

  return parts.length >
    0
    ? parts.join(
      " "
    )
    : undefined;
};

/* =========================================================
   NEXT STEPS
========================================================= */

const buildNextStepsDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const nextSteps =
    input.nextSteps;

  if (!nextSteps) {
    return undefined;
  }

  if (
    input.focus !==
    "ROADMAP" &&
    input.focus !==
    "PRIORITIES"
  ) {
    return undefined;
  }

  if (
    nextSteps.steps.length ===
    0
  ) {
    return undefined;
  }

  const items =
    nextSteps.steps
      .slice(
        0,
        5
      )
      .map(
        (
          step,
          index
        ) =>
          `${index + 1}. ${step.title}: ${step.description}`
      );

  if (
    input.focus ===
    "ROADMAP"
  ) {
    return `Here is a focused roadmap based on your current InterviewIQ data: ${items.join(
      " "
    )}`;
  }

  return `Your highest-priority next steps are: ${items.join(
    " "
  )}`;
};

/* =========================================================
   CAREER GOAL
========================================================= */

const buildCareerGoalDynamicReply = (
  input:
    ICareerDynamicResponseInput
): string | undefined => {
  const goal =
    input.careerGoal;

  if (!goal) {
    return undefined;
  }

  if (
    input.focus !==
    "GOAL_READINESS" &&
    input.focus !==
    "OVERVIEW"
  ) {
    return undefined;
  }

  const parts:
    string[] = [];

  parts.push(
    `Your readiness for ${goal.targetRole} is currently ${goal.readinessScore}/100, which is rated as ${goal.readinessLevel}.`
  );

  if (
    goal.strengths.length >
    0
  ) {
    parts.push(
      `Your strongest readiness signals include ${formatList(
        goal.strengths.map(
          (
            item
          ) =>
            item.title
        ),
        3
      )}.`
    );
  }

  if (
    goal.gaps.length >
    0
  ) {
    parts.push(
      `The biggest gaps to address are ${formatList(
        goal.gaps.map(
          (
            item
          ) =>
            item.title
        ),
        3
      )}.`
    );
  }

  return parts.join(
    " "
  );
};

/* =========================================================
   MAIN GENERATOR
========================================================= */

export const buildCareerDynamicResponse =
  (
    input:
      ICareerDynamicResponseInput
  ): ICareerDynamicResponseResult => {
    const dataSources:
      string[] = [];

    if (
      input.resume
    ) {
      dataSources.push(
        "resume"
      );
    }

    if (
      input.jobMatches
    ) {
      dataSources.push(
        "jobMatching"
      );
    }

    if (
      input.interview
    ) {
      dataSources.push(
        "interview"
      );
    }

    if (
      input.progress
    ) {
      dataSources.push(
        "progress"
      );
    }

    if (
      input.nextSteps
    ) {
      dataSources.push(
        "nextSteps"
      );
    }

    if (
      input.careerGoal
    ) {
      dataSources.push(
        "careerGoal"
      );
    }

    if (
      input.jobSearchHelp
    ) {
      dataSources.push(
        "jobSearchHelp"
      );
    }

    let reply:
      string | undefined;

    if (
      input.intent ===
      "CV_ANALYSIS" ||
      input.intent ===
      "CV_IMPROVEMENT" ||
      input.intent ===
      "SKILL_GAP" ||
      input.intent ===
      "PROFILE_SUMMARY"
    ) {
      reply =
        buildCVAnalysisDynamicReply(
          input
        );
    }

    if (
      !reply &&
      input.intent ===
      "JOB_SEARCH_HELP"
    ) {
      reply =
        buildJobSearchDynamicReply(
          input
        );
    }

    if (
      !reply &&
      input.intent ===
      "INTERVIEW_FEEDBACK"
    ) {
      reply =
        buildInterviewDynamicReply(
          input
        );
    }

    if (
      !reply &&
      input.intent ===
      "CAREER_PROGRESS"
    ) {
      reply =
        buildProgressDynamicReply(
          input
        );
    }

    if (
      !reply &&
      input.intent ===
      "NEXT_STEPS"
    ) {
      reply =
        buildNextStepsDynamicReply(
          input
        );
    }

    if (
      !reply &&
      input.intent ===
      "CAREER_GOAL"
    ) {
      reply =
        buildCareerGoalDynamicReply(
          input
        );
    }

    return {
      generated:
        Boolean(
          reply
        ),

      reply,

      focus:
        input.focus,

      metadata: {
        strategy:
          reply
            ? "DYNAMIC_RULE_BASED"
            : "STATIC_FALLBACK",

        dataSources,
      },
    };
  };


/* =========================================================
   SMART CACHE + QWEN FALLBACK
========================================================= */

const RESUME_CONTEXT_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "SKILL_GAP",
    "PROFILE_SUMMARY",
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "NEXT_STEPS",
    "CAREER_GOAL",
  ]);

const INTERVIEW_CONTEXT_INTENTS =
  new Set<string>([
    "INTERVIEW_FEEDBACK",
    "INTERVIEW_PREP",
    "CAREER_PROGRESS",
    "NEXT_STEPS",
    "CAREER_GOAL",
  ]);

const normalizeSmartIntent = (
  value: string
): string => {
  return value
    .replace(/\s+/g, "_")
    .trim()
    .toUpperCase();
};

const buildSmartCacheContext = (
  input:
    ICareerSmartResponseInput
): ICareerCacheContext => {
  return {
    resumeId:
      input.resumeId,

    interviewId:
      input.interviewId,

    targetRole:
      input.targetRole,

    resumeUpdatedAt:
      input.resumeUpdatedAt,

    interviewUpdatedAt:
      input.interviewUpdatedAt,
  };
};

const canUseSmartCache = (
  input:
    ICareerSmartResponseInput
): boolean => {
  if (
    !input.userId ||
    !isCareerIntentCacheable(
      input.intent
    )
  ) {
    return false;
  }

  const intent =
    normalizeSmartIntent(
      input.intent
    );

  if (
    RESUME_CONTEXT_INTENTS.has(
      intent
    ) &&
    !input.resumeId
  ) {
    return false;
  }

  if (
    INTERVIEW_CONTEXT_INTENTS.has(
      intent
    ) &&
    !input.interviewId
  ) {
    return false;
  }

  return true;
};

const safeJsonSnippet = (
  value: unknown,
  maxLength = 3500
): string => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  try {
    const serialized =
      JSON.stringify(
        value
      );

    if (
      serialized.length <=
      maxLength
    ) {
      return serialized;
    }

    return (
      serialized.slice(
        0,
        maxLength
      ) +
      "..."
    );
  } catch {
    return "";
  }
};

const toSafeDatasetValue = (
  value: unknown,
  maxLength: number
): unknown => {
  const serialized =
    safeJsonSnippet(
      value,
      maxLength
    );

  if (!serialized) {
    return undefined;
  }

  try {
    return JSON.parse(
      serialized
    );
  } catch {
    return serialized;
  }
};

const cleanDatasetString = (
  value: unknown,
  maxLength = 700
): string | undefined => {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const cleaned =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (!cleaned) {
    return undefined;
  }

  return cleaned.slice(
    0,
    maxLength
  );
};


const cleanDatasetStringArray = (
  value: unknown,
  limit = 20,
  maxItemLength = 350
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    string[] = [];

  const seen =
    new Set<string>();

  for (
    const raw
    of value
  ) {
    const cleaned =
      cleanDatasetString(
        raw,
        maxItemLength
      );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

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
      cleaned
    );

    if (
      result.length >=
      limit
    ) {
      break;
    }
  }

  return result;
};


const toDatasetRecord = (
  value: unknown
): Record<
  string,
  unknown
> | undefined => {
  if (
    typeof value !==
    "object" ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  return value as Record<
    string,
    unknown
  >;
};


const toDatasetRecordArray = (
  value: unknown
): Array<
  Record<
    string,
    unknown
  >
> => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item
      ) =>
        toDatasetRecord(
          item
        )
    )
    .filter(
      (
        item
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(
          item
        )
    );
};


const cleanScore = (
  value: unknown
): number | undefined => {
  const numeric =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return undefined;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        numeric
      )
    )
  );
};


const buildVerifiedExperienceEntries = (
  value: unknown
): Array<
  Record<
    string,
    unknown
  >
> => {
  return toDatasetRecordArray(
    value
  )
    .slice(
      0,
      12
    )
    .map(
      (
        item
      ) => {
        const result:
          Record<
            string,
            unknown
          > = {};

        const title =
          cleanDatasetString(
            item.title,
            180
          );

        const company =
          cleanDatasetString(
            item.company,
            180
          );

        const location =
          cleanDatasetString(
            item.location,
            180
          );

        const employmentType =
          cleanDatasetString(
            item.employmentType,
            120
          );

        const startDate =
          cleanDatasetString(
            item.startDate,
            80
          );

        const endDate =
          cleanDatasetString(
            item.endDate,
            80
          );

        const description =
          cleanDatasetString(
            item.description,
            900
          );

        const bullets =
          cleanDatasetStringArray(
            item.bullets,
            12,
            700
          );

        const technologies =
          cleanDatasetStringArray(
            item.technologies,
            20,
            120
          );

        if (title) {
          result.title =
            title;
        }

        if (company) {
          result.company =
            company;
        }

        if (location) {
          result.location =
            location;
        }

        if (
          employmentType
        ) {
          result.employmentType =
            employmentType;
        }

        if (startDate) {
          result.startDate =
            startDate;
        }

        if (endDate) {
          result.endDate =
            endDate;
        }

        if (
          item.isCurrent ===
          true
        ) {
          result.isCurrent =
            true;
        }

        if (description) {
          result.description =
            description;
        }

        if (
          bullets.length >
          0
        ) {
          result.bullets =
            bullets;
        }

        if (
          technologies.length >
          0
        ) {
          result.technologies =
            technologies;
        }

        return result;
      }
    )
    .filter(
      (
        item
      ) =>
        Object.keys(
          item
        ).length >
        0
    );
};


const buildVerifiedProjectEntries = (
  value: unknown
): Array<
  Record<
    string,
    unknown
  >
> => {
  return toDatasetRecordArray(
    value
  )
    .slice(
      0,
      12
    )
    .map(
      (
        item
      ) => {
        const result:
          Record<
            string,
            unknown
          > = {};

        const name =
          cleanDatasetString(
            item.name,
            180
          );

        const role =
          cleanDatasetString(
            item.role,
            160
          );

        const description =
          cleanDatasetString(
            item.description,
            900
          );

        const startDate =
          cleanDatasetString(
            item.startDate,
            80
          );

        const endDate =
          cleanDatasetString(
            item.endDate,
            80
          );

        const bullets =
          cleanDatasetStringArray(
            item.bullets,
            12,
            700
          );

        const technologies =
          cleanDatasetStringArray(
            item.technologies,
            20,
            120
          );

        const url =
          cleanDatasetString(
            item.url,
            300
          );

        const github =
          cleanDatasetString(
            item.github,
            300
          );

        if (name) {
          result.name =
            name;
        }

        if (role) {
          result.role =
            role;
        }

        if (description) {
          result.description =
            description;
        }

        if (startDate) {
          result.startDate =
            startDate;
        }

        if (endDate) {
          result.endDate =
            endDate;
        }

        if (
          bullets.length >
          0
        ) {
          result.bullets =
            bullets;
        }

        if (
          technologies.length >
          0
        ) {
          result.technologies =
            technologies;
        }

        if (url) {
          result.url =
            url;
        }

        if (github) {
          result.github =
            github;
        }

        return result;
      }
    )
    .filter(
      (
        item
      ) =>
        Object.keys(
          item
        ).length >
        0
    );
};


const buildVerifiedEducationEntries = (
  value: unknown
): Array<
  Record<
    string,
    unknown
  >
> => {
  return toDatasetRecordArray(
    value
  )
    .slice(
      0,
      10
    )
    .map(
      (
        item
      ) => {
        const result:
          Record<
            string,
            unknown
          > = {};

        const institution =
          cleanDatasetString(
            item.institution,
            220
          );

        const degree =
          cleanDatasetString(
            item.degree,
            180
          );

        const field =
          cleanDatasetString(
            item.field,
            180
          );

        const startDate =
          cleanDatasetString(
            item.startDate,
            80
          );

        const endDate =
          cleanDatasetString(
            item.endDate,
            80
          );

        if (
          institution
        ) {
          result.institution =
            institution;
        }

        if (degree) {
          result.degree =
            degree;
        }

        if (field) {
          result.field =
            field;
        }

        if (startDate) {
          result.startDate =
            startDate;
        }

        if (endDate) {
          result.endDate =
            endDate;
        }

        if (
          item.isCurrent ===
          true
        ) {
          result.isCurrent =
            true;
        }

        return result;
      }
    )
    .filter(
      (
        item
      ) =>
        Object.keys(
          item
        ).length >
        0
    );
};


const buildVerifiedResumeContext = (
  resume:
    ICareerResumeContext
): Record<
  string,
  unknown
> => {
  const source =
    resume as unknown as Record<
      string,
      unknown
    >;

  const profile =
    toDatasetRecord(
      source.profile
    );

  const profileSource =
    profile ??
    {};

  const experience =
    buildVerifiedExperienceEntries(
      profileSource.experience ??
      source.experience
    );

  const projects =
    buildVerifiedProjectEntries(
      profileSource.projects ??
      source.projects
    );

  const education =
    buildVerifiedEducationEntries(
      profileSource.education ??
      source.education
    );

  const detectedSkills =
    cleanDatasetStringArray(
      source.skillsDetected,
      30,
      120
    );

  const profileSkills = [
    ...cleanDatasetStringArray(
      profileSource.skills,
      30,
      120
    ),
    ...cleanDatasetStringArray(
      profileSource.technicalSkills,
      30,
      120
    ),
    ...cleanDatasetStringArray(
      profileSource.softSkills,
      20,
      120
    ),
  ];

  const currentSkills =
    cleanDatasetStringArray(
      [
        ...detectedSkills,
        ...profileSkills,
      ],
      40,
      120
    );

  const missingSkills =
    cleanDatasetStringArray(
      source.missingSkills,
      20,
      160
    );

  const recommendedSkills =
    cleanDatasetStringArray(
      source.recommendedSkills,
      20,
      160
    );

  const suggestedSkills =
    cleanDatasetStringArray(
      [
        ...missingSkills,
        ...recommendedSkills,
      ],
      25,
      160
    );

  const scores:
    Record<
      string,
      number
    > = {};

  const scoreEntries:
    Array<
      [
        string,
        unknown
      ]
    > = [
      [
        "overallScore",
        source.overallScore,
      ],
      [
        "atsScore",
        source.atsScore,
      ],
      [
        "contentScore",
        source.contentScore,
      ],
      [
        "structureScore",
        source.structureScore,
      ],
      [
        "skillsScore",
        source.skillsScore,
      ],
      [
        "experienceScore",
        source.experienceScore,
      ],
    ];

  for (
    const [
      key,
      rawValue,
    ]
    of scoreEntries
  ) {
    const score =
      cleanScore(
        rawValue
      );

    if (
      score !==
      undefined
    ) {
      scores[key] =
        score;
    }
  }

  const result:
    Record<
      string,
      unknown
    > = {
    factualAvailability: {
      hasStructuredExperience:
        experience.length >
        0,

      hasExperienceBullets:
        experience.some(
          (
            item
          ) =>
            Array.isArray(
              item.bullets
            ) &&
            item.bullets.length >
            0
        ),

      hasStructuredProjects:
        projects.length >
        0,

      hasStructuredEducation:
        education.length >
        0,

      hasCurrentSkills:
        currentSkills.length >
        0,

      hasSuggestedSkills:
        suggestedSkills.length >
        0,
    },

    importantInterpretation: {
      currentSkills:
        "These are skills detected/listed as present in the CV.",

      suggestedSkills:
        "These are suggestions or gaps. They MUST NOT be described as skills the candidate already has.",

      analysisText:
        "Strengths, weaknesses, suggestions, and recommendations are analysis outputs, not proof of a specific employer, project, technology, metric, date, or achievement.",
    },
  };

  if (
    Object.keys(
      scores
    ).length >
    0
  ) {
    result.scores =
      scores;
  }

  const summary =
    cleanDatasetString(
      source.summary,
      1200
    );

  if (summary) {
    result.analysisSummary =
      summary;
  }

  if (
    currentSkills.length >
    0
  ) {
    result.currentSkills =
      currentSkills;
  }

  if (
    suggestedSkills.length >
    0
  ) {
    result.suggestedSkills =
      suggestedSkills;
  }

  const strengths =
    cleanDatasetStringArray(
      source.strengths,
      12,
      450
    );

  if (
    strengths.length >
    0
  ) {
    result.strengths =
      strengths;
  }

  const weaknesses =
    cleanDatasetStringArray(
      source.weaknesses,
      12,
      450
    );

  if (
    weaknesses.length >
    0
  ) {
    result.weaknesses =
      weaknesses;
  }

  const atsSuggestions =
    cleanDatasetStringArray(
      source.atsSuggestions,
      12,
      450
    );

  if (
    atsSuggestions.length >
    0
  ) {
    result.atsSuggestions =
      atsSuggestions;
  }

  const formattingFeedback =
    cleanDatasetStringArray(
      source.formattingFeedback,
      12,
      450
    );

  if (
    formattingFeedback.length >
    0
  ) {
    result.formattingFeedback =
      formattingFeedback;
  }

  const recommendations =
    cleanDatasetStringArray(
      source.recommendations,
      12,
      500
    );

  if (
    recommendations.length >
    0
  ) {
    result.recommendations =
      recommendations;
  }

  if (
    experience.length >
    0
  ) {
    result.verifiedExperience =
      experience;
  }

  if (
    projects.length >
    0
  ) {
    result.verifiedProjects =
      projects;
  }

  if (
    education.length >
    0
  ) {
    result.verifiedEducation =
      education;
  }

  return result;
};


const normalizeConversationHistory = (
  value?: ICareerConversationTurn[]
): ICareerConversationTurn[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        item &&
        (item.role === "user" ||
          item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,

      content: item.content
        .replace(/\s+/g, " ")
        .trim()
        .slice(
          0,
          item.role === "assistant"
            ? 1200
            : 500
        ),
      metadata: item.metadata,
    }));
};

const normalizeTopicForComparison = (
  value: string
): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();


/* =========================================================
   DETERMINISTIC RECOMMENDATION TRACKING (ROOT CAUSE FIX)
========================================================= */

const extractCareerKnowledgeTopics = (
  careerKnowledge: unknown
): string[] => {
  if (
    typeof careerKnowledge !== "object" ||
    careerKnowledge === null
  ) {
    return [];
  }

  const knowledge =
    careerKnowledge as Record<
      string,
      unknown
    >;

  const roleContext =
    typeof knowledge.roleContext === "object" &&
      knowledge.roleContext !== null
      ? knowledge.roleContext as Record<
        string,
        unknown
      >
      : undefined;

  const possibleTopicArrays = [
    knowledge.priorityTopics,
    roleContext?.priorityTopics,
    knowledge.missingTopics,
    roleContext?.missingTopics,
  ];

  const topicItems =
    possibleTopicArrays.flatMap(
      (items) =>
        Array.isArray(items)
          ? items
          : []
    );

  if (topicItems.length === 0) {
    return [];
  }

  const topics: string[] = [];
  const seen = new Set<string>();

  for (const rawItem of topicItems) {
    if (
      typeof rawItem !== "object" ||
      rawItem === null
    ) {
      continue;
    }

    const item =
      rawItem as Record<
        string,
        unknown
      >;

    const topic =
      typeof item.topic === "object" &&
        item.topic !== null
        ? item.topic as Record<
          string,
          unknown
        >
        : item;

    const name =
      typeof topic.name === "string"
        ? topic.name.trim()
        : "";

    if (!name) {
      continue;
    }

    const normalizedName =
      normalizeTopicForComparison(
        name
      );

    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    topics.push(name);
  }

  return topics;
};

const getPreviouslyRecommendedTopicsForSubject = (
  history: ICareerConversationTurn[],
  currentSubject: string
): string[] => {
  const recommendedTopics = new Map<string, string>();

  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const targetSubject = normalize(currentSubject);

  for (const turn of history) {
    if (turn.role !== "assistant") {
      continue;
    }

    const metadata = turn.metadata;

    if (!metadata) {
      continue;
    }

    const turnSubject = metadata.careerSubject;

    if (!turnSubject) {
      continue;
    }

    if (normalize(turnSubject) !== targetSubject) {
      continue;
    }

    const topics = metadata.recommendedTopics;

    if (!Array.isArray(topics)) {
      continue;
    }

    for (const topic of topics) {
      if (typeof topic !== "string") {
        continue;
      }

      const cleanTopic = topic.trim();

      if (!cleanTopic) {
        continue;
      }

      const normalizedTopic = normalize(cleanTopic);

      if (!recommendedTopics.has(normalizedTopic)) {
        recommendedTopics.set(
          normalizedTopic,
          cleanTopic
        );
      }
    }
  }

  return Array.from(recommendedTopics.values());
};


export const buildQwenCareerDataset = (
  input: ICareerSmartResponseInput
): Record<string, unknown> => {
  const dataset: Record<string, unknown> = {
    intent: input.intent,
    focus: input.focus,

    groundingPolicy: {
      useOnlyProvidedPersonalizedFacts: true,
      inventMissingFacts: false,
    },
  };

  if(input.activeCareer)dataset.accountCareer={...input.activeCareer};
  if (input.customerName) {
    dataset.user = {
      name: input.customerName,
    };
  }

  const history =
    normalizeConversationHistory(
      input.conversationHistory
    );

  const additionalInformationRequested =
    requestsAdditionalInformation(
      input.message
    );

  const repeatedOrSimilarQuestion =
    isRepeatedOrSimilarQuestion(
      input.message,
      history
    );

  if (
    additionalInformationRequested
  ) {
    dataset.additionalInformationRequested =
      true;
  }

  if (
    repeatedOrSimilarQuestion
  ) {
    dataset.repeatedOrSimilarQuestion =
      true;
  }

  if (history.length > 0) {
    dataset.recentConversation =
      history.slice(-6);
  }

  const knowledgeSubject =
    input.conversationSubject || input.nextSteps?.knowledgeSubject;

  const questionKnowledge =
    input.nextSteps?.careerKnowledge;

  if (knowledgeSubject) {
    const allKnowledgeTopics = questionKnowledge?.found ? extractCareerKnowledgeTopics(questionKnowledge) : [];
    const previouslyRecommended =
      getPreviouslyRecommendedTopicsForSubject(
        input.careerRecommendationHistory ?? history,
        knowledgeSubject
      );

    const availableTopics = allKnowledgeTopics.filter(
      topic => !previouslyRecommended.some(rec => normalizeTopicForComparison(rec) === normalizeTopicForComparison(topic))
    );

    const questionDataset:
      Record<string, unknown> = {
      subject:
        knowledgeSubject,

      careerKnowledge: questionKnowledge?.found ? toSafeDatasetValue(
          questionKnowledge,
          3200
        ) : undefined,
    };

    const batchSize = 4;
    const freshTopicCandidates = availableTopics.slice(0, batchSize);
    const isExhausted = Boolean(questionKnowledge?.found) && additionalInformationRequested && availableTopics.length === 0;

    questionDataset.freshTopicCandidates = freshTopicCandidates;
    questionDataset.freshTopicsExhausted = isExhausted;

    if (freshTopicCandidates.length > 0) {
      questionDataset.freshTopicInstruction =
        `STRICT DIVERSITY REQUIREMENT: You MUST recommend ONLY these specific unused topics: ${freshTopicCandidates.join(", ")}. Do NOT repeat any previously covered skills.`;
    }

    dataset.question =
      questionDataset;
  }

  const needsResumeEvidence =
    new Set([
      "CV_ANALYSIS",
      "CV_IMPROVEMENT",
      "SKILL_GAP",
      "PROFILE_SUMMARY",
      "JOB_MATCHING",
      "JOB_SEARCH_HELP",
      "INTERVIEW_PREP",
      "NEXT_STEPS",
      "CAREER_GOAL",
    ]).has(
      normalizeSmartIntent(
        input.intent
      )
    );

  if (
    needsResumeEvidence &&
    input.resume
  ) {
    const resumeEvidence =
      buildVerifiedResumeContext(
        input.resume
      );

    if (
      normalizeSmartIntent(
        input.intent
      ) === "SKILL_GAP" &&
      knowledgeSubject
    ) {
      delete resumeEvidence.suggestedSkills;
      delete resumeEvidence.analysisSummary;
      delete resumeEvidence.weaknesses;
      delete resumeEvidence.recommendations;
      delete resumeEvidence.atsSuggestions;
      delete resumeEvidence.formattingFeedback;

      const factualAvailability =
        toDatasetRecord(
          resumeEvidence.factualAvailability
        );

      if (
        factualAvailability
      ) {
        factualAvailability.hasSuggestedSkills =
          false;
      }
    }

    dataset.resumeEvidence =
      resumeEvidence;
  }

  switch (
  normalizeSmartIntent(
    input.intent
  )
  ) {
    case "INTERVIEW_FEEDBACK": {
      if (input.interview) {
        dataset.interview =
          toSafeDatasetValue(
            input.interview,
            1400
          );
      }
      break;
    }

    case "CAREER_PROGRESS": {
      if (input.progress) {
        dataset.careerProgress =
          toSafeDatasetValue(
            input.progress,
            1200
          );
      }
      break;
    }

    case "JOB_MATCHING": {
      if (input.jobMatches) {
        dataset.jobMatches =
          toSafeDatasetValue(
            input.jobMatches,
            1600
          );
      }
      break;
    }

    case "JOB_SEARCH_HELP": {
      if (input.jobSearchHelp) {
        dataset.jobSearchContext =
          toSafeDatasetValue(
            input.jobSearchHelp,
            1400
          );
      }
      break;
    }

    case "CAREER_GOAL": {
      if (input.careerGoal) {
        dataset.careerGoalEvaluation =
          toSafeDatasetValue(
            input.careerGoal,
            1400
          );
      }

      if (input.careerGoalText) {
        dataset.careerGoal =
          input.careerGoalText;
      }
      break;
    }

    case "NEXT_STEPS": {
      if (
        !knowledgeSubject &&
        input.nextSteps?.steps
      ) {
        dataset.nextSteps =
          input.nextSteps.steps
            .slice(0, 6)
            .map(
              (step) => ({
                title:
                  step.title,

                description:
                  step.description,

                category:
                  step.category,

                priority:
                  step.priority,
              })
            );
      }
      break;
    }
  }

  return dataset;
};


const buildQwenCareerSystemPrompt = (
  input: ICareerSmartResponseInput,
  providedDataset?: Record<string, unknown>
): string => {
  const dataset =
    providedDataset ??
    buildQwenCareerDataset(
      input
    );

  const serializedDataset =
    JSON.stringify(
      dataset
    );

  return `
You are InterviewIQ Career Assistant.

Answer the user's CURRENT question directly.

RULES:

1. Use the supplied context when it is relevant to the question.

2. Personalized facts must come only from the supplied context.
Never invent experience, projects, skills, employers, education,
scores, achievements, technologies, dates, or metrics.

3. The subject of the current question has priority over any saved
career target or previous career context. accountCareer is background context only and must never replace the current conversation subject.

4. If question.careerKnowledge exists, it represents knowledge for
the subject currently being asked about. Use it as the primary
career-knowledge source.

5. When answering a skill-gap or improvement question:
- question.careerKnowledge defines the skills and topics relevant to
  the career subject currently being discussed;
- use resumeEvidence only to determine whether those subject-specific
  skills are already present, missing, weakly evidenced, or worth strengthening;
- recommendations must come from question.careerKnowledge, not from
  unrelated skills that merely appear in resumeEvidence.

6. CONVERSATION CONTINUITY AND RESPONSE DIVERSITY

Use recentConversation to understand what the user and assistant
have already discussed.

Avoid unnecessary repetition across consecutive answers.

If the user asks for "other", "more", "another", "else",
"anything else", or otherwise clearly requests additional information:
- prioritize useful information that has not already been given (freshTopicCandidates);
- do not repeat previously recommended items merely to fill the answer;
- continue using the same conversational subject unless the user changes it.

7. RESPONSE DEPTH

Adapt the response depth to the user's request (Default / Short / Detailed).
Explicit user format and scope constraints override presentation defaults.
If exactly two sentences and one exercise are requested, return exactly two plain
sentences about that single exercise: no bullets, headings, extra projects or advice.
Respect exclusions such as no roadmap and no job-hunting advice, including negation.
Use Markdown headings, bullets, or numbered steps only when compatible with the request.
Do not mention datasets, prompts, databases, Qwen, or models.

CONTEXT:
${serializedDataset}
`.trim();
};

const messageRequestsCvSpecificExample = (
  message: string
): boolean => {
  const normalized =
    message
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  return (
    /using my (?:current )?(?:cv|resume)/i.test(
      normalized
    ) ||
    /one of my (?:real )?(?:experience )?bullets?/i.test(
      normalized
    ) ||
    /rewrite (?:one of )?my (?:real )?(?:experience )?bullets?/i.test(
      normalized
    )
  );
};


const hasVerifiedExperienceBullet = (
  input:
    ICareerSmartResponseInput
): boolean => {
  if (
    !input.resume
  ) {
    return false;
  }

  const verified =
    buildVerifiedResumeContext(
      input.resume
    );

  const availability =
    toDatasetRecord(
      verified.factualAvailability
    );

  return (
    availability
      ?.hasExperienceBullets ===
    true
  );
};


const buildSafeCvExampleFallback = (
  input:
    ICareerSmartResponseInput
): string => {
  const verified =
    input.resume
      ? buildVerifiedResumeContext(
        input.resume
      )
      : undefined;

  const currentSkills =
    verified &&
      Array.isArray(
        verified.currentSkills
      )
      ? (
        verified.currentSkills as string[]
      )
      : [];

  const skillHint =
    currentSkills.length >
      0
      ? ` You can use one of your verified skills where appropriate, such as ${currentSkills
        .slice(
          0,
          3
        )
        .join(
          ", "
        )}, but only if that skill was actually used in the experience you are rewriting.`
      : "";

  return (
    "I don't have a verified experience bullet with enough exact detail to rewrite safely without inventing facts." +
    skillHint +
    ' Use this template with only real information from your CV: "Built [feature/system] using [technology you actually used], resulting in [real measurable outcome]." If you share the exact bullet, I can rewrite it without adding any new facts.'
  );
};

const requestsAdditionalInformation = (
  message: string
): boolean => {
  const normalized =
    message
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const patterns = [
    /\bwhat else\b/i,
    /\banything else\b/i,
    /\bsomething else\b/i,
    /\bany other\b/i,
    /\bother (?:skills?|things?|areas?|topics?|recommendations?|options?|ways?)\b/i,
    /\bmore (?:skills?|things?|areas?|topics?|recommendations?|options?|ways?|information|advice)\b/i,
    /\banother (?:skill|thing|area|topic|recommendation|option|way|example)\b/i,
    /\badditional (?:skills?|things?|areas?|topics?|recommendations?|information|advice)\b/i,
    /\bwhat more\b/i,
    /\bwhich other\b/i,
  ];

  return patterns.some(
    (pattern) =>
      pattern.test(normalized)
  );
};

const normalizeQuestionForComparison = (
  value: string
): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();


const isRepeatedOrSimilarQuestion = (
  currentMessage: string,
  history: ICareerConversationTurn[]
): boolean => {
  const current =
    normalizeQuestionForComparison(
      currentMessage
    );

  if (!current) {
    return false;
  }

  if (requestsAdditionalInformation(currentMessage)) {
    return false;
  }

  const previousUserMessages =
    history
      .filter(
        (item) =>
          item.role === "user"
      )
      .slice(-6)
      .map(
        (item) =>
          normalizeQuestionForComparison(
            item.content
          )
      )
      .filter(Boolean);

  if (
    previousUserMessages.includes(
      current
    )
  ) {
    return true;
  }

  const currentWords =
    new Set(
      current
        .split(" ")
        .filter(
          (word) =>
            word.length >= 3
        )
    );

  if (currentWords.size === 0) {
    return false;
  }

  for (
    const previous of
    previousUserMessages
  ) {
    const previousWords =
      new Set(
        previous
          .split(" ")
          .filter(
            (word) =>
              word.length >= 3
          )
      );

    if (
      previousWords.size === 0
    ) {
      continue;
    }

    let shared = 0;

    for (
      const word of
      currentWords
    ) {
      if (
        previousWords.has(
          word
        )
      ) {
        shared += 1;
      }
    }

    const smallerSize =
      Math.min(
        currentWords.size,
        previousWords.size
      );

    const similarity =
      shared /
      smallerSize;

    if (
      similarity >= 0.7
    ) {
      return true;
    }
  }

  return false;
};

const isSimpleCareerGreeting = (
  message: string
): boolean => {
  const normalized =
    message
      .trim()
      .toLowerCase()
      .replace(/[!.,?]+$/g, "")
      .trim();

  return [
    "hi",
    "hello",
    "hey",
    "hey there",
    "hello there",
    "good morning",
    "good afternoon",
    "good evening",
  ].includes(
    normalized
  );
};


const buildCareerGreetingReply = (
  input: ICareerSmartResponseInput
): string => {
  const name =
    cleanDatasetString(
      input.customerName,
      120
    );

  const firstName =
    name
      ?.split(/\s+/)[0]
      ?.trim();

  if (firstName) {
    return `Hi, ${firstName}! I'm your InterviewIQ Career Assistant. How can I help you today?`;
  }

  return "Hi! I'm your InterviewIQ Career Assistant. How can I help you today?";
};

const buildFreshTopicsExhaustedReply = (
  input: ICareerSmartResponseInput,
  dataset: Record<string, unknown>
): string => {
  const question =
    typeof dataset.question === "object" &&
      dataset.question !== null
      ? dataset.question as Record<
        string,
        unknown
      >
      : undefined;

  const subject =
    typeof question?.subject === "string" &&
      question.subject.trim()
      ? question.subject.trim()
      : input.targetRole?.trim() ||
      "this career path";

  return (
    `We've already covered the main ${subject} skill areas available ` +
    `in your current career knowledge, so I don't want to repeat the same ` +
    `skills as if they were new recommendations. ` +
    `The most useful next step is to go deeper into those areas—for example, ` +
    `I can prioritize them for you, build a learning roadmap, suggest practical ` +
    `projects and exercises, or explain the advanced subtopics you should learn next.`
  );
};


const generateQwenCareerReply =
  async (
    input:
      ICareerSmartResponseInput
  ): Promise<
    { reply?: string; recommendedTopics?: string[]; subject?: string } | undefined
  > => {
    if (
      isSimpleCareerGreeting(
        input.message
      )
    ) {
      return { reply: buildCareerGreetingReply(input) };
    }

    const dataset =
      buildQwenCareerDataset(
        input
      );

    const question =
      typeof dataset.question === "object" &&
        dataset.question !== null
        ? dataset.question as Record<
          string,
          unknown
        >
        : undefined;

    const freshTopicsExhausted =
      question?.freshTopicsExhausted ===
      true;

    const additionalInformationRequested =
      dataset.additionalInformationRequested ===
      true;

    if (
      freshTopicsExhausted &&
      additionalInformationRequested
    ) {
      return {
        reply: buildFreshTopicsExhaustedReply(input, dataset),
        recommendedTopics: [],
        subject: typeof question?.subject === "string" ? question.subject : undefined
      };
    }

    const systemPrompt =
      buildQwenCareerSystemPrompt(
        input,
        dataset
      );

    const userPrompt = `
CURRENT USER MESSAGE:
"""
${input.message.trim()}
"""

Answer the CURRENT USER MESSAGE directly.
Return only the final answer.
`.trim();

    try {
      const response =
        await qwenService
          .generateQwenChatText({
            messages: [
              {
                role:
                  "system",

                content:
                  systemPrompt,
              },

              {
                role:
                  "user",

                content:
                  userPrompt,
              },
            ],

            temperature:
              0.3,

            topP:
              0.85,

            maxCompletionTokens:
              700,

            timeoutMs:
              300_000,

            retries:
              0,
          });

      if (
        !response.success ||
        !response.text
      ) {
        return undefined;
      }

      const reply =
        response.text
          .replace(
            /^```(?:text|markdown)?\s*/i,
            ""
          )
          .replace(
            /```\s*$/,
            ""
          )
          .trim();

      if (!reply) {
        return undefined;
      }

      if (
        messageRequestsCvSpecificExample(
          input.message
        ) &&
        !hasVerifiedExperienceBullet(
          input
        )
      ) {
        return { reply: buildSafeCvExampleFallback(input) };
      }

      const freshCandidates = Array.isArray(question?.freshTopicCandidates)
        ? (question.freshTopicCandidates as string[])
        : [];

      const normalizeTopicText = (value: string): string =>
        value
          .toLowerCase()
          .normalize("NFKC")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedReply = normalizeTopicText(reply);

      const recommendedTopics = freshCandidates.filter(
        (topic) =>
          normalizedReply.includes(
            normalizeTopicText(topic)
          )
      );

      const finalRecommended = recommendedTopics;

      return {
        reply,
        recommendedTopics: finalRecommended,
        subject: typeof question?.subject === "string" ? question.subject : undefined
      };
    } catch {
      return undefined;
    }
  };


export const buildCareerDynamicOrQwenResponse =
  async (
    input:
      ICareerSmartResponseInput
  ): Promise<
    ICareerDynamicResponseResult
  > => {
    const qwenResult =
      await generateQwenCareerReply(
        input
      );

    if (
      qwenResult?.reply
    ) {
      return {
        generated:
          true,

        reply:
          qwenResult.reply,

        focus:
          input.focus,

        metadata: {
          strategy:
            "QWEN_FRESH_CONTEXTUAL",

          dataSources: [
            "qwen",

            ...(input.resume
              ? [
                "resume",
              ]
              : []),

            ...(input.jobMatches
              ? [
                "jobMatching",
              ]
              : []),

            ...(input.interview
              ? [
                "interview",
              ]
              : []),

            ...(input.progress
              ? [
                "careerProgress",
              ]
              : []),

            ...(input.nextSteps
              ? [
                "nextSteps",
              ]
              : []),

            ...(input.careerGoal
              ? [
                "careerGoal",
              ]
              : []),

            ...(input.jobSearchHelp
              ? [
                "jobSearchHelp",
              ]
              : []),

            ...(input.conversationHistory &&
              input.conversationHistory.length >
              0
              ? [
                "conversationHistory",
              ]
              : []),
          ],

          careerSubject: qwenResult.subject,
          recommendedTopics: qwenResult.recommendedTopics,
        },
      };
    }

    return {
      generated:
        true,

      reply:
        "I couldn't generate a fresh personalized response right now. Please try again in a moment.",

      focus:
        input.focus,

      metadata: {
        strategy:
          "QWEN_FRESH_GENERATION_FAILED",

        dataSources: [
          "qwen",
        ],
      },
    };
  };


export const buildCareerSmartResponse =
  async (
    input:
      ICareerSmartResponseInput
  ): Promise<
    ICareerDynamicResponseResult
  > => {
    const message =
      input.message
        .replace(/\s+/g, " ")
        .trim();

    if (
      !message
    ) {
      return {
        generated:
          true,

        reply:
          "Please send a message so I can help with your career question.",

        focus:
          input.focus,

        metadata: {
          strategy:
            "EMPTY_MESSAGE",

          dataSources: [],
        },
      };
    }

    const cacheEnabled =
      canUseSmartCache(
        input
      );

    const cacheContext =
      buildSmartCacheContext(
        input
      );

    const result =
      await buildCareerDynamicOrQwenResponse(
        {
          ...input,
          message,
        }
      );

    if (
      cacheEnabled &&
      input.userId &&
      result.reply
    ) {
      await trySaveCareerResponseCache(
        {
          userId:
            input.userId,

          question:
            message,

          intent:
            input.intent,

          response:
            result.reply,

          context:
            cacheContext,

          ttlMinutes:
            input.cacheTtlMinutes,
        }
      );
    }

    return result;
  };


export default {
  buildCareerDynamicResponse,
  buildCareerDynamicOrQwenResponse,
  buildCareerSmartResponse,
};
