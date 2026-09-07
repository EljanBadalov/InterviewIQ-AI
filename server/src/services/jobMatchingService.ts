import {
  type IJob,
} from "../models/Job";

import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

export type JobMatchLevel =
  | "strong"
  | "good"
  | "partial"
  | "low";

export interface IJobMatchBreakdown {
  skills: number;
  keywords: number;
  experience: number;
  education: number;
}

export interface IJobMatchResult {
  matchScore: number;

  matchLevel: JobMatchLevel;

  matchLabel: string;

  matchedSkills: string[];

  missingSkills: string[];

  matchedKeywords: string[];

  missingKeywords: string[];

  strengths: string[];

  improvementAreas: string[];

  breakdown: IJobMatchBreakdown;
}

const normalizeText = (
  value: string
): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /[^\w+#.\-/ ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
};

const escapeRegExp = (
  value: string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const normalizeSkill = (
  value: string
): string => {
  const normalized =
    normalizeText(value);

  const aliases: Record<
    string,
    string
  > = {
    js: "javascript",
    javascript:
      "javascript",

    ts: "typescript",
    typescript:
      "typescript",

    reactjs: "react",
    "react.js": "react",
    react: "react",

    nodejs: "node.js",
    "node.js": "node.js",
    node: "node.js",

    expressjs:
      "express",
    "express.js":
      "express",
    express: "express",

    mongodb: "mongodb",
    mongo: "mongodb",

    postgres:
      "postgresql",
    postgresql:
      "postgresql",

    aws: "aws",

    "amazon web services":
      "aws",

    gcp: "gcp",

    "google cloud":
      "gcp",

    "google cloud platform":
      "gcp",

    k8s: "kubernetes",
    kubernetes:
      "kubernetes",

    docker: "docker",

    git: "git",

    html5: "html",
    html: "html",

    css3: "css",
    css: "css",

    rest: "rest api",
    restful:
      "rest api",

    "rest api":
      "rest api",

    "restful api":
      "rest api",

    api: "rest api",

    ml:
      "machine learning",

    "machine learning":
      "machine learning",

    ai:
      "artificial intelligence",

    "artificial intelligence":
      "artificial intelligence",

    ui:
      "ui design",

    "ui design":
      "ui design",

    ux:
      "ux design",

    "ux design":
      "ux design",

    figma: "figma",

    cicd: "ci/cd",

    "ci cd":
      "ci/cd",

    "ci/cd":
      "ci/cd",

    nextjs:
      "next.js",

    "next.js":
      "next.js",

    reduxjs:
      "redux",

    redux:
      "redux",

    graphql:
      "graphql",

    jest:
      "jest",

    python:
      "python",

    numpy:
      "numpy",

    pandas:
      "pandas",

    pytorch:
      "pytorch",

    tensorflow:
      "tensorflow",

    sklearn:
      "scikit-learn",

    "scikit learn":
      "scikit-learn",

    "scikit-learn":
      "scikit-learn",

    mlops:
      "mlops",

    nlp:
      "nlp",

    terraform:
      "terraform",

    linux:
      "linux",

    bash:
      "bash",

    redis:
      "redis",

    "data structures":
      "data structures",

    algorithms:
      "algorithms",

    "system design":
      "system design",

    "distributed systems":
      "distributed systems",

    "deep learning":
      "deep learning",

    transformers:
      "transformers",

    wireframing:
      "wireframing",

    prototyping:
      "prototyping",

    "user research":
      "user research",

    "product design":
      "product design",

    "design systems":
      "design systems",
  };

  return (
    aliases[normalized] ||
    normalized
  );
};

const uniqueStrings = (
  values: string[]
): string[] => {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value.trim()
        )
        .filter(Boolean)
    ),
  ];
};

