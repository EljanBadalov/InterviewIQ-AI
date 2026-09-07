import {
  getCareerJobMatches,
  type ICareerJobMatchingResult,
} from "./careerJobContextService";

import {
  resolveCareerInterviewContext,
  type ICareerInterviewContext,
} from "./careerInterviewContextService";

import {
  resolveResumeContext,
  type ICareerResumeContext,
} from "./careerContextService";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerInterviewPrepInput {
  userId: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;
}

export interface ICareerInterviewPrepContext {
  resume?: ICareerResumeContext;

  previousInterview?:
    ICareerInterviewContext;

  jobMatches?:
    ICareerJobMatchingResult;

  selectedJob?: {
    id: string;

    title: string;

    company: string;

    matchScore: number;

    matchedSkills: string[];

    missingSkills: string[];

    improvementAreas: string[];
  };

  focusAreas: string[];

  strengthsToLeverage: string[];

  skillsToReview: string[];

  practicePriorities: string[];
}

export interface ICareerInterviewPrepResult {
  found: boolean;

  data?:
    ICareerInterviewPrepContext;

  reason?:
    | "INVALID_USER"
    | "RESUME_NOT_FOUND";
}

/* =========================================================
   HELPERS
========================================================= */

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
            value
              .trim()
        )
        .filter(
          Boolean
        )
    )
  );
};

/* =========================================================
   BUILD FOCUS AREAS
========================================================= */

const buildFocusAreas = (
  resume?: ICareerResumeContext,
  previousInterview?:
    ICareerInterviewContext,
  jobMatches?:
    ICareerJobMatchingResult
): string[] => {
  const result:
    string[] = [];

  /* ---------------------------------------------------------
     CV WEAKNESSES
  --------------------------------------------------------- */

  if (
    resume
  ) {
    result.push(
      ...resume.weaknesses
    );

    result.push(
      ...resume.missingSkills
        .map(
          (
            skill
          ) =>
            `Strengthen ${skill}`
        )
    );
  }

  /* ---------------------------------------------------------
     INTERVIEW IMPROVEMENTS
  --------------------------------------------------------- */

  if (
    previousInterview
  ) {
    result.push(
      ...previousInterview
        .finalReport
        .improvements
    );

    for (
      const answer
      of previousInterview.answers
    ) {
      result.push(
        ...answer.weaknesses
      );
    }
  }

  /* ---------------------------------------------------------
     JOB MATCH IMPROVEMENTS
  --------------------------------------------------------- */

  const bestMatch =
    jobMatches
      ?.bestMatch;

  if (
    bestMatch
  ) {
    result.push(
      ...bestMatch
        .match
        .improvementAreas
    );
  }

  return uniqueStrings(
    result
  ).slice(
    0,
    10
  );
};

/* =========================================================
   BUILD STRENGTHS TO LEVERAGE
========================================================= */

const buildStrengthsToLeverage = (
  resume?: ICareerResumeContext,
  previousInterview?:
    ICareerInterviewContext,
  jobMatches?:
    ICareerJobMatchingResult
): string[] => {
  const result:
    string[] = [];

  if (
    resume
  ) {
    result.push(
      ...resume.strengths
    );
  }

  if (
    previousInterview
  ) {
    result.push(
      ...previousInterview
        .finalReport
        .strengths
    );
  }

  if (
    jobMatches?.bestMatch
  ) {
    result.push(
      ...jobMatches
        .bestMatch
        .match
        .strengths
    );
  }

  return uniqueStrings(
    result
  ).slice(
    0,
    8
  );
};

/* =========================================================
   BUILD SKILLS TO REVIEW
========================================================= */

const buildSkillsToReview = (
  resume?: ICareerResumeContext,
  jobMatches?:
    ICareerJobMatchingResult
): string[] => {
  const result:
    string[] = [];

  if (
    resume
  ) {
    result.push(
      ...resume.missingSkills
    );
  }

  if (
    jobMatches?.bestMatch
  ) {
    result.push(
      ...jobMatches
        .bestMatch
        .match
        .missingSkills
    );

    result.push(
      ...jobMatches
        .bestMatch
        .match
        .missingKeywords
    );
  }

  return uniqueStrings(
    result
  ).slice(
    0,
    10
  );
};

