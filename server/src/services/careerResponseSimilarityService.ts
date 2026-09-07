/* =========================================================
   TYPES
========================================================= */

export interface ICareerSimilarityResult {
  similarity: number;

  normalizedA: string;

  normalizedB: string;

  exactMatch: boolean;
}

/* =========================================================
   STOP WORDS
========================================================= */

const STOP_WORDS =
  new Set<string>([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "than",
    "to",
    "of",
    "for",
    "in",
    "on",
    "at",
    "by",
    "with",
    "from",
    "into",
    "about",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "do",
    "does",
    "did",
    "doing",
    "have",
    "has",
    "had",
    "having",
    "can",
    "could",
    "should",
    "would",
    "will",
    "may",
    "might",
    "must",
    "i",
    "me",
    "my",
    "mine",
    "you",
    "your",
    "yours",
    "we",
    "our",
    "ours",
    "they",
    "their",
    "theirs",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "what",
    "which",
    "who",
    "whom",
    "where",
    "when",
    "why",
    "how",
    "please",
    "just",
  ]);

/* =========================================================
   SEMANTIC ALIASES
========================================================= */

/*
  These aliases map common career-assistant synonyms
  to one canonical token.

  Examples:
  CV -> resume
  analyze -> analysis
  analyse -> analysis
  review -> analysis
*/

const TOKEN_ALIASES:
  Record<
    string,
    string
  > = {
    /* =====================================================
       CV / RESUME
    ===================================================== */

    cv:
      "resume",

    cvs:
      "resume",

    résumé:
      "resume",

    résumés:
      "resume",

    resumes:
      "resume",

    /* =====================================================
       ANALYSIS
    ===================================================== */

    analyze:
      "analysis",

    analyzes:
      "analysis",

    analyzed:
      "analysis",

    analyzing:
      "analysis",

    analyse:
      "analysis",

    analyses:
      "analysis",

    reviewed:
      "analysis",

    reviewing:
      "analysis",

    review:
      "analysis",

    evaluate:
      "analysis",

    evaluation:
      "analysis",

    assess:
      "analysis",

    assessment:
      "analysis",

    /* =====================================================
       IMPROVEMENT
    ===================================================== */

    improve:
      "improvement",

    improves:
      "improvement",

    improved:
      "improvement",

    improving:
      "improvement",

    optimize:
      "improvement",

    optimisation:
      "improvement",

    optimization:
      "improvement",

    enhance:
      "improvement",

    strengthen:
      "improvement",

    /* =====================================================
       JOBS
    ===================================================== */

    jobs:
      "job",

    vacancy:
      "job",

    vacancies:
      "job",

    position:
      "job",

    positions:
      "job",

    role:
      "job",

    roles:
      "job",

    opportunities:
      "job",

    opportunity:
      "job",

    /* =====================================================
       MATCH
    ===================================================== */

    matches:
      "match",

    matching:
      "match",

    matched:
      "match",

    suitable:
      "match",

    compatible:
      "match",

    compatibility:
      "match",

    /* =====================================================
       INTERVIEW
    ===================================================== */

    interviews:
      "interview",

    interviewed:
      "interview",

    interviewing:
      "interview",

    /* =====================================================
       FEEDBACK
    ===================================================== */

    feedbacks:
      "feedback",

    result:
      "feedback",

    results:
      "feedback",

    performance:
      "feedback",

    score:
      "feedback",

    scores:
      "feedback",

    /* =====================================================
       PREPARATION
    ===================================================== */

    prepare:
      "preparation",

    preparing:
      "preparation",

    prep:
      "preparation",

    practice:
      "preparation",

    practicing:
      "preparation",

    practise:
      "preparation",

    /* =====================================================
       SKILLS
    ===================================================== */

    skills:
      "skill",

    abilities:
      "skill",

    ability:
      "skill",

    technologies:
      "skill",

    technology:
      "skill",

    /* =====================================================
       ROADMAP / NEXT STEPS
    ===================================================== */

    roadmap:
      "plan",

    roadmaps:
      "plan",

    steps:
      "plan",

    next:
      "plan",

    pathway:
      "plan",

    path:
      "plan",

    /* =====================================================
       CAREER
    ===================================================== */

    careers:
      "career",

    profession:
      "career",

    professions:
      "career",
  };

/* =========================================================
   NORMALIZE TEXT
========================================================= */

