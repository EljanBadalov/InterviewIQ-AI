import {
  type IExtractedResumeExperience,
  type IExtractedResumeProfile,
  type IExtractedResumeProject,
  type IResumeAnalysis,
} from "./resumeService";

/* =========================================================
   TYPES
========================================================= */

export interface IResumeEvidenceItem {
  label: string;
  evidenceCount: number;
  sources: string[];
}

export interface IResumeBulletInsight {
  section:
    | "experience"
    | "project";

  parentLabel: string;

  bullet: string;

  wordCount: number;

  hasActionVerb: boolean;

  hasMetric: boolean;

  supportedSkills: string[];

  quality:
    | "strong"
    | "medium"
    | "weak";
}

export interface IResumeDetailedAnalysis {
  inferredRole:
    string;

  metrics: {
    experienceEntries:
      number;

    projectEntries:
      number;

    educationEntries:
      number;

    totalBullets:
      number;

    bulletsWithMetrics:
      number;

    bulletsWithActionVerbs:
      number;

    technicalSkillCount:
      number;

    evidencedSkillCount:
      number;

    weakSkillCount:
      number;
  };

  skillEvidence:
    IResumeEvidenceItem[];

  bulletInsights:
    IResumeBulletInsight[];

  strengths:
    string[];

  weaknesses:
    string[];

  recommendedSkills:
    string[];

  recommendations:
    string[];

  scoreExplanations: {
    overall:
      string;

    ats:
      string;

    content:
      string;

    structure:
      string;

    skills:
      string;

    experience:
      string;
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const ACTION_VERBS = [
  "built",
  "developed",
  "implemented",
  "created",
  "designed",
  "improved",
  "optimized",
  "led",
  "managed",
  "delivered",
  "launched",
  "integrated",
  "automated",
  "reduced",
  "increased",
  "supported",
  "maintained",
  "configured",
  "tested",
  "deployed",
  "collaborated",
  "analyzed",
  "engineered",
  "resolved",
  "refactored",
  "migrated",
  "secured",
  "monitored",
  "documented",
];

const ROLE_HINTS: Array<{
  role: string;
  keywords: string[];
}> = [
  {
    role:
      "Frontend Developer",

    keywords: [
      "react",
      "next.js",
      "javascript",
      "typescript",
      "html",
      "css",
      "scss",
      "tailwind",
      "redux",
      "vite",
      "webpack",
    ],
  },

  {
    role:
      "Backend Developer",

    keywords: [
      "node.js",
      "express",
      "nestjs",
      "java",
      "python",
      "mongodb",
      "postgresql",
      "mysql",
      "redis",
      "rest api",
      "graphql",
    ],
  },

  {
    role:
      "Full-Stack Developer",

    keywords: [
      "react",
      "next.js",
      "node.js",
      "express",
      "mongodb",
      "postgresql",
      "typescript",
      "javascript",
    ],
  },

  {
    role:
      "QA Engineer",

    keywords: [
      "selenium",
      "cypress",
      "playwright",
      "postman",
      "testing",
      "qa",
      "jira",
    ],
  },

  {
    role:
      "Data Analyst",

    keywords: [
      "sql",
      "excel",
      "power bi",
      "tableau",
      "python",
      "pandas",
      "data analysis",
    ],
  },
];

const ROLE_RECOMMENDATIONS:
  Record<
    string,
    string[]
  > = {
    "Frontend Developer": [
      "Accessibility",
      "Testing",
      "Performance Optimization",
      "State Management",
      "Responsive Design",
    ],

    "Backend Developer": [
      "API Security",
      "Database Optimization",
      "Caching",
      "Testing",
      "Docker",
    ],

    "Full-Stack Developer": [
      "Testing",
      "Docker",
      "CI/CD",
      "API Security",
      "Performance Optimization",
    ],

    "QA Engineer": [
      "API Testing",
      "Automation Testing",
      "CI/CD",
      "Performance Testing",
      "Test Design",
    ],

    "Data Analyst": [
      "Data Visualization",
      "Statistics",
      "SQL Optimization",
      "Dashboard Design",
      "Data Cleaning",
    ],
  };

/* =========================================================
   HELPERS
========================================================= */

const normalize = (
  value:
    string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
};

const unique = (
  values:
    string[]
): string[] => {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value.trim()
        )
        .filter(Boolean)
    )
  );
};

