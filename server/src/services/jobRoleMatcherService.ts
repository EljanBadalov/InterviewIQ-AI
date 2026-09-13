import {
  type ICareerFieldSearchPlan,
} from "./careerFieldService";

/* =========================================================
   TYPES
========================================================= */

export type JobRoleMatchType =
  | "exact"
  | "alias"
  | "strong"
  | "related"
  | "fallback"
  | "reject";

export interface IJobRoleMatchResult {
  type:
    JobRoleMatchType;

  score:
    number;

  similarity:
    number;

  matchedRole?:
    string;

  matchedRoleSource?:
    | "target"
    | "alias"
    | "related-role";

  conflictDetected:
    boolean;

  conflictReason?:
    string;

  matchedTokens:
    string[];

  missingTokens:
    string[];
}

/* =========================================================
   CONSTANTS
========================================================= */

/*
 * These words identify the generic job role.
 *
 * They matter, but they do NOT identify the career by
 * themselves.
 *
 * Example:
 *
 * Software Engineer
 *
 * "Engineer" alone must never make this a Frontend job.
 */
const ROLE_WORDS =
  new Set<string>([
    "developer",
    "engineer",
    "designer",
    "analyst",
    "scientist",
    "administrator",
    "architect",
    "specialist",
    "consultant",
    "programmer",
    "tester",
  ]);

/*
 * Seniority words should not affect career identity.
 */
const SENIORITY_WORDS =
  new Set<string>([
    "junior",
    "jr",
    "senior",
    "sr",
    "staff",
    "principal",
    "lead",
    "associate",
    "entry",
    "graduate",
    "intern",
    "internship",
    "apprentice",
    "trainee",
  ]);

/*
 * Generic software words.
 *
 * These words may exist in thousands of job titles and must
 * not become career anchors.
 */
const GENERIC_WORDS =
  new Set<string>([
    "software",
    "application",
    "applications",
    "platform",
    "product",
    "products",
    "system",
    "systems",
    "technology",
    "technical",
    "engineering",
    "development",
    "services",
    "service",
    "team",
    "tools",
    "tooling",
  ]);

/*
 * Leadership titles are normally not suitable when searching
 * for individual-contributor developer roles.
 */
const MANAGEMENT_WORDS =
  new Set<string>([
    "manager",
    "director",
    "head",
    "vp",
    "president",
    "chief",
  ]);

/* =========================================================
   NORMALIZATION
========================================================= */

