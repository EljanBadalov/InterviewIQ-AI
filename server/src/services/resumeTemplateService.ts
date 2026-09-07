import {
  type IJob,
} from "../models/Job";

import {
  ResumeTemplate,
  type IResumeTemplate,
  type ResumeTemplateRole,
} from "../models/ResumeTemplate";

export interface IResumeTemplateMatch {
  template: IResumeTemplate;

  score: number;

  reasons: string[];

  matchedTerms: string[];
}

interface TemplateScoreResult {
  score: number;

  reasons: string[];

  matchedTerms: string[];
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

const normalizeSkill = (
  value: string
): string => {
  const normalized =
    normalizeText(
      value
    );

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

    nextjs: "next.js",
    "next.js": "next.js",

    node: "node.js",
    nodejs: "node.js",
    "node.js": "node.js",

    expressjs: "express",
    "express.js": "express",
    express: "express",

    mongo: "mongodb",
    mongodb: "mongodb",

    postgres: "postgresql",
    postgresql: "postgresql",

    restful: "rest api",
    rest: "rest api",
    api: "rest api",
    "restful api": "rest api",
    "rest api": "rest api",

    html5: "html",
    html: "html",

    css3: "css",
    css: "css",

    k8s: "kubernetes",
    kubernetes:
      "kubernetes",

    cicd: "ci/cd",
    "ci cd": "ci/cd",
    "ci/cd": "ci/cd",

    ml:
      "machine learning",
    "machine learning":
      "machine learning",

    ai:
      "artificial intelligence",
    "artificial intelligence":
      "artificial intelligence",

    sklearn:
      "scikit-learn",
    "scikit learn":
      "scikit-learn",
    "scikit-learn":
      "scikit-learn",

    pentesting:
      "penetration testing",
    pentest:
      "penetration testing",
    "penetration testing":
      "penetration testing",

    "red teaming":
      "red team",
    redteam:
      "red team",
    "red team":
      "red team",

    soc:
      "soc",
    "security operations center":
      "soc",

    siem:
      "siem",

    "data structures and algorithms":
      "data structures",
    dsa:
      "data structures",

    oop:
      "object-oriented programming",
    "object oriented programming":
      "object-oriented programming",
    "object-oriented programming":
      "object-oriented programming",
  };

  return (
    aliases[normalized] ||
    normalized
  );
};

const uniqueStrings = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value
    of values
  ) {
    const cleaned =
      value.trim();

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push(
      cleaned
    );
  }

  return result;
};


const safeArray = (
  value:
    | string[]
    | null
    | undefined
): string[] => {
  return Array.isArray(
    value
  )
    ? value
    : [];
};

const safeText = (
  value:
    | string
    | null
    | undefined
): string => {
  return typeof value ===
    "string"
    ? value
    : "";
};

const containsTerm = (
  text: string,
  term: string
): boolean => {
  const normalizedText =
    normalizeText(
      text
    );

  const normalizedTerm =
    normalizeText(
      term
    );

  if (
    !normalizedText ||
    !normalizedTerm
  ) {
    return false;
  }

  return (
    normalizedText ===
      normalizedTerm ||
    normalizedText.includes(
      normalizedTerm
    )
  );
};