const wordCount = (
  value:
    string
): number => {
  return value
    .trim()
    .split(
      /\s+/
    )
    .filter(Boolean)
    .length;
};

const hasMetric = (
  value:
    string
): boolean => {
  return (
    /(?:\d+(?:\.\d+)?%|\$\s?\d+|\b\d+\+?\s*(?:users|clients|projects|features|requests|tickets|hours|days|weeks|months|years|seconds|ms)\b)/i.test(
      value
    )
  );
};

const hasActionVerb = (
  value:
    string
): boolean => {
  const firstWord =
    normalize(
      value
    )
      .split(
        " "
      )[0];

  return ACTION_VERBS.includes(
    firstWord
  );
};

const inferRole = (
  profile:
    IExtractedResumeProfile
): string => {
  const skills =
    profile.technicalSkills
      .map(normalize);

  let bestRole =
    "Technology Professional";

  let bestScore =
    0;

  for (
    const hint
    of ROLE_HINTS
  ) {
    const score =
      hint.keywords.filter(
        (keyword) =>
          skills.includes(
            normalize(
              keyword
            )
          )
      ).length;

    if (
      score >
      bestScore
    ) {
      bestRole =
        hint.role;

      bestScore =
        score;
    }
  }

  return bestRole;
};

const collectExperienceText = (
  item:
    IExtractedResumeExperience
): string => {
  return [
    item.title,
    item.company,
    item.description,
    ...item.bullets,
    ...item.technologies,
  ]
    .filter(Boolean)
    .join(
      " "
    );
};

const collectProjectText = (
  item:
    IExtractedResumeProject
): string => {
  return [
    item.name,
    item.role,
    item.description,
    ...item.bullets,
    ...item.technologies,
  ]
    .filter(Boolean)
    .join(
      " "
    );
};

const buildSkillEvidence = (
  profile:
    IExtractedResumeProfile
): IResumeEvidenceItem[] => {
  const result:
    IResumeEvidenceItem[] =
      [];

  for (
    const skill
    of profile.technicalSkills
  ) {
    const normalizedSkill =
      normalize(
        skill
      );

    const sources:
      string[] = [];

    for (
      const experience
      of profile.experience
    ) {
      const text =
        normalize(
          collectExperienceText(
            experience
          )
        );

      if (
        text.includes(
          normalizedSkill
        )
      ) {
        sources.push(
          `Experience: ${experience.title}${
            experience.company
              ? ` at ${experience.company}`
              : ""
          }`
        );
      }
    }

    for (
      const project
      of profile.projects
    ) {
      const text =
        normalize(
          collectProjectText(
            project
          )
        );

      if (
        text.includes(
          normalizedSkill
        )
      ) {
        sources.push(
          `Project: ${project.name}`
        );
      }
    }

    result.push({
      label:
        skill,

      evidenceCount:
        sources.length,

      sources:
        unique(
          sources
        ),
    });
  }

  return result.sort(
    (
      a,
      b
    ) =>
      b.evidenceCount -
      a.evidenceCount
  );
};

