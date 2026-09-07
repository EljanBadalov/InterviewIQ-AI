import {
  type Types,
} from "mongoose";

import {
  type IJob,
} from "../models/Job";

import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  buildCVEvidenceContext,
  buildGeneralCVEvidenceContext,
  getSafeSkillsForGeneralCV,
  getPlatformSkillsMissingFromResumeGeneral,
  getMissingJobSkills,
  getPlatformSkillsMissingFromResume,
  getSafeKeywordsForCV,
  getSafeSkillsForCV,
  type ICVEvidenceContext,
} from "./cvEvidenceService";

export interface ICVOptimizationResult {
  mode: "general" | "job-targeted";

  currentResumeScore: number;

  currentJobMatchScore: number;

  targetJob: {
    id?: string;

    title: string;

    company: string;
  } | null;

  matchLevel:
    | "strong"
    | "good"
    | "partial"
    | "low";

  templateUsed: {
    id?: string;

    role: string;

    displayName: string;

    matchScore: number;

    reasons: string[];
  } | null;

  matchedSkills: string[];

  missingSkills: string[];

  platformVerifiedSkills: string[];

  platformSkillsMissingFromResume: string[];

  safeSkillsForCV: string[];

  recommendedKeywords: string[];

  suggestedSkills: string[];

  suggestedProfessionalSummary: string;

  experienceSuggestions: string[];

  projectSuggestions: string[];

  atsSuggestions: string[];

  formattingSuggestions: string[];

  priorityActions: Array<{
    priority:
      | "high"
      | "medium"
      | "low";

    title: string;

    description: string;
  }>;

  sectionsToImprove: Array<{
    section:
      | "summary"
      | "skills"
      | "experience"
      | "projects"
      | "keywords"
      | "education"
      | "ats";

    score: number;

    status:
      | "strong"
      | "needs-improvement"
      | "weak";

    suggestions: string[];
  }>;

  evidenceSummary: {
    totalResumeSkills: number;

    totalValidatedSkills: number;

    totalJobSkills: number;

    matchedJobSkills: number;

    missingJobSkills: number;

    platformSupportedJobSkills: number;

    templateRelevantSkills: number;
  };

  disclaimer: string;
}

interface OptimizeCVParams {
  userId:
    | Types.ObjectId
    | string;

  resume: IResumeAnalysis;

  job: IJob;
}

const normalizeText = (
  value: string
): string => {
  return value
    .trim()
    .replace(
      /\s+/g,
      " "
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
      normalizeText(
        value
      );

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

const clampScore = (
  score: number
): number => {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        score
      )
    )
  );
};

const getSectionStatus = (
  score: number
):
  | "strong"
  | "needs-improvement"
  | "weak" => {
  if (
    score >= 75
  ) {
    return "strong";
  }

  if (
    score >= 50
  ) {
    return "needs-improvement";
  }

  return "weak";
};

const buildRecommendedKeywords = (
  context:
    ICVEvidenceContext
): string[] => {
  const safeKeywords =
    getSafeKeywordsForCV(
      context
    )
      .filter(
        (item) =>
          item.requiredByJob ||
          item.recommendedByTemplate
      )
      .map(
        (item) =>
          item.keyword
      );

  return uniqueStrings([
    ...safeKeywords,

    ...context.match
      .matchedKeywords,

    context.job.title,
  ]).slice(
    0,
    15
  );
};

const buildSuggestedSkills = (
  context:
    ICVEvidenceContext
): string[] => {
  /*
   * Important:
   *
   * A skill can be suggested for direct CV inclusion
   * only when it already exists in the resume OR
   * InterviewIQ has validated it.
   *
   * Template/job-only skills are not automatically
   * added as candidate skills.
   */

  const safeSkills =
    getSafeSkillsForCV(
      context
    );

  return uniqueStrings(
    safeSkills
      .filter(
        (skill) =>
          skill.requiredByJob ||
          skill.recommendedByTemplate
      )
      .map(
        (skill) =>
          skill.name
      )
  );
};