export const normalizeCareerQuestion = (
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
      /[-_/]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

/* =========================================================
   NORMALIZE TOKEN
========================================================= */

const normalizeCareerToken = (
  token: string
): string => {
  const normalized =
    token
      .toLowerCase()
      .trim();

  if (!normalized) {
    return "";
  }

  return (
    TOKEN_ALIASES[
      normalized
    ] ??
    normalized
  );
};

/* =========================================================
   TOKENIZE
========================================================= */

export const tokenizeCareerQuestion = (
  value: string
): string[] => {
  const normalized =
    normalizeCareerQuestion(
      value
    );

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(
      (
        token
      ) =>
        normalizeCareerToken(
          token
        )
    )
    .filter(
      Boolean
    )
    .filter(
      (
        token
      ) =>
        !STOP_WORDS.has(
          token
        )
    )
    .filter(
      (
        token
      ) =>
        token.length >
        1
    );
};

/* =========================================================
   UNIQUE TOKENS
========================================================= */

const uniqueTokens = (
  tokens: string[]
): string[] => {
  return Array.from(
    new Set(
      tokens
    )
  );
};

/* =========================================================
   JACCARD SIMILARITY
========================================================= */

const calculateJaccardSimilarity = (
  tokensA: string[],
  tokensB: string[]
): number => {
  const setA =
    new Set(
      tokensA
    );

  const setB =
    new Set(
      tokensB
    );

  if (
    setA.size ===
      0 &&
    setB.size ===
      0
  ) {
    return 1;
  }

  if (
    setA.size ===
      0 ||
    setB.size ===
      0
  ) {
    return 0;
  }

  const intersection =
    new Set(
      [
        ...setA,
      ].filter(
        (
          token
        ) =>
          setB.has(
            token
          )
      )
    );

  const union =
    new Set([
      ...setA,
      ...setB,
    ]);

  return (
    intersection.size /
    union.size
  );
};

/* =========================================================
   DICE SIMILARITY
========================================================= */

const calculateDiceSimilarity = (
  tokensA: string[],
  tokensB: string[]
): number => {
  const setA =
    new Set(
      tokensA
    );

  const setB =
    new Set(
      tokensB
    );

  if (
    setA.size ===
      0 &&
    setB.size ===
      0
  ) {
    return 1;
  }

  if (
    setA.size ===
      0 ||
    setB.size ===
      0
  ) {
    return 0;
  }

  let intersection =
    0;

  for (
    const token
    of setA
  ) {
    if (
      setB.has(
        token
      )
    ) {
      intersection +=
        1;
    }
  }

  return (
    2 *
    intersection
  ) /
    (
      setA.size +
      setB.size
    );
};

/* =========================================================
   TOKEN CONTAINMENT SCORE
========================================================= */

const calculateTokenContainmentScore = (
  tokensA: string[],
  tokensB: string[]
): number => {
  if (
    tokensA.length ===
      0 ||
    tokensB.length ===
      0
  ) {
    return 0;
  }

  const setA =
    new Set(
      tokensA
    );

  const setB =
    new Set(
      tokensB
    );

  let intersection =
    0;

  for (
    const token
    of setA
  ) {
    if (
      setB.has(
        token
      )
    ) {
      intersection +=
        1;
    }
  }

  const smallerSize =
    Math.min(
      setA.size,
      setB.size
    );

  if (
    smallerSize ===
    0
  ) {
    return 0;
  }

  return (
    intersection /
    smallerSize
  );
};

/* =========================================================
   PREFIX BONUS
========================================================= */

const calculatePrefixBonus = (
  normalizedA: string,
  normalizedB: string
): number => {
  if (
    !normalizedA ||
    !normalizedB
  ) {
    return 0;
  }

  if (
    normalizedA.startsWith(
      normalizedB
    ) ||
    normalizedB.startsWith(
      normalizedA
    )
  ) {
    return 0.05;
  }

  return 0;
};

/* =========================================================
   SEMANTIC CORE BONUS
========================================================= */

const calculateSemanticCoreBonus = (
  tokensA: string[],
  tokensB: string[]
): number => {
  const setA =
    new Set(
      tokensA
    );

  const setB =
    new Set(
      tokensB
    );

  const importantPairs =
    [
      [
        "resume",
        "analysis",
      ],

      [
        "resume",
        "improvement",
      ],

      [
        "job",
        "match",
      ],

      [
        "job",
        "search",
      ],

      [
        "interview",
        "feedback",
      ],

      [
        "interview",
        "preparation",
      ],

      [
        "career",
        "progress",
      ],

      [
        "career",
        "goal",
      ],

      [
        "skill",
        "gap",
      ],
    ];

  for (
    const pair
    of importantPairs
  ) {
    const [
      first,
      second,
    ] =
      pair;

    if (
      setA.has(
        first
      ) &&
      setA.has(
        second
      ) &&
      setB.has(
        first
      ) &&
      setB.has(
        second
      )
    ) {
      return 0.12;
    }
  }

  return 0;
};

/* =========================================================
   FINAL SIMILARITY
========================================================= */

export const calculateCareerQuestionSimilarity =
  (
    questionA: string,
    questionB: string
  ): ICareerSimilarityResult => {
    const normalizedA =
      normalizeCareerQuestion(
        questionA
      );

    const normalizedB =
      normalizeCareerQuestion(
        questionB
      );

    /*
      Exact raw-normalized phrase match.
    */

    if (
      normalizedA ===
      normalizedB
    ) {
      return {
        similarity:
          1,

        normalizedA,

        normalizedB,

        exactMatch:
          true,
      };
    }

    const tokensA =
      uniqueTokens(
        tokenizeCareerQuestion(
          normalizedA
        )
      );

    const tokensB =
      uniqueTokens(
        tokenizeCareerQuestion(
          normalizedB
        )
      );

    /*
      After semantic token normalization these may
      effectively become the same question.

      Example:

      Analyze my CV
      → analysis resume

      Can you analyze my resume?
      → analysis resume
    */

    const canonicalA =
      [
        ...tokensA,
      ]
        .sort()
        .join(" ");

    const canonicalB =
      [
        ...tokensB,
      ]
        .sort()
        .join(" ");

    if (
      canonicalA &&
      canonicalA ===
        canonicalB
    ) {
      return {
        similarity:
          0.98,

        normalizedA,

        normalizedB,

        exactMatch:
          false,
      };
    }

    const jaccard =
      calculateJaccardSimilarity(
        tokensA,
        tokensB
      );

    const dice =
      calculateDiceSimilarity(
        tokensA,
        tokensB
      );

    const containment =
      calculateTokenContainmentScore(
        tokensA,
        tokensB
      );

    const prefixBonus =
      calculatePrefixBonus(
        normalizedA,
        normalizedB
      );

    const semanticCoreBonus =
      calculateSemanticCoreBonus(
        tokensA,
        tokensB
      );

    let similarity =
      (
        jaccard *
        0.30
      ) +
      (
        dice *
        0.35
      ) +
      (
        containment *
        0.35
      ) +
      prefixBonus +
      semanticCoreBonus;

    similarity =
      Math.min(
        1,
        similarity
      );

    similarity =
      Number(
        similarity.toFixed(
          4
        )
      );

    return {
      similarity,

      normalizedA,

      normalizedB,

      exactMatch:
        false,
    };
  };

/* =========================================================
   CACHE MATCH CHECK
========================================================= */

export const isCareerQuestionSimilar =
  (
    questionA: string,
    questionB: string,
    threshold =
      0.82
  ): boolean => {
    const result =
      calculateCareerQuestionSimilarity(
        questionA,
        questionB
      );

    return (
      result.similarity >=
      threshold
    );
  };

/* =========================================================
   FIND BEST MATCH
========================================================= */

export const findBestCareerQuestionMatch =
  <
    T extends {
      originalQuestion: string;
    }
  >(
    question: string,
    candidates: T[],
    threshold =
      0.82
  ):
    | {
        candidate: T;

        similarity: number;
      }
    | undefined => {
    let bestCandidate:
      T | undefined;

    let bestSimilarity =
      0;

    for (
      const candidate
      of candidates
    ) {
      const result =
        calculateCareerQuestionSimilarity(
          question,
          candidate.originalQuestion
        );

      if (
        result.similarity >
        bestSimilarity
      ) {
        bestSimilarity =
          result.similarity;

        bestCandidate =
          candidate;
      }
    }

    if (
      !bestCandidate ||
      bestSimilarity <
        threshold
    ) {
      return undefined;
    }

    return {
      candidate:
        bestCandidate,

      similarity:
        bestSimilarity,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  normalizeCareerQuestion,
  tokenizeCareerQuestion,
  calculateCareerQuestionSimilarity,
  isCareerQuestionSimilar,
  findBestCareerQuestionMatch,
};