import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

/* =========================================================
   SCORE TYPES
========================================================= */

export interface ICVQualityScores {
  overallScore: number;
  atsScore: number;
  contentScore: number;
  structureScore: number;
  skillsScore: number;
  experienceScore: number;
}

export type CVQualityDimension =
  | "overall"
  | "ats"
  | "content"
  | "structure"
  | "skills"
  | "experience";

export interface ICVQualityDimensionResult {
  dimension: CVQualityDimension;

  baselineScore: number;

  candidateScore: number;

  delta: number;

  status:
    | "improved"
    | "preserved"
    | "regressed";

  significantRegression: boolean;
}

export interface ICVQualityGateResult {
  accepted: boolean;

  baselineScore: number;

  generatedScore: number;

  improvement: number;

  reasons: string[];

  warnings: string[];

  regressions: string[];

  improvements: string[];

  dimensions: ICVQualityDimensionResult[];

  retryFeedback: string[];
}

/* =========================================================
   QUALITY RULES
========================================================= */

/*
 * A generated CV must have a strictly higher overall score.
 *
 * Example:
 *
 * baseline = 80
 * candidate = 80
 *
 * This is NOT considered an improvement.
 */
const MIN_OVERALL_IMPROVEMENT = 1;

/*
 * Small score movements can happen because resume analysis
 * is AI-based.
 *
 * A drop of 1-2 points is therefore treated as effectively
 * preserved rather than a meaningful regression.
 */
const SCORE_VARIANCE_TOLERANCE = 2;

/*
 * Strong sections should be protected more aggressively.
 *
 * If the original section scored >= 80, we do not want the
 * improved CV to sacrifice it in exchange for improvements
 * elsewhere.
 */
const STRONG_SECTION_SCORE = 80;

const MAX_STRONG_SECTION_REGRESSION = 3;

/*
 * Even a section that was not originally strong should not
 * regress substantially.
 */
const MAX_GENERAL_SECTION_REGRESSION = 5;

/*
 * Very large regression is always considered unacceptable.
 */
const CRITICAL_REGRESSION = 8;

/* =========================================================
   HELPERS
========================================================= */

const clampScore = (
  value: number
): number => {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value
      )
    )
  );
};

const normalizeScores = (
  scores: ICVQualityScores
): ICVQualityScores => {
  return {
    overallScore:
      clampScore(
        scores.overallScore
      ),

    atsScore:
      clampScore(
        scores.atsScore
      ),

    contentScore:
      clampScore(
        scores.contentScore
      ),

    structureScore:
      clampScore(
        scores.structureScore
      ),

    skillsScore:
      clampScore(
        scores.skillsScore
      ),

    experienceScore:
      clampScore(
        scores.experienceScore
      ),
  };
};

const getDimensionLabel = (
  dimension: CVQualityDimension
): string => {
  const labels:
    Record<
      CVQualityDimension,
      string
    > = {
      overall:
        "Overall",

      ats:
        "ATS",

      content:
        "Content",

      structure:
        "Structure",

      skills:
        "Skills",

      experience:
        "Experience",
    };

  return labels[
    dimension
  ];
};

const buildDimensionResult = ({
  dimension,
  baselineScore,
  candidateScore,
}: {
  dimension:
    CVQualityDimension;

  baselineScore:
    number;

  candidateScore:
    number;
}): ICVQualityDimensionResult => {
  const baseline =
    clampScore(
      baselineScore
    );

  const candidate =
    clampScore(
      candidateScore
    );

  const delta =
    candidate -
    baseline;

  let status:
    ICVQualityDimensionResult["status"];

  if (
    delta >
    SCORE_VARIANCE_TOLERANCE
  ) {
    status =
      "improved";
  } else if (
    delta <
    -SCORE_VARIANCE_TOLERANCE
  ) {
    status =
      "regressed";
  } else {
    status =
      "preserved";
  }

  const regression =
    baseline -
    candidate;

  const significantRegression =
    dimension !==
      "overall" &&
    (
      regression >=
        CRITICAL_REGRESSION ||
      (
        baseline >=
          STRONG_SECTION_SCORE &&
        regression >
          MAX_STRONG_SECTION_REGRESSION
      ) ||
      (
        baseline <
          STRONG_SECTION_SCORE &&
        regression >
          MAX_GENERAL_SECTION_REGRESSION
      )
    );

  return {
    dimension,

    baselineScore:
      baseline,

    candidateScore:
      candidate,

    delta,

    status,

    significantRegression,
  };
};

const getBaselineScores = (
  resume:
    IResumeAnalysis
): ICVQualityScores => {
  return normalizeScores({
    overallScore:
      resume.overallScore,

    atsScore:
      resume.atsScore,

    contentScore:
      resume.contentScore,

    structureScore:
      resume.structureScore,

    skillsScore:
      resume.skillsScore,

    experienceScore:
      resume.experienceScore,
  });
};