const analyzeBullets = (
  profile:
    IExtractedResumeProfile
): IResumeBulletInsight[] => {
  const insights:
    IResumeBulletInsight[] =
      [];

  for (
    const experience
    of profile.experience
  ) {
    for (
      const bullet
      of experience.bullets
    ) {
      const supportedSkills =
        profile.technicalSkills.filter(
          (skill) =>
            normalize(
              bullet
            ).includes(
              normalize(
                skill
              )
            )
        );

      const action =
        hasActionVerb(
          bullet
        );

      const metric =
        hasMetric(
          bullet
        );

      const words =
        wordCount(
          bullet
        );

      const quality:
        IResumeBulletInsight["quality"] =
          action &&
          metric &&
          words >=
            8
            ? "strong"
            : action ||
                metric
              ? "medium"
              : "weak";

      insights.push({
        section:
          "experience",

        parentLabel:
          experience.title,

        bullet,

        wordCount:
          words,

        hasActionVerb:
          action,

        hasMetric:
          metric,

        supportedSkills,

        quality,
      });
    }
  }

  for (
    const project
    of profile.projects
  ) {
    for (
      const bullet
      of project.bullets
    ) {
      const supportedSkills =
        profile.technicalSkills.filter(
          (skill) =>
            normalize(
              bullet
            ).includes(
              normalize(
                skill
              )
            )
        );

      const action =
        hasActionVerb(
          bullet
        );

      const metric =
        hasMetric(
          bullet
        );

      const words =
        wordCount(
          bullet
        );

      const quality:
        IResumeBulletInsight["quality"] =
          action &&
          metric &&
          words >=
            8
            ? "strong"
            : action ||
                metric
              ? "medium"
              : "weak";

      insights.push({
        section:
          "project",

        parentLabel:
          project.name,

        bullet,

        wordCount:
          words,

        hasActionVerb:
          action,

        hasMetric:
          metric,

        supportedSkills,

        quality,
      });
    }
  }

  return insights;
};

/* =========================================================
   DYNAMIC FEEDBACK
========================================================= */

const buildStrengths = ({
  profile,
  skillEvidence,
  bulletInsights,
}: {
  profile:
    IExtractedResumeProfile;

  skillEvidence:
    IResumeEvidenceItem[];

  bulletInsights:
    IResumeBulletInsight[];
}): string[] => {
  const strengths:
    string[] = [];

  const strongSkills =
    skillEvidence.filter(
      (item) =>
        item.evidenceCount >=
        2
    );

  if (
    strongSkills.length >
    0
  ) {
    strengths.push(
      `Your strongest evidenced skills are ${strongSkills
        .slice(
          0,
          4
        )
        .map(
          (item) =>
            item.label
        )
        .join(
          ", "
        )}, because they appear across multiple experience or project entries.`
    );
  }

  const strongBullets =
    bulletInsights.filter(
      (item) =>
        item.quality ===
        "strong"
    );

  if (
    strongBullets.length >
    0
  ) {
    strengths.push(
      `${strongBullets.length} bullet point${
        strongBullets.length ===
        1
          ? ""
          : "s"
      } combine action-oriented language with measurable impact.`
    );
  }

  if (
    profile.projects.length >
    0
  ) {
    strengths.push(
      `The resume includes ${profile.projects.length} project${
        profile.projects.length ===
        1
          ? ""
          : "s"
      }, which gives recruiters additional evidence of practical implementation experience.`
    );
  }

  if (
    profile.education.length >
    0
  ) {
    strengths.push(
      `Education is clearly represented with ${profile.education.length} identifiable entr${
        profile.education.length ===
        1
          ? "y"
          : "ies"
      }.`
    );
  }

  return strengths;
};