const buildJobText = (
  job: IJob
): string => {
  return normalizeText(
    [
      safeText(job.title),
      safeText(job.company),
      safeText(job.description),
      ...safeArray(job.skills),
      ...safeArray(job.keywords),
      ...safeArray(job.requirements),
      ...safeArray(job.preferredQualifications),
      ...safeArray(job.responsibilities),
      ...safeArray(job.education),
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const getRoleSpecificBoost = (
  role:
    ResumeTemplateRole,
  job:
    IJob
): {
  score: number;
  reason?: string;
} => {
  const title =
    normalizeText(
      safeText(job.title)
    );

  switch (role) {
    case "penetration-tester": {
      const terms = [
        "penetration tester",
        "penetration testing",
        "pentest",
        "red team",
        "ethical hacker",
        "offensive security",
      ];

      if (
        terms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches penetration testing or offensive security.",
        };
      }

      return {
        score: 0,
      };
    }

    case "soc-analyst": {
      const terms = [
        "soc analyst",
        "security analyst",
        "cybersecurity analyst",
        "blue team",
        "security operations",
        "incident response analyst",
      ];

      if (
        terms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches SOC or defensive cybersecurity.",
        };
      }

      return {
        score: 0,
      };
    }

    case "full-stack-developer": {
      const exactTerms = [
        "full stack",
        "full-stack",
        "web developer",
        "mern",
      ];

      if (
        exactTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches full-stack or web development.",
        };
      }

      const frontendTerms = [
        "frontend",
        "front end",
        "react developer",
        "react engineer",
        "next.js",
        "javascript developer",
      ];

      if (
        frontendTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 35,

          reason:
            "Frontend-oriented role aligns strongly with the Full-Stack Developer reference.",
        };
      }

      const backendTerms = [
        "node.js developer",
        "node developer",
        "backend developer",
        "backend engineer",
      ];

      if (
        backendTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 25,

          reason:
            "Backend web-development role partially aligns with the Full-Stack Developer reference.",
        };
      }

      return {
        score: 0,
      };
    }

    case "software-engineer": {
      const exactTerms = [
        "software engineer",
        "software developer",
        "application developer",
        "application engineer",
      ];

      if (
        exactTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches general software engineering.",
        };
      }

      const relatedTerms = [
        "backend engineer",
        "backend developer",
        "java developer",
        "python developer",
        "systems engineer",
      ];

      if (
        relatedTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 30,

          reason:
            "Job title aligns with core software-engineering responsibilities.",
        };
      }

      return {
        score: 0,
      };
    }

    case "machine-learning-engineer": {
      const terms = [
        "machine learning engineer",
        "ml engineer",
        "ai engineer",
        "applied machine learning",
        "deep learning engineer",
      ];

      if (
        terms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches machine learning or AI engineering.",
        };
      }

      return {
        score: 0,
      };
    }

    case "data-scientist": {
      const exactTerms = [
        "data scientist",
        "data analyst",
        "analytics specialist",
        "analytics scientist",
      ];

      if (
        exactTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 45,

          reason:
            "Job title directly matches data science or analytics.",
        };
      }

      const relatedTerms = [
        "business intelligence",
        "bi analyst",
        "reporting analyst",
        "business data analyst",
      ];

      if (
        relatedTerms.some(
          (term) =>
            containsTerm(
              title,
              term
            )
        )
      ) {
        return {
          score: 30,

          reason:
            "Analytics-oriented role aligns with the Data Scientist reference.",
        };
      }

      return {
        score: 0,
      };
    }

    default:
      return {
        score: 0,
      };
  }
};

const scoreTemplate = (
  template:
    IResumeTemplate,
  job:
    IJob
): TemplateScoreResult => {
  let score = 0;

  const reasons:
    string[] = [];

  const matchedTerms:
    string[] = [];

  const jobText =
    buildJobText(
      job
    );

  const roleBoost =
    getRoleSpecificBoost(
      template.role,
      job
    );

  if (
    roleBoost.score > 0
  ) {
    score +=
      roleBoost.score;

    if (
      roleBoost.reason
    ) {
      reasons.push(
        roleBoost.reason
      );
    }
  }

  const normalizedAliases =
    safeArray(template.aliases).map(
      normalizeText
    );

  const title =
    normalizeText(
      safeText(job.title)
    );

  const aliasMatches =
    normalizedAliases.filter(
      (alias) =>
        title.includes(
          alias
        ) ||
        alias.includes(
          title
        )
    );

  if (
    aliasMatches.length >
    0
  ) {
    score += 20;

    matchedTerms.push(
      ...aliasMatches
    );

    reasons.push(
      "Job title matches one or more template role aliases."
    );
  }

  const jobSkills =
    uniqueStrings(
      safeArray(job.skills).map(
        normalizeSkill
      )
    );

  const templateSkills =
    uniqueStrings(
      [
        ...template.coreSkills,
        ...template.technicalSkills,
      ].map(
        normalizeSkill
      )
    );

  const templateSkillSet =
    new Set(
      templateSkills
    );

  const matchedSkills =
    jobSkills.filter(
      (skill) =>
        templateSkillSet.has(
          skill
        )
    );

  if (
    jobSkills.length > 0
  ) {
    const skillRatio =
      matchedSkills.length /
      jobSkills.length;

    const skillScore =
      Math.round(
        skillRatio *
          25
      );

    score +=
      skillScore;

    if (
      matchedSkills.length >
      0
    ) {
      matchedTerms.push(
        ...matchedSkills
      );

      reasons.push(
        `${matchedSkills.length} job skills align with this resume reference.`
      );
    }
  }

  const templateKeywords =
    uniqueStrings(
      safeArray(template.atsKeywords).map(
        normalizeText
      )
    );

  const matchedKeywords =
    templateKeywords.filter(
      (keyword) =>
        containsTerm(
          jobText,
          keyword
        )
    );

  if (
    templateKeywords.length >
    0
  ) {
    const keywordRatio =
      matchedKeywords.length /
      templateKeywords.length;

    const keywordScore =
      Math.min(
        15,
        Math.round(
          keywordRatio *
            35
        )
      );

    score +=
      keywordScore;

    if (
      matchedKeywords.length >
      0
    ) {
      matchedTerms.push(
        ...matchedKeywords
      );

      reasons.push(
        `${matchedKeywords.length} ATS keywords overlap with the job description.`
      );
    }
  }

  const recommendedRoleMatches =
    safeArray(template.recommendedForRoles).filter(
      (role) =>
        containsTerm(
          safeText(job.title),
          role
        ) ||
        containsTerm(
          jobText,
          role
        )
    );

  if (
    recommendedRoleMatches.length >
    0
  ) {
    score +=
      Math.min(
        15,
        recommendedRoleMatches.length *
          5
      );

    matchedTerms.push(
      ...recommendedRoleMatches
    );

    reasons.push(
      "The vacancy aligns with roles recommended for this template."
    );
  }

  return {
    score:
      Math.max(
        0,
        Math.min(
          100,
          score
        )
      ),

    reasons:
      uniqueStrings(
        reasons
      ),

    matchedTerms:
      uniqueStrings(
        matchedTerms
      ),
  };
};

