/* =========================================================
   TYPES
========================================================= */

export type CareerResponseFocus =
  | "OVERVIEW"
  | "STRENGTHS"
  | "WEAKNESSES"
  | "ATS"
  | "SKILLS"
  | "EXPERIENCE"
  | "STRUCTURE"
  | "CONTENT"
  | "PRIORITIES"
  | "ROADMAP"
  | "COMPARISON"
  | "JOB_ALIGNMENT"
  | "INTERVIEW_TECHNICAL"
  | "INTERVIEW_COMMUNICATION"
  | "INTERVIEW_COMPLETENESS"
  | "PROGRESS"
  | "GOAL_READINESS"
  | "GENERAL";

export interface ICareerResponseFocusInput {
  message: string;

  intent: string;

  previousIntent?: string;

  inheritedIntent?: string;

  targetRole?: string;
}

export interface ICareerResponseFocusResult {
  focus: CareerResponseFocus;

  confidence: number;

  matchedSignals: string[];

  source:
    | "EXPLICIT_KEYWORD"
    | "PATTERN"
    | "INTENT_DEFAULT"
    | "CONTEXT"
    | "FALLBACK";
}

/* =========================================================
   NORMALIZATION
========================================================= */

const normalizeMessage = (
  value: string
): string => {
  return value
    .toLowerCase()
    .replace(
      /['’]/g,
      ""
    )
    .replace(
      /[^a-z0-9+#.\s-]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

/* =========================================================
   PATTERN MATCH
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
   SIGNAL COLLECTOR
========================================================= */

const collectSignals = (
  message: string,
  patterns: Array<{
    label: string;

    pattern: RegExp;
  }>
): string[] => {
  return patterns
    .filter(
      (
        item
      ) =>
        item.pattern.test(
          message
        )
    )
    .map(
      (
        item
      ) =>
        item.label
    );
};

/* =========================================================
   STRENGTH PATTERNS
========================================================= */

const STRENGTH_PATTERNS = [
  {
    label:
      "strongest",

    pattern:
      /\bstrongest\b/i,
  },

  {
    label:
      "strength",

    pattern:
      /\bstrengths?\b/i,
  },

  {
    label:
      "best",

    pattern:
      /\bbest\b/i,
  },

  {
    label:
      "good at",

    pattern:
      /\bgood at\b/i,
  },

  {
    label:
      "strong areas",

    pattern:
      /\bstrong areas?\b/i,
  },

  {
    label:
      "what stands out",

    pattern:
      /\bwhat stands out\b/i,
  },
];

/* =========================================================
   WEAKNESS PATTERNS
========================================================= */

const WEAKNESS_PATTERNS = [
  {
    label:
      "weakest",

    pattern:
      /\bweakest\b/i,
  },

  {
    label:
      "weakness",

    pattern:
      /\bweakness(?:es)?\b/i,
  },

  {
    label:
      "problem",

    pattern:
      /\bproblems?\b/i,
  },

  {
    label:
      "wrong",

    pattern:
      /\bwhat(?:s| is) wrong\b/i,
  },

  {
    label:
      "bad",

    pattern:
      /\bbad\b/i,
  },

  {
    label:
      "needs improvement",

    pattern:
      /\bneeds? improvement\b/i,
  },

  {
    label:
      "poor",

    pattern:
      /\bpoor\b/i,
  },
];

/* =========================================================
   ATS PATTERNS
========================================================= */

const ATS_PATTERNS = [
  {
    label:
      "ats",

    pattern:
      /\bats\b/i,
  },

  {
    label:
      "applicant tracking",

    pattern:
      /\bapplicant tracking\b/i,
  },

  {
    label:
      "ats score",

    pattern:
      /\bats score\b/i,
  },

  {
    label:
      "keyword alignment",

    pattern:
      /\bkeyword alignment\b/i,
  },
];

/* =========================================================
   SKILL PATTERNS
========================================================= */

const SKILL_PATTERNS = [
  {
    label:
      "skill",

    pattern:
      /\bskills?\b/i,
  },

  {
    label:
      "technology",

    pattern:
      /\btechnolog(?:y|ies)\b/i,
  },

  {
    label:
      "technical stack",

    pattern:
      /\btech(?:nical)? stack\b/i,
  },

  {
    label:
      "what should i learn",

    pattern:
      /\bwhat should i learn\b/i,
  },

  {
    label:
      "learn next",

    pattern:
      /\blearn next\b/i,
  },

  {
    label:
      "missing skill",

    pattern:
      /\bmissing skills?\b/i,
  },
];

/* =========================================================
   EXPERIENCE PATTERNS
========================================================= */

const EXPERIENCE_PATTERNS = [
  {
    label:
      "experience",

    pattern:
      /\bexperience\b/i,
  },

  {
    label:
      "work history",

    pattern:
      /\bwork history\b/i,
  },

  {
    label:
      "professional background",

    pattern:
      /\bprofessional background\b/i,
  },

  {
    label:
      "employment",

    pattern:
      /\bemployment\b/i,
  },
];

/* =========================================================
   STRUCTURE PATTERNS
========================================================= */

const STRUCTURE_PATTERNS = [
  {
    label:
      "structure",

    pattern:
      /\bstructure\b/i,
  },

  {
    label:
      "format",

    pattern:
      /\bformat(?:ting)?\b/i,
  },

  {
    label:
      "layout",

    pattern:
      /\blayout\b/i,
  },

  {
    label:
      "section order",

    pattern:
      /\bsection order\b/i,
  },

  {
    label:
      "readability",

    pattern:
      /\breadability\b/i,
  },
];

/* =========================================================
   CONTENT PATTERNS
========================================================= */

const CONTENT_PATTERNS = [
  {
    label:
      "content",

    pattern:
      /\bcontent\b/i,
  },

  {
    label:
      "wording",

    pattern:
      /\bwording\b/i,
  },

  {
    label:
      "summary",

    pattern:
      /\bprofessional summary\b/i,
  },

  {
    label:
      "description",

    pattern:
      /\bdescription(?:s)?\b/i,
  },
];

/* =========================================================
   PRIORITY PATTERNS
========================================================= */

const PRIORITY_PATTERNS = [
  {
    label:
      "fix first",

    pattern:
      /\bfix first\b/i,
  },

  {
    label:
      "improve first",

    pattern:
      /\bimprove first\b/i,
  },

  {
    label:
      "focus first",

    pattern:
      /\bfocus on first\b/i,
  },

  {
    label:
      "highest priority",

    pattern:
      /\bhighest priority\b/i,
  },

  {
    label:
      "top priority",

    pattern:
      /\btop priorit(?:y|ies)\b/i,
  },

  {
    label:
      "most important",

    pattern:
      /\bmost important\b/i,
  },

  {
    label:
      "what should i do first",

    pattern:
      /\bwhat should i do first\b/i,
  },

  {
    label:
      "where should i start",

    pattern:
      /\bwhere should i start\b/i,
  },
];

/* =========================================================
   ROADMAP PATTERNS
========================================================= */

const ROADMAP_PATTERNS = [
  {
    label:
      "roadmap",

    pattern:
      /\broad\s?map\b/i,
  },

  {
    label:
      "step by step",

    pattern:
      /\bstep[- ]by[- ]step\b/i,
  },

  {
    label:
      "action plan",

    pattern:
      /\baction plan\b/i,
  },

  {
    label:
      "learning plan",

    pattern:
      /\blearning plan\b/i,
  },

  {
    label:
      "plan",

    pattern:
      /\b(?:create|write|make|build|give).{0,20}\bplan\b/i,
  },

  {
    label:
      "steps",

    pattern:
      /\bwhat steps\b/i,
  },
];

/* =========================================================
   COMPARISON PATTERNS
========================================================= */

const COMPARISON_PATTERNS = [
  {
    label:
      "compare",

    pattern:
      /\bcompar(?:e|ing|ison)\b/i,
  },

  {
    label:
      "better than",

    pattern:
      /\bbetter than\b/i,
  },

  {
    label:
      "worse than",

    pattern:
      /\bworse than\b/i,
  },

  {
    label:
      "changed",

    pattern:
      /\bchanged?\b/i,
  },

  {
    label:
      "difference",

    pattern:
      /\bdifference\b/i,
  },

  {
    label:
      "before",

    pattern:
      /\bbefore\b/i,
  },

  {
    label:
      "previous",

    pattern:
      /\bprevious\b/i,
  },
];

/* =========================================================
   JOB ALIGNMENT PATTERNS
========================================================= */

const JOB_ALIGNMENT_PATTERNS = [
  {
    label:
      "job match",

    pattern:
      /\bjob matches?\b/i,
  },

  {
    label:
      "fit job",

    pattern:
      /\bfit(?: for)? (?:this )?job\b/i,
  },

  {
    label:
      "role alignment",

    pattern:
      /\brole alignment\b/i,
  },

  {
    label:
      "suitable role",

    pattern:
      /\bsuitable roles?\b/i,
  },

  {
    label:
      "good enough for",

    pattern:
      /\bgood enough for\b/i,
  },

  {
    label:
      "ready for",

    pattern:
      /\bready for\b/i,
  },
];

/* =========================================================
   INTERVIEW TECHNICAL PATTERNS
========================================================= */

const INTERVIEW_TECHNICAL_PATTERNS = [
  {
    label:
      "technical",

    pattern:
      /\btechnical\b/i,
  },

  {
    label:
      "technical accuracy",

    pattern:
      /\btechnical accuracy\b/i,
  },

  {
    label:
      "coding",

    pattern:
      /\bcoding\b/i,
  },

  {
    label:
      "technical questions",

    pattern:
      /\btechnical questions?\b/i,
  },
];

/* =========================================================
   COMMUNICATION PATTERNS
========================================================= */

const COMMUNICATION_PATTERNS = [
  {
    label:
      "communication",

    pattern:
      /\bcommunication\b/i,
  },

  {
    label:
      "speaking",

    pattern:
      /\bspeaking\b/i,
  },

  {
    label:
      "clear",

    pattern:
      /\bclarity\b/i,
  },

  {
    label:
      "explain answers",

    pattern:
      /\bexplain(?:ing)? (?:my )?answers?\b/i,
  },
];

/* =========================================================
   COMPLETENESS PATTERNS
========================================================= */

const COMPLETENESS_PATTERNS = [
  {
    label:
      "completeness",

    pattern:
      /\bcompleteness\b/i,
  },

  {
    label:
      "complete answers",

    pattern:
      /\bcomplete answers?\b/i,
  },

  {
    label:
      "detail",

    pattern:
      /\bdetails?\b/i,
  },

  {
    label:
      "answer enough",

    pattern:
      /\banswer(?:ed)? enough\b/i,
  },
];

/* =========================================================
   PROGRESS PATTERNS
========================================================= */

const PROGRESS_PATTERNS = [
  {
    label:
      "progress",

    pattern:
      /\bprogress\b/i,
  },

  {
    label:
      "improved over time",

    pattern:
      /\bimprov(?:ed|ement).{0,20}\bover time\b/i,
  },

  {
    label:
      "getting better",

    pattern:
      /\bgetting better\b/i,
  },

  {
    label:
      "changed over time",

    pattern:
      /\bchanged? over time\b/i,
  },
];

/* =========================================================
   GOAL READINESS PATTERNS
========================================================= */

const GOAL_READINESS_PATTERNS = [
  {
    label:
      "realistic",

    pattern:
      /\brealistic\b/i,
  },

  {
    label:
      "ready",

    pattern:
      /\bready\b/i,
  },

  {
    label:
      "readiness",

    pattern:
      /\breadiness\b/i,
  },

  {
    label:
      "can i become",

    pattern:
      /\bcan i become\b/i,
  },

  {
    label:
      "career goal",

    pattern:
      /\bcareer goal\b/i,
  },

  {
    label:
      "target role",

    pattern:
      /\btarget role\b/i,
  },
];

/* =========================================================
   RESULT BUILDER
========================================================= */

const buildResult = (
  focus: CareerResponseFocus,
  confidence: number,
  matchedSignals: string[],
  source:
    ICareerResponseFocusResult["source"]
): ICareerResponseFocusResult => {
  return {
    focus,

    confidence:
      Number(
        Math.min(
          1,
          Math.max(
            0,
            confidence
          )
        ).toFixed(
          4
        )
      ),

    matchedSignals,

    source,
  };
};

/* =========================================================
   INTENT DEFAULT
========================================================= */

const resolveDefaultFocusFromIntent = (
  intent: string
): CareerResponseFocus => {
  switch (
    intent
  ) {
    case "CV_ANALYSIS":
      return "OVERVIEW";

    case "CV_IMPROVEMENT":
      return "PRIORITIES";

    case "SKILL_GAP":
      return "SKILLS";

    case "PROFILE_SUMMARY":
      return "OVERVIEW";

    case "JOB_MATCHING":
      return "JOB_ALIGNMENT";

    case "JOB_SEARCH_HELP":
      return "JOB_ALIGNMENT";

    case "INTERVIEW_PREP":
      return "PRIORITIES";

    case "INTERVIEW_FEEDBACK":
      return "OVERVIEW";

    case "CAREER_PROGRESS":
      return "PROGRESS";

    case "CAREER_GOAL":
      return "GOAL_READINESS";

    case "NEXT_STEPS":
      return "PRIORITIES";

    default:
      return "GENERAL";
  }
};

/* =========================================================
   MAIN RESOLVER
========================================================= */

export const resolveCareerResponseFocus =
  (
    input:
      ICareerResponseFocusInput
  ): ICareerResponseFocusResult => {
    const message =
      normalizeMessage(
        input.message
      );

    /* =====================================================
       ROADMAP
    ===================================================== */

    const roadmapSignals =
      collectSignals(
        message,
        ROADMAP_PATTERNS
      );

    if (
      roadmapSignals.length >
      0
    ) {
      return buildResult(
        "ROADMAP",
        0.98,
        roadmapSignals,
        "EXPLICIT_KEYWORD"
      );
    }

    /* =====================================================
       PRIORITIES
    ===================================================== */

    const prioritySignals =
      collectSignals(
        message,
        PRIORITY_PATTERNS
      );

    if (
      prioritySignals.length >
      0
    ) {
      return buildResult(
        "PRIORITIES",
        0.96,
        prioritySignals,
        "EXPLICIT_KEYWORD"
      );
    }

    /* =====================================================
       ATS
    ===================================================== */

    const atsSignals =
      collectSignals(
        message,
        ATS_PATTERNS
      );

    if (
      atsSignals.length >
      0
    ) {
      return buildResult(
        "ATS",
        0.99,
        atsSignals,
        "EXPLICIT_KEYWORD"
      );
    }

    /* =====================================================
       JOB ALIGNMENT
    ===================================================== */

    const jobSignals =
      collectSignals(
        message,
        JOB_ALIGNMENT_PATTERNS
      );

    if (
      jobSignals.length >
      0
    ) {
      return buildResult(
        "JOB_ALIGNMENT",
        0.95,
        jobSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       INTERVIEW TECHNICAL
    ===================================================== */

    if (
      input.intent ===
        "INTERVIEW_FEEDBACK" ||
      input.intent ===
        "INTERVIEW_PREP"
    ) {
      const technicalSignals =
        collectSignals(
          message,
          INTERVIEW_TECHNICAL_PATTERNS
        );

      if (
        technicalSignals.length >
        0
      ) {
        return buildResult(
          "INTERVIEW_TECHNICAL",
          0.97,
          technicalSignals,
          "PATTERN"
        );
      }

      const communicationSignals =
        collectSignals(
          message,
          COMMUNICATION_PATTERNS
        );

      if (
        communicationSignals.length >
        0
      ) {
        return buildResult(
          "INTERVIEW_COMMUNICATION",
          0.97,
          communicationSignals,
          "PATTERN"
        );
      }

      const completenessSignals =
        collectSignals(
          message,
          COMPLETENESS_PATTERNS
        );

      if (
        completenessSignals.length >
        0
      ) {
        return buildResult(
          "INTERVIEW_COMPLETENESS",
          0.97,
          completenessSignals,
          "PATTERN"
        );
      }
    }

    /* =====================================================
       SKILLS
    ===================================================== */

    const skillSignals =
      collectSignals(
        message,
        SKILL_PATTERNS
      );

    if (
      skillSignals.length >
      0
    ) {
      return buildResult(
        "SKILLS",
        0.94,
        skillSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       EXPERIENCE
    ===================================================== */

    const experienceSignals =
      collectSignals(
        message,
        EXPERIENCE_PATTERNS
      );

    if (
      experienceSignals.length >
      0
    ) {
      return buildResult(
        "EXPERIENCE",
        0.94,
        experienceSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       STRUCTURE
    ===================================================== */

    const structureSignals =
      collectSignals(
        message,
        STRUCTURE_PATTERNS
      );

    if (
      structureSignals.length >
      0
    ) {
      return buildResult(
        "STRUCTURE",
        0.94,
        structureSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       CONTENT
    ===================================================== */

    const contentSignals =
      collectSignals(
        message,
        CONTENT_PATTERNS
      );

    if (
      contentSignals.length >
      0
    ) {
      return buildResult(
        "CONTENT",
        0.93,
        contentSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       STRENGTHS
    ===================================================== */

    const strengthSignals =
      collectSignals(
        message,
        STRENGTH_PATTERNS
      );

    if (
      strengthSignals.length >
      0
    ) {
      return buildResult(
        "STRENGTHS",
        0.94,
        strengthSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       WEAKNESSES
    ===================================================== */

    const weaknessSignals =
      collectSignals(
        message,
        WEAKNESS_PATTERNS
      );

    if (
      weaknessSignals.length >
      0
    ) {
      return buildResult(
        "WEAKNESSES",
        0.94,
        weaknessSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       COMPARISON
    ===================================================== */

    const comparisonSignals =
      collectSignals(
        message,
        COMPARISON_PATTERNS
      );

    if (
      comparisonSignals.length >
      0
    ) {
      return buildResult(
        "COMPARISON",
        0.92,
        comparisonSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       PROGRESS
    ===================================================== */

    const progressSignals =
      collectSignals(
        message,
        PROGRESS_PATTERNS
      );

    if (
      progressSignals.length >
      0
    ) {
      return buildResult(
        "PROGRESS",
        0.95,
        progressSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       GOAL READINESS
    ===================================================== */

    const goalSignals =
      collectSignals(
        message,
        GOAL_READINESS_PATTERNS
      );

    if (
      goalSignals.length >
      0
    ) {
      return buildResult(
        "GOAL_READINESS",
        0.95,
        goalSignals,
        "PATTERN"
      );
    }

    /* =====================================================
       CONTEXTUAL ROADMAP

       For messages such as:
       "Can you make a plan for these?"
       contextual intent may already have been inherited.
    ===================================================== */

    if (
      input.intent ===
        "NEXT_STEPS" &&
      input.inheritedIntent
    ) {
      return buildResult(
        "PRIORITIES",
        0.82,
        [
          `inherited:${input.inheritedIntent}`,
        ],
        "CONTEXT"
      );
    }

    /* =====================================================
       INTENT DEFAULT
    ===================================================== */

    const defaultFocus =
      resolveDefaultFocusFromIntent(
        input.intent
      );

    return buildResult(
      defaultFocus,
      0.65,
      [],
      defaultFocus ===
        "GENERAL"
        ? "FALLBACK"
        : "INTENT_DEFAULT"
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  resolveCareerResponseFocus,
};