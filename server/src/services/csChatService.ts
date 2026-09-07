import {
  predictCSIntent,
} from "./csIntentService";

import {
  resolveCareerConversationIntent,
} from "./careerConversationContextService";

import {
  resolveCareerResponseFocus,
} from "./careerResponseFocusService";

import {
  buildCareerDynamicOrQwenResponse,
  type ICareerConversationTurn,
} from "./careerDynamicResponseService";

import {
  getCareerCachedResponse,
  saveCareerResponseCache,
  type ICareerCacheContext,
} from "./careerResponseCacheService";

import {
  addConversationMessage,
  buildConversationContext,
  getOrCreateConversation,
  markIntentResolved,
  setActiveInterview,
  setActiveResume,
  setAwaitingField,
  updateConversationMemory,
} from "./csMemoryService";

import {
  buildCSResponse,
  CSResponseAction,
  ICSResponseResult,
} from "./csResponseService";

import {
  recordLearningCandidate,
} from "./csLearningService";

import {
  buildResumeCareerSummary,
  ICareerResumeContext,
  resolveResumeContext,
} from "./careerContextService";

import {
  buildCareerJobMatchReply,
  buildCareerJobMatchSummary,
  getCareerJobMatches,
  ICareerJobMatchingResult,
} from "./careerJobContextService";

import {
  buildCareerInterviewFeedbackReply,
  buildCareerInterviewSummary,
  ICareerInterviewContext,
  resolveCareerInterviewContext,
} from "./careerInterviewContextService";

import {
  buildCareerInterviewPrepContext,
  buildCareerInterviewPrepReply,
  buildCareerInterviewPrepSummary,
  ICareerInterviewPrepContext,
} from "./careerInterviewPrepService";

import {
  buildCareerProgressContext,
  buildCareerProgressReply,
  buildCareerProgressSummary,
  ICareerProgressContext,
} from "./careerProgressService";

import {
  buildCareerNextStepsContext,
  buildCareerNextStepsReply,
  buildCareerNextStepsSummary,
  ICareerNextStepsContext,
} from "./careerNextStepsService";

import {
  buildCareerGoalContext,
  buildCareerGoalReply,
  buildCareerGoalSummary,
  ICareerGoalContext,
} from "./careerGoalService";

import {
  buildCareerJobSearchHelpContext,
  buildCareerJobSearchHelpReply,
  buildCareerJobSearchHelpSummary,
  ICareerJobSearchHelpContext,
} from "./careerJobSearchHelpService";

/* =========================================================
   TYPES
========================================================= */

export interface ICSChatInput {
  sessionId: string;

  message: string;

  userId?: string;

  customerId?: string;

  customerName?: string;

  email?: string;

  activeResumeId?: string;

  activeJobId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  skillsFocus?: string[];
}

export interface ICSChatMemory {
  activeResumeId?: string;

  activeJobId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  skillsFocus?: string[];

  previousIntent?: string;

  lastResolvedIntent?: string;

  awaitingField?: string;
}

export interface ICSChatOutput {
  sessionId: string;

  reply: string;

  intent: string;

  confidence: number;

  alternatives: Array<{
    intent: string;

    confidence: number;
  }>;

  needsClarification: boolean;

  action: CSResponseAction;

  requiresHuman: boolean;

  memory: ICSChatMemory;

  data?: Record<string, unknown>;
}

/* =========================================================
   CAREER INTENTS
========================================================= */

const CAREER_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "INTERVIEW_FEEDBACK",
    "SKILL_GAP",
    "CAREER_PROGRESS",
    "CAREER_GOAL",
    "NEXT_STEPS",
    "PROFILE_SUMMARY",
    "GENERAL_CAREER_HELP",
    "GREETING",
    "THANK_YOU",
  ]);

/* =========================================================
   RESUME DATA INTENTS
========================================================= */

const RESUME_DATA_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "JOB_MATCHING",
    "SKILL_GAP",
    "PROFILE_SUMMARY",
  ]);

/* =========================================================
   RESUME RESPONSE INTENTS
========================================================= */

const RESUME_RESPONSE_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "SKILL_GAP",
    "PROFILE_SUMMARY",
  ]);

/* =========================================================
   DATA-DRIVEN INTENTS
========================================================= */

const DATA_DRIVEN_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "INTERVIEW_FEEDBACK",
    "SKILL_GAP",
    "CAREER_PROGRESS",
    "CAREER_GOAL",
    "NEXT_STEPS",
    "PROFILE_SUMMARY",
  ]);

/* =========================================================
   HELPERS
========================================================= */

const normalizeMessage = (
  value: string
): string => {
  return value
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeOptionalString = (
  value?: string
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

const normalizeStringArray = (
  value?: string[]
): string[] | undefined => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const normalized =
    value
      .map(
        (
          item
        ) =>
          normalizeOptionalString(
            item
          )
      )
      .filter(
        (
          item
        ): item is string =>
          Boolean(
            item
          )
      );

  if (
    normalized.length ===
    0
  ) {
    return undefined;
  }

  return Array.from(
    new Set(
      normalized
    )
  );
};

const formatList = (
  items: string[],
  limit = 3
): string => {
  return items
    .slice(
      0,
      limit
    )
    .join(", ");
};

const buildFocusedCacheQuestion = (
  focus: string,
  message: string
): string => {
  return `${focus}::${message}`;
};

const stripFocusedCachePrefix = (
  value: string
): string => {
  return value.replace(
    /^[A-Z_]+::/,
    ""
  );
};

/* =========================================================
   RECENT CONVERSATION FOR QWEN CONTEXT
========================================================= */

const buildRecentConversationHistory = (
  conversation: unknown,
  currentMessage: string,
  limit = 8
): ICareerConversationTurn[] => {
  if (
    typeof conversation !==
      "object" ||
    conversation === null
  ) {
    return [];
  }

  const rawConversation =
    conversation as {
      messages?: unknown[];
    };

  if (
    !Array.isArray(
      rawConversation.messages
    )
  ) {
    return [];
  }

  const history: ICareerConversationTurn[] =
    rawConversation.messages
      .map((raw) => {
        if (
          typeof raw !==
            "object" ||
          raw === null
        ) {
          return undefined;
        }

        const item =
          raw as Record<
            string,
            unknown
          >;

        const sender =
          typeof item.sender ===
            "string"
            ? item.sender
                .toLowerCase()
                .trim()
            : "";

        const text =
          typeof item.text ===
            "string"
            ? normalizeMessage(
                item.text
              )
            : "";

        if (!text) {
          return undefined;
        }

        if (
          sender ===
            "customer" ||
          sender ===
            "user"
        ) {
          return {
            role:
              "user" as const,

            content:
              text.slice(
                0,
                650
              ),
          };
        }

        if (
          sender ===
            "assistant" ||
          sender ===
            "bot"
        ) {
          return {
            role:
              "assistant" as const,

            content:
              text.slice(
                0,
                650
              ),
          };
        }

        return undefined;
      })
      .filter(
        (
          item
        ): item is ICareerConversationTurn =>
          Boolean(item)
      );

  /*
   * The current user message has already been saved before
   * this helper runs. Remove the final duplicate because the
   * current question is sent to Qwen separately as the user prompt.
   */
  const normalizedCurrent =
    normalizeMessage(
      currentMessage
    );

  const last =
    history[
      history.length - 1
    ];

  if (
    last?.role ===
      "user" &&
    normalizeMessage(
      last.content
    ) ===
      normalizedCurrent
  ) {
    history.pop();
  }

  return history.slice(
    -Math.max(
      1,
      limit
    )
  );
};

/* =========================================================
   RESPONSE CACHE
========================================================= */

/*
 * JOB_MATCHING is intentionally excluded for now because the
 * frontend renders rich job cards from response.data.jobMatching.
 * Our current cache stores the text reply only. Once structured
 * response data is cached too, JOB_MATCHING can be enabled safely.
 *
 * CAREER_PROGRESS is also excluded for now because progress is
 * highly time-sensitive and can change whenever a new CV analysis
 * or interview is completed.
 */
const CACHE_SUPPORTED_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "INTERVIEW_FEEDBACK",
    "SKILL_GAP",
    "CAREER_GOAL",
    "NEXT_STEPS",
    "PROFILE_SUMMARY",
    "GENERAL_CAREER_HELP",
  ]);