const containsExactPhrase = (
  text: string,
  phrase: string
): boolean => {
  const normalizedText =
    normalizeText(text);

  const normalizedPhrase =
    normalizeText(phrase);

  if (
    !normalizedText ||
    !normalizedPhrase
  ) {
    return false;
  }

  const escaped =
    escapeRegExp(
      normalizedPhrase
    );

  const regex =
    new RegExp(
      `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
      "i"
    );

  return regex.test(
    normalizedText
  );
};

const getResumeSkills = (
  resume:
    IResumeAnalysis
): string[] => {
  return uniqueStrings(
    resume.skillsDetected.map(
      normalizeSkill
    )
  );
};

const buildPositiveResumeText = (
  resume:
    IResumeAnalysis
): string => {
  return normalizeText(
    [
      resume.summary,

      ...resume.skillsDetected,

      ...resume.strengths,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const buildNegativeResumeText = (
  resume:
    IResumeAnalysis
): string => {
  return normalizeText(
    [
      ...resume.missingSkills,

      ...resume.weaknesses,

      ...resume.atsSuggestions,

      ...resume.formattingFeedback,

      ...resume.recommendations,
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const calculateSkillMatch = (
  resume:
    IResumeAnalysis,
  job:
    IJob
): {
  score: number;
  matched: string[];
  missing: string[];
} => {
  const resumeSkills =
    new Set(
      getResumeSkills(
        resume
      )
    );

  const matched:
    string[] = [];

  const missing:
    string[] = [];

  for (
    const jobSkill
    of (job.skills ?? [])
  ) {
    const normalized =
      normalizeSkill(
        jobSkill
      );

    if (
      resumeSkills.has(
        normalized
      )
    ) {
      matched.push(
        jobSkill
      );
    } else {
      missing.push(
        jobSkill
      );
    }
  }

  if (
    (job.skills ?? []).length ===
    0
  ) {
    return {
      score: 100,
      matched: [],
      missing: [],
    };
  }

  return {
    score:
      Math.round(
        (
          matched.length /
          (job.skills ?? []).length
        ) * 100
      ),

    matched:
      uniqueStrings(
        matched
      ),

    missing:
      uniqueStrings(
        missing
      ),
  };
};

const calculateKeywordMatch = (
  resume:
    IResumeAnalysis,
  job:
    IJob
): {
  score: number;
  matched: string[];
  missing: string[];
} => {
  const positiveText =
    buildPositiveResumeText(
      resume
    );

  const negativeText =
    buildNegativeResumeText(
      resume
    );

  const resumeSkills =
    new Set(
      getResumeSkills(
        resume
      )
    );

  const matched:
    string[] = [];

  const missing:
    string[] = [];

  for (
    const keyword
    of (job.keywords ?? [])
  ) {
    const normalizedKeyword =
      normalizeText(
        keyword
      );

    const normalizedSkill =
      normalizeSkill(
        keyword
      );

    const existsAsSkill =
      resumeSkills.has(
        normalizedSkill
      );

    const existsPositive =
      containsExactPhrase(
        positiveText,
        normalizedKeyword
      );

    const existsNegative =
      containsExactPhrase(
        negativeText,
        normalizedKeyword
      );

    const positiveEvidence =
      existsAsSkill ||
      existsPositive;

    const negativeOnly =
      existsNegative &&
      !existsAsSkill &&
      !existsPositive;

    if (
      positiveEvidence &&
      !negativeOnly
    ) {
      matched.push(
        keyword
      );
    } else {
      missing.push(
        keyword
      );
    }
  }

  if (
    (job.keywords ?? []).length ===
    0
  ) {
    return {
      score: 100,
      matched: [],
      missing: [],
    };
  }

  return {
    score:
      Math.round(
        (
          matched.length /
          (job.keywords ?? []).length
        ) * 100
      ),

    matched:
      uniqueStrings(
        matched
      ),

    missing:
      uniqueStrings(
        missing
      ),
  };
};

const estimateResumeExperienceYears = (
  experienceScore: number
): number => {
  const score =
    Math.max(
      0,
      Math.min(
        100,
        experienceScore
      )
    );

  if (
    score >= 90
  ) {
    return 7;
  }

  if (
    score >= 80
  ) {
    return 5;
  }

  if (
    score >= 65
  ) {
    return 3;
  }

  if (
    score >= 45
  ) {
    return 2;
  }

  if (
    score >= 30
  ) {
    return 1;
  }

  return 0;
};

const calculateExperienceMatch = (
  resume:
    IResumeAnalysis,
  job:
    IJob
): number => {
  const estimatedYears =
    estimateResumeExperienceYears(
      resume.experienceScore
    );

  const min =
    job.experienceMin;

  const max =
    job.experienceMax;

  if (
    estimatedYears >= min &&
    (
      max === null ||
      estimatedYears <= max
    )
  ) {
    return 100;
  }

  if (
    estimatedYears >
    (max ?? min)
  ) {
    return 90;
  }

  if (
    min === 0
  ) {
    return 100;
  }

  const difference =
    min -
    estimatedYears;

  if (
    difference <= 1
  ) {
    return 75;
  }

  if (
    difference <= 2
  ) {
    return 50;
  }

  if (
    difference <= 3
  ) {
    return 30;
  }

  return 10;
};

const calculateEducationMatch = (
  resume:
    IResumeAnalysis,
  job:
    IJob
): number => {
  if (
    !(job.education ?? []) ||
    (job.education ?? []).length ===
      0
  ) {
    return 100;
  }

  const positiveText =
    buildPositiveResumeText(
      resume
    );

  const exactMatch =
    (job.education ?? []).some(
      (education) =>
        containsExactPhrase(
          positiveText,
          education
        )
    );

  if (
    exactMatch
  ) {
    return 100;
  }

  const generalTerms = [
    "bachelor",
    "bachelor's",
    "master",
    "master's",
    "degree",
    "university",
    "college",
    "computer science",
    "information technology",
    "software engineering",
    "data science",
    "mathematics",
    "statistics",
    "design",
  ];

  const generalMatch =
    generalTerms.some(
      (term) =>
        containsExactPhrase(
          positiveText,
          term
        )
    );

  return generalMatch
    ? 70
    : 40;
};

const getMatchLevel = (
  score: number
): JobMatchLevel => {
  if (
    score >= 80
  ) {
    return "strong";
  }

  if (
    score >= 60
  ) {
    return "good";
  }

  if (
    score >= 40
  ) {
    return "partial";
  }

  return "low";
};

const getMatchLabel = (
  level:
    JobMatchLevel
): string => {
  switch (
    level
  ) {
    case "strong":
      return "Strong match for your CV";

    case "good":
      return "Good match for your CV";

    case "partial":
      return "Your CV partially matches this job";

    case "low":
      return "Low match for your CV";
  }
};

const buildStrengths = (
  skillScore: number,
  keywordScore: number,
  experienceScore: number,
  educationScore: number,
  matchedSkills: string[]
): string[] => {
  const result:
    string[] = [];

  if (
    skillScore >= 80
  ) {
    result.push(
      "Your technical skills strongly align with this position."
    );
  } else if (
    skillScore >= 60
  ) {
    result.push(
      "Your CV contains several of the key skills required for this position."
    );
  }

  if (
    matchedSkills.length >=
    3
  ) {
    result.push(
      `You already match ${matchedSkills.length} important skills required by this job.`
    );
  }

  if (
    experienceScore >=
    80
  ) {
    result.push(
      "Your current experience profile aligns well with this position."
    );
  }

  if (
    keywordScore >= 70
  ) {
    result.push(
      "Your CV contains strong keyword alignment with the job description."
    );
  }

  if (
    educationScore >=
    80
  ) {
    result.push(
      "Your educational background appears relevant to this position."
    );
  }

  if (
    result.length === 0
  ) {
    result.push(
      "Your profile contains some transferable qualifications for this position."
    );
  }

  return result;
};

const buildImprovementAreas = (
  missingSkills:
    string[],
  missingKeywords:
    string[],
  experienceScore:
    number,
  educationScore:
    number
): string[] => {
  const result:
    string[] = [];

  if (
    missingSkills.length >
    0
  ) {
    result.push(
      `These required skills were not detected in your CV: ${missingSkills.join(
        ", "
      )}.`
    );
  }

  if (
    missingKeywords.length >
    0
  ) {
    result.push(
      `Your CV has limited keyword alignment with: ${missingKeywords
        .slice(0, 5)
        .join(", ")}.`
    );
  }

  if (
    experienceScore <
    60
  ) {
    result.push(
      "Your current experience profile may be below the expected experience range for this position."
    );
  }

  if (
    educationScore <
    70
  ) {
    result.push(
      "The educational background detected in your CV does not strongly align with this job's preferred education."
    );
  }

  if (
    result.length === 0
  ) {
    result.push(
      "Your CV already aligns well with the major requirements of this position."
    );
  }

  return result;
};

export const calculateJobMatch = (
  resume:
    IResumeAnalysis,
  job:
    IJob
): IJobMatchResult => {
  const skillResult =
    calculateSkillMatch(
      resume,
      job
    );

  const keywordResult =
    calculateKeywordMatch(
      resume,
      job
    );

  const experienceScore =
    calculateExperienceMatch(
      resume,
      job
    );

  const educationScore =
    calculateEducationMatch(
      resume,
      job
    );

  const weights = {
    skills: 0.55,
    keywords: 0.15,
    experience: 0.2,
    education: 0.1,
  };

  const rawScore =
    skillResult.score *
      weights.skills +
    keywordResult.score *
      weights.keywords +
    experienceScore *
      weights.experience +
    educationScore *
      weights.education;

  const matchScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          rawScore
        )
      )
    );

  const matchLevel =
    getMatchLevel(
      matchScore
    );

  return {
    matchScore,

    matchLevel,

    matchLabel:
      getMatchLabel(
        matchLevel
      ),

    matchedSkills:
      skillResult.matched,

    missingSkills:
      skillResult.missing,

    matchedKeywords:
      keywordResult.matched,

    missingKeywords:
      keywordResult.missing,

    strengths:
      buildStrengths(
        skillResult.score,
        keywordResult.score,
        experienceScore,
        educationScore,
        skillResult.matched
      ),

    improvementAreas:
      buildImprovementAreas(
        skillResult.missing,
        keywordResult.missing,
        experienceScore,
        educationScore
      ),

    breakdown: {
      skills:
        skillResult.score,

      keywords:
        keywordResult.score,

      experience:
        experienceScore,

      education:
        educationScore,
    },
  };
};

export const rankJobsForResume = (
  resume:
    IResumeAnalysis,
  jobs:
    IJob[]
): Array<{
  job: IJob;
  match: IJobMatchResult;
}> => {
  return jobs
    .map(
      (job) => ({
        job,

        match:
          calculateJobMatch(
            resume,
            job
          ),
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        b.match
          .matchScore -
        a.match
          .matchScore
    );
};