const getFallbackRole = (
  job:
    IJob
): ResumeTemplateRole => {
  const text =
    buildJobText(
      job
    );

  if (
    [
      "penetration",
      "pentest",
      "red team",
      "ethical hacking",
      "burp suite",
      "metasploit",
    ].some(
      (term) =>
        containsTerm(
          text,
          term
        )
    )
  ) {
    return "penetration-tester";
  }

  if (
    [
      "soc",
      "siem",
      "security monitoring",
      "incident response",
      "splunk",
      "blue team",
    ].some(
      (term) =>
        containsTerm(
          text,
          term
        )
    )
  ) {
    return "soc-analyst";
  }

  if (
    [
      "machine learning",
      "ml engineer",
      "tensorflow",
      "pytorch",
      "deep learning",
      "model deployment",
    ].some(
      (term) =>
        containsTerm(
          text,
          term
        )
    )
  ) {
    return "machine-learning-engineer";
  }

  if (
    [
      "data scientist",
      "data analyst",
      "power bi",
      "tableau",
      "statistics",
      "data visualization",
      "a/b testing",
    ].some(
      (term) =>
        containsTerm(
          text,
          term
        )
    )
  ) {
    return "data-scientist";
  }

  if (
    [
      "react",
      "frontend",
      "full stack",
      "full-stack",
      "next.js",
      "node.js",
      "express",
      "web developer",
    ].some(
      (term) =>
        containsTerm(
          text,
          term
        )
    )
  ) {
    return "full-stack-developer";
  }

  return "software-engineer";
};

export const getAllResumeTemplates =
  async (): Promise<
    IResumeTemplate[]
  > => {
    return ResumeTemplate.find({
      isActive: true,
    })
      .sort({
        displayName: 1,
      })
      .lean();
  };

export const getResumeTemplateByRole =
  async (
    role:
      ResumeTemplateRole
  ): Promise<
    IResumeTemplate | null
  > => {
    return ResumeTemplate.findOne({
      role,
      isActive: true,
    }).lean();
  };

export const findBestResumeTemplateForJob =
  async (
    job:
      IJob
  ): Promise<
    IResumeTemplateMatch | null
  > => {
    const templates =
      await getAllResumeTemplates();

    if (
      templates.length ===
      0
    ) {
      return null;
    }

    const ranked =
      templates
        .map(
          (template) => {
            const result =
              scoreTemplate(
                template,
                job
              );

            return {
              template,

              score:
                result.score,

              reasons:
                result.reasons,

              matchedTerms:
                result.matchedTerms,
            };
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        );

    const best =
      ranked[0];

    if (
      best &&
      best.score >= 20
    ) {
      return best;
    }

    const fallbackRole =
      getFallbackRole(
        job
      );

    const fallbackTemplate =
      templates.find(
        (template) =>
          template.role ===
          fallbackRole
      );

    if (
      fallbackTemplate
    ) {
      return {
        template:
          fallbackTemplate,

        score:
          best?.score ||
          0,

        reasons: [
          "No high-confidence template match was found, so InterviewIQ selected the closest professional reference based on the vacancy domain.",
        ],

        matchedTerms:
          best?.matchedTerms ||
          [],
      };
    }

    return (
      best ||
      null
    );
  };

export const rankResumeTemplatesForJob =
  async (
    job:
      IJob
  ): Promise<
    IResumeTemplateMatch[]
  > => {
    const templates =
      await getAllResumeTemplates();

    return templates
      .map(
        (template) => {
          const result =
            scoreTemplate(
              template,
              job
            );

          return {
            template,

            score:
              result.score,

            reasons:
              result.reasons,

            matchedTerms:
              result.matchedTerms,
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      );
  };