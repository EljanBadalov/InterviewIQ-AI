import {
  resolveResumeContext,
  type ICareerResumeContext,
} from "./careerContextService";

import {
  getCareerJobMatches,
  type ICareerJobMatchingResult,
} from "./careerJobContextService";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerJobSearchStrategy {
  targetRole?: string;

  recommendedTitles: string[];

  recommendedKeywords: string[];

  prioritySkills: string[];

  strongestMatchedSkills: string[];

  bestMatchScore?: number;

  bestMatchJobId?: string;

  bestMatchTitle?: string;

  bestMatchCompany?: string;

  suggestedApproach: string[];

  searchQueries: string[];
}

export interface ICareerJobSearchHelpContext {
  resume?: ICareerResumeContext;

  jobMatches?: ICareerJobMatchingResult;

  targetRole?: string;

  strategy:
    ICareerJobSearchStrategy;
}

export interface ICareerJobSearchHelpResult {
  found: boolean;

  data?:
    ICareerJobSearchHelpContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "RESUME_NOT_FOUND"
    | "NO_JOB_DATA";
}

export interface ICareerJobSearchHelpInput {
  userId?: string;

  activeResumeId?: string;

  targetRole?: string;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value:
    | string
    | undefined
    | null
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized ||
    undefined;
};

const uniqueStrings = (
  values: string[]
): string[] => {
  return Array.from(
    new Set(
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
    )
  );
};

/* =========================================================
   RECOMMENDED TITLES
========================================================= */

const buildRecommendedTitles = (
  targetRole: string | undefined,
  jobMatches:
    ICareerJobMatchingResult | undefined
): string[] => {
  const titles:
    string[] = [];

  if (
    targetRole
  ) {
    titles.push(
      targetRole
    );
  }

  if (
    jobMatches?.matchedJobs
  ) {
    for (
      const job
      of jobMatches.matchedJobs
    ) {
      titles.push(
        job.title
      );
    }
  }

  return uniqueStrings(
    titles
  ).slice(
    0,
    8
  );
};

/* =========================================================
   STRONGEST MATCHED SKILLS
========================================================= */

const buildStrongestMatchedSkills = (
  jobMatches:
    ICareerJobMatchingResult | undefined
): string[] => {
  if (
    !jobMatches?.matchedJobs
  ) {
    return [];
  }

  const skills:
    string[] = [];

  for (
    const job
    of jobMatches.matchedJobs
      .slice(
        0,
        5
      )
  ) {
    skills.push(
      ...job.match
        .matchedSkills
    );
  }

  return uniqueStrings(
    skills
  ).slice(
    0,
    10
  );
};

/* =========================================================
   PRIORITY SKILLS
========================================================= */

const buildPrioritySkills = (
  resume:
    ICareerResumeContext | undefined,
  jobMatches:
    ICareerJobMatchingResult | undefined
): string[] => {
  const skills:
    string[] = [];

  if (
    resume
  ) {
    skills.push(
      ...resume.missingSkills
    );
  }

  if (
    jobMatches?.matchedJobs
  ) {
    for (
      const job
      of jobMatches.matchedJobs
        .slice(
          0,
          5
        )
    ) {
      skills.push(
        ...job.match
          .missingSkills
      );
    }
  }

  return uniqueStrings(
    skills
  ).slice(
    0,
    10
  );
};

/* =========================================================
   RECOMMENDED KEYWORDS
========================================================= */

const buildRecommendedKeywords = (
  targetRole: string | undefined,
  resume:
    ICareerResumeContext | undefined,
  jobMatches:
    ICareerJobMatchingResult | undefined
): string[] => {
  const keywords:
    string[] = [];

  if (
    targetRole
  ) {
    keywords.push(
      targetRole
    );
  }

  if (
    resume
  ) {
    keywords.push(
      ...resume.skillsDetected
    );
  }

  if (
    jobMatches?.matchedJobs
  ) {
    for (
      const job
      of jobMatches.matchedJobs.slice(
        0,
        3
      )
    ) {
      keywords.push(
        ...job.match.matchedSkills
      );
    }
  }

  return uniqueStrings(
    keywords
  ).slice(
    0,
    12
  );
};

/* =========================================================
   SEARCH QUERIES
========================================================= */