const normalizeText = (
  value:
    string | undefined | null
): string => {
  if (
    !value
  ) {
    return "";
  }

  return value
    .toLowerCase()

    /*
     * Preserve useful technology symbols:
     *
     * c++
     * c#
     * .net
     * node.js
     */
    .replace(
      /[(){}\[\],:;/\\|]+/g,
      " "
    )

    .replace(
      /[-–—]+/g,
      " "
    )

    .replace(
      /[^a-z0-9+#.]+/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();
};

const normalizeTechnologyToken = (
  value:
    string
): string => {
  const token =
    value
      .trim()
      .toLowerCase();

  const aliases:
    Record<
      string,
      string
    > = {
      "react.js":
        "react",

      reactjs:
        "react",

      "node.js":
        "node",

      nodejs:
        "node",

      "next.js":
        "next",

      nextjs:
        "next",

      typescript:
        "typescript",

      javascript:
        "javascript",

      js:
        "javascript",

      ts:
        "typescript",

      frontend:
        "frontend",

      "front-end":
        "frontend",

      backend:
        "backend",

      "back-end":
        "backend",

      fullstack:
        "fullstack",

      "full-stack":
        "fullstack",
    };

  return (
    aliases[token] ||
    token
  );
};

const tokenize = (
  value:
    string | undefined | null
): string[] => {
  const normalized =
    normalizeText(
      value
    );

  if (
    !normalized
  ) {
    return [];
  }

  return normalized
    .split(
      " "
    )
    .map(
      normalizeTechnologyToken
    )
    .filter(
      Boolean
    );
};

const uniqueStrings = (
  values:
    string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value of
    values
  ) {
    const cleaned =
      value.trim();

    if (
      !cleaned
    ) {
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
  }

  return result;
};

/* =========================================================
   TOKEN HELPERS
========================================================= */

const getMeaningfulTokens = (
  value:
    string
): string[] => {
  return tokenize(
    value
  ).filter(
    (
      token
    ) =>
      !SENIORITY_WORDS.has(
        token
      )
  );
};

const getIdentityTokens = (
  value:
    string
): string[] => {
  return getMeaningfulTokens(
    value
  ).filter(
    (
      token
    ) =>
      !ROLE_WORDS.has(
        token
      ) &&
      !GENERIC_WORDS.has(
        token
      )
  );
};

const getRoleTokens = (
  value:
    string
): string[] => {
  return getMeaningfulTokens(
    value
  ).filter(
    (
      token
    ) =>
      ROLE_WORDS.has(
        token
      )
  );
};

const countMatches = (
  haystack:
    Set<string>,
  needles:
    string[]
): number => {
  return needles.filter(
    (
      token
    ) =>
      haystack.has(
        token
      )
  ).length;
};

/* =========================================================
   MANAGEMENT CHECK
========================================================= */

const isManagementTitle = (
  title:
    string
): boolean => {
  const tokens =
    tokenize(
      title
    );

  return tokens.some(
    (
      token
    ) =>
      MANAGEMENT_WORDS.has(
        token
      )
  );
};

/* =========================================================
   TOKEN BASED ROLE MATCH

   IMPORTANT:

   We never use substring matching like:

   title.includes("ui")

   because:

   recruiter
   community

   can accidentally contain short character combinations.

   All matching below is token-based.
========================================================= */

interface ITokenRoleMatch {
  matched:
    boolean;

  phraseScore:
    number;

  matchedTokens:
    string[];

  missingTokens:
    string[];

  matchedIdentityTokens:
    string[];

  missingIdentityTokens:
    string[];

  matchedRoleTokens:
    string[];
}

const matchRoleTokens = (
  jobTitle:
    string,
  candidateRole:
    string
): ITokenRoleMatch => {
  const titleTokensArray =
    getMeaningfulTokens(
      jobTitle
    );

  const titleTokens =
    new Set<string>(
      titleTokensArray
    );

  const candidateTokens =
    getMeaningfulTokens(
      candidateRole
    );

  const identityTokens =
    getIdentityTokens(
      candidateRole
    );

  const roleTokens =
    getRoleTokens(
      candidateRole
    );

  if (
    candidateTokens.length ===
    0
  ) {
    return {
      matched:
        false,

      phraseScore:
        0,

      matchedTokens:
        [],

      missingTokens:
        [],

      matchedIdentityTokens:
        [],

      missingIdentityTokens:
        [],

      matchedRoleTokens:
        [],
    };
  }

  const matchedTokens =
    candidateTokens.filter(
      (
        token
      ) =>
        titleTokens.has(
          token
        )
    );

  const missingTokens =
    candidateTokens.filter(
      (
        token
      ) =>
        !titleTokens.has(
          token
        )
    );

  const matchedIdentityTokens =
    identityTokens.filter(
      (
        token
      ) =>
        titleTokens.has(
          token
        )
    );

  const missingIdentityTokens =
    identityTokens.filter(
      (
        token
      ) =>
        !titleTokens.has(
          token
        )
    );

  const matchedRoleTokens =
    roleTokens.filter(
      (
        token
      ) =>
        titleTokens.has(
          token
        )
    );

  const tokenCoverage =
    matchedTokens.length /
    candidateTokens.length;

  let phraseScore =
    Math.round(
      tokenCoverage *
      60
    );

  /*
   * Career-specific identity tokens are the most important.
   */
  if (
    identityTokens.length >
      0
  ) {
    const identityCoverage =
      matchedIdentityTokens.length /
      identityTokens.length;

    phraseScore +=
      Math.round(
        identityCoverage *
        30
      );
  }

  /*
   * Engineer / Developer / Analyst etc.
   */
  if (
    roleTokens.length ===
      0 ||
    matchedRoleTokens.length >
      0
  ) {
    phraseScore +=
      10;
  }

  phraseScore =
    Math.max(
      0,
      Math.min(
        100,
        phraseScore
      )
    );

  /*
   * RULE 1
   *
   * Career-specific roles require ALL identity tokens.
   *
   * JavaScript Engineer
   *
   * matches:
   *
   * SDK Engineer - JavaScript
   *
   * because token order does not matter.
   */
  if (
    identityTokens.length >
      0
  ) {
    const identityMatched =
      matchedIdentityTokens.length ===
      identityTokens.length;

    const roleCompatible =
      roleTokens.length ===
        0 ||
      matchedRoleTokens.length >
        0;

    return {
      matched:
        identityMatched &&
        roleCompatible,

      phraseScore,

      matchedTokens,

      missingTokens,

      matchedIdentityTokens,

      missingIdentityTokens,

      matchedRoleTokens,
    };
  }

  /*
   * RULE 2
   *
   * A fully generic role such as Software Engineer requires
   * very high token coverage.
   *
   * This prevents:
   *
   * Backend Software Engineer
   *
   * from matching a generic Software Engineer fallback too
   * easily in another career.
   */
  return {
    matched:
      tokenCoverage >=
      0.9,

    phraseScore,

    matchedTokens,

    missingTokens,

    matchedIdentityTokens,

    missingIdentityTokens,

    matchedRoleTokens,
  };
};

/* =========================================================
   CAREER CONFLICT DETECTION
========================================================= */

interface IConflictRule {
  targetTokens:
    string[];

  conflictingTokens:
    string[];
}

/*
 * This is intentionally small and structural.
 *
 * The database remains the primary career knowledge base.
 * These rules only protect against clearly opposite titles.
 */
const CONFLICT_RULES:
  IConflictRule[] = [
    {
      targetTokens: [
        "frontend",
      ],

      conflictingTokens: [
        "backend",
        "database",
        "devops",
        "cybersecurity",
        "security",
        "android",
        "ios",
      ],
    },

    {
      targetTokens: [
        "backend",
      ],

      conflictingTokens: [
        "frontend",
        "designer",
        "android",
        "ios",
      ],
    },

    {
      targetTokens: [
        "devops",
      ],

      conflictingTokens: [
        "frontend",
        "designer",
        "mobile",
      ],
    },

    {
      targetTokens: [
        "data",
        "analyst",
      ],

      conflictingTokens: [
        "frontend",
        "backend",
        "devops",
        "mobile",
      ],
    },

    {
      targetTokens: [
        "machine",
        "learning",
      ],

      conflictingTokens: [
        "frontend",
        "designer",
        "manual",
      ],
    },

    {
      targetTokens: [
        "qa",
      ],

      conflictingTokens: [
        "designer",
        "scientist",
      ],
    },
  ];

const detectCareerConflict = (
  targetFieldName:
    string,
  jobTitle:
    string
): {
  conflict:
    boolean;

  reason?:
    string;
} => {
  const targetTokens =
    new Set(
      tokenize(
        targetFieldName
      )
    );

  const titleTokens =
    new Set(
      tokenize(
        jobTitle
      )
    );

  for (
    const rule of
    CONFLICT_RULES
  ) {
    const ruleMatchesTarget =
      rule.targetTokens.every(
        (
          token
        ) =>
          targetTokens.has(
            normalizeTechnologyToken(
              token
            )
          )
      );

    if (
      !ruleMatchesTarget
    ) {
      continue;
    }

    const conflictToken =
      rule.conflictingTokens.find(
        (
          token
        ) =>
          titleTokens.has(
            normalizeTechnologyToken(
              token
            )
          )
      );

    if (
      conflictToken
    ) {
      return {
        conflict:
          true,

        reason:
          `Conflicting career token "${conflictToken}" found in job title.`,
      };
    }
  }

  return {
    conflict:
      false,
  };
};

/* =========================================================
   EXACT TARGET MATCH
========================================================= */

const matchTargetRole = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): IJobRoleMatchResult | null => {
  const match =
    matchRoleTokens(
      jobTitle,
      plan.targetField.name
    );

  if (
    !match.matched
  ) {
    return null;
  }

  return {
    type:
      "exact",

    score:
      100,

    similarity:
      100,

    matchedRole:
      plan.targetField.name,

    matchedRoleSource:
      "target",

    conflictDetected:
      false,

    matchedTokens:
      match.matchedTokens,

    missingTokens:
      match.missingTokens,
  };
};

/* =========================================================
   ALIAS MATCH
========================================================= */

const matchAliasRole = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): IJobRoleMatchResult | null => {
  let best:
    IJobRoleMatchResult | null =
    null;

  for (
    const alias of
    plan.targetField.aliases
  ) {
    const match =
      matchRoleTokens(
        jobTitle,
        alias
      );

    if (
      !match.matched
    ) {
      continue;
    }

    const candidate:
      IJobRoleMatchResult = {
        type:
          "alias",

        score:
          Math.max(
            92,
            match.phraseScore
          ),

        similarity:
          100,

        matchedRole:
          alias,

        matchedRoleSource:
          "alias",

        conflictDetected:
          false,

        matchedTokens:
          match.matchedTokens,

        missingTokens:
          match.missingTokens,
      };

    if (
      !best ||
      candidate.score >
        best.score
    ) {
      best =
        candidate;
    }
  }

  return best;
};