const buildWeaknesses = ({
  profile,
  skillEvidence,
  bulletInsights,
}: {
  profile:
    IExtractedResumeProfile;

  skillEvidence:
    IResumeEvidenceItem[];

  bulletInsights:
    IResumeBulletInsight[];
}): string[] => {
  const weaknesses:
    string[] = [];

  const totalBullets =
    bulletInsights.length;

  const metricBullets =
    bulletInsights.filter(
      (item) =>
        item.hasMetric
    ).length;

  const weakBullets =
    bulletInsights.filter(
      (item) =>
        item.quality ===
        "weak"
    );

  if (
    totalBullets >
      0 &&
    metricBullets ===
      0
  ) {
    weaknesses.push(
      `None of the ${totalBullets} analyzed experience/project bullet points include measurable outcomes. This makes impact harder to evaluate.`
    );
  } else if (
    totalBullets >
      0 &&
    metricBullets /
      totalBullets <
      0.25
  ) {
    weaknesses.push(
      `Only ${metricBullets} of ${totalBullets} bullet points include measurable outcomes, so most contributions read as responsibilities rather than impact.`
    );
  }

  if (
    weakBullets.length >
    0
  ) {
    const examples =
      weakBullets
        .slice(
          0,
          2
        )
        .map(
          (item) =>
            `"${item.bullet}"`
        )
        .join(
          "; "
        );

    weaknesses.push(
      `${weakBullets.length} bullet point${
        weakBullets.length ===
        1
          ? ""
          : "s"
      } are weak because they lack both a clear action verb and measurable result. Example: ${examples}`
    );
  }

  const unsupportedSkills =
    skillEvidence.filter(
      (item) =>
        item.evidenceCount ===
        0
    );

  if (
    unsupportedSkills.length >
    0
  ) {
    weaknesses.push(
      `${unsupportedSkills.length} technical skill${
        unsupportedSkills.length ===
        1
          ? ""
          : "s"
      } appear in the resume but are not supported by identifiable experience or project evidence: ${unsupportedSkills
        .slice(
          0,
          6
        )
        .map(
          (item) =>
            item.label
        )
        .join(
          ", "
        )}.`
    );
  }

  if (
    profile.professionalSummary
      .trim()
      .length <
      60
  ) {
    weaknesses.push(
      "The professional summary is missing or too short to clearly position the candidate's strongest skills and career direction."
    );
  }

  if (
    profile.experience.length ===
      0 &&
    profile.projects.length ===
      0
  ) {
    weaknesses.push(
      "The resume contains no clearly identifiable experience or project section, which limits evidence for claimed skills."
    );
  }

  return weaknesses;
};

const buildRecommendedSkills = ({
  role,
  profile,
}: {
  role:
    string;

  profile:
    IExtractedResumeProfile;
}): string[] => {
  const currentSkills =
    new Set(
      profile.skills.map(
        normalize
      )
    );

  const candidates =
    ROLE_RECOMMENDATIONS[
      role
    ] ??
    [];

  return candidates
    .filter(
      (skill) =>
        !currentSkills.has(
          normalize(
            skill
          )
        )
    )
    .slice(
      0,
      5
    );
};

const buildRecommendations = ({
  profile,
  skillEvidence,
  bulletInsights,
  role,
}: {
  profile:
    IExtractedResumeProfile;

  skillEvidence:
    IResumeEvidenceItem[];

  bulletInsights:
    IResumeBulletInsight[];

  role:
    string;
}): string[] => {
  const recommendations:
    string[] = [];

  const weakBullets =
    bulletInsights.filter(
      (item) =>
        item.quality ===
        "weak"
    );

  if (
    weakBullets.length >
    0
  ) {
    recommendations.push(
      `Rewrite the weakest ${Math.min(
        weakBullets.length,
        3
      )} bullet point${
        weakBullets.length ===
        1
          ? ""
          : "s"
      } using an action + task + outcome structure.`
    );
  }

  const metricCount =
    bulletInsights.filter(
      (item) =>
        item.hasMetric
    ).length;

  if (
    bulletInsights.length >
      0 &&
    metricCount <
      Math.ceil(
        bulletInsights.length *
          0.3
      )
  ) {
    recommendations.push(
      "Add truthful measurable outcomes where possible, such as performance gains, users supported, response-time improvements, defects reduced, features delivered, or time saved."
    );
  }

  const unsupported =
    skillEvidence.filter(
      (item) =>
        item.evidenceCount ===
        0
    );

  if (
    unsupported.length >
    0
  ) {
    recommendations.push(
      `Strengthen evidence for ${unsupported
        .slice(
          0,
          4
        )
        .map(
          (item) =>
            item.label
        )
        .join(
          ", "
        )} by referencing them inside relevant project or experience bullets when they were genuinely used.`
    );
  }

  if (
    profile.professionalSummary
      .trim()
      .length <
      60
  ) {
    recommendations.push(
      `Add a 2–4 sentence summary positioning the candidate toward ${role} roles using only verified skills and experience.`
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "Tailor the strongest skills and evidence to each target vacancy while preserving factual accuracy."
    );
  }

  return recommendations;
};

