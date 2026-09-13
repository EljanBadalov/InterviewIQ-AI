import {
  type IJob,
  type JobExperienceLevel,
} from "../models/Job";

import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  type ICareerSkillProfile,
  type ICareerSkillProfileItem,
} from "./careerSkillProfileService";

/* =========================================================
   TYPES
========================================================= */

export type JobMatchLevel =
  | "strong"
  | "good"
  | "partial"
  | "low";

export interface IJobMatchBreakdown {
  skills: number;

  roleRelevance: number;

  experience: number;

  evidenceConfidence: number;

  /*
   * Kept for backwards compatibility with existing frontend
   * components. They are no longer part of the weighted score.
   */
  keywords: number;

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

export interface IJobMatchOptions {
  targetRole?: string;

  preferredExperienceLevels?:
    JobExperienceLevel[];
}

/* =========================================================
   CONSTANTS
========================================================= */

const SCORE_WEIGHTS = {
  /*
   * Role alignment must dominate recommendation quality.
   * A user searching for "Frontend Developer" should not receive
   * a high score for an unrelated engineering title simply because
   * React/Python happen to appear in the description.
   */
  roleRelevance:
    0.45,

  skills:
    0.35,

  experience:
    0.12,

  evidenceConfidence:
    0.08,
} as const;

const ROLE_STOP_WORDS =
  new Set([
    "a",
    "an",
    "and",
    "the",
    "for",
    "of",
    "to",
    "with",
    "remote",
    "hybrid",
    "onsite",
    "entry",
    "junior",
    "jr",
    "mid",
    "senior",
    "sr",
    "lead",
  ]);

/* =========================================================
   NORMALIZATION
========================================================= */

const normalizeText = (
  value:
    string
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

const normalizeSkill = (
  value:
    string
): string => {
  const normalized =
    normalizeText(
      value
    );

  const aliases:
    Record<
      string,
      string
    > = {
    js:
      "javascript",

    javascript:
      "javascript",

    ts:
      "typescript",

    typescript:
      "typescript",

    reactjs:
      "react",

    "react.js":
      "react",

    react:
      "react",

    nodejs:
      "node.js",

    "node.js":
      "node.js",

    node:
      "node.js",

    expressjs:
      "express",

    "express.js":
      "express",

    express:
      "express",

    mongodb:
      "mongodb",

    mongo:
      "mongodb",

    postgres:
      "postgresql",

    postgresql:
      "postgresql",

    html5:
      "html",

    html:
      "html",

    css3:
      "css",

    css:
      "css",

    rest:
      "rest api",

    restful:
      "rest api",

    "restful api":
      "rest api",

    "rest api":
      "rest api",

    nextjs:
      "next.js",

    "next.js":
      "next.js",

    k8s:
      "kubernetes",

    kubernetes:
      "kubernetes",

    cicd:
      "ci/cd",

    "ci cd":
      "ci/cd",

    "ci/cd":
      "ci/cd",

    "google cloud":
      "gcp",

    "google cloud platform":
      "gcp",

    gcp:
      "gcp",

    aws:
      "aws",
  };

  return (
    aliases[
      normalized
    ] ||
    normalized
  );
};

const uniqueStrings = (
  values:
    string[]
): string[] => {
  return [
    ...new Set(
      values
        .map(
          (
            value
          ) =>
            value.trim()
        )
        .filter(
          Boolean
        )
    ),
  ];
};

const clampScore = (
  value:
    number
): number => {
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

/* =========================================================
   LEGACY RESUME -> LIGHT PROFILE
========================================================= */

/*
 * Existing controllers still call:
 *
 * calculateJobMatch(resume, job)
 * rankJobsForResume(resume, jobs)
 *
 * We keep those calls working, but convert the resume into a
 * lightweight SKILL profile. ATS/overall/content/structure/
 * experience scores are intentionally ignored.
 */
const isCareerSkillProfile = (
  value:
    ICareerSkillProfile |
    IResumeAnalysis
): value is ICareerSkillProfile => {
  return (
    "generatedAt" in
      value &&
    "strongestSkills" in
      value &&
    "verifiedSkills" in
      value
  );
};

const buildProfileFromResume = (
  resume:
    IResumeAnalysis
): ICareerSkillProfile => {
  const seen =
    new Set<
      string
    >();

  const skills:
    ICareerSkillProfileItem[] =
    [];

  for (
    const rawSkill of
    resume.skillsDetected ??
    []
  ) {
    const normalizedName =
      normalizeSkill(
        rawSkill
      );

    if (
      !normalizedName ||
      seen.has(
        normalizedName
      )
    ) {
      continue;
    }

    seen.add(
      normalizedName
    );

    skills.push({
      name:
        rawSkill,

      normalizedName,

      skillScore:
        68,

      confidence:
        0.62,

      confidenceLabel:
        "medium",

      level:
        "beginner",

      evidenceCount:
        1,

      sources: [
        "resume",
      ],

      interviewVerified:
        false,

      presentInResume:
        true,

      resumeAnalysisId:
        resume._id
          ?.toString(),

      latestEvidenceAt:
        resume.createdAt,
    });
  }

  return {
    userId:
      resume.user.toString(),

    resumeAnalysisId:
      resume._id
        ?.toString(),

    resumeFileName:
      resume.fileName,

    skills,

    strongestSkills:
      skills.slice(
        0,
        10
      ),

    verifiedSkills:
      [],

    resumeSkills:
      skills,

    totalSkills:
      skills.length,

    generatedAt:
      new Date(),
  };
};

const resolveProfile = (
  value:
    ICareerSkillProfile |
    IResumeAnalysis
): ICareerSkillProfile => {
  return isCareerSkillProfile(
    value
  )
    ? value
    : buildProfileFromResume(
        value
      );
};

/* =========================================================
   SKILL MATCH
========================================================= */

const calculateSkillMatch = (
  profile:
    ICareerSkillProfile,
  job:
    IJob
): {
  score: number;

  matched: string[];

  missing: string[];
} => {
  const jobSkills =
    uniqueStrings(
      job.skills ??
      []
    );

  if (
    jobSkills.length ===
    0
  ) {
    /*
     * No explicit skill requirements means neutral, not 100.
     * This prevents poorly-parsed job posts from receiving
     * an automatic perfect match.
     */
    return {
      score:
        60,

      matched:
        [],

      missing:
        [],
    };
  }

  const profileSkillMap =
    new Map<
      string,
      ICareerSkillProfileItem
    >(
      profile.skills.map(
        (
          skill
        ) => [
          normalizeSkill(
            skill.normalizedName ||
            skill.name
          ),
          skill,
        ]
      )
    );

  const matched:
    string[] = [];

  const missing:
    string[] = [];

  let weightedMatched =
    0;

  let totalWeight =
    0;

  for (
    const jobSkill of
    jobSkills
  ) {
    const normalized =
      normalizeSkill(
        jobSkill
      );

    const profileSkill =
      profileSkillMap.get(
        normalized
      );

    /*
     * Each required job skill has equal requirement weight.
     * If the user has the skill, the contribution depends on
     * skill strength and evidence confidence.
     */
    totalWeight +=
      1;

    if (
      profileSkill
    ) {
      matched.push(
        jobSkill
      );

      const strengthFactor =
        Math.max(
          0.55,
          profileSkill.skillScore /
            100
        );

      const confidenceFactor =
        Math.max(
          0.55,
          profileSkill.confidence
        );

      const verificationBonus =
        profileSkill.interviewVerified
          ? 0.08
          : 0;

      weightedMatched +=
        Math.min(
          1,
          strengthFactor *
            0.72 +
            confidenceFactor *
              0.28 +
            verificationBonus
        );
    } else {
      missing.push(
        jobSkill
      );
    }
  }

  return {
    score:
      totalWeight >
      0
        ? clampScore(
            (
              weightedMatched /
              totalWeight
            ) *
              100
          )
        : 60,

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

/* =========================================================
   ROLE RELEVANCE
========================================================= */

const tokenizeRole = (
  value:
    string
): string[] => {
  return normalizeText(
    value
  )
    .split(
      /[\s/|,-]+/
    )
    .map(
      (
        token
      ) =>
        token.trim()
    )
    .filter(
      (
        token
      ) =>
        token.length >=
          2 &&
        !ROLE_STOP_WORDS.has(
          token
        )
    );
};

const calculateRoleRelevance = (
  targetRole:
    string | undefined,
  job:
    IJob
): number => {
  if (
    !targetRole ||
    !targetRole.trim()
  ) {
    return 70;
  }

  const target =
    normalizeText(
      targetRole
    );

  const title =
    normalizeText(
      job.title
    );

  if (
    target ===
    title
  ) {
    return 100;
  }

  if (
    title.includes(
      target
    ) ||
    target.includes(
      title
    )
  ) {
    return 96;
  }

  const targetTokens =
    tokenizeRole(
      targetRole
    );

  const titleTokens =
    tokenizeRole(
      job.title
    );

  if (
    targetTokens.length ===
    0 ||
    titleTokens.length ===
    0
  ) {
    return 25;
  }

  const titleSet =
    new Set(
      titleTokens
    );

  const overlap =
    targetTokens.filter(
      (
        token
      ) =>
        titleSet.has(
          token
        )
    ).length;

  const overlapRatio =
    overlap /
    targetTokens.length;

  const targetText =
    targetTokens.join(
      " "
    );

  const titleText =
    titleTokens.join(
      " "
    );

  const isFrontendTarget =
    /\b(frontend|front-end|react|ui|web)\b/.test(
      targetText
    );

  const isBackendTarget =
    /\b(backend|back-end|node\.js|api|server)\b/.test(
      targetText
    );

  const isFullStackTarget =
    /\b(fullstack|full-stack)\b/.test(
      targetText
    );

  const isQaTarget =
    /\b(qa|quality|tester|testing|sdet)\b/.test(
      targetText
    );

  const isDataTarget =
    /\b(data|analytics|analyst|bi)\b/.test(
      targetText
    );

  const isSecurityTarget =
    /\b(cyber|security|soc)\b/.test(
      targetText
    );

  const isDevOpsTarget =
    /\b(devops|sre|reliability|cloud)\b/.test(
      targetText
    );

  const frontendTitle =
    /\b(frontend|front-end|react|ui)\b/.test(
      titleText
    ) ||
    (
      /\bweb\b/.test(
        titleText
      ) &&
      /\b(developer|engineer)\b/.test(
        titleText
      )
    );

  const backendTitle =
    /\b(backend|back-end|api|server|node\.js)\b/.test(
      titleText
    );

  const fullStackTitle =
    /\b(fullstack|full-stack)\b/.test(
      titleText
    );

  const qaTitle =
    /\b(qa|quality|tester|testing|sdet)\b/.test(
      titleText
    );

  const dataTitle =
    /\b(data analyst|analytics|analyst|bi)\b/.test(
      title
    );

  const securityTitle =
    /\b(cyber|security|soc)\b/.test(
      titleText
    );

  const devOpsTitle =
    /\b(devops|sre|site reliability|cloud engineer)\b/.test(
      title
    );

  const genericSoftwareTitle =
    /\bsoftware\b/.test(
      titleText
    ) &&
    /\b(developer|engineer)\b/.test(
      titleText
    );

  const unrelatedSpecializedEngineer =
    /\b(forward deployed|solutions? engineer|sales engineer|support engineer|customer engineer|implementation engineer|field engineer|machine learning|ml engineer|ai engineer|data engineer|security engineer|devops|site reliability|sre|cloud engineer|platform engineer|mobile|ios|android)\b/.test(
      title
    );

  /*
   * Exact role-family rules come before generic token overlap.
   * This prevents "Forward Deployed Engineer" from being treated
   * like "Frontend Engineer" just because both contain "Engineer".
   */
  if (
    isFrontendTarget
  ) {
    if (
      frontendTitle
    ) {
      return overlapRatio >=
        0.5
        ? 94
        : 90;
    }

    if (
      unrelatedSpecializedEngineer
    ) {
      return 18;
    }

    if (
      fullStackTitle
    ) {
      return 68;
    }

    if (
      genericSoftwareTitle
    ) {
      return 58;
    }

    return overlap >
      0
      ? 45
      : 15;
  }

  if (
    isBackendTarget
  ) {
    if (
      backendTitle
    ) {
      return 92;
    }

    if (
      fullStackTitle
    ) {
      return 70;
    }

    if (
      genericSoftwareTitle
    ) {
      return 58;
    }

    return overlap >
      0
      ? 45
      : 15;
  }

  if (
    isFullStackTarget
  ) {
    if (
      fullStackTitle
    ) {
      return 94;
    }

    if (
      frontendTitle ||
      backendTitle
    ) {
      return 70;
    }

    if (
      genericSoftwareTitle
    ) {
      return 60;
    }

    return overlap >
      0
      ? 45
      : 15;
  }

  if (
    isQaTarget
  ) {
    if (
      qaTitle
    ) {
      return 94;
    }

    return overlap >
      0
      ? 50
      : 15;
  }

  if (
    isDataTarget
  ) {
    if (
      dataTitle
    ) {
      return 94;
    }

    return overlap >
      0
      ? 50
      : 15;
  }

  if (
    isSecurityTarget
  ) {
    if (
      securityTitle
    ) {
      return 94;
    }

    return overlap >
      0
      ? 50
      : 15;
  }

  if (
    isDevOpsTarget
  ) {
    if (
      devOpsTitle
    ) {
      return 94;
    }

    return overlap >
      0
      ? 50
      : 15;
  }

  if (
    overlapRatio >=
    0.75
  ) {
    return 90;
  }

  if (
    overlapRatio >=
    0.5
  ) {
    return 80;
  }

  if (
    overlap >
    0
  ) {
    return 55;
  }

  if (
    genericSoftwareTitle &&
    /\bsoftware\b/.test(
      target
    )
  ) {
    return 70;
  }

  return 20;
};

/* =========================================================
   EXPERIENCE FIT
========================================================= */

const calculateExperienceFit = (
  preferredLevels:
    JobExperienceLevel[] |
    undefined,
  job:
    IJob
): number => {
  if (
    !preferredLevels ||
    preferredLevels.length ===
      0
  ) {
    return 75;
  }

  if (
    preferredLevels.includes(
      job.experienceLevel
    )
  ) {
    return 100;
  }

  if (
    preferredLevels.includes(
      "entry"
    ) &&
    job.experienceLevel ===
      "junior"
  ) {
    return 85;
  }

  if (
    preferredLevels.includes(
      "junior"
    ) &&
    job.experienceLevel ===
      "entry"
  ) {
    return 90;
  }

  if (
    preferredLevels.includes(
      "mid"
    ) &&
    job.experienceLevel ===
      "junior"
  ) {
    return 75;
  }

  return 35;
};

/* =========================================================
   EVIDENCE CONFIDENCE
========================================================= */

const calculateEvidenceConfidence = (
  profile:
    ICareerSkillProfile,
  matchedSkills:
    string[]
): number => {
  if (
    profile.skills.length ===
    0
  ) {
    return 0;
  }

  const matchedSet =
    new Set(
      matchedSkills.map(
        normalizeSkill
      )
    );

  const relevantSkills =
    profile.skills.filter(
      (
        skill
      ) =>
        matchedSet.has(
          normalizeSkill(
            skill.normalizedName ||
            skill.name
          )
        )
    );

  const sourceSkills =
    relevantSkills.length >
      0
      ? relevantSkills
      : profile.strongestSkills;

  if (
    sourceSkills.length ===
    0
  ) {
    return 0;
  }

  const averageConfidence =
    sourceSkills.reduce(
      (
        total,
        skill
      ) =>
        total +
        skill.confidence *
          100,
      0
    ) /
    sourceSkills.length;

  const verifiedCount =
    sourceSkills.filter(
      (
        skill
      ) =>
        skill.interviewVerified
    ).length;

  const verificationBonus =
    Math.min(
      15,
      verifiedCount *
        5
    );

  return clampScore(
    averageConfidence +
      verificationBonus
  );
};

/* =========================================================
   LEGACY KEYWORD OUTPUT
========================================================= */

const calculateKeywordOutput = (
  profile:
    ICareerSkillProfile,
  job:
    IJob
): {
  matched: string[];

  missing: string[];
} => {
  const profileSkills =
    new Set(
      profile.skills.map(
        (
          skill
        ) =>
          normalizeSkill(
            skill.normalizedName ||
            skill.name
          )
      )
    );

  const matched:
    string[] = [];

  const missing:
    string[] = [];

  for (
    const keyword of
    job.keywords ??
    []
  ) {
    if (
      profileSkills.has(
        normalizeSkill(
          keyword
        )
      )
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

  return {
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

/* =========================================================
   RESULT TEXT
========================================================= */

const getMatchLevel = (
  score:
    number
): JobMatchLevel => {
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
    return "good";
  }

  if (
    score >=
    45
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
      return "Strong match for your skill profile";

    case "good":
      return "Good match for your skill profile";

    case "partial":
      return "Partial match for your skill profile";

    case "low":
      return "Low match for your skill profile";
  }
};

const buildStrengths = (
  profile:
    ICareerSkillProfile,
  roleScore:
    number,
  skillScore:
    number,
  evidenceScore:
    number,
  matchedSkills:
    string[]
): string[] => {
  const result:
    string[] = [];

  if (
    roleScore >=
    80
  ) {
    result.push(
      "The vacancy title is strongly aligned with your target role."
    );
  }

  if (
    skillScore >=
    75
  ) {
    result.push(
      "Your skill profile strongly aligns with the technical requirements."
    );
  }

  if (
    matchedSkills.length >=
    3
  ) {
    result.push(
      `Your profile matches ${matchedSkills.length} requested skills.`
    );
  }

  if (
    profile.verifiedSkills.length >
    0 &&
    evidenceScore >=
    70
  ) {
    result.push(
      "InterviewIQ has verified technical evidence supporting your profile."
    );
  }

  if (
    result.length ===
    0
  ) {
    result.push(
      "Your profile contains some relevant skills for this position."
    );
  }

  return result;
};

const buildImprovementAreas = (
  missingSkills:
    string[],
  roleScore:
    number,
  experienceScore:
    number
): string[] => {
  const result:
    string[] = [];

  if (
    missingSkills.length >
    0
  ) {
    result.push(
      `Skills to strengthen for this role: ${missingSkills
        .slice(
          0,
          6
        )
        .join(
          ", "
        )}.`
    );
  }

  if (
    roleScore <
    60
  ) {
    result.push(
      "This vacancy title is not closely aligned with your current target role."
    );
  }

  if (
    experienceScore <
    60
  ) {
    result.push(
      "The vacancy's experience level is outside your preferred range."
    );
  }

  if (
    result.length ===
    0
  ) {
    result.push(
      "Your current skill profile aligns well with the main requirements."
    );
  }

  return result;
};

/* =========================================================
   MAIN MATCH
========================================================= */

export const calculateJobMatch = (
  input:
    ICareerSkillProfile |
    IResumeAnalysis,
  job:
    IJob,
  options:
    IJobMatchOptions = {}
): IJobMatchResult => {
  const profile =
    resolveProfile(
      input
    );

  const skillResult =
    calculateSkillMatch(
      profile,
      job
    );

  const roleRelevance =
    calculateRoleRelevance(
      options.targetRole,
      job
    );

  const experience =
    calculateExperienceFit(
      options.preferredExperienceLevels,
      job
    );

  const evidenceConfidence =
    calculateEvidenceConfidence(
      profile,
      skillResult.matched
    );

  const keywordResult =
    calculateKeywordOutput(
      profile,
      job
    );

  const rawScore =
    roleRelevance *
      SCORE_WEIGHTS.roleRelevance +
    skillResult.score *
      SCORE_WEIGHTS.skills +
    experience *
      SCORE_WEIGHTS.experience +
    evidenceConfidence *
      SCORE_WEIGHTS.evidenceConfidence;

  /*
   * Role-gating cap:
   *
   * Skills can improve a relevant vacancy, but they cannot turn an
   * unrelated role into a "good" match.
   */
  const roleCappedScore =
    roleRelevance <
      30
      ? Math.min(
          rawScore,
          34
        )
      : roleRelevance <
          50
        ? Math.min(
            rawScore,
            44
          )
        : roleRelevance <
            65
          ? Math.min(
              rawScore,
              59
            )
          : rawScore;

  const matchScore =
    clampScore(
      roleCappedScore
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
        profile,
        roleRelevance,
        skillResult.score,
        evidenceConfidence,
        skillResult.matched
      ),

    improvementAreas:
      buildImprovementAreas(
        skillResult.missing,
        roleRelevance,
        experience
      ),

    breakdown: {
      skills:
        skillResult.score,

      roleRelevance,

      experience,

      evidenceConfidence,

      keywords:
        keywordResult.matched.length,

      education:
        0,
    },
  };
};

/* =========================================================
   RANKING
========================================================= */

export const rankJobsForProfile = (
  profile:
    ICareerSkillProfile,
  jobs:
    IJob[],
  options:
    IJobMatchOptions = {}
): Array<{
  job: IJob;

  match: IJobMatchResult;
}> => {
  return jobs
    .map(
      (
        job
      ) => ({
        job,

        match:
          calculateJobMatch(
            profile,
            job,
            options
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

/*
 * Kept so existing controllers compile.
 * It no longer uses ATS/overall/content/structure scores.
 */
export const rankJobsForResume = (
  resume:
    IResumeAnalysis,
  jobs:
    IJob[]
): Array<{
  job: IJob;

  match: IJobMatchResult;
}> => {
  return rankJobsForProfile(
    buildProfileFromResume(
      resume
    ),
    jobs
  );
};

export default {
  calculateJobMatch,
  rankJobsForProfile,
  rankJobsForResume,
};
