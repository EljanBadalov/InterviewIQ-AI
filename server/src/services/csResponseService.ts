/* =========================================================
   CAREER ASSISTANT INTENTS
========================================================= */

export type CSIntent =
  | "CV_ANALYSIS"
  | "CV_IMPROVEMENT"
  | "JOB_MATCHING"
  | "JOB_SEARCH_HELP"
  | "INTERVIEW_PREP"
  | "INTERVIEW_FEEDBACK"
  | "SKILL_GAP"
  | "CAREER_PROGRESS"
  | "CAREER_GOAL"
  | "NEXT_STEPS"
  | "PROFILE_SUMMARY"
  | "GENERAL_CAREER_HELP"
  | "GREETING"
  | "THANK_YOU"
  | "UNKNOWN"
  | string;

/* =========================================================
   RESPONSE ACTIONS
========================================================= */

export type CSResponseAction =
  | "REPLY"
  | "ASK_RESUME"
  | "ASK_JOB"
  | "ASK_INTERVIEW"
  | "ASK_TARGET_ROLE"
  | "ASK_CAREER_GOAL"
  | "ASK_SKILLS_FOCUS"
  | "ASK_CLARIFICATION";

/* =========================================================
   CAREER CONTEXT
========================================================= */

export interface ICSConversationContext {
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

  previousIntent?: string;

  lastResolvedIntent?: string;

  awaitingField?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   RESPONSE INPUT
========================================================= */

export interface ICSResponseInput {
  intent: CSIntent;

  message: string;

  confidence: number;

  needsClarification: boolean;

  context?: ICSConversationContext;
}

/* =========================================================
   RESPONSE RESULT
========================================================= */

export interface ICSResponseResult {
  reply: string;

  intent: CSIntent;

  action: CSResponseAction;

  requiredFields: string[];

  metadata: Record<
    string,
    unknown
  >;
}

/* =========================================================
   SETTINGS
========================================================= */

/*
 * Resume-dependent intents.
 *
 * Later csChatService will first try to automatically
 * find the user's latest resume / analysis before asking.
 */
const RESUME_REQUIRED_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "JOB_MATCHING",
    "SKILL_GAP",
    "PROFILE_SUMMARY",
  ]);

/*
 * Interview feedback requires a previous interview
 * or interview report.
 */
const INTERVIEW_REQUIRED_INTENTS =
  new Set<string>([
    "INTERVIEW_FEEDBACK",
  ]);

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (
  value: string
): string => {
  return value
    .replace(/\s+/g, " ")
    .trim();
};

const getFirstName = (
  context?: ICSConversationContext
): string => {
  const name =
    context?.customerName
      ?.trim();

  if (!name) {
    return "";
  }

  const firstName =
    name
      .split(/\s+/)[0]
      ?.trim();

  if (!firstName) {
    return "";
  }

  return firstName;
};

const buildGreetingPrefix = (
  context?: ICSConversationContext
): string => {
  const firstName =
    getFirstName(
      context
    );

  if (!firstName) {
    return "Hi";
  }

  return `Hi ${firstName}`;
};

/* =========================================================
   REQUIRED FIELDS
========================================================= */

const getMissingRequiredFields = (
  intent: CSIntent,
  context?: ICSConversationContext
): string[] => {
  const missing:
    string[] = [];

  if (
    RESUME_REQUIRED_INTENTS.has(
      intent
    ) &&
    !context?.activeResumeId
  ) {
    missing.push(
      "activeResumeId"
    );
  }

  if (
    INTERVIEW_REQUIRED_INTENTS.has(
      intent
    ) &&
    !context?.activeInterviewId
  ) {
    missing.push(
      "activeInterviewId"
    );
  }

  return missing;
};

/* =========================================================
   CLARIFICATION RESPONSE
========================================================= */

const buildClarificationResponse =
  (): ICSResponseResult => {
    return {
      reply:
        "I want to make sure I understand correctly. Are you asking about your CV, job matches, interview preparation, interview feedback, skills, career progress, career goals, or what you should do next?",

      intent:
        "UNKNOWN",

      action:
        "ASK_CLARIFICATION",

      requiredFields:
        [],

      metadata: {
        reason:
          "LOW_CONFIDENCE_OR_AMBIGUOUS_INTENT",
      },
    };
  };

/* =========================================================
   MISSING RESUME
========================================================= */

const buildMissingResumeResponse = (
  intent: CSIntent
): ICSResponseResult => {
  return {
    reply:
      "I need a CV or resume connected to this conversation before I can give you a personalized answer.",

    intent,

    action:
      "ASK_RESUME",

    requiredFields: [
      "activeResumeId",
    ],

    metadata: {
      awaitingField:
        "activeResumeId",

      nextStep:
        "RESOLVE_ACTIVE_RESUME",
    },
  };
};

/* =========================================================
   MISSING INTERVIEW
========================================================= */