const buildScoreExplanations = ({
  analysis,
  profile,
  skillEvidence,
  bulletInsights,
}: {
  analysis:
    IResumeAnalysis;

  profile:
    IExtractedResumeProfile;

  skillEvidence:
    IResumeEvidenceItem[];

  bulletInsights:
    IResumeBulletInsight[];
}) => {
  const evidencedSkills =
    skillEvidence.filter(
      (item) =>
        item.evidenceCount >
        0
    ).length;

  const metricBullets =
    bulletInsights.filter(
      (item) =>
        item.hasMetric
    ).length;

  return {
    overall:
      `Overall score ${analysis.overallScore}/100 reflects the combination of ATS readiness, content quality, structure, skills evidence, and experience strength.`,

    ats:
      `ATS score ${analysis.atsScore}/100 is influenced by recognizable sections, keyword coverage, contact information, and the amount of structured resume content.`,

    content:
      `Content score ${analysis.contentScore}/100 is affected by ${bulletInsights.length} analyzed bullet points, of which ${metricBullets} contain measurable outcomes.`,

    structure:
      `Structure score ${analysis.structureScore}/100 reflects the presence of identifiable experience, projects, education, skills, and other standard resume sections.`,

    skills:
      `Skills score ${analysis.skillsScore}/100 reflects ${profile.technicalSkills.length} detected technical skills, with ${evidencedSkills} supported by identifiable project or experience evidence.`,

    experience:
      `Experience score ${analysis.experienceScore}/100 reflects ${profile.experience.length} experience entr${
        profile.experience.length ===
        1
          ? "y"
          : "ies"
      }, ${bulletInsights.filter(
        (item) =>
          item.section ===
          "experience"
      ).length} experience bullet points, and the amount of measurable impact found in those bullets.`,
  };
};

/* =========================================================
   MAIN
========================================================= */

export const buildDetailedResumeAnalysis =
  ({
    analysis,
    profile,
  }: {
    analysis:
      IResumeAnalysis;

    profile:
      IExtractedResumeProfile;
  }): IResumeDetailedAnalysis => {
    const inferredRole =
      inferRole(
        profile
      );

    const skillEvidence =
      buildSkillEvidence(
        profile
      );

    const bulletInsights =
      analyzeBullets(
        profile
      );

    const strengths =
      buildStrengths({
        profile,
        skillEvidence,
        bulletInsights,
      });

    const weaknesses =
      buildWeaknesses({
        profile,
        skillEvidence,
        bulletInsights,
      });

    const recommendedSkills =
      buildRecommendedSkills({
        role:
          inferredRole,

        profile,
      });

    const recommendations =
      buildRecommendations({
        profile,
        skillEvidence,
        bulletInsights,
        role:
          inferredRole,
      });

    const scoreExplanations =
      buildScoreExplanations({
        analysis,
        profile,
        skillEvidence,
        bulletInsights,
      });

    const totalBullets =
      bulletInsights.length;

    const bulletsWithMetrics =
      bulletInsights.filter(
        (item) =>
          item.hasMetric
      ).length;

    const bulletsWithActionVerbs =
      bulletInsights.filter(
        (item) =>
          item.hasActionVerb
      ).length;

    const evidencedSkillCount =
      skillEvidence.filter(
        (item) =>
          item.evidenceCount >
          0
      ).length;

    const weakSkillCount =
      skillEvidence.filter(
        (item) =>
          item.evidenceCount ===
          0
      ).length;

    return {
      inferredRole,

      metrics: {
        experienceEntries:
          profile.experience
            .length,

        projectEntries:
          profile.projects
            .length,

        educationEntries:
          profile.education
            .length,

        totalBullets,

        bulletsWithMetrics,

        bulletsWithActionVerbs,

        technicalSkillCount:
          profile.technicalSkills
            .length,

        evidencedSkillCount,

        weakSkillCount,
      },

      skillEvidence,

      bulletInsights,

      strengths,

      weaknesses,

      recommendedSkills,

      recommendations,

      scoreExplanations,
    };
  };

export default {
  buildDetailedResumeAnalysis,
};