const buildProfessionalSummary = (
  context:
    ICVEvidenceContext
): string => {
  const job =
    context.job;

  const strongestSkills =
    getSafeSkillsForCV(
      context
    )
      .filter(
        (skill) =>
          skill.requiredByJob ||
          skill.recommendedByTemplate
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.requiredByJob !==
            b.requiredByJob
          ) {
            return a.requiredByJob
              ? -1
              : 1;
          }

          if (
            a.validatedByPlatform !==
            b.validatedByPlatform
          ) {
            return a.validatedByPlatform
              ? -1
              : 1;
          }

          return (
            (
              b.confidence ||
              0
            ) -
            (
              a.confidence ||
              0
            )
          );
        }
      )
      .slice(
        0,
        5
      )
      .map(
        (skill) =>
          skill.name
      );

  const fallbackSkills =
    context.resume
      .skillsDetected
      .slice(
        0,
        4
      );

  const selectedSkills =
    strongestSkills.length >
    0
      ? strongestSkills
      : fallbackSkills;

  const skillText =
    selectedSkills.join(
      ", "
    );

  if (
    skillText
  ) {
    return (
      `Professional targeting ${job.title} opportunities with demonstrated skills in ${skillText}. ` +
      `Brings practical technical knowledge, continuous learning, problem-solving, and collaborative experience aligned with the requirements of the role.`
    );
  }

  return (
    `Motivated professional targeting ${job.title} opportunities at ${job.company}. ` +
    `Focused on applying relevant technical knowledge, adaptability, continuous learning, and results-oriented collaboration to the role.`
  );
};

const buildExperienceSuggestions = (
  context:
    ICVEvidenceContext
): string[] => {
  const suggestions:
    string[] = [];

  const job =
    context.job;

  const missingSkills =
    getMissingJobSkills(
      context
    );

  const platformSkills =
    getPlatformSkillsMissingFromResume(
      context
    ).filter(
      (skill) =>
        skill.requiredByJob
    );

  if (
    platformSkills.length >
    0
  ) {
    suggestions.push(
      `InterviewIQ has evidence for ${platformSkills
        .slice(
          0,
          6
        )
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )}. If you have real projects, coursework, or work examples using these skills, surface that evidence in your experience or projects section.`
    );
  }

  if (
    missingSkills.length >
    0
  ) {
    suggestions.push(
      `The vacancy expects ${missingSkills
        .slice(
          0,
          6
        )
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )}. Do not claim these skills unless you can support them with genuine experience, training, or projects.`
    );
  }

  if (
    context.match
      .breakdown
      .experience <
    75
  ) {
    suggestions.push(
      `Make experience relevant to ${job.title} easier to identify by moving the strongest related responsibilities, achievements, and projects higher in each section.`
    );
  }

  suggestions.push(
    "Rewrite experience bullets using an action verb, the task performed, the technology or method used, and the result when a real measurable outcome is available."
  );

  suggestions.push(
    "Replace generic responsibility statements with concrete contributions, technical decisions, project outcomes, or measurable achievements."
  );

  if (
    job.responsibilities
      .length >
    0
  ) {
    suggestions.push(
      `Where truthful, emphasize experience related to responsibilities such as: ${job.responsibilities
        .slice(
          0,
          3
        )
        .join(
          "; "
        )}.`
    );
  }

  if (
    context.template
      ?.experiencePatterns
      .length
  ) {
    const patterns =
      context.template
        .experiencePatterns
        .slice(
          0,
          3
        )
        .map(
          (pattern) =>
            `${pattern.title}: ${pattern.description}`
        );

    suggestions.push(
      `Use the professional ${context.template.displayName} reference as a writing guide for relevant experience: ${patterns.join(
        " | "
      )}.`
    );
  }

  return uniqueStrings(
    suggestions
  );
};