/* =========================================================
   BUILD PRACTICE PRIORITIES
========================================================= */

const buildPracticePriorities = (
  previousInterview?:
    ICareerInterviewContext,
  jobMatches?:
    ICareerJobMatchingResult
): string[] => {
  const priorities:
    string[] = [];

  if (
    previousInterview
  ) {
    if (
      typeof previousInterview
        .averageTechnicalAccuracy ===
        "number" &&
      previousInterview
        .averageTechnicalAccuracy <
        75
    ) {
      priorities.push(
        "Practice technical accuracy with role-specific questions."
      );
    }

    if (
      typeof previousInterview
        .averageCompleteness ===
        "number" &&
      previousInterview
        .averageCompleteness <
        75
    ) {
      priorities.push(
        "Practice giving more complete and structured answers."
      );
    }

    if (
      typeof previousInterview
        .averageCommunication ===
        "number" &&
      previousInterview
        .averageCommunication <
        75
    ) {
      priorities.push(
        "Practice clearer and more concise communication."
      );
    }

    priorities.push(
      ...previousInterview
        .finalReport
        .recommendations
    );
  }

  if (
    jobMatches?.bestMatch
  ) {
    priorities.push(
      ...jobMatches
        .bestMatch
        .match
        .improvementAreas
    );
  }

  if (
    priorities.length ===
    0
  ) {
    priorities.push(
      "Review your strongest technical topics and practice explaining them clearly."
    );

    priorities.push(
      "Practice behavioral answers using a clear situation-action-result structure."
    );
  }

  return uniqueStrings(
    priorities
  ).slice(
    0,
    8
  );
};

/* =========================================================
   MAIN PREPARATION CONTEXT
========================================================= */