/* =========================================================
   RELATED ROLE MATCH
========================================================= */

const matchRelatedRole = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): IJobRoleMatchResult | null => {
  let best:
    IJobRoleMatchResult | null =
    null;

  for (
    const relatedRole of
    plan.relatedRoles
  ) {
    const match =
      matchRoleTokens(
        jobTitle,
        relatedRole.title
      );

    if (
      !match.matched
    ) {
      continue;
    }

    const finalScore =
      Math.round(
        relatedRole.similarity *
          0.8 +
        match.phraseScore *
          0.2
      );

    let type:
      JobRoleMatchType =
      "fallback";

    if (
      relatedRole.similarity >=
      85
    ) {
      type =
        "strong";
    } else if (
      relatedRole.similarity >=
      70
    ) {
      type =
        "related";
    } else if (
      relatedRole.similarity >=
      50
    ) {
      type =
        "fallback";
    } else {
      type =
        "reject";
    }

    const candidate:
      IJobRoleMatchResult = {
        type,

        score:
          finalScore,

        similarity:
          relatedRole.similarity,

        matchedRole:
          relatedRole.title,

        matchedRoleSource:
          "related-role",

        conflictDetected:
          false,

        matchedTokens:
          match.matchedTokens,

        missingTokens:
          match.missingTokens,
      };

    if (
      !best ||
      candidate.score >
        best.score
    ) {
      best =
        candidate;
    }
  }

  return best;
};