const buildProjectSuggestions = (
  context:
    ICVEvidenceContext
): string[] => {
  const suggestions:
    string[] = [];

  const platformOnly =
    getPlatformSkillsMissingFromResume(
      context
    );

  if (
    platformOnly.length >
    0
  ) {
    suggestions.push(
      `Consider adding genuine projects that demonstrate InterviewIQ-validated skills currently missing from the CV, especially ${platformOnly
        .slice(
          0,
          5
        )
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )}.`
    );
  }

  if (
    context.template
      ?.projectPatterns
      .length
  ) {
    suggestions.push(
      `For ${context.template.displayName} roles, strong project evidence commonly includes areas such as ${context.template.projectPatterns
        .slice(
          0,
          6
        )
        .join(
          ", "
        )}. Include only projects you actually completed.`
    );
  }

  suggestions.push(
    "For each project, state what you built or analyzed, the technologies or methods you actually used, your contribution, and the outcome."
  );

  suggestions.push(
    "Do not create fictional projects only to match the vacancy. Use real academic, personal, freelance, open-source, laboratory, or professional work."
  );

  return uniqueStrings(
    suggestions
  );
};

const buildAtsSuggestions = (
  context:
    ICVEvidenceContext,
  recommendedKeywords:
    string[]
): string[] => {
  const suggestions:
    string[] = [];

  suggestions.push(
    `Use the exact target title "${context.job.title}" naturally in the professional summary when it accurately represents the position being targeted.`
  );

  if (
    recommendedKeywords.length >
    0
  ) {
    suggestions.push(
      `Naturally incorporate supported keywords such as ${recommendedKeywords
        .slice(
          0,
          10
        )
        .join(
          ", "
        )} across the summary, skills, projects, or experience sections.`
    );
  }

  const missingSkills =
    getMissingJobSkills(
      context
    );

  if (
    missingSkills.length >
    0
  ) {
    suggestions.push(
      `Do not add unverified skills simply to improve ATS matching. Skills such as ${missingSkills
        .slice(
          0,
          8
        )
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )} should appear only after you genuinely develop or demonstrate them.`
    );
  }

  suggestions.push(
    "Use standard ATS-readable section headings such as Professional Summary, Technical Skills, Experience, Projects, Education, and Certifications."
  );

  suggestions.push(
    "Keep important information as normal text rather than embedding it inside images, charts, icons, or decorative graphics."
  );

  suggestions.push(
    "Keep technical terminology consistent with the target vacancy while preserving truthful descriptions of your actual background."
  );

  if (
    context.resume
      .atsSuggestions
      .length >
    0
  ) {
    suggestions.push(
      ...context.resume
        .atsSuggestions
    );
  }

  if (
    context.template
      ?.formattingRules
      .length
  ) {
    suggestions.push(
      ...context.template
        .formattingRules
    );
  }

  return uniqueStrings(
    suggestions
  );
};

const buildFormattingSuggestions = (
  context:
    ICVEvidenceContext
): string[] => {
  const suggestions =
    [
      ...context.resume
        .formattingFeedback,
    ];

  if (
    context.template
  ) {
    suggestions.push(
      ...context.template
        .formattingRules
    );
  }

  suggestions.push(
    "Keep typography, spacing, dates, section headings, and bullet formatting consistent throughout the CV."
  );

  return uniqueStrings(
    suggestions
  );
};