/* =========================================================
   QUALITY DIMENSIONS
========================================================= */

const buildDimensionResults = (
  baseline:
    ICVQualityScores,
  candidate:
    ICVQualityScores
): ICVQualityDimensionResult[] => {
  return [
    buildDimensionResult({
      dimension:
        "overall",

      baselineScore:
        baseline.overallScore,

      candidateScore:
        candidate.overallScore,
    }),

    buildDimensionResult({
      dimension:
        "ats",

      baselineScore:
        baseline.atsScore,

      candidateScore:
        candidate.atsScore,
    }),

    buildDimensionResult({
      dimension:
        "content",

      baselineScore:
        baseline.contentScore,

      candidateScore:
        candidate.contentScore,
    }),

    buildDimensionResult({
      dimension:
        "structure",

      baselineScore:
        baseline.structureScore,

      candidateScore:
        candidate.structureScore,
    }),

    buildDimensionResult({
      dimension:
        "skills",

      baselineScore:
        baseline.skillsScore,

      candidateScore:
        candidate.skillsScore,
    }),

    buildDimensionResult({
      dimension:
        "experience",

      baselineScore:
        baseline.experienceScore,

      candidateScore:
        candidate.experienceScore,
    }),
  ];
};

/* =========================================================
   MESSAGE BUILDERS
========================================================= */

const buildImprovementMessages = (
  dimensions:
    ICVQualityDimensionResult[]
): string[] => {
  return dimensions
    .filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        dimension.delta >
          SCORE_VARIANCE_TOLERANCE
    )
    .map(
      (dimension) =>
        `${getDimensionLabel(
          dimension.dimension
        )} improved from ${dimension.baselineScore} to ${dimension.candidateScore} (+${dimension.delta}).`
    );
};

const buildRegressionMessages = (
  dimensions:
    ICVQualityDimensionResult[]
): string[] => {
  return dimensions
    .filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        dimension.delta <
          -SCORE_VARIANCE_TOLERANCE
    )
    .map(
      (dimension) =>
        `${getDimensionLabel(
          dimension.dimension
        )} regressed from ${dimension.baselineScore} to ${dimension.candidateScore} (${dimension.delta}).`
    );
};

const buildRetryFeedback = (
  dimensions:
    ICVQualityDimensionResult[]
): string[] => {
  const feedback:
    string[] = [];

  const significantRegressions =
    dimensions.filter(
      (dimension) =>
        dimension
          .significantRegression
    );

  for (
    const dimension
    of significantRegressions
  ) {
    const label =
      getDimensionLabel(
        dimension.dimension
      );

    feedback.push(
      `Restore and preserve the original CV's stronger ${label.toLowerCase()} quality. It dropped from ${dimension.baselineScore} to ${dimension.candidateScore}.`
    );
  }

  const weakCandidateDimensions =
    dimensions
      .filter(
        (dimension) =>
          dimension.dimension !==
            "overall" &&
          dimension.candidateScore <
            80 &&
          !dimension
            .significantRegression
      )
      .sort(
        (
          a,
          b
        ) =>
          a.candidateScore -
          b.candidateScore
      );

  for (
    const dimension
    of weakCandidateDimensions
  ) {
    const label =
      getDimensionLabel(
        dimension.dimension
      );

    feedback.push(
      `Improve ${label.toLowerCase()} quality from the current candidate score of ${dimension.candidateScore} while preserving factual information.`
    );
  }

  const strongCandidateDimensions =
    dimensions.filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        dimension.candidateScore >=
          80 &&
        !dimension
          .significantRegression
    );

  if (
    strongCandidateDimensions
      .length >
    0
  ) {
    feedback.push(
      `Preserve the successful improvements in ${strongCandidateDimensions
        .map(
          (dimension) =>
            getDimensionLabel(
              dimension.dimension
            )
        )
        .join(
          ", "
        )}.`
    );
  }

  feedback.push(
    "Do not invent skills, experience, projects, employers, responsibilities, education, certifications, dates, achievements, technologies, clients, outcomes, or metrics."
  );

  feedback.push(
    "Improve only through clearer wording, stronger organization, ATS readability, supported skills, and evidence already available from the candidate."
  );

  return Array.from(
    new Set(
      feedback
    )
  );
};

/* =========================================================
   QUALITY GATE
========================================================= */