/* =========================================================
   MAIN ROLE CLASSIFIER
========================================================= */

export const classifyJobRole = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): IJobRoleMatchResult => {
  const normalizedTitle =
    normalizeText(
      jobTitle
    );

  if (
    !normalizedTitle
  ) {
    return {
      type:
        "reject",

      score:
        0,

      similarity:
        0,

      conflictDetected:
        false,

      matchedTokens:
        [],

      missingTokens:
        [],
    };
  }

  /* =====================================================
     MANAGEMENT FILTER
  ===================================================== */

  if (
    isManagementTitle(
      normalizedTitle
    )
  ) {
    return {
      type:
        "reject",

      score:
        0,

      similarity:
        0,

      conflictDetected:
        true,

      conflictReason:
        "Management or leadership title detected.",

      matchedTokens:
        [],

      missingTokens:
        [],
    };
  }

  /* =====================================================
     TARGET
  ===================================================== */

  const targetMatch =
    matchTargetRole(
      plan,
      normalizedTitle
    );

  if (
    targetMatch
  ) {
    return targetMatch;
  }

  /* =====================================================
     ALIAS
  ===================================================== */

  const aliasMatch =
    matchAliasRole(
      plan,
      normalizedTitle
    );

  if (
    aliasMatch
  ) {
    return aliasMatch;
  }

  /* =====================================================
     CONFLICT

     Target / alias gets checked first so:

     Frontend Engineer - Backend Integrations

     remains a frontend job because "Frontend Engineer"
     explicitly exists in the title.

     But:

     Backend Software Engineer

     cannot become Frontend fallback.
  ===================================================== */

  const conflict =
    detectCareerConflict(
      plan.targetField.name,
      normalizedTitle
    );

  if (
    conflict.conflict
  ) {
    return {
      type:
        "reject",

      score:
        0,

      similarity:
        0,

      conflictDetected:
        true,

      conflictReason:
        conflict.reason,

      matchedTokens:
        [],

      missingTokens:
        [],
    };
  }

  /* =====================================================
     RELATED ROLE
  ===================================================== */

  const relatedMatch =
    matchRelatedRole(
      plan,
      normalizedTitle
    );

  if (
    relatedMatch
  ) {
    return relatedMatch;
  }

  return {
    type:
      "reject",

    score:
      0,

    similarity:
      0,

    conflictDetected:
      false,

    matchedTokens:
      [],

    missingTokens:
      [],
  };
};

