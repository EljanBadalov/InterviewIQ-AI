import apiClient from "./apiClient";

/* =========================================================
   TYPES
========================================================= */

export type CareerAssistantAction =
  | "REPLY"
  | "ASK_CLARIFICATION"
  | "ASK_RESUME"
  | "ASK_JOB"
  | "ASK_INTERVIEW"
  | "ASK_TARGET_ROLE"
  | "ASK_CAREER_GOAL"
  | "ASK_SKILLS_FOCUS";

export interface CareerAssistantAlternative {
  intent: string;
  confidence: number;
}

export interface CareerAssistantMemory {
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

/* =========================================================
   REQUEST
========================================================= */

export interface CareerAssistantChatRequest {
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

/* =========================================================
   RESPONSE DATA
========================================================= */

export interface CareerAssistantData {
  careerAssistant?: boolean;

  intent?: string;

  nextStep?: string;

  requiresInterviewIQData?: boolean;

  activeResumeId?: string;
  activeJobId?: string;
  activeInterviewId?: string;

  targetRole?: string;
  careerGoal?: string;

  skillsFocus?: string[];

  resumeDataLoaded?: boolean;
  jobDataLoaded?: boolean;
  interviewDataLoaded?: boolean;
  interviewPrepDataLoaded?: boolean;
  careerProgressDataLoaded?: boolean;
  nextStepsDataLoaded?: boolean;
  careerGoalDataLoaded?: boolean;
  jobSearchHelpDataLoaded?: boolean;

  resume?: Record<string, unknown>;

  jobMatching?: Record<string, unknown>;

  interview?: Record<string, unknown>;

  interviewPrep?: Record<string, unknown>;

  careerProgress?: Record<string, unknown>;

  nextSteps?: Record<string, unknown>;

  careerGoalEvaluation?: Record<string, unknown>;

  jobSearchHelp?: Record<string, unknown>;

  [key: string]: unknown;
}

/* =========================================================
   CHAT RESPONSE
========================================================= */

export interface CareerAssistantChatResponse {
  sessionId: string;

  reply: string;

  intent: string;

  confidence: number;

  alternatives: CareerAssistantAlternative[];

  needsClarification: boolean;

  action: CareerAssistantAction;

  requiresHuman: boolean;

  memory: CareerAssistantMemory;

  data?: CareerAssistantData;
}

/* =========================================================
   API RESPONSE
========================================================= */

interface CareerAssistantApiResponse {
  success: boolean;

  data: CareerAssistantChatResponse;

  message?: string;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value?: string
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized || undefined;
};

const normalizeStringArray = (
  value?: string[]
): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized =
    value
      .map((item) =>
        normalizeString(item)
      )
      .filter(
        (item): item is string =>
          Boolean(item)
      );

  if (normalized.length === 0) {
    return undefined;
  }

  return Array.from(
    new Set(normalized)
  );
};

/* =========================================================
   BUILD BODY
========================================================= */

const buildChatRequestBody = (
  input: CareerAssistantChatRequest
): CareerAssistantChatRequest => {
  const sessionId =
    normalizeString(
      input.sessionId
    );

  const message =
    normalizeString(
      input.message
    );

  if (!sessionId) {
    throw new Error(
      "Career Assistant sessionId is required."
    );
  }

  if (!message) {
    throw new Error(
      "Career Assistant message is required."
    );
  }

  return {
    sessionId,

    message,

    userId:
      normalizeString(
        input.userId
      ),

    customerId:
      normalizeString(
        input.customerId
      ),

    customerName:
      normalizeString(
        input.customerName
      ),

    email:
      normalizeString(
        input.email
      ),

    activeResumeId:
      normalizeString(
        input.activeResumeId
      ),

    activeJobId:
      normalizeString(
        input.activeJobId
      ),

    activeInterviewId:
      normalizeString(
        input.activeInterviewId
      ),

    targetRole:
      normalizeString(
        input.targetRole
      ),

    careerGoal:
      normalizeString(
        input.careerGoal
      ),

    skillsFocus:
      normalizeStringArray(
        input.skillsFocus
      ),
  };
};

/* =========================================================
   SEND MESSAGE
========================================================= */

export const sendCareerAssistantMessage =
  async (
    input: CareerAssistantChatRequest
  ): Promise<CareerAssistantChatResponse> => {
    const body =
      buildChatRequestBody(
        input
      );

    const response =
      await apiClient.post<CareerAssistantApiResponse>(
        "/cs/chat",
        body
      );

    if (
      !response.data.success ||
      !response.data.data
    ) {
      throw new Error(
        response.data.message ||
          "Career Assistant returned no data."
      );
    }

    return response.data.data;
  };

/* =========================================================
   SESSION ID
========================================================= */

export const createCareerAssistantSessionId =
  (): string => {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID ===
        "function"
    ) {
      return `career-${crypto.randomUUID()}`;
    }

    return [
      "career",
      Date.now(),
      Math.random()
        .toString(36)
        .slice(2),
    ].join("-");
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  sendCareerAssistantMessage,
  createCareerAssistantSessionId,
};