export const buildCareerInterviewPrepContext =
  async (
    input: ICareerInterviewPrepInput
  ): Promise<
    ICareerInterviewPrepResult
  > => {
    if (
      !input.userId
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER",
      };
    }

    /* =====================================================
       RESUME
    ===================================================== */

    const resumeResult =
      await resolveResumeContext({
        userId:
          input.userId,

        activeResumeId:
          input.activeResumeId,
      });

    if (
      !resumeResult.found ||
      !resumeResult.data
    ) {
      return {
        found:
          false,

        reason:
          "RESUME_NOT_FOUND",
      };
    }

    const resume =
      resumeResult.data;

    /* =====================================================
       PREVIOUS INTERVIEW

       Optional.
       No previous interview should NOT break preparation.
    ===================================================== */

    let previousInterview:
      ICareerInterviewContext | undefined;

    try {
      const interviewResult =
        await resolveCareerInterviewContext({
          userId:
            input.userId,

          activeInterviewId:
            input.activeInterviewId,
        });

      if (
        interviewResult.found &&
        interviewResult.data
      ) {
        previousInterview =
          interviewResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Interview Prep] Previous interview could not be loaded:",
        error
      );
    }

    /* =====================================================
       JOB MATCHES

       We use the user's strongest current matching role
       if a specific target role/job has not been selected.
    ===================================================== */

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    try {
      const result =
        await getCareerJobMatches({
          userId:
            input.userId,

          activeResumeId:
            resume.id,

          targetRole:
            input.targetRole,

          limit:
            3,
        });

      if (
        result.found
      ) {
        jobMatches =
          result;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Interview Prep] Job matching could not be loaded:",
        error
      );
    }

    /* =====================================================
       SELECTED / BEST JOB
    ===================================================== */

    const bestJob =
      jobMatches
        ?.bestMatch;

    const selectedJob =
      bestJob
        ? {
            id:
              bestJob.id,

            title:
              bestJob.title,

            company:
              bestJob.company,

            matchScore:
              bestJob
                .match
                .matchScore,

            matchedSkills:
              bestJob
                .match
                .matchedSkills,

            missingSkills:
              bestJob
                .match
                .missingSkills,

            improvementAreas:
              bestJob
                .match
                .improvementAreas,
          }
        : undefined;

    /* =====================================================
       BUILD CONTEXT
    ===================================================== */

    const focusAreas =
      buildFocusAreas(
        resume,
        previousInterview,
        jobMatches
      );

    const strengthsToLeverage =
      buildStrengthsToLeverage(
        resume,
        previousInterview,
        jobMatches
      );

    const skillsToReview =
      buildSkillsToReview(
        resume,
        jobMatches
      );

    const practicePriorities =
      buildPracticePriorities(
        previousInterview,
        jobMatches
      );

    return {
      found:
        true,

      data: {
        resume,

        previousInterview,

        jobMatches,

        selectedJob,

        focusAreas,

        strengthsToLeverage,

        skillsToReview,

        practicePriorities,
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerInterviewPrepReply =
  (
    context:
      ICareerInterviewPrepContext,
    targetRole?: string
  ): string => {
    const parts:
      string[] = [];

    /* =====================================================
       INTRO
    ===================================================== */

    if (
      context.selectedJob
    ) {
      parts.push(
        `For your next interview, I would prepare primarily for ${context.selectedJob.title} roles. Your CV currently has a ${context.selectedJob.matchScore}% match with ${context.selectedJob.company}'s ${context.selectedJob.title} position.`
      );
    } else if (
      targetRole
    ) {
      parts.push(
        `I'll focus your preparation on ${targetRole} interviews.`
      );
    } else {
      parts.push(
        "Based on your CV and existing InterviewIQ data, here is what I would prioritize for your next interview."
      );
    }

    /* =====================================================
       SKILLS
    ===================================================== */

    if (
      context.skillsToReview.length >
      0
    ) {
      parts.push(
        `Review these skills first: ${context.skillsToReview
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       PRACTICE PRIORITIES
    ===================================================== */

    if (
      context.practicePriorities.length >
      0
    ) {
      parts.push(
        `Your main practice priorities are: ${context.practicePriorities
          .slice(
            0,
            3
          )
          .join(
            " "
          )}`
      );
    }

    /* =====================================================
       STRENGTHS
    ===================================================== */

    if (
      context.strengthsToLeverage.length >
      0
    ) {
      parts.push(
        `You should also lean on these strengths: ${context.strengthsToLeverage
          .slice(
            0,
            3
          )
          .join(
            ", "
          )}.`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API DATA
========================================================= */

export const buildCareerInterviewPrepSummary =
  (
    context:
      ICareerInterviewPrepContext
  ): Record<
    string,
    unknown
  > => {
    return {
      selectedJob:
        context.selectedJob,

      focusAreas:
        context.focusAreas,

      strengthsToLeverage:
        context.strengthsToLeverage,

      skillsToReview:
        context.skillsToReview,

      practicePriorities:
        context.practicePriorities,

      resume: {
        id:
          context.resume?.id,

        overallScore:
          context.resume
            ?.overallScore,

        atsScore:
          context.resume
            ?.atsScore,

        skillsScore:
          context.resume
            ?.skillsScore,

        skills:
          context.resume
            ?.skillsDetected,
      },

      previousInterview:
        context.previousInterview
          ? {
              id:
                context
                  .previousInterview
                  .id,

              overallScore:
                context
                  .previousInterview
                  .overallScore,

              technicalAccuracy:
                context
                  .previousInterview
                  .averageTechnicalAccuracy,

              completeness:
                context
                  .previousInterview
                  .averageCompleteness,

              communication:
                context
                  .previousInterview
                  .averageCommunication,

              improvements:
                context
                  .previousInterview
                  .finalReport
                  .improvements,

              recommendations:
                context
                  .previousInterview
                  .finalReport
                  .recommendations,
            }
          : null,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerInterviewPrepContext,

  buildCareerInterviewPrepReply,

  buildCareerInterviewPrepSummary,
};