const buildCareerCacheContext = (
  context: ReturnType<
    typeof buildConversationContext
  >
): ICareerCacheContext => {
  return {
    resumeId:
      context.activeResumeId,

    interviewId:
      context.activeInterviewId,

    targetRole:
      context.targetRole,
  };
};

const canUseResponseCache = (
  intent: string,
  contextual: boolean,
  awaitingField?: string
): boolean => {
  if (
    contextual ||
    awaitingField
  ) {
    return false;
  }

  return CACHE_SUPPORTED_INTENTS.has(
    intent
  );
};

const getCachedResponseSafely =
  async (
    options: {
      userId?: string;

      question: string;

      intent: string;

      context: ICareerCacheContext;
    }
  ) => {
    if (
      !options.userId
    ) {
      return undefined;
    }

    try {
      return await getCareerCachedResponse({
        userId:
          options.userId,

        question:
          options.question,

        intent:
          options.intent,

        context:
          options.context,
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Response Cache] Lookup failed:",
        error
      );

      return undefined;
    }
  };

const saveCachedResponseSafely =
  async (
    options: {
      userId?: string;

      question: string;

      intent: string;

      response: string;

      context: ICareerCacheContext;
    }
  ): Promise<void> => {
    if (
      !options.userId
    ) {
      return;
    }

    try {
      await saveCareerResponseCache({
        userId:
          options.userId,

        question:
          options.question,

        intent:
          options.intent,

        response:
          options.response,

        context:
          options.context,
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Response Cache] Save failed:",
        error
      );
    }
  };

/* =========================================================
   OUTPUT MEMORY
========================================================= */

const buildOutputMemory = (
  conversation: Awaited<
    ReturnType<
      typeof addConversationMessage
    >
  >
): ICSChatMemory => {
  const context =
    buildConversationContext(
      conversation
    );

  return {
    activeResumeId:
      context.activeResumeId,

    activeJobId:
      context.activeJobId,

    activeInterviewId:
      context.activeInterviewId,

    targetRole:
      context.targetRole,

    careerGoal:
      context.careerGoal,

    skillsFocus:
      context.skillsFocus,

    previousIntent:
      context.previousIntent,

    lastResolvedIntent:
      context.lastResolvedIntent,

    awaitingField:
      context.awaitingField,
  };
};

/* =========================================================
   SYNC FRONTEND CAREER CONTEXT
========================================================= */

const syncCareerContext =
  async (
    input: ICSChatInput
  ): Promise<void> => {
    const hasUpdate =
      input.activeResumeId !==
        undefined ||
      input.activeJobId !==
        undefined ||
      input.activeInterviewId !==
        undefined ||
      input.targetRole !==
        undefined ||
      input.careerGoal !==
        undefined ||
      input.skillsFocus !==
        undefined;

    if (
      !hasUpdate
    ) {
      return;
    }

    await updateConversationMemory(
      input.sessionId,
      {
        activeResumeId:
          input.activeResumeId,

        activeJobId:
          input.activeJobId,

        activeInterviewId:
          input.activeInterviewId,

        targetRole:
          input.targetRole,

        careerGoal:
          input.careerGoal,

        skillsFocus:
          normalizeStringArray(
            input.skillsFocus
          ),
      }
    );
  };

/* =========================================================
   LEARNING
========================================================= */