const buildMissingInterviewResponse = (
  intent: CSIntent
): ICSResponseResult => {
  return {
    reply:
      "I need one of your previous interview sessions or interview reports before I can analyze your interview performance.",

    intent,

    action:
      "ASK_INTERVIEW",

    requiredFields: [
      "activeInterviewId",
    ],

    metadata: {
      awaitingField:
        "activeInterviewId",

      nextStep:
        "RESOLVE_ACTIVE_INTERVIEW",
    },
  };
};

/* =========================================================
   CAREER INTENT RESPONSES
========================================================= */

const buildIntentResponse = (
  intent: CSIntent,
  context?: ICSConversationContext
): ICSResponseResult => {
  const firstName =
    getFirstName(
      context
    );

  const targetRole =
    context?.targetRole;

  const careerGoal =
    context?.careerGoal;

  const skillsFocus =
    context?.skillsFocus ??
    [];

  switch (intent) {
    /* =====================================================
       GREETING
    ===================================================== */

    case "GREETING":
      return {
        reply:
          `${buildGreetingPrefix(
            context
          )}! I'm your Career Assistant. I can help you understand your CV, improve it, find suitable jobs, prepare for interviews, review interview performance, identify skill gaps, and decide what to work on next.`,

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          nextStep:
            "CAREER_ASSISTANT_READY",
        },
      };

    /* =====================================================
       THANK YOU
    ===================================================== */

    case "THANK_YOU":
      return {
        reply:
          firstName
            ? `You're welcome, ${firstName}. Let me know what you'd like to work on next.`
            : "You're welcome. Let me know what you'd like to work on next.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          nextStep:
            "WAIT_FOR_NEXT_REQUEST",
        },
      };

    /* =====================================================
       CV ANALYSIS
    ===================================================== */

    case "CV_ANALYSIS":
      return {
        reply:
          "I'll review your CV analysis and explain your overall score, ATS performance, strengths, weaknesses, skills, and the areas that need the most attention.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          nextStep:
            "LOAD_CV_ANALYSIS",
        },
      };

    /* =====================================================
       CV IMPROVEMENT
    ===================================================== */

    case "CV_IMPROVEMENT":
      return {
        reply:
          targetRole
            ? `I'll review your CV and identify the highest-impact improvements for your target role: ${targetRole}.`
            : "I'll review your CV and identify the highest-impact changes that can make it stronger and more competitive.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          targetRole,

          nextStep:
            "LOAD_CV_IMPROVEMENT_DATA",
        },
      };

    /* =====================================================
       JOB MATCHING
    ===================================================== */

    case "JOB_MATCHING":
      return {
        reply:
          targetRole
            ? `I'll compare your CV and skills with available jobs, with extra focus on ${targetRole} opportunities.`
            : "I'll compare your CV, experience, and skills with available jobs and identify the strongest matches.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          activeJobId:
            context?.activeJobId,

          targetRole,

          nextStep:
            "RUN_JOB_MATCHING",
        },
      };

    /* =====================================================
       JOB SEARCH HELP
    ===================================================== */

    case "JOB_SEARCH_HELP":
      return {
        reply:
          targetRole
            ? `I can help you structure your job search for ${targetRole} roles, including what positions to prioritize and how to improve your applications.`
            : "I can help you structure your job search, choose the right roles, improve your applications, and decide where to focus your effort.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          targetRole,

          nextStep:
            "BUILD_JOB_SEARCH_GUIDANCE",
        },
      };

    /* =====================================================
       INTERVIEW PREPARATION
    ===================================================== */

    case "INTERVIEW_PREP":
      return {
        reply:
          targetRole
            ? `I'll help you prepare for ${targetRole} interviews using relevant questions, your profile, and the areas you need to strengthen.`
            : "I'll help you prepare for interviews with relevant questions, practice areas, and guidance based on your profile.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          targetRole,

          activeJobId:
            context?.activeJobId,

          nextStep:
            "BUILD_INTERVIEW_PREPARATION",
        },
      };

    /* =====================================================
       INTERVIEW FEEDBACK
    ===================================================== */

    case "INTERVIEW_FEEDBACK":
      return {
        reply:
          "I'll review your interview results and explain your strengths, weaknesses, scoring, and the areas you should improve before your next interview.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeInterviewId:
            context?.activeInterviewId,

          nextStep:
            "LOAD_INTERVIEW_FEEDBACK",
        },
      };

    /* =====================================================
       SKILL GAP
    ===================================================== */

    case "SKILL_GAP":
      return {
        reply:
          targetRole
            ? `I'll compare your current skills with what is expected for ${targetRole} roles and identify the most important gaps.`
            : "I'll review your current skills and identify the most important gaps that may be limiting your job opportunities.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          activeJobId:
            context?.activeJobId,

          targetRole,

          currentSkillsFocus:
            skillsFocus,

          nextStep:
            "ANALYZE_SKILL_GAPS",
        },
      };

    /* =====================================================
       CAREER PROGRESS
    ===================================================== */

    case "CAREER_PROGRESS":
      return {
        reply:
          "I'll review your recent InterviewIQ activity and summarize how your CV, interview performance, skills, and preparation have changed over time.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          nextStep:
            "LOAD_USER_PROGRESS",
        },
      };

    /* =====================================================
       CAREER GOAL
    ===================================================== */

    case "CAREER_GOAL":
      if (
        careerGoal
      ) {
        return {
          reply:
            `Your current career goal is "${careerGoal}". I can use your CV, skills, interview performance, and job data to help evaluate and refine that goal.`,

          intent,

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            careerGoal,

            targetRole,

            nextStep:
              "EVALUATE_CAREER_GOAL",
          },
        };
      }

      if (
        targetRole
      ) {
        return {
          reply:
            `You're currently targeting ${targetRole}. I can use your profile to help turn that target role into a clearer career goal and development plan.`,

          intent,

          action:
            "REPLY",

          requiredFields:
            [],

          metadata: {
            targetRole,

            nextStep:
              "BUILD_CAREER_GOAL",
          },
        };
      }

      return {
        reply:
          "What role or career direction are you currently interested in? For example: frontend developer, backend developer, cybersecurity analyst, data analyst, or another role.",

        intent,

        action:
          "ASK_TARGET_ROLE",

        requiredFields: [
          "targetRole",
        ],

        metadata: {
          awaitingField:
            "targetRole",

          nextStep:
            "COLLECT_TARGET_ROLE",
        },
      };

    /* =====================================================
       NEXT STEPS
    ===================================================== */

    case "NEXT_STEPS":
      return {
        reply:
          "I'll review the information available in your profile and determine the highest-priority next steps across your CV, skills, job search, and interview preparation.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          activeJobId:
            context?.activeJobId,

          activeInterviewId:
            context?.activeInterviewId,

          targetRole,

          careerGoal,

          skillsFocus,

          /*
           * This is NOT Career Automation yet.
           *
           * It only means the Career Assistant should
           * produce guidance using existing user data.
           *
           * The future Next Best Action / Automation
           * engine will be a separate module.
           */
          nextStep:
            "BUILD_CAREER_NEXT_STEPS",
        },
      };

    /* =====================================================
       PROFILE SUMMARY
    ===================================================== */

    case "PROFILE_SUMMARY":
      return {
        reply:
          "I'll combine your CV information, skills, experience, and available InterviewIQ data into a concise professional profile summary.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          activeResumeId:
            context?.activeResumeId,

          targetRole,

          careerGoal,

          skillsFocus,

          nextStep:
            "BUILD_PROFILE_SUMMARY",
        },
      };

    /* =====================================================
       GENERAL CAREER HELP
    ===================================================== */

    case "GENERAL_CAREER_HELP":
      return {
        reply:
          "I can help you with your CV, CV improvement, job matching, job search, interview preparation, interview feedback, skill gaps, career progress, career goals, and deciding what to work on next.",

        intent,

        action:
          "REPLY",

        requiredFields:
          [],

        metadata: {
          nextStep:
            "SHOW_CAREER_CAPABILITIES",
        },
      };

    /* =====================================================
       UNKNOWN
    ===================================================== */

    default:
      return {
        reply:
          "I'm not completely sure what career-related help you're asking for. Could you give me a little more detail?",

        intent,

        action:
          "ASK_CLARIFICATION",

        requiredFields:
          [],

        metadata: {
          reason:
            "UNSUPPORTED_OR_UNKNOWN_INTENT",
        },
      };
  }
};