const buildPriorityActions = (
  context:
    ICVEvidenceContext
): ICVOptimizationResult["priorityActions"] => {
  const actions:
    ICVOptimizationResult["priorityActions"] =
      [];

  const platformMissingFromResume =
    getPlatformSkillsMissingFromResume(
      context
    ).filter(
      (skill) =>
        skill.requiredByJob
    );

  const trulyMissing =
    getMissingJobSkills(
      context
    );

  if (
    platformMissingFromResume
      .length >
    0
  ) {
    actions.push({
      priority:
        "high",

      title:
        "Surface verified skills",

      description:
        `InterviewIQ has evidence that you know ${platformMissingFromResume
          .slice(
            0,
            6
          )
          .map(
            (skill) =>
              skill.name
          )
          .join(
            ", "
          )}, but these skills are not currently visible in your CV. Add them only in ways that accurately reflect your real experience or projects.`,
    });
  }

  if (
    context.match
      .breakdown
      .keywords <
    70
  ) {
    actions.push({
      priority:
        "high",

      title:
        "Improve keyword alignment",

      description:
        "Use more supported terminology from the target vacancy throughout the summary, skills, projects, and experience sections.",
    });
  }

  if (
    context.match
      .breakdown
      .experience <
    70
  ) {
    actions.push({
      priority:
        "high",

      title:
        "Strengthen experience evidence",

      description:
        "Rewrite and reorder experience so the strongest evidence related to the target role appears first.",
    });
  }

  if (
    trulyMissing.length >
    0
  ) {
    actions.push({
      priority:
        "medium",

      title:
        "Develop missing skills",

      description:
        `The vacancy includes skills for which InterviewIQ currently has no supporting evidence: ${trulyMissing
          .slice(
            0,
            6
          )
          .map(
            (skill) =>
              skill.name
          )
          .join(
            ", "
          )}. Treat these as learning gaps rather than automatically adding them to the CV.`,
    });
  }

  if (
    context.match
      .breakdown
      .education <
    70
  ) {
    actions.push({
      priority:
        "medium",

      title:
        "Clarify relevant education",

      description:
        "Make relevant education, certifications, coursework, bootcamps, and technical training easier for recruiters and ATS systems to identify.",
    });
  }

  actions.push({
    priority:
      "medium",

    title:
      "Tailor your professional summary",

    description:
      `Align the summary with the ${context.job.title} role using only skills and strengths supported by your CV or InterviewIQ evidence.`,
  });

  actions.push({
    priority:
      "low",

    title:
      "Improve ATS structure",

    description:
      "Keep headings, dates, skill terminology, and formatting simple, consistent, and ATS-readable.",
  });

  return actions;
};

const buildSectionsToImprove = (
  context:
    ICVEvidenceContext,
  suggestedSummary:
    string,
  suggestedSkills:
    string[],
  experienceSuggestions:
    string[],
  projectSuggestions:
    string[],
  atsSuggestions:
    string[]
): ICVOptimizationResult["sectionsToImprove"] => {
  const summaryScore =
    clampScore(
      (
        context.match
          .breakdown
          .keywords +
        context.match
          .breakdown
          .skills
      ) / 2
    );

  const projectScore =
    clampScore(
      (
        context.match
          .breakdown
          .skills +
        context.match
          .breakdown
          .experience
      ) / 2
    );

  return [
    {
      section:
        "summary",

      score:
        summaryScore,

      status:
        getSectionStatus(
          summaryScore
        ),

      suggestions: [
        suggestedSummary,
      ],
    },

    {
      section:
        "skills",

      score:
        context.match
          .breakdown
          .skills,

      status:
        getSectionStatus(
          context.match
            .breakdown
            .skills
        ),

      suggestions:
        suggestedSkills.length >
        0
          ? [
              `Prioritize supported and role-relevant skills such as ${suggestedSkills
                .slice(
                  0,
                  10
                )
                .join(
                  ", "
                )}.`,
            ]
          : [
              "No additional verified role-specific skills are currently available to recommend.",
            ],
    },

    {
      section:
        "experience",

      score:
        context.match
          .breakdown
          .experience,

      status:
        getSectionStatus(
          context.match
            .breakdown
            .experience
        ),

      suggestions:
        experienceSuggestions,
    },

    {
      section:
        "projects",

      score:
        projectScore,

      status:
        getSectionStatus(
          projectScore
        ),

      suggestions:
        projectSuggestions,
    },

    {
      section:
        "keywords",

      score:
        context.match
          .breakdown
          .keywords,

      status:
        getSectionStatus(
          context.match
            .breakdown
            .keywords
        ),

      suggestions:
        recommendedKeywordSectionSuggestions(
          context
        ),
    },

    {
      section:
        "education",

      score:
        context.match
          .breakdown
          .education,

      status:
        getSectionStatus(
          context.match
            .breakdown
            .education
        ),

      suggestions:
        context.match
          .breakdown
          .education <
        70
          ? [
              "Make relevant education, coursework, certifications, and technical training more visible.",
            ]
          : [
              "Your education profile aligns reasonably well with the vacancy.",
            ],
    },

    {
      section:
        "ats",

      score:
        context.resume
          .atsScore,

      status:
        getSectionStatus(
          context.resume
            .atsScore
        ),

      suggestions:
        atsSuggestions,
    },
  ];
};