/* =========================================================
   SEARCH QUERY MATCH SCORE

   Used by externalJobService.ts.

   Important:
   query:
   UI Engineer

   DOES NOT match:
   Recruiter
   Community Manager
   iOS Engineer

   because UI must exist as a complete token.

   But:

   query:
   JavaScript Engineer

   DOES match:
   SDK Engineer - JavaScript

   because word order is intentionally irrelevant.
========================================================= */

export const calculateSearchQueryScore = (
  jobTitle:
    string,
  query:
    string
): number => {
  const normalizedTitle =
    normalizeText(
      jobTitle
    );

  const normalizedQuery =
    normalizeText(
      query
    );

  if (
    !normalizedTitle ||
    !normalizedQuery
  ) {
    return 0;
  }

  if (
    isManagementTitle(
      normalizedTitle
    )
  ) {
    return 0;
  }

  const match =
    matchRoleTokens(
      normalizedTitle,
      normalizedQuery
    );

  if (
    !match.matched
  ) {
    return 0;
  }

  /*
   * Exact normalized string.
   */
  if (
    normalizedTitle ===
    normalizedQuery
  ) {
    return 100;
  }

  const queryIdentityTokens =
    getIdentityTokens(
      normalizedQuery
    );

  /*
   * Specialized searches:
   *
   * React Developer
   * JavaScript Engineer
   * TypeScript Developer
   * UI Engineer
   *
   * require their identity token.
   */
  if (
    queryIdentityTokens.length >
      0 &&
    match.matchedIdentityTokens.length !==
      queryIdentityTokens.length
  ) {
    return 0;
  }

  return Math.max(
    70,
    Math.min(
      100,
      match.phraseScore
    )
  );
};

/* =========================================================
   BOOLEAN SEARCH MATCH
========================================================= */

export const matchesJobSearchQuery = (
  jobTitle:
    string,
  query:
    string,
  minimumScore =
    60
): boolean => {
  return (
    calculateSearchQueryScore(
      jobTitle,
      query
    ) >=
    minimumScore
  );
};

/* =========================================================
   ALL ACCEPTED CAREER TITLES
========================================================= */

export const getCareerRoleTitles = (
  plan:
    ICareerFieldSearchPlan
): string[] => {
  return uniqueStrings([
    plan.targetField.name,

    ...plan.targetField
      .aliases,

    ...plan.relatedRoles.map(
      (
        item
      ) =>
        item.title
    ),
  ]);
};

/* =========================================================
   DEBUG HELPER
========================================================= */

export const explainJobRoleMatch = (
  plan:
    ICareerFieldSearchPlan,
  jobTitle:
    string
): {
  jobTitle: string;

  targetField: string;

  result:
    IJobRoleMatchResult;
} => {
  return {
    jobTitle,

    targetField:
      plan.targetField.name,

    result:
      classifyJobRole(
        plan,
        jobTitle
      ),
  };
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  classifyJobRole,

  calculateSearchQueryScore,

  matchesJobSearchQuery,

  getCareerRoleTitles,

  explainJobRoleMatch,
};