const buildSearchQueries = (
  targetRole: string | undefined,
  recommendedTitles:
    string[],
  strongestMatchedSkills:
    string[]
): string[] => {
  const queries:
    string[] = [];

  const role =
    targetRole ||
    recommendedTitles[0];

  if (
    role
  ) {
    queries.push(
      role
    );

    queries.push(
      `Junior ${role}`
    );

    queries.push(
      `${role} internship`
    );

    queries.push(
      `${role} remote`
    );
  }

  if (
    role &&
    strongestMatchedSkills
      .length >
      0
  ) {
    queries.push(
      `${role} ${strongestMatchedSkills
        .slice(
          0,
          3
        )
        .join(
          " "
        )}`
    );
  }

  return uniqueStrings(
    queries
  ).slice(
    0,
    6
  );
};

/* =========================================================
   SEARCH APPROACH
========================================================= */

const buildSuggestedApproach = (
  resume:
    ICareerResumeContext | undefined,
  jobMatches:
    ICareerJobMatchingResult | undefined,
  prioritySkills:
    string[]
): string[] => {
  const approach:
    string[] = [];

  if (
    jobMatches?.bestMatch
  ) {
    approach.push(
      `Start with roles similar to ${jobMatches.bestMatch.title}, because your current best match is ${jobMatches.bestMatch.match.matchScore}%.`
    );
  }

  if (
    resume &&
    resume.atsScore <
      70
  ) {
    approach.push(
      `Tailor your CV for each role because your current ATS score is ${resume.atsScore}/100.`
    );
  }

  if (
    prioritySkills.length >
    0
  ) {
    approach.push(
      `Prioritize roles where your existing strengths are already useful while improving ${prioritySkills
        .slice(
          0,
          3
        )
        .join(
          ", "
        )}.`
    );
  }

  approach.push(
    "Apply first to roles with the highest skill overlap instead of sending the same CV to every vacancy."
  );

  approach.push(
    "Use job-title variations and skill combinations when searching so you do not miss relevant openings."
  );

  return uniqueStrings(
    approach
  ).slice(
    0,
    6
  );
};

/* =========================================================
   MAIN CONTEXT
========================================================= */