export const evaluateCVQuality = ({
  baseline,
  candidate,
}: {
  baseline:
    IResumeAnalysis;

  candidate:
    ICVQualityScores;
}): ICVQualityGateResult => {
  const baselineScores =
    getBaselineScores(
      baseline
    );

  const candidateScores =
    normalizeScores(
      candidate
    );

  const dimensions =
    buildDimensionResults(
      baselineScores,
      candidateScores
    );

  const reasons:
    string[] = [];

  const warnings:
    string[] = [];

  const baselineScore =
    baselineScores
      .overallScore;

  const generatedScore =
    candidateScores
      .overallScore;

  const improvement =
    generatedScore -
    baselineScore;

  /* =====================================================
     RULE 1
     Generated CV must improve overall score.
  ===================================================== */

  if (
    improvement <
    MIN_OVERALL_IMPROVEMENT
  ) {
    reasons.push(
      `Generated CV did not improve the overall score. Baseline: ${baselineScore}, generated: ${generatedScore}.`
    );
  }

  /* =====================================================
     RULE 2
     Strong original dimensions must not be damaged.
  ===================================================== */

  const significantRegressions =
    dimensions.filter(
      (dimension) =>
        dimension
          .significantRegression
    );

  for (
    const dimension
    of significantRegressions
  ) {
    reasons.push(
      `${getDimensionLabel(
        dimension.dimension
      )} quality regressed too much: ${dimension.baselineScore} → ${dimension.candidateScore} (${dimension.delta}).`
    );
  }

  /* =====================================================
     RULE 3
     Critical regression is never acceptable.
  ===================================================== */

  const criticalRegressions =
    dimensions.filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        (
          dimension
            .baselineScore -
          dimension
            .candidateScore
        ) >=
          CRITICAL_REGRESSION
    );

  for (
    const dimension
    of criticalRegressions
  ) {
    const message =
      `${getDimensionLabel(
        dimension.dimension
      )} suffered a critical regression of ${
        dimension.baselineScore -
        dimension.candidateScore
      } points.`;

    if (
      !reasons.includes(
        message
      )
    ) {
      reasons.push(
        message
      );
    }
  }

  /* =====================================================
     WARNINGS
     Small regressions do not automatically fail the CV,
     but we expose them for diagnostics.
  ===================================================== */

  const minorRegressions =
    dimensions.filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        dimension.delta <
          -SCORE_VARIANCE_TOLERANCE &&
        !dimension
          .significantRegression
    );

  for (
    const dimension
    of minorRegressions
  ) {
    warnings.push(
      `${getDimensionLabel(
        dimension.dimension
      )} decreased slightly from ${dimension.baselineScore} to ${dimension.candidateScore}.`
    );
  }

  /*
   * Score changes inside the AI variance tolerance are
   * considered preserved.
   */

  const preservedWithinTolerance =
    dimensions.filter(
      (dimension) =>
        dimension.dimension !==
          "overall" &&
        dimension.delta < 0 &&
        dimension.delta >=
          -SCORE_VARIANCE_TOLERANCE
    );

  for (
    const dimension
    of preservedWithinTolerance
  ) {
    warnings.push(
      `${getDimensionLabel(
        dimension.dimension
      )} changed from ${dimension.baselineScore} to ${dimension.candidateScore}, which is within the accepted analysis variance tolerance.`
    );
  }

  const accepted =
    reasons.length ===
    0;

  if (
    accepted
  ) {
    reasons.push(
      `Generated CV safely improved the overall score from ${baselineScore} to ${generatedScore} (+${improvement}) without unacceptable section regressions.`
    );
  }

  const improvements =
    buildImprovementMessages(
      dimensions
    );

  const regressions =
    buildRegressionMessages(
      dimensions
    );

  const retryFeedback =
    accepted
      ? []
      : buildRetryFeedback(
          dimensions
        );

  return {
    accepted,

    baselineScore,

    generatedScore,

    improvement,

    reasons,

    warnings,

    regressions,

    improvements,

    dimensions,

    retryFeedback,
  };
};

/* =========================================================
   SCORE EXTRACTION
========================================================= */

/*
 * analyzeResume() returns a richer analysis object.
 *
 * Quality Gate intentionally needs only these six scores,
 * so this helper prevents the orchestration layer from
 * passing unnecessary analysis data into the comparison
 * engine.
 */
export const extractCVQualityScores = (
  analysis: {
    overallScore:
      number;

    atsScore:
      number;

    contentScore:
      number;

    structureScore:
      number;

    skillsScore:
      number;

    experienceScore:
      number;
  }
): ICVQualityScores => {
  return normalizeScores({
    overallScore:
      analysis.overallScore,

    atsScore:
      analysis.atsScore,

    contentScore:
      analysis.contentScore,

    structureScore:
      analysis.structureScore,

    skillsScore:
      analysis.skillsScore,

    experienceScore:
      analysis.experienceScore,
  });
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  evaluateCVQuality,
  extractCVQualityScores,
};