const recommendedKeywordSectionSuggestions = (
  context:
    ICVEvidenceContext
): string[] => {
  const safeKeywords =
    getSafeKeywordsForCV(
      context
    )
      .filter(
        (keyword) =>
          keyword.requiredByJob
      )
      .map(
        (keyword) =>
          keyword.keyword
      );

  if (
    safeKeywords.length >
    0
  ) {
    return [
      `Improve natural keyword coverage using supported terms such as ${safeKeywords
        .slice(
          0,
          10
        )
        .join(
          ", "
        )}.`,
    ];
  }

  return [
    "No additional verified target-job keywords are currently available to recommend.",
  ];
};

export const optimizeCVForJob =
  async ({
    userId,
    resume,
    job,
  }: OptimizeCVParams): Promise<ICVOptimizationResult> => {
    const context =
      await buildCVEvidenceContext({
        userId,
        resume,
        job,
      });

    const recommendedKeywords =
      buildRecommendedKeywords(
        context
      );

    const suggestedSkills =
      buildSuggestedSkills(
        context
      );

    const suggestedProfessionalSummary =
      buildProfessionalSummary(
        context
      );

    const experienceSuggestions =
      buildExperienceSuggestions(
        context
      );

    const projectSuggestions =
      buildProjectSuggestions(
        context
      );

    const atsSuggestions =
      buildAtsSuggestions(
        context,
        recommendedKeywords
      );

    const formattingSuggestions =
      buildFormattingSuggestions(
        context
      );

    const priorityActions =
      buildPriorityActions(
        context
      );

    const sectionsToImprove =
      buildSectionsToImprove(
        context,
        suggestedProfessionalSummary,
        suggestedSkills,
        experienceSuggestions,
        projectSuggestions,
        atsSuggestions
      );

    const platformVerifiedSkills =
      uniqueStrings(
        context.platformSkills.map(
          (skill) =>
            skill.name
        )
      );

    const platformSkillsMissingFromResume =
      uniqueStrings(
        getPlatformSkillsMissingFromResume(
          context
        ).map(
          (skill) =>
            skill.name
        )
      );

    const safeSkillsForCV =
      uniqueStrings(
        getSafeSkillsForCV(
          context
        ).map(
          (skill) =>
            skill.name
        )
      );

    const trulyMissingSkills =
      uniqueStrings(
        getMissingJobSkills(
          context
        ).map(
          (skill) =>
            skill.name
        )
      );

    return {
      mode:
        "job-targeted",

      currentResumeScore:
        context.resume
          .overallScore,

      currentJobMatchScore:
        context.match
          .matchScore,

      targetJob: {
        id:
          context.job.id,

        title:
          context.job.title,

        company:
          context.job.company,
      },

      matchLevel:
        context.match
          .matchLevel,

      templateUsed:
        context.template
          ? {
              id:
                context.template
                  .id,

              role:
                context.template
                  .role,

              displayName:
                context.template
                  .displayName,

              matchScore:
                context.template
                  .score,

              reasons:
                context.template
                  .reasons,
            }
          : null,

      matchedSkills:
        context.match
          .matchedSkills,

      missingSkills:
        trulyMissingSkills,

      platformVerifiedSkills,

      platformSkillsMissingFromResume,

      safeSkillsForCV,

      recommendedKeywords,

      suggestedSkills,

      suggestedProfessionalSummary,

      experienceSuggestions,

      projectSuggestions,

      atsSuggestions,

      formattingSuggestions,

      priorityActions,

      sectionsToImprove,

      evidenceSummary:
        context.evidenceSummary,

      disclaimer:
        "InterviewIQ uses the existing CV, target vacancy, platform-validated skill evidence, and professional reference templates to recommend improvements. Skills, experience, projects, certifications, achievements, or metrics must never be fabricated.",
    };
  };

/* =========================================================
   GENERAL CV OPTIMIZATION

   Vacancy is optional. This path never creates a synthetic
   IJob. It uses only the uploaded resume analysis plus
   InterviewIQ-validated skill evidence.
========================================================= */