export const buildCareerJobSearchHelpContext =
  async (
    input:
      ICareerJobSearchHelpInput
  ): Promise<
    ICareerJobSearchHelpResult
  > => {
    const userId =
      normalizeString(
        input.userId
      );

    const targetRole =
      normalizeString(
        input.targetRole
      );

    if (
      !userId
    ) {
      return {
        found:
          false,

        reason:
          "USER_ID_REQUIRED",
      };
    }

    let resume:
      ICareerResumeContext | undefined;

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    /* =====================================================
       RESUME
    ===================================================== */

    try {
      const resumeResult =
        await resolveResumeContext({
          userId,

          activeResumeId:
            input.activeResumeId,
        });

      if (
        resumeResult.found &&
        resumeResult.data
      ) {
        resume =
          resumeResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Job Search Help] Resume context failed:",
        error
      );
    }

    if (
      !resume
    ) {
      return {
        found:
          false,

        reason:
          "RESUME_NOT_FOUND",
      };
    }

    /* =====================================================
       JOB MATCHING
    ===================================================== */

    try {
      const jobResult =
        await getCareerJobMatches({
          userId,

          activeResumeId:
            resume.id,

          targetRole,

          limit:
            8,
        });

      if (
        jobResult.found
      ) {
        jobMatches =
          jobResult;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Job Search Help] Job matching failed:",
        error
      );
    }

    if (
      !jobMatches ||
      jobMatches.matchedJobs.length ===
        0
    ) {
      return {
        found:
          false,

        reason:
          "NO_JOB_DATA",
      };
    }

    /* =====================================================
       STRATEGY
    ===================================================== */

    const recommendedTitles =
      buildRecommendedTitles(
        targetRole,
        jobMatches
      );

    const strongestMatchedSkills =
      buildStrongestMatchedSkills(
        jobMatches
      );

    const prioritySkills =
      buildPrioritySkills(
        resume,
        jobMatches
      );

    const recommendedKeywords =
      buildRecommendedKeywords(
        targetRole,
        resume,
        jobMatches
      );

    const searchQueries =
      buildSearchQueries(
        targetRole,
        recommendedTitles,
        strongestMatchedSkills
      );

    const suggestedApproach =
      buildSuggestedApproach(
        resume,
        jobMatches,
        prioritySkills
      );

    return {
      found:
        true,

      data: {
        resume,

        jobMatches,

        targetRole,

        strategy: {
          targetRole,

          recommendedTitles,

          recommendedKeywords,

          prioritySkills,

          strongestMatchedSkills,

          bestMatchScore:
            jobMatches
              .bestMatch
              ?.match
              .matchScore,

          bestMatchJobId:
            jobMatches
              .bestMatch
              ?.id,

          bestMatchTitle:
            jobMatches
              .bestMatch
              ?.title,

          bestMatchCompany:
            jobMatches
              .bestMatch
              ?.company,

          suggestedApproach,

          searchQueries,
        },
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerJobSearchHelpReply =
  (
    context:
      ICareerJobSearchHelpContext
  ): string => {
    const parts:
      string[] = [];

    const strategy =
      context.strategy;

    if (
      strategy.bestMatchTitle &&
      strategy.bestMatchCompany &&
      typeof strategy.bestMatchScore ===
        "number"
    ) {
      parts.push(
        `Your strongest current direction is ${strategy.bestMatchTitle}-type roles. Your best active match is ${strategy.bestMatchTitle} at ${strategy.bestMatchCompany} with a ${strategy.bestMatchScore}% match.`
      );
    }

    if (
      strategy.recommendedTitles
        .length >
      0
    ) {
      parts.push(
        `I would focus your search on titles such as ${strategy.recommendedTitles
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`
      );
    }

    if (
      strategy.strongestMatchedSkills
        .length >
      0
    ) {
      parts.push(
        `Your strongest search keywords are ${strategy.strongestMatchedSkills
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
      strategy.prioritySkills
        .length >
      0
    ) {
      parts.push(
        `Skills worth strengthening while you search include ${strategy.prioritySkills
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`
      );
    }

    if (
      strategy.suggestedApproach
        .length >
      0
    ) {
      parts.push(
        `My recommended search approach: ${strategy.suggestedApproach
          .slice(
            0,
            3
          )
          .join(
            " "
          )}`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerJobSearchHelpSummary =
  (
    context:
      ICareerJobSearchHelpContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      bestMatch:
        context.jobMatches
          ?.bestMatch
        ? {
            id:
              context.jobMatches
                .bestMatch
                ?.id,

            title:
              context.jobMatches
                .bestMatch
                ?.title,

            company:
              context.jobMatches
                .bestMatch
                ?.company,

            matchScore:
              context.jobMatches
                .bestMatch
                ?.match
                .matchScore,

            matchedSkills:
              context.jobMatches
                .bestMatch
                ?.match
                .matchedSkills,

            missingSkills:
              context.jobMatches
                .bestMatch
                ?.match
                .missingSkills,
          }
        : null,

      recommendedTitles:
        context.strategy
          .recommendedTitles,

      recommendedKeywords:
        context.strategy
          .recommendedKeywords,

      strongestMatchedSkills:
        context.strategy
          .strongestMatchedSkills,

      prioritySkills:
        context.strategy
          .prioritySkills,

      searchQueries:
        context.strategy
          .searchQueries,

      suggestedApproach:
        context.strategy
          .suggestedApproach,

      totalMatchedJobs:
        context.jobMatches
          ?.matchedJobs
          .length ??
        0,

      topJobs:
        context.jobMatches
          ?.matchedJobs
          .slice(
            0,
            5
          )
          .map(
            (
              job
            ) => ({
              id:
                job.id,

              title:
                job.title,

              company:
                job.company,

              location:
                job.location,

              remoteType:
                job.remoteType,

              employmentType:
                job.employmentType,

              experienceLevel:
                job.experienceLevel,

              matchScore:
                job.match
                  .matchScore,

              matchLevel:
                job.match
                  .matchLevel,

              matchedSkills:
                job.match
                  .matchedSkills,

              missingSkills:
                job.match
                  .missingSkills,
            })
          ) ??
        [],
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerJobSearchHelpContext,

  buildCareerJobSearchHelpReply,

  buildCareerJobSearchHelpSummary,
};