/* =========================================================
   TYPES
========================================================= */

export interface ICareerConversationContextInput {
  message: string;

  predictedIntent: string;

  previousIntent?: string;

  lastResolvedIntent?: string;

  awaitingField?: string;

  targetRole?: string;

  careerGoal?: string;
}

export interface ICareerConversationContextResult {
  contextual: boolean;

  intent: string;

  originalIntent: string;

  inheritedIntent?: string;

  reason?:
    | "AWAITING_FIELD"
    | "ROADMAP_FOLLOW_UP"
    | "IMPROVEMENT_FOLLOW_UP"
    | "REFERENCE_FOLLOW_UP"
    | "CONTINUE_PREVIOUS_TOPIC"
    | "NO_CONTEXT_OVERRIDE";

  metadata: {
    hasReferenceLanguage: boolean;

    hasRoadmapLanguage: boolean;

    hasImprovementLanguage: boolean;

    hasContinuationLanguage: boolean;

    previousTopic?: string;

    targetRole?: string;

    careerGoal?: string;
  };
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
   CONTEXTUAL SOURCE INTENTS
========================================================= */

const CONTEXTUAL_SOURCE_INTENTS =
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
   NORMALIZE
========================================================= */

const normalizeMessage = (
  value: string
): string => {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

/* =========================================================
   REFERENCE LANGUAGE

   Examples:
   - this field
   - that field
   - this role
   - that role
   - this career
   - these skills
   - those skills
   - improve this
   - learn that
========================================================= */

const REFERENCE_PATTERNS:
  RegExp[] = [
    /\bthis field\b/i,

    /\bthat field\b/i,

    /\bthis role\b/i,

    /\bthat role\b/i,

    /\bthis career\b/i,

    /\bthat career\b/i,

    /\bthis path\b/i,

    /\bthat path\b/i,

    /\bthis direction\b/i,

    /\bthat direction\b/i,

    /\bthese skills\b/i,

    /\bthose skills\b/i,

    /\bthese areas\b/i,

    /\bthose areas\b/i,

    /\bthis area\b/i,

    /\bthat area\b/i,

    /\bthis job\b/i,

    /\bthat job\b/i,

    /\bthis position\b/i,

    /\bthat position\b/i,

    /\bimprove this\b/i,

    /\bimprove that\b/i,

    /\blearn this\b/i,

    /\blearn that\b/i,

    /\bwork on this\b/i,

    /\bwork on that\b/i,

    /\bfocus on this\b/i,

    /\bfocus on that\b/i,

    /\bwhat about that\b/i,

    /\bwhat about this\b/i,

    /\bhow about that\b/i,

    /\bhow about this\b/i,
  ];

/* =========================================================
   ROADMAP LANGUAGE
========================================================= */

const ROADMAP_PATTERNS:
  RegExp[] = [
    /\broadmap\b/i,

    /\broad map\b/i,

    /\bstep[- ]by[- ]step\b/i,

    /\baction plan\b/i,

    /\blearning plan\b/i,

    /\bstudy plan\b/i,

    /\bcareer plan\b/i,

    /\bdevelopment plan\b/i,

    /\bimprovement plan\b/i,

    /\bplan to improve\b/i,

    /\bplan for improving\b/i,

    /\bwhat should i do first\b/i,

    /\bwhat should i do next\b/i,

    /\bhow should i proceed\b/i,

    /\bhow should i continue\b/i,

    /\bwhere should i start\b/i,

    /\bwhat steps should i take\b/i,

    /\bwrite.*plan\b/i,

    /\bcreate.*plan\b/i,

    /\bmake.*plan\b/i,

    /\bbuild.*plan\b/i,
  ];

/* =========================================================
   IMPROVEMENT LANGUAGE
========================================================= */

const IMPROVEMENT_PATTERNS:
  RegExp[] = [
    /\bhow can i improve\b/i,

    /\bhow should i improve\b/i,

    /\bhow do i improve\b/i,

    /\bhelp me improve\b/i,

    /\bwhat should i improve\b/i,

    /\bwhat do i need to improve\b/i,

    /\bwhat should i learn\b/i,

    /\bwhat do i need to learn\b/i,

    /\bwhat should i practice\b/i,

    /\bwhat should i study\b/i,

    /\bwhat should i strengthen\b/i,

    /\bhow can i get better\b/i,

    /\bhow do i get better\b/i,

    /\bhow can i become better\b/i,
  ];

/* =========================================================
   CONTINUATION LANGUAGE
========================================================= */

const CONTINUATION_PATTERNS:
  RegExp[] = [
    /\btell me more\b/i,

    /\bexplain more\b/i,

    /\bcan you explain\b/i,

    /\bgo deeper\b/i,

    /\bcontinue\b/i,

    /\bwhat else\b/i,

    /\band then\b/i,

    /\bafter that\b/i,

    /\bwhat next\b/i,

    /\bcan you expand\b/i,

    /\bexpand on that\b/i,

    /\bexpand on this\b/i,

    /\bmore about that\b/i,

    /\bmore about this\b/i,
  ];

/* =========================================================
   PATTERN CHECK
========================================================= */

const matchesAny = (
  message: string,
  patterns: RegExp[]
): boolean => {
  return patterns.some(
    (
      pattern
    ) =>
      pattern.test(
        message
      )
  );
};

/* =========================================================
   RESOLVE PREVIOUS TOPIC
========================================================= */

const resolvePreviousTopic = (
  previousIntent?: string,
  lastResolvedIntent?: string
): string | undefined => {
  if (
    previousIntent &&
    CONTEXTUAL_SOURCE_INTENTS.has(
      previousIntent
    )
  ) {
    return previousIntent;
  }

  if (
    lastResolvedIntent &&
    CONTEXTUAL_SOURCE_INTENTS.has(
      lastResolvedIntent
    )
  ) {
    return lastResolvedIntent;
  }

  return undefined;
};

/* =========================================================
   EXPLICIT INTENT CHECK

   We should not override clearly explicit requests.

   Examples:
   "Analyze my CV"
   "Find matching jobs"
   "Give me interview feedback"
========================================================= */

const hasStrongExplicitIntent =
  (
    message: string
  ): boolean => {
    const patterns:
      RegExp[] = [
      /\b(cv|resume)\b.*\b(analyze|analysis|review|score)\b/i,

      /\b(analyze|review)\b.*\b(cv|resume)\b/i,

      /\bjob\b.*\b(match|matching)\b/i,

      /\bmatch\b.*\b(job|jobs|vacancy|vacancies)\b/i,

      /\binterview\b.*\b(feedback|performance|score|result)\b/i,

      /\bprepare\b.*\binterview\b/i,

      /\binterview\b.*\bprepare|preparation|practice\b/i,

      /\bcareer progress\b/i,

      /\bcareer goal\b/i,

      /\bprofile summary\b/i,

      /\bskill gap\b/i,

      /\bmissing skills\b/i,

      /\bjob search\b/i,
    ];

    return matchesAny(
      message,
      patterns
    );
  };

/* =========================================================
   RESOLVE ROADMAP INTENT

   A roadmap is normally a NEXT_STEPS request.

   We intentionally reuse an existing Career Assistant
   intent instead of creating a new ML intent.
========================================================= */

const resolveRoadmapIntent = (
  previousTopic?: string
): string => {
  switch (
    previousTopic
  ) {
    case "INTERVIEW_FEEDBACK":
    case "INTERVIEW_PREP":
    case "JOB_MATCHING":
    case "JOB_SEARCH_HELP":
    case "SKILL_GAP":
    case "CV_ANALYSIS":
    case "CV_IMPROVEMENT":
    case "CAREER_PROGRESS":
    case "CAREER_GOAL":
    case "PROFILE_SUMMARY":
    case "NEXT_STEPS":
      return "NEXT_STEPS";

    default:
      return "NEXT_STEPS";
  }
};

/* =========================================================
   RESOLVE IMPROVEMENT FOLLOW-UP
========================================================= */

const resolveImprovementIntent = (
  previousTopic?: string
): string => {
  switch (
    previousTopic
  ) {
    /* =====================================================
       CV
    ===================================================== */

    case "CV_ANALYSIS":
    case "CV_IMPROVEMENT":
      return "CV_IMPROVEMENT";

    /* =====================================================
       JOB / SKILLS
    ===================================================== */

    case "JOB_MATCHING":
    case "JOB_SEARCH_HELP":
    case "SKILL_GAP":
      return "SKILL_GAP";

    /* =====================================================
       INTERVIEW
    ===================================================== */

    case "INTERVIEW_FEEDBACK":
    case "INTERVIEW_PREP":
      return "INTERVIEW_PREP";

    /* =====================================================
       GOAL / PROGRESS
    ===================================================== */

    case "CAREER_GOAL":
    case "CAREER_PROGRESS":
    case "NEXT_STEPS":
      return "NEXT_STEPS";

    default:
      return "GENERAL_CAREER_HELP";
  }
};

/* =========================================================
   MAIN RESOLVER
========================================================= */

export const resolveCareerConversationIntent =
  (
    input:
      ICareerConversationContextInput
  ): ICareerConversationContextResult => {
    const message =
      normalizeMessage(
        input.message
      );

    const originalIntent =
      input.predictedIntent;

    const previousTopic =
      resolvePreviousTopic(
        input.previousIntent,
        input.lastResolvedIntent
      );

    const hasReferenceLanguage =
      matchesAny(
        message,
        REFERENCE_PATTERNS
      );

    const hasRoadmapLanguage =
      matchesAny(
        message,
        ROADMAP_PATTERNS
      );

    const hasImprovementLanguage =
      matchesAny(
        message,
        IMPROVEMENT_PATTERNS
      );

    const hasContinuationLanguage =
      matchesAny(
        message,
        CONTINUATION_PATTERNS
      );

    const metadata = {
      hasReferenceLanguage,

      hasRoadmapLanguage,

      hasImprovementLanguage,

      hasContinuationLanguage,

      previousTopic,

      targetRole:
        input.targetRole,

      careerGoal:
        input.careerGoal,
    };

    /* =====================================================
       1. AWAITING FIELD HAS HIGHEST PRIORITY

       Existing multi-turn field collection must not be
       interrupted by contextual intent resolution.
    ===================================================== */

    if (
      input.awaitingField &&
      previousTopic
    ) {
      return {
        contextual:
          true,

        intent:
          previousTopic,

        originalIntent,

        inheritedIntent:
          previousTopic,

        reason:
          "AWAITING_FIELD",

        metadata,
      };
    }

    /* =====================================================
       2. STRONG EXPLICIT REQUEST

       Do not replace a clearly stated new topic.
    ===================================================== */

    if (
      hasStrongExplicitIntent(
        message
      )
    ) {
      return {
        contextual:
          false,

        intent:
          originalIntent,

        originalIntent,

        reason:
          "NO_CONTEXT_OVERRIDE",

        metadata,
      };
    }

    /* =====================================================
       3. ROADMAP FOLLOW-UP

       Example:

       Previous:
       JOB_SEARCH_HELP

       User:
       "Can you write a roadmap to improve this field?"

       Result:
       NEXT_STEPS
    ===================================================== */

    if (
      previousTopic &&
      hasRoadmapLanguage &&
      (
        hasReferenceLanguage ||
        originalIntent ===
          "GENERAL_CAREER_HELP" ||
        originalIntent ===
          "NEXT_STEPS"
      )
    ) {
      const resolvedIntent =
        resolveRoadmapIntent(
          previousTopic
        );

      return {
        contextual:
          true,

        intent:
          resolvedIntent,

        originalIntent,

        inheritedIntent:
          previousTopic,

        reason:
          "ROADMAP_FOLLOW_UP",

        metadata,
      };
    }

    /* =====================================================
       4. IMPROVEMENT FOLLOW-UP

       Example:

       Previous:
       JOB_SEARCH_HELP

       User:
       "How can I improve this?"

       Result:
       SKILL_GAP
    ===================================================== */

    if (
      previousTopic &&
      hasImprovementLanguage &&
      hasReferenceLanguage
    ) {
      const resolvedIntent =
        resolveImprovementIntent(
          previousTopic
        );

      return {
        contextual:
          true,

        intent:
          resolvedIntent,

        originalIntent,

        inheritedIntent:
          previousTopic,

        reason:
          "IMPROVEMENT_FOLLOW_UP",

        metadata,
      };
    }

    /* =====================================================
       5. GENERIC REFERENCE FOLLOW-UP

       Example:

       "Tell me more about that."
       "What about this?"
       "Can you explain that?"

       Keep the previous topic.
    ===================================================== */

    if (
      previousTopic &&
      hasReferenceLanguage
    ) {
      return {
        contextual:
          true,

        intent:
          previousTopic,

        originalIntent,

        inheritedIntent:
          previousTopic,

        reason:
          "REFERENCE_FOLLOW_UP",

        metadata,
      };
    }

    /* =====================================================
       6. CONTINUATION FOLLOW-UP

       We only override broad / uncertain predictions.

       Example:
       "Tell me more"
    ===================================================== */

    if (
      previousTopic &&
      hasContinuationLanguage &&
      (
        originalIntent ===
          "GENERAL_CAREER_HELP" ||
        originalIntent ===
          "GREETING"
      )
    ) {
      return {
        contextual:
          true,

        intent:
          previousTopic,

        originalIntent,

        inheritedIntent:
          previousTopic,

        reason:
          "CONTINUE_PREVIOUS_TOPIC",

        metadata,
      };
    }

    /* =====================================================
       7. DEFAULT
    ===================================================== */

    return {
      contextual:
        false,

      intent:
        CAREER_INTENTS.has(
          originalIntent
        )
          ? originalIntent
          : "GENERAL_CAREER_HELP",

      originalIntent,

      reason:
        "NO_CONTEXT_OVERRIDE",

      metadata,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  resolveCareerConversationIntent,
};