export const optimizeCVGenerally =
  async ({
    userId,
    resume,
  }: {
    userId:
    | Types.ObjectId
    | string;

    resume:
    IResumeAnalysis;
  }): Promise<ICVOptimizationResult> => {
    const context =
      await buildGeneralCVEvidenceContext({
        userId,
        resume,
      });

    const safeSkills =
      getSafeSkillsForGeneralCV(
        context
      );

    const platformSkillsMissingFromResume =
      getPlatformSkillsMissingFromResumeGeneral(
        context
      );

    const safeSkillNames =
      uniqueStrings(
        safeSkills.map(
          (skill) =>
            skill.name
        )
      );

    const verifiedSkillNames =
      uniqueStrings(
        context.platformSkills.map(
          (skill) =>
            skill.name
        )
      );

    const verifiedMissingNames =
      uniqueStrings(
        platformSkillsMissingFromResume.map(
          (skill) =>
            skill.name
        )
      );

    const strongestSkills =
      uniqueStrings([
        ...safeSkills
          .filter(
            (skill) =>
              skill.validatedByPlatform
          )
          .sort(
            (
              a,
              b
            ) =>
              (
                b.averageScore ||
                0
              ) -
              (
                a.averageScore ||
                0
              )
          )
          .map(
            (skill) =>
              skill.name
          ),

        ...(resume.skillsDetected ??
          []),
      ]).slice(
        0,
        6
      );

    const suggestedProfessionalSummary =
      strongestSkills.length > 0
        ? `Professional with demonstrated strengths in ${strongestSkills.join(
            ", "
          )}. Focused on practical problem-solving, continuous learning, clear communication, and presenting proven technical experience effectively.`
        : "Motivated professional focused on practical problem-solving, continuous learning, clear communication, and presenting proven experience effectively.";

    const experienceSuggestions =
      uniqueStrings([
        "Preserve all factual employment history and strengthen only weak bullets.",
        "Use clear action verbs and explain the candidate's actual contribution, technologies used, and real outcomes when available.",
        "Move the strongest and most specific contributions higher within each experience entry.",
        "Do not invent employers, responsibilities, dates, clients, metrics, technologies, or achievements.",
      ]);

    const projectSuggestions =
      uniqueStrings([
        verifiedMissingNames.length > 0
          ? `InterviewIQ has verified skills not currently visible in the uploaded CV: ${verifiedMissingNames
              .slice(
                0,
                8
              )
              .join(
                ", "
              )}. Surface them only in existing real projects or sections where they can be represented truthfully.`
          : "",
        "For each real project, clearly state what was built, the candidate's contribution, technologies actually used, and the real outcome.",
        "Prioritize the strongest existing projects instead of creating fictional projects.",
        "Do not invent project metrics, users, clients, technologies, responsibilities, or results.",
      ]);

    const atsSuggestions =
      uniqueStrings([
        ...(resume.atsSuggestions ??
          []),
        "Use standard ATS-readable headings such as Professional Summary, Technical Skills, Experience, Projects, Education, and Certifications.",
        "Keep important information as normal text instead of images, charts, icons, or decorative graphics.",
        "Use consistent technical terminology and include only skills or keywords supported by the resume or InterviewIQ evidence.",
      ]);

    const formattingSuggestions =
      uniqueStrings([
        ...(resume.formattingFeedback ??
          []),
        "Use consistent typography, spacing, dates, headings, and bullet formatting.",
        "Keep the document clean, professional, ATS-friendly, and limited to one or two pages when the available real content allows it.",
      ]);

    const priorityActions:
      ICVOptimizationResult["priorityActions"] =
      [];

    if (
      verifiedMissingNames.length >
      0
    ) {
      priorityActions.push({
        priority:
          "high",

        title:
          "Surface verified skills",

        description:
          `InterviewIQ has verified ${verifiedMissingNames
            .slice(
              0,
              8
            )
            .join(
              ", "
            )}. Add these only where they can be stated truthfully.`,
      });
    }

    if (
      resume.contentScore <
      80
    ) {
      priorityActions.push({
        priority:
          "high",

        title:
          "Strengthen content",

        description:
          "Improve weak summary, experience, and project wording while preserving factual information.",
      });
    }

    if (
      resume.atsScore <
      80
    ) {
      priorityActions.push({
        priority:
          "high",

        title:
          "Improve ATS readability",

        description:
          "Use standard headings, simple formatting, consistent terminology, and supported keywords.",
      });
    }

    if (
      resume.structureScore <
      80
    ) {
      priorityActions.push({
        priority:
          "medium",

        title:
          "Improve structure",

        description:
          "Reorder and format sections for clearer professional scanning without removing useful factual content.",
      });
    }

    priorityActions.push({
      priority:
        "medium",

      title:
        "Preserve strong sections",

      description:
        "Keep already strong factual content and avoid unnecessary rewriting that could reduce resume quality.",
    });

    const sectionsToImprove:
      ICVOptimizationResult["sectionsToImprove"] =
      [
        {
          section:
            "summary",

          score:
            resume.contentScore,

          status:
            getSectionStatus(
              resume.contentScore
            ),

          suggestions: [
            suggestedProfessionalSummary,
          ],
        },

        {
          section:
            "skills",

          score:
            resume.skillsScore,

          status:
            getSectionStatus(
              resume.skillsScore
            ),

          suggestions:
            safeSkillNames.length >
            0
              ? [
                  `Present supported skills clearly. Strong available evidence includes: ${safeSkillNames
                    .slice(
                      0,
                      12
                    )
                    .join(
                      ", "
                    )}.`,
                ]
              : [
                  "Keep only skills supported by the candidate's actual background.",
                ],
        },

        {
          section:
            "experience",

          score:
            resume.experienceScore,

          status:
            getSectionStatus(
              resume.experienceScore
            ),

          suggestions:
            experienceSuggestions,
        },

        {
          section:
            "projects",

          score:
            resume.contentScore,

          status:
            getSectionStatus(
              resume.contentScore
            ),

          suggestions:
            projectSuggestions,
        },

        {
          section:
            "keywords",

          score:
            resume.atsScore,

          status:
            getSectionStatus(
              resume.atsScore
            ),

          suggestions: [
            "Use supported technical terminology naturally throughout the CV without keyword stuffing.",
          ],
        },

        {
          section:
            "education",

          score:
            resume.structureScore,

          status:
            getSectionStatus(
              resume.structureScore
            ),

          suggestions: [
            "Keep real education, coursework, certifications, and training clear and easy to scan.",
          ],
        },

        {
          section:
            "ats",

          score:
            resume.atsScore,

          status:
            getSectionStatus(
              resume.atsScore
            ),

          suggestions:
            atsSuggestions,
        },
      ];

    return {
      mode:
        "general",

      currentResumeScore:
        resume.overallScore,

      currentJobMatchScore:
        0,

      targetJob:
        null,

      matchLevel:
        "partial",

      templateUsed:
        null,

      matchedSkills:
        [],

      missingSkills:
        [],

      platformVerifiedSkills:
        verifiedSkillNames,

      platformSkillsMissingFromResume:
        verifiedMissingNames,

      safeSkillsForCV:
        safeSkillNames,

      recommendedKeywords:
        [],

      suggestedSkills:
        safeSkillNames,

      suggestedProfessionalSummary,

      experienceSuggestions,

      projectSuggestions,

      atsSuggestions,

      formattingSuggestions,

      priorityActions,

      sectionsToImprove,

      evidenceSummary: {
        totalResumeSkills:
          context.evidenceSummary
            .totalResumeSkills,

        totalValidatedSkills:
          context.evidenceSummary
            .totalValidatedSkills,

        totalJobSkills:
          0,

        matchedJobSkills:
          0,

        missingJobSkills:
          0,

        platformSupportedJobSkills:
          0,

        templateRelevantSkills:
          0,
      },

      disclaimer:
        "General CV improvement does not require a vacancy. InterviewIQ uses the existing resume and platform-validated evidence only and must never fabricate skills, experience, projects, certifications, education, achievements, dates, employers, clients, or metrics.",
    };
  };