const collectLearningCandidateSafely =
  async (
    options: {
      message: string;

      intent: string;

      confidence: number;

      sessionId: string;

      conversationId?: string;

      alternatives?: Array<{
        intent: string;

        confidence: number;
      }>;

      needsClarification?: boolean;
    }
  ): Promise<void> => {
    if (
      !CAREER_INTENTS.has(
        options.intent
      )
    ) {
      return;
    }

    try {
      await recordLearningCandidate({
        phrase:
          options.message,

        suggestedIntent:
          options.intent,

        confidence:
          options.confidence,

        sessionId:
          options.sessionId,

        conversationId:
          options.conversationId,

        source:
          "conversation",

        metadata: {
          domain:
            "career_assistant",

          alternatives:
            options.alternatives ??
            [],

          needsClarification:
            options.needsClarification ??
            false,

          collectedAt:
            new Date()
              .toISOString(),
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Assistant Learning] Failed to collect candidate:",
        error
      );
    }
  };

/* =========================================================
   RESPONSE ACTION -> MEMORY
========================================================= */

const applyResponseMemoryAction =
  async (
    sessionId: string,
    action: CSResponseAction
  ): Promise<void> => {
    switch (action) {
      case "ASK_RESUME":
        await setAwaitingField(
          sessionId,
          "activeResumeId"
        );

        return;

      case "ASK_JOB":
        await setAwaitingField(
          sessionId,
          "activeJobId"
        );

        return;

      case "ASK_INTERVIEW":
        await setAwaitingField(
          sessionId,
          "activeInterviewId"
        );

        return;

      case "ASK_TARGET_ROLE":
        await setAwaitingField(
          sessionId,
          "targetRole"
        );

        return;

      case "ASK_CAREER_GOAL":
        await setAwaitingField(
          sessionId,
          "careerGoal"
        );

        return;

      case "ASK_SKILLS_FOCUS":
        await setAwaitingField(
          sessionId,
          "skillsFocus"
        );

        return;

      default:
        return;
    }
  };

/* =========================================================
   CV RESPONSE BUILDERS
========================================================= */

const buildCVAnalysisResponse = (
  resume: ICareerResumeContext
): string => {
  const parts:
    string[] = [];

  parts.push(
    `Your CV currently has an overall score of ${resume.overallScore}/100 and an ATS score of ${resume.atsScore}/100.`
  );

  parts.push(
    `Content: ${resume.contentScore}/100, structure: ${resume.structureScore}/100, skills: ${resume.skillsScore}/100, and experience: ${resume.experienceScore}/100.`
  );

  if (
    resume.strengths.length >
    0
  ) {
    parts.push(
      `Your strongest areas include ${formatList(
        resume.strengths
      )}.`
    );
  }

  if (
    resume.weaknesses.length >
    0
  ) {
    parts.push(
      `The main areas that need improvement are ${formatList(
        resume.weaknesses
      )}.`
    );
  }

  if (
    resume.recommendations.length >
    0
  ) {
    parts.push(
      `A high-priority recommendation is: ${resume.recommendations[0]}`
    );
  }

  return parts.join(
    " "
  );
};

const buildCVImprovementResponse = (
  resume: ICareerResumeContext
): string => {
  const parts:
    string[] = [];

  parts.push(
    `Based on your current CV analysis, your overall score is ${resume.overallScore}/100 and your ATS score is ${resume.atsScore}/100.`
  );

  if (
    resume.recommendations.length >
    0
  ) {
    parts.push(
      `Your highest-impact improvements are: ${formatList(
        resume.recommendations,
        4
      )}.`
    );
  }

  if (
    resume.atsSuggestions.length >
    0
  ) {
    parts.push(
      `For ATS performance, focus on: ${formatList(
        resume.atsSuggestions,
        3
      )}.`
    );
  }

  if (
    resume.weaknesses.length >
    0
  ) {
    parts.push(
      `The main weaknesses to address are: ${formatList(
        resume.weaknesses,
        3
      )}.`
    );
  }

  return parts.join(
    " "
  );
};

const buildSkillGapResponse = (
  resume: ICareerResumeContext,
  targetRole?: string
): string => {
  const parts:
    string[] = [];

  if (
    resume.skillsDetected.length >
    0
  ) {
    parts.push(
      `Your CV currently shows skills such as ${formatList(
        resume.skillsDetected,
        5
      )}.`
    );
  }

  if (
    resume.missingSkills.length >
    0
  ) {
    parts.push(
      targetRole
        ? `For your target role of ${targetRole}, the saved CV analysis suggests strengthening or adding: ${formatList(
            resume.missingSkills,
            5
          )}.`
        : `The saved CV analysis suggests strengthening or adding: ${formatList(
            resume.missingSkills,
            5
          )}.`
    );
  } else {
    parts.push(
      "Your saved CV analysis does not currently list specific missing skills."
    );
  }

  parts.push(
    `Your current skills score is ${resume.skillsScore}/100.`
  );

  return parts.join(
    " "
  );
};

const buildProfileSummaryResponse = (
  resume: ICareerResumeContext
): string => {
  const parts:
    string[] = [];

  if (
    resume.summary
  ) {
    parts.push(
      resume.summary
    );
  } else {
    parts.push(
      `Your current CV has an overall score of ${resume.overallScore}/100.`
    );
  }

  if (
    resume.skillsDetected.length >
    0
  ) {
    parts.push(
      `Your profile highlights skills including ${formatList(
        resume.skillsDetected,
        6
      )}.`
    );
  }

  if (
    resume.strengths.length >
    0
  ) {
    parts.push(
      `Key strengths include ${formatList(
        resume.strengths,
        3
      )}.`
    );
  }

  return parts.join(
    " "
  );
};

/* =========================================================
   RESUME RESPONSE DISPATCHER
========================================================= */

const buildResumeDrivenResponse = (
  intent: string,
  resume: ICareerResumeContext,
  targetRole?: string
): string | undefined => {
  switch (intent) {
    case "CV_ANALYSIS":
      return buildCVAnalysisResponse(
        resume
      );

    case "CV_IMPROVEMENT":
      return buildCVImprovementResponse(
        resume
      );

    case "SKILL_GAP":
      return buildSkillGapResponse(
        resume,
        targetRole
      );

    case "PROFILE_SUMMARY":
      return buildProfileSummaryResponse(
        resume
      );

    default:
      return undefined;
  }
};

/* =========================================================
   RESOLVE REAL RESUME
========================================================= */

const resolveCareerResume =
  async (
    userId: string | undefined,
    activeResumeId?: string
  ) => {
    if (
      !userId
    ) {
      return {
        found:
          false as const,

        reason:
          "USER_ID_REQUIRED",
      };
    }

    return resolveResumeContext({
      userId,

      activeResumeId,
    });
  };

/* =========================================================
   RESOLVE REAL INTERVIEW
========================================================= */

const resolveCareerInterview =
  async (
    userId: string | undefined,
    activeInterviewId?: string
  ) => {
    if (
      !userId
    ) {
      return {
        found:
          false as const,

        reason:
          "INVALID_USER_ID",
      };
    }

    return resolveCareerInterviewContext({
      userId,

      activeInterviewId,
    });
  };

/* =========================================================
   RESPONSE DATA
========================================================= */

const buildCareerResponseData = (
  intent: string,
  context: ReturnType<
    typeof buildConversationContext
  >,
  responseMetadata:
    Record<string, unknown>,
  resume?: ICareerResumeContext,
  jobMatches?: ICareerJobMatchingResult,
  interview?: ICareerInterviewContext,
  interviewPrep?: ICareerInterviewPrepContext,
  careerProgress?: ICareerProgressContext,
  nextSteps?: ICareerNextStepsContext,
  careerGoalContext?: ICareerGoalContext,
  jobSearchHelp?: ICareerJobSearchHelpContext
): Record<string, unknown> => {
  const data:
    Record<string, unknown> = {
      careerAssistant:
        true,

      intent,

      nextStep:
        responseMetadata.nextStep,

      requiresInterviewIQData:
        DATA_DRIVEN_INTENTS.has(
          intent
        ),
    };

  if (
    context.activeResumeId
  ) {
    data.activeResumeId =
      context.activeResumeId;
  }

  if (
    context.activeJobId
  ) {
    data.activeJobId =
      context.activeJobId;
  }

  if (
    context.activeInterviewId
  ) {
    data.activeInterviewId =
      context.activeInterviewId;
  }

  if (
    context.targetRole
  ) {
    data.targetRole =
      context.targetRole;
  }

  if (
    context.careerGoal
  ) {
    data.careerGoal =
      context.careerGoal;
  }

  if (
    context.skillsFocus &&
    context.skillsFocus.length >
      0
  ) {
    data.skillsFocus =
      context.skillsFocus;
  }

  /* =====================================================
     RESUME
  ===================================================== */

  if (
    resume
  ) {
    data.resume =
      buildResumeCareerSummary(
        resume
      );

    data.resumeDataLoaded =
      true;
  } else {
    data.resumeDataLoaded =
      false;
  }

  /* =====================================================
     JOB MATCHING
  ===================================================== */

  if (
    jobMatches
  ) {
    data.jobMatching =
      buildCareerJobMatchSummary(
        jobMatches
      );

    data.jobDataLoaded =
      true;
  } else {
    data.jobDataLoaded =
      false;
  }

  /* =====================================================
     INTERVIEW
  ===================================================== */

  if (
    interview
  ) {
    data.interview =
      buildCareerInterviewSummary(
        interview
      );

    data.interviewDataLoaded =
      true;
  } else {
    data.interviewDataLoaded =
      false;
  }

  /* =====================================================
     INTERVIEW PREP
  ===================================================== */

  if (
    interviewPrep
  ) {
    data.interviewPrep =
      buildCareerInterviewPrepSummary(
        interviewPrep
      );

    data.interviewPrepDataLoaded =
      true;
  } else {
    data.interviewPrepDataLoaded =
      false;
  }

  /* =====================================================
     CAREER PROGRESS
  ===================================================== */

  if (
    careerProgress
  ) {
    data.careerProgress =
      buildCareerProgressSummary(
        careerProgress
      );

    data.careerProgressDataLoaded =
      true;
  } else {
    data.careerProgressDataLoaded =
      false;
  }

  /* =====================================================
     NEXT STEPS
  ===================================================== */

  if (
    nextSteps
  ) {
    data.nextSteps =
      buildCareerNextStepsSummary(
        nextSteps
      );

    data.nextStepsDataLoaded =
      true;
  } else {
    data.nextStepsDataLoaded =
      false;
  }

  /* =====================================================
     CAREER GOAL
  ===================================================== */

  if (
    careerGoalContext
  ) {
    data.careerGoalEvaluation =
      buildCareerGoalSummary(
        careerGoalContext
      );

    data.careerGoalDataLoaded =
      true;
  } else {
    data.careerGoalDataLoaded =
      false;
  }

  /* =====================================================
     JOB SEARCH HELP
  ===================================================== */

  if (
    jobSearchHelp
  ) {
    data.jobSearchHelp =
      buildCareerJobSearchHelpSummary(
        jobSearchHelp
      );

    data.jobSearchHelpDataLoaded =
      true;
  } else {
    data.jobSearchHelpDataLoaded =
      false;
  }

  return data;
};

/* =========================================================
   MAIN CHAT FLOW
========================================================= */

export const processCustomerMessage =
  async (
    input: ICSChatInput
  ): Promise<ICSChatOutput> => {
    const sessionId =
      normalizeMessage(
        input.sessionId
      );

    const message =
      normalizeMessage(
        input.message
      );

    if (
      !sessionId
    ) {
      throw new Error(
        "Session ID is required"
      );
    }

    if (
      !message
    ) {
      throw new Error(
        "Message is required"
      );
    }

    /* =====================================================
       STEP 1
       GET / CREATE CONVERSATION
    ===================================================== */

    let conversation =
      await getOrCreateConversation(
        sessionId,
        {
          userId:
            input.userId,

          customerId:
            input.customerId,

          customerName:
            input.customerName,

          email:
            input.email,
        }
      );

    /* =====================================================
       STEP 2
       SYNC FRONTEND CONTEXT
    ===================================================== */

    await syncCareerContext({
      ...input,

      sessionId,
    });

    conversation =
      await getOrCreateConversation(
        sessionId
      );

    /* =====================================================
       STEP 3
       CURRENT CONTEXT
    ===================================================== */

    const currentContext =
      buildConversationContext(
        conversation
      );

    const wasAwaitingField =
      Boolean(
        currentContext.awaitingField
      );

    /* =====================================================
       STEP 4
       ML INTENT
    ===================================================== */

    const prediction =
      await predictCSIntent(
        message
      );

    /* =====================================================
       STEP 5
       CONTEXT-AWARE EFFECTIVE INTENT
    ===================================================== */

    const contextualIntent =
      resolveCareerConversationIntent({
        message,

        predictedIntent:
          prediction.intent,

        previousIntent:
          currentContext.previousIntent,

        lastResolvedIntent:
          currentContext.lastResolvedIntent,

        awaitingField:
          currentContext.awaitingField,

        targetRole:
          currentContext.targetRole,

        careerGoal:
          currentContext.careerGoal,
      });

    const effectiveIntent =
      contextualIntent.intent;

    const isContextualOverride =
      contextualIntent.contextual;

    /* =====================================================
       STEP 5.5
       RESPONSE FOCUS
    ===================================================== */

    const responseFocus =
      resolveCareerResponseFocus({
        message,

        intent:
          effectiveIntent,

        previousIntent:
          currentContext.previousIntent,

        inheritedIntent:
          contextualIntent.inheritedIntent,

        targetRole:
          currentContext.targetRole,
      });

    const focusedCacheQuestion =
      buildFocusedCacheQuestion(
        responseFocus.focus,
        message
      );

    /* =====================================================
       STEP 6
       SAVE CUSTOMER MESSAGE
    ===================================================== */

    conversation =
      await addConversationMessage({
        sessionId,

        sender:
          "customer",

        text:
          message,

        intent:
          effectiveIntent,

        confidence:
          prediction.confidence,

        metadata: {
          domain:
            "career_assistant",

          predictedIntent:
            prediction.intent,

          effectiveIntent,

          contextualIntent:
            contextualIntent.contextual,

          contextReason:
            contextualIntent.reason,

          inheritedIntent:
            contextualIntent.inheritedIntent,

          contextMetadata:
            contextualIntent.metadata,

          responseFocus: {
            focus:
              responseFocus.focus,

            confidence:
              responseFocus.confidence,

            matchedSignals:
              responseFocus.matchedSignals,

            source:
              responseFocus.source,
          },

          alternatives:
            prediction.alternatives,

          needsClarification:
            prediction.needsClarification,

          contextualAnswer:
            wasAwaitingField ||
            isContextualOverride,

          learningEligible:
            !wasAwaitingField &&
            !isContextualOverride,
        },
      });

    /* =====================================================
       STEP 7
       LEARNING
    ===================================================== */

    if (
      !wasAwaitingField &&
      !isContextualOverride
    ) {
      await collectLearningCandidateSafely({
        message,

        intent:
          prediction.intent,

        confidence:
          prediction.confidence,

        sessionId,

        conversationId:
          String(
            conversation._id
          ),

        alternatives:
          prediction.alternatives,

        needsClarification:
          prediction.needsClarification,
      });
    }

    /* =====================================================
       STEP 8
       UPDATED CONTEXT
    ===================================================== */

    let updatedContext =
      buildConversationContext(
        conversation
      );

    const fieldWasResolved =
      wasAwaitingField &&
      !updatedContext.awaitingField;

    let needsClarification =
      fieldWasResolved ||
      isContextualOverride
        ? false
        : prediction.needsClarification;

    /* =====================================================
       STEP 8.5
       RESPONSE CACHE LOOKUP

       FRESH CHAT MODE:
       We intentionally DO NOT reuse a cached reply.
       Every incoming user message must be answered by Qwen.
       Cache may still be written later for analytics/history,
       but it is never a user-facing response source.
    ===================================================== */

    const cacheEligible =
      false;

    console.log(
      "[Career Assistant] Fresh chat mode: direct response-cache reuse is disabled."
    );

    /* =====================================================
       STEP 9
       RESUME DATA
    ===================================================== */

    let resume:
      ICareerResumeContext | undefined;

    if (
      RESUME_DATA_INTENTS.has(
        effectiveIntent
      )
    ) {
      const resumeResult =
        await resolveCareerResume(
          updatedContext.userId,
          updatedContext.activeResumeId
        );

      if (
        resumeResult.found &&
        resumeResult.data
      ) {
        resume =
          resumeResult.data;

        if (
          updatedContext.activeResumeId !==
          resume.id
        ) {
          await setActiveResume(
            sessionId,
            resume.id
          );

          conversation =
            await getOrCreateConversation(
              sessionId
            );

          updatedContext =
            buildConversationContext(
              conversation
            );
        }
      }
    }

    /* =====================================================
       STEP 10
       INTERVIEW FEEDBACK DATA
    ===================================================== */

    let interview:
      ICareerInterviewContext | undefined;

    if (
      effectiveIntent ===
      "INTERVIEW_FEEDBACK"
    ) {
      const interviewResult =
        await resolveCareerInterview(
          updatedContext.userId,
          updatedContext.activeInterviewId
        );

      if (
        interviewResult.found &&
        interviewResult.data
      ) {
        interview =
          interviewResult.data;

        if (
          updatedContext.activeInterviewId !==
          interview.id
        ) {
          await setActiveInterview(
            sessionId,
            interview.id
          );

          conversation =
            await getOrCreateConversation(
              sessionId
            );

          updatedContext =
            buildConversationContext(
              conversation
            );
        }
      }
    }

    /* =====================================================
       STEP 11
       BASE RESPONSE
    ===================================================== */

    let response:
      ICSResponseResult =
      buildCSResponse({
        intent:
          effectiveIntent,

        message,

        confidence:
          prediction.confidence,

        needsClarification,

        context:
          updatedContext,
      });

    /* =====================================================
       STEP 12
       PERSONALIZED CV RESPONSE
    ===================================================== */

    if (
      resume &&
      RESUME_RESPONSE_INTENTS.has(
        effectiveIntent
      )
    ) {
      const personalizedReply =
        buildResumeDrivenResponse(
          effectiveIntent,
          resume,
          updatedContext.targetRole
        );

      if (
        personalizedReply
      ) {
        needsClarification =
          false;

        response = {
          ...response,

          reply:
            personalizedReply,

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            resumeDataLoaded:
              true,

            resumeAnalysisId:
              resume.id,

            resumeFileId:
              resume.fileId,

            personalized:
              true,
          },
        };
      }
    }

    /* =====================================================
       STEP 13
       JOB MATCHING
    ===================================================== */

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    if (
      effectiveIntent ===
        "JOB_MATCHING" &&
      updatedContext.userId
    ) {
      jobMatches =
        await getCareerJobMatches({
          userId:
            updatedContext.userId,

          activeResumeId:
            updatedContext.activeResumeId,

          targetRole:
            updatedContext.targetRole,

          limit:
            5,
        });

      if (
        jobMatches.found &&
        jobMatches.matchedJobs.length >
          0
      ) {
        needsClarification =
          false;

        response = {
          ...response,

          reply:
            buildCareerJobMatchReply(
              jobMatches,
              updatedContext.targetRole
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            jobDataLoaded:
              true,

            personalized:
              true,

            matchCount:
              jobMatches
                .matchedJobs
                .length,

            bestMatchId:
              jobMatches
                .bestMatch
                ?.id,

            nextStep:
              "JOB_MATCHING_COMPLETED",
          },
        };
      } else {
        response = {
          ...response,

          reply:
            jobMatches.reason ===
            "NO_ACTIVE_JOBS"
              ? "I found your CV analysis, but there are currently no active jobs available to match against it."
              : "I couldn't find suitable active jobs for your current CV right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            jobDataLoaded:
              false,

            jobMatchReason:
              jobMatches.reason,

            nextStep:
              "JOB_MATCHING_NO_RESULTS",
          },
        };
      }
    }

    /* =====================================================
       STEP 14
       INTERVIEW FEEDBACK
    ===================================================== */

    if (
      effectiveIntent ===
        "INTERVIEW_FEEDBACK" &&
      interview
    ) {
      needsClarification =
        false;

      response = {
        ...response,

        reply:
          buildCareerInterviewFeedbackReply(
            interview
          ),

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          ...response.metadata,

          interviewDataLoaded:
            true,

          activeInterviewId:
            interview.id,

          personalized:
            true,

          nextStep:
            "INTERVIEW_FEEDBACK_COMPLETED",
        },
      };
    }

    /* =====================================================
       STEP 15
       INTERVIEW PREP
    ===================================================== */

    let interviewPrep:
      ICareerInterviewPrepContext | undefined;

    let interviewPrepFailureReason:
      string | undefined;

    if (
      effectiveIntent ===
        "INTERVIEW_PREP" &&
      updatedContext.userId
    ) {
      const prepResult =
        await buildCareerInterviewPrepContext({
          userId:
            updatedContext.userId,

          activeResumeId:
            updatedContext.activeResumeId,

          activeInterviewId:
            updatedContext.activeInterviewId,

          targetRole:
            updatedContext.targetRole,
        });

      if (
        prepResult.found &&
        prepResult.data
      ) {
        interviewPrep =
          prepResult.data;

        needsClarification =
          false;

        if (
          interviewPrep.resume?.id &&
          updatedContext.activeResumeId !==
            interviewPrep.resume.id
        ) {
          await setActiveResume(
            sessionId,
            interviewPrep.resume.id
          );
        }

        if (
          interviewPrep
            .previousInterview
            ?.id &&
          updatedContext.activeInterviewId !==
            interviewPrep
              .previousInterview
              .id
        ) {
          await setActiveInterview(
            sessionId,
            interviewPrep
              .previousInterview
              .id
          );
        }

        conversation =
          await getOrCreateConversation(
            sessionId
          );

        updatedContext =
          buildConversationContext(
            conversation
          );

        response = {
          ...response,

          reply:
            buildCareerInterviewPrepReply(
              interviewPrep,
              updatedContext.targetRole
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            interviewPrepDataLoaded:
              true,

            personalized:
              true,

            selectedJobId:
              interviewPrep
                .selectedJob
                ?.id,

            previousInterviewId:
              interviewPrep
                .previousInterview
                ?.id,

            nextStep:
              "INTERVIEW_PREP_COMPLETED",
          },
        };
      } else {
        interviewPrepFailureReason =
          prepResult.reason;

        response = {
          ...response,

          reply:
            prepResult.reason ===
            "RESUME_NOT_FOUND"
              ? "I couldn't find a saved CV analysis for your account. Please analyze or upload a CV first so I can build personalized interview preparation."
              : "I couldn't build personalized interview preparation from your current InterviewIQ data.",

          action:
            prepResult.reason ===
            "RESUME_NOT_FOUND"
              ? "ASK_RESUME"
              : "REPLY",

          requiredFields:
            prepResult.reason ===
            "RESUME_NOT_FOUND"
              ? [
                  "activeResumeId",
                ]
              : [],

          metadata: {
            ...response.metadata,

            interviewPrepDataLoaded:
              false,

            interviewPrepFailureReason:
              prepResult.reason,

            nextStep:
              "INTERVIEW_PREP_DATA_UNAVAILABLE",
          },
        };
      }
    }

    /* =====================================================
       STEP 16
       CAREER PROGRESS
    ===================================================== */

    let careerProgress:
      ICareerProgressContext | undefined;

    let careerProgressFailureReason:
      string | undefined;

    if (
      effectiveIntent ===
        "CAREER_PROGRESS" &&
      updatedContext.userId
    ) {
      const progressResult =
        await buildCareerProgressContext(
          updatedContext.userId
        );

      if (
        progressResult.found &&
        progressResult.data
      ) {
        careerProgress =
          progressResult.data;

        needsClarification =
          false;

        response = {
          ...response,

          reply:
            buildCareerProgressReply(
              careerProgress
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            careerProgressDataLoaded:
              true,

            personalized:
              true,

            nextStep:
              "CAREER_PROGRESS_COMPLETED",
          },
        };
      } else {
        careerProgressFailureReason =
          progressResult.reason;

        response = {
          ...response,

          reply:
            progressResult.reason ===
            "NO_PROGRESS_DATA"
              ? "I don't have enough saved CV or completed interview data yet to measure your career progress."
              : "I couldn't load your career progress data right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            careerProgressDataLoaded:
              false,

            careerProgressFailureReason:
              progressResult.reason,

            nextStep:
              "CAREER_PROGRESS_UNAVAILABLE",
          },
        };
      }
    }

    /* =====================================================
       STEP 17
       NEXT STEPS
    ===================================================== */

    let nextSteps:
      ICareerNextStepsContext | undefined;

    let nextStepsFailureReason:
      string | undefined;

    if (
      effectiveIntent ===
        "NEXT_STEPS" &&
      updatedContext.userId
    ) {
      const nextStepsResult =
        await buildCareerNextStepsContext({
          userId:
            updatedContext.userId,

          activeResumeId:
            updatedContext.activeResumeId,

          activeInterviewId:
            updatedContext.activeInterviewId,

          targetRole:
            updatedContext.targetRole,

          careerGoal:
            updatedContext.careerGoal,

          contextIntent:
            contextualIntent.inheritedIntent,

          userMessage:
            message,
        });

      if (
        nextStepsResult.found &&
        nextStepsResult.data
      ) {
        nextSteps =
          nextStepsResult.data;

        needsClarification =
          false;

        if (
          nextSteps.resume?.id &&
          updatedContext.activeResumeId !==
            nextSteps.resume.id
        ) {
          await setActiveResume(
            sessionId,
            nextSteps.resume.id
          );
        }

        if (
          nextSteps.interview?.id &&
          updatedContext.activeInterviewId !==
            nextSteps.interview.id
        ) {
          await setActiveInterview(
            sessionId,
            nextSteps.interview.id
          );
        }

        conversation =
          await getOrCreateConversation(
            sessionId
          );

        updatedContext =
          buildConversationContext(
            conversation
          );

        response = {
          ...response,

          reply:
            buildCareerNextStepsReply(
              nextSteps
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            nextStepsDataLoaded:
              true,

            personalized:
              true,

            totalSteps:
              nextSteps
                .steps
                .length,

            topStepId:
              nextSteps
                .topStep
                ?.id,

            nextStep:
              "NEXT_STEPS_COMPLETED",
          },
        };
      } else {
        nextStepsFailureReason =
          nextStepsResult.reason;

        response = {
          ...response,

          reply:
            nextStepsResult.reason ===
            "NO_CAREER_DATA"
              ? "I don't have enough career data yet to build personalized next steps. Start with a CV analysis or complete an interview first."
              : "I couldn't build your personalized next steps right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            nextStepsDataLoaded:
              false,

            nextStepsFailureReason:
              nextStepsResult.reason,

            nextStep:
              "NEXT_STEPS_UNAVAILABLE",
          },
        };
      }
    }

    /* =====================================================
       STEP 18
       CAREER GOAL
    ===================================================== */

    let careerGoalContext:
      ICareerGoalContext | undefined;

    let careerGoalFailureReason:
      string | undefined;

    if (
      effectiveIntent ===
        "CAREER_GOAL" &&
      updatedContext.userId
    ) {
      const goalResult =
        await buildCareerGoalContext({
          userId:
            updatedContext.userId,

          activeResumeId:
            updatedContext.activeResumeId,

          activeInterviewId:
            updatedContext.activeInterviewId,

          targetRole:
            updatedContext.targetRole,

          careerGoal:
            updatedContext.careerGoal,
        });

      if (
        !goalResult.found &&
        goalResult.reason ===
          "TARGET_ROLE_REQUIRED"
      ) {
        response = {
          ...response,

          reply:
            "What role are you currently targeting? For example: Frontend Developer, Backend Developer, Cybersecurity Analyst, Data Analyst, or another role.",

          action:
            "ASK_TARGET_ROLE",

          requiredFields: [
            "targetRole",
          ],

          metadata: {
            ...response.metadata,

            careerGoalDataLoaded:
              false,

            careerGoalFailureReason:
              "TARGET_ROLE_REQUIRED",

            awaitingField:
              "targetRole",

            nextStep:
              "COLLECT_TARGET_ROLE_FOR_CAREER_GOAL",
          },
        };
      }

      if (
        goalResult.found &&
        goalResult.data
      ) {
        careerGoalContext =
          goalResult.data;

        needsClarification =
          false;

        if (
          careerGoalContext.resume?.id &&
          updatedContext.activeResumeId !==
            careerGoalContext.resume.id
        ) {
          await setActiveResume(
            sessionId,
            careerGoalContext.resume.id
          );
        }

        if (
          careerGoalContext.interview?.id &&
          updatedContext.activeInterviewId !==
            careerGoalContext.interview.id
        ) {
          await setActiveInterview(
            sessionId,
            careerGoalContext.interview.id
          );
        }

        conversation =
          await getOrCreateConversation(
            sessionId
          );

        updatedContext =
          buildConversationContext(
            conversation
          );

        response = {
          ...response,

          reply:
            buildCareerGoalReply(
              careerGoalContext
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            careerGoalDataLoaded:
              true,

            personalized:
              true,

            targetRole:
              careerGoalContext.targetRole,

            readinessScore:
              careerGoalContext.readinessScore,

            readinessLevel:
              careerGoalContext.readinessLevel,

            goalStatus:
              careerGoalContext.status,

            nextStep:
              "CAREER_GOAL_EVALUATED",
          },
        };
      }

      if (
        !goalResult.found &&
        goalResult.reason !==
          "TARGET_ROLE_REQUIRED"
      ) {
        careerGoalFailureReason =
          goalResult.reason;

        response = {
          ...response,

          reply:
            goalResult.reason ===
            "NO_CAREER_DATA"
              ? "I know your target role, but I don't have enough InterviewIQ career data yet to evaluate your readiness."
              : "I couldn't evaluate your career goal right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            careerGoalDataLoaded:
              false,

            careerGoalFailureReason:
              goalResult.reason,

            nextStep:
              "CAREER_GOAL_UNAVAILABLE",
          },
        };
      }
    }

    /* =====================================================
       STEP 19
       JOB SEARCH HELP
    ===================================================== */

    let jobSearchHelp:
      ICareerJobSearchHelpContext | undefined;

    let jobSearchHelpFailureReason:
      string | undefined;

    if (
      effectiveIntent ===
        "JOB_SEARCH_HELP" &&
      updatedContext.userId
    ) {
      const jobSearchResult =
        await buildCareerJobSearchHelpContext({
          userId:
            updatedContext.userId,

          activeResumeId:
            updatedContext.activeResumeId,

          targetRole:
            updatedContext.targetRole,
        });

      /* -----------------------------------------------------
         SUCCESS
      ----------------------------------------------------- */

      if (
        jobSearchResult.found &&
        jobSearchResult.data
      ) {
        jobSearchHelp =
          jobSearchResult.data;

        needsClarification =
          false;

        if (
          jobSearchHelp.resume?.id &&
          updatedContext.activeResumeId !==
            jobSearchHelp.resume.id
        ) {
          await setActiveResume(
            sessionId,
            jobSearchHelp.resume.id
          );

          conversation =
            await getOrCreateConversation(
              sessionId
            );

          updatedContext =
            buildConversationContext(
              conversation
            );
        }

        response = {
          ...response,

          reply:
            buildCareerJobSearchHelpReply(
              jobSearchHelp
            ),

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            jobSearchHelpDataLoaded:
              true,

            personalized:
              true,

            bestMatchJobId:
              jobSearchHelp
                .strategy
                .bestMatchJobId,

            bestMatchScore:
              jobSearchHelp
                .strategy
                .bestMatchScore,

            recommendedTitlesCount:
              jobSearchHelp
                .strategy
                .recommendedTitles
                .length,

            nextStep:
              "JOB_SEARCH_HELP_COMPLETED",
          },
        };
      }

      /* -----------------------------------------------------
         RESUME REQUIRED
      ----------------------------------------------------- */

      if (
        !jobSearchResult.found &&
        jobSearchResult.reason ===
          "RESUME_NOT_FOUND"
      ) {
        jobSearchHelpFailureReason =
          jobSearchResult.reason;

        response = {
          ...response,

          reply:
            "I couldn't find a saved CV analysis for your account. Analyze or upload your CV first so I can build a personalized job-search strategy.",

          action:
            "ASK_RESUME",

          requiredFields: [
            "activeResumeId",
          ],

          metadata: {
            ...response.metadata,

            jobSearchHelpDataLoaded:
              false,

            jobSearchHelpFailureReason:
              "RESUME_NOT_FOUND",

            nextStep:
              "RESUME_REQUIRED_FOR_JOB_SEARCH_HELP",
          },
        };
      }

      /* -----------------------------------------------------
         NO ACTIVE / MATCHED JOB DATA
      ----------------------------------------------------- */

      if (
        !jobSearchResult.found &&
        jobSearchResult.reason ===
          "NO_JOB_DATA"
      ) {
        jobSearchHelpFailureReason =
          jobSearchResult.reason;

        response = {
          ...response,

          reply:
            "I found your CV, but I couldn't find enough active job data to build a personalized search strategy right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            jobSearchHelpDataLoaded:
              false,

            jobSearchHelpFailureReason:
              "NO_JOB_DATA",

            nextStep:
              "JOB_SEARCH_DATA_UNAVAILABLE",
          },
        };
      }

      /* -----------------------------------------------------
         OTHER FAILURE
      ----------------------------------------------------- */

      if (
        !jobSearchResult.found &&
        jobSearchResult.reason !==
          "RESUME_NOT_FOUND" &&
        jobSearchResult.reason !==
          "NO_JOB_DATA"
      ) {
        jobSearchHelpFailureReason =
          jobSearchResult.reason;

        response = {
          ...response,

          reply:
            "I couldn't build your personalized job-search strategy right now.",

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            ...response.metadata,

            jobSearchHelpDataLoaded:
              false,

            jobSearchHelpFailureReason:
              jobSearchResult.reason,

            nextStep:
              "JOB_SEARCH_HELP_UNAVAILABLE",
          },
        };
      }
    }

    /* =====================================================
       STEP 19.5
       DYNAMIC CAREER RESPONSE
    ===================================================== */

    const recentConversationHistory =
      buildRecentConversationHistory(
        conversation,
        message,
        12
      );

    const dynamicResponse =
      await buildCareerDynamicOrQwenResponse({
        userId:
          updatedContext.userId,

        customerName:
          input.customerName,

        careerGoalText:
          updatedContext.careerGoal,

        skillsFocus:
          updatedContext.skillsFocus,

        conversationHistory:
          recentConversationHistory,

        message,

        intent:
          effectiveIntent,

        focus:
          responseFocus.focus,

        targetRole:
          updatedContext.targetRole,

        resumeId:
          updatedContext.activeResumeId,

        interviewId:
          updatedContext.activeInterviewId,

        resume,

        jobMatches,

        interview,

        progress:
          careerProgress,

        nextSteps,

        careerGoal:
          careerGoalContext,

        jobSearchHelp,
      });

    if (
      dynamicResponse.generated &&
      dynamicResponse.reply
    ) {
      needsClarification =
        false;

      response = {
        ...response,

        reply:
          dynamicResponse.reply,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          ...response.metadata,

          personalized:
            true,

          dynamicResponse:
            true,

          responseFocus:
            responseFocus.focus,

          responseFocusConfidence:
            responseFocus.confidence,

          responseFocusSource:
            responseFocus.source,

          responseGenerationStrategy:
            dynamicResponse.metadata
              .strategy,

          responseDataSources:
            dynamicResponse.metadata
              .dataSources,
        },
      };
    }

    /* =====================================================
       STEP 20
       AUTH REQUIRED
    ===================================================== */

    if (
      (
        RESUME_DATA_INTENTS.has(
          effectiveIntent
        ) ||
        effectiveIntent ===
          "INTERVIEW_FEEDBACK" ||
        effectiveIntent ===
          "INTERVIEW_PREP" ||
        effectiveIntent ===
          "CAREER_PROGRESS" ||
        effectiveIntent ===
          "NEXT_STEPS" ||
        effectiveIntent ===
          "CAREER_GOAL" ||
        effectiveIntent ===
          "JOB_SEARCH_HELP"
      ) &&
      !updatedContext.userId
    ) {
      response = {
        ...response,

        reply:
          "I need your signed-in InterviewIQ account context before I can access your saved career data.",

        action:
          "ASK_CLARIFICATION",

        requiredFields:
          [],

        metadata: {
          ...response.metadata,

          reason:
            "USER_ID_REQUIRED",
        },
      };
    }

    /* =====================================================
       STEP 21
       NO RESUME FOUND
    ===================================================== */

    if (
      RESUME_DATA_INTENTS.has(
        effectiveIntent
      ) &&
      updatedContext.userId &&
      !resume
    ) {
      response = {
        ...response,

        reply:
          "I couldn't find a saved CV analysis for your account. Please analyze or upload a CV first, then I can use the results in this conversation.",

        action:
          "ASK_RESUME",

        requiredFields: [
          "activeResumeId",
        ],

        metadata: {
          ...response.metadata,

          reason:
            "RESUME_ANALYSIS_NOT_FOUND",

          resumeDataLoaded:
            false,
        },
      };
    }

    /* =====================================================
       STEP 22
       NO INTERVIEW FOUND
    ===================================================== */

    if (
      effectiveIntent ===
        "INTERVIEW_FEEDBACK" &&
      updatedContext.userId &&
      !interview
    ) {
      response = {
        ...response,

        reply:
          "I couldn't find a completed interview for your account. Complete an interview first, then I can review your performance and feedback.",

        action:
          "ASK_INTERVIEW",

        requiredFields: [
          "activeInterviewId",
        ],

        metadata: {
          ...response.metadata,

          reason:
            "INTERVIEW_NOT_FOUND",

          interviewDataLoaded:
            false,

          nextStep:
            "INTERVIEW_REQUIRED",
        },
      };
    }

    /* =====================================================
       STEP 23
       APPLY MEMORY ACTION
    ===================================================== */

    await applyResponseMemoryAction(
      sessionId,
      response.action
    );

    /* =====================================================
       STEP 24
       MARK RESOLVED
    ===================================================== */

    const canMarkResolved =
      response.action ===
        "REPLY" &&
      (
        !DATA_DRIVEN_INTENTS.has(
          effectiveIntent
        ) ||
        (
          RESUME_RESPONSE_INTENTS.has(
            effectiveIntent
          ) &&
          Boolean(
            resume
          )
        ) ||
        (
          effectiveIntent ===
            "JOB_MATCHING" &&
          Boolean(
            jobMatches?.found
          )
        ) ||
        (
          effectiveIntent ===
            "INTERVIEW_FEEDBACK" &&
          Boolean(
            interview
          )
        ) ||
        (
          effectiveIntent ===
            "INTERVIEW_PREP" &&
          Boolean(
            interviewPrep
          )
        ) ||
        (
          effectiveIntent ===
            "CAREER_PROGRESS" &&
          Boolean(
            careerProgress
          )
        ) ||
        (
          effectiveIntent ===
            "NEXT_STEPS" &&
          Boolean(
            nextSteps
          )
        ) ||
        (
          effectiveIntent ===
            "CAREER_GOAL" &&
          Boolean(
            careerGoalContext
          )
        ) ||
        (
          effectiveIntent ===
            "JOB_SEARCH_HELP" &&
          Boolean(
            jobSearchHelp
          )
        )
      );

    if (
      canMarkResolved
    ) {
      await markIntentResolved(
        sessionId,
        effectiveIntent
      );
    }

    /* =====================================================
       STEP 25
       FINAL CONTEXT
    ===================================================== */

    conversation =
      await getOrCreateConversation(
        sessionId
      );

    const finalContext =
      buildConversationContext(
        conversation
      );

    /* =====================================================
       STEP 26
       RESPONSE DATA
    ===================================================== */

    const responseData =
      buildCareerResponseData(
        effectiveIntent,
        finalContext,
        response.metadata,
        resume,
        jobMatches,
        interview,
        interviewPrep,
        careerProgress,
        nextSteps,
        careerGoalContext,
        jobSearchHelp
      );

    responseData.responseFocus = {
      focus:
        responseFocus.focus,

      confidence:
        responseFocus.confidence,

      matchedSignals:
        responseFocus.matchedSignals,

      source:
        responseFocus.source,
    };

    responseData.responseGeneration = {
      dynamic:
        dynamicResponse.generated,

      strategy:
        dynamicResponse.metadata
          .strategy,

      dataSources:
        dynamicResponse.metadata
          .dataSources,
    };

    if (
      interviewPrepFailureReason
    ) {
      responseData.interviewPrepFailureReason =
        interviewPrepFailureReason;
    }

    if (
      careerProgressFailureReason
    ) {
      responseData.careerProgressFailureReason =
        careerProgressFailureReason;
    }

    if (
      nextStepsFailureReason
    ) {
      responseData.nextStepsFailureReason =
        nextStepsFailureReason;
    }

    if (
      careerGoalFailureReason
    ) {
      responseData.careerGoalFailureReason =
        careerGoalFailureReason;
    }

    if (
      jobSearchHelpFailureReason
    ) {
      responseData.jobSearchHelpFailureReason =
        jobSearchHelpFailureReason;
    }

    /* =====================================================
       STEP 26.5
       SAVE RESPONSE CACHE
    ===================================================== */

    const shouldSaveToCache =
      false &&
      Boolean(
        finalContext.userId
      ) &&
      response.action ===
        "REPLY" &&
      !needsClarification &&
      canUseResponseCache(
        effectiveIntent,
        isContextualOverride,
        finalContext.awaitingField
      ) &&
      canMarkResolved;

    if (
      shouldSaveToCache &&
      finalContext.userId
    ) {
      await saveCachedResponseSafely({
        userId:
          finalContext.userId,

        question:
          focusedCacheQuestion,

        intent:
          effectiveIntent,

        response:
          response.reply,

        context:
          buildCareerCacheContext(
            finalContext
          ),
      });

      responseData.cache = {
        hit:
          false,

        saved:
          true,
      };
    } else {
      responseData.cache = {
        hit:
          false,

        saved:
          false,
      };
    }

    /* =====================================================
       STEP 27
       SAVE ASSISTANT MESSAGE
    ===================================================== */

    conversation =
      await addConversationMessage({
        sessionId,

        sender:
          "assistant",

        text:
          response.reply,

        intent:
          effectiveIntent,

        confidence:
          prediction.confidence,

        metadata: {
          domain:
            "career_assistant",

          action:
            response.action,

          requiredFields:
            response.requiredFields,

          responseMetadata:
            response.metadata,

          contextResolution: {
            contextual:
              contextualIntent.contextual,

            reason:
              contextualIntent.reason,

            inheritedIntent:
              contextualIntent.inheritedIntent,

            predictedIntent:
              prediction.intent,

            effectiveIntent,
          },

          responseFocus: {
            focus:
              responseFocus.focus,

            confidence:
              responseFocus.confidence,

            matchedSignals:
              responseFocus.matchedSignals,

            source:
              responseFocus.source,
          },

          responseGeneration: {
            dynamic:
              dynamicResponse.generated,

            strategy:
              dynamicResponse.metadata
                .strategy,

            dataSources:
              dynamicResponse.metadata
                .dataSources,
          },

          data:
            responseData,
        },
      });

    /* =====================================================
       STEP 28
       FINAL API RESPONSE
    ===================================================== */

    return {
      sessionId,

      reply:
        response.reply,

      intent:
        effectiveIntent,

      confidence:
        prediction.confidence,

      alternatives:
        prediction.alternatives,

      needsClarification,

      action:
        response.action,

      requiresHuman:
        false,

      memory:
        buildOutputMemory(
          conversation
        ),

      data:
        responseData,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  processCustomerMessage,
};