/* =========================================================
   MAIN CAREER RESPONSE ENGINE
========================================================= */

export const buildCSResponse = (
  input: ICSResponseInput
): ICSResponseResult => {
  const message =
    normalizeText(
      input.message
    );

  /* =====================================================
     EMPTY MESSAGE
  ===================================================== */

  if (!message) {
    return {
      reply:
        "Please send me a message about your CV, jobs, interviews, skills, career progress, or career goals.",

      intent:
        input.intent,

      action:
        "ASK_CLARIFICATION",

      requiredFields:
        [],

      metadata: {
        reason:
          "EMPTY_MESSAGE",
      },
    };
  }

  /* =====================================================
     LOW CONFIDENCE / AMBIGUOUS
  ===================================================== */

  if (
    input.needsClarification
  ) {
    return buildClarificationResponse();
  }

  /* =====================================================
     REQUIRED DATA
  ===================================================== */

  const missingFields =
    getMissingRequiredFields(
      input.intent,
      input.context
    );

  /* =====================================================
     RESUME REQUIRED
  ===================================================== */

  if (
    missingFields.includes(
      "activeResumeId"
    )
  ) {
    return buildMissingResumeResponse(
      input.intent
    );
  }

  /* =====================================================
     INTERVIEW REQUIRED
  ===================================================== */

  if (
    missingFields.includes(
      "activeInterviewId"
    )
  ) {
    return buildMissingInterviewResponse(
      input.intent
    );
  }

  /* =====================================================
     NORMAL RESPONSE
  ===================================================== */

  return buildIntentResponse(
    input.intent,
    input.context
  );
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCSResponse,
};