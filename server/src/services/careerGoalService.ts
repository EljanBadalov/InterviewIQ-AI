import {
  resolveResumeContext,
  type ICareerResumeContext,
} from "./careerContextService";

import {
  getCareerJobMatches,
  type ICareerJobMatchingResult,
} from "./careerJobContextService";

import {
  resolveCareerInterviewContext,
  type ICareerInterviewContext,
} from "./careerInterviewContextService";

import {
  buildCareerProgressContext,
  type ICareerProgressContext,
} from "./careerProgressService";

/* =========================================================
   TYPES
========================================================= */

export type CareerGoalReadinessLevel =
  | "very_high"
  | "high"
  | "moderate"
  | "developing"
  | "early";

export type CareerGoalStatus =
  | "well_aligned"
  | "realistic_with_improvements"
  | "needs_development"
  | "insufficient_data";

export type CareerGoalPriority =
  | "high"
  | "medium"
  | "low";

export interface ICareerGoalGap {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  priority:
    CareerGoalPriority;

  title: string;

  description: string;

  reason: string;

  score?: number;
}

export interface ICareerGoalStrength {
  category:
    | "CV"
    | "SKILL"
    | "JOB"
    | "INTERVIEW"
    | "PROGRESS";

  title: string;

  description: string;

  score?: number;
}

export interface ICareerGoalMilestone {
  order: number;

  title: string;

  description: string;

  completed: boolean;
}

export interface ICareerGoalContext {
  targetRole?: string;

  careerGoal?: string;

  readinessScore: number;

  readinessLevel:
    CareerGoalReadinessLevel;

  status:
    CareerGoalStatus;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;

  strengths:
    ICareerGoalStrength[];

  gaps:
    ICareerGoalGap[];

  milestones:
    ICareerGoalMilestone[];

  summary: string;
}

export interface ICareerGoalResult {
  found: boolean;

  data?:
    ICareerGoalContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "TARGET_ROLE_REQUIRED"
    | "NO_CAREER_DATA";
}

export interface ICareerGoalInput {
  userId?: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;
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

const clamp = (
  value: number,
  min = 0,
  max = 100
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const round = (
  value: number
): number => {
  return Math.round(
    value
  );
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
   READINESS LEVEL
========================================================= */

const getReadinessLevel = (
  score: number
): CareerGoalReadinessLevel => {
  if (
    score >= 90
  ) {
    return "very_high";
  }

  if (
    score >= 80
  ) {
    return "high";
  }

  if (
    score >= 65
  ) {
    return "moderate";
  }

  if (
    score >= 50
  ) {
    return "developing";
  }

  return "early";
};

/* =========================================================
   GOAL STATUS
========================================================= */

const getGoalStatus = (
  score: number,
  hasData: boolean
): CareerGoalStatus => {
  if (
    !hasData
  ) {
    return "insufficient_data";
  }

  if (
    score >= 80
  ) {
    return "well_aligned";
  }

  if (
    score >= 60
  ) {
    return "realistic_with_improvements";
  }

  return "needs_development";
};

/* =========================================================
   RESUME READINESS
========================================================= */

const calculateResumeReadiness = (
  resume?: ICareerResumeContext
): number | undefined => {
  if (
    !resume
  ) {
    return undefined;
  }

  const score =
    (
      resume.overallScore *
        0.25
    ) +
    (
      resume.atsScore *
        0.20
    ) +
    (
      resume.skillsScore *
        0.20
    ) +
    (
      resume.experienceScore *
        0.20
    ) +
    (
      resume.contentScore *
        0.10
    ) +
    (
      resume.structureScore *
        0.05
    );

  return round(
    clamp(
      score
    )
  );
};

/* =========================================================
   JOB READINESS
========================================================= */

const calculateJobReadiness = (
  jobMatches?:
    ICareerJobMatchingResult
): number | undefined => {
  if (
    !jobMatches?.found ||
    !jobMatches.bestMatch
  ) {
    return undefined;
  }

  return round(
    clamp(
      jobMatches
        .bestMatch
        .match
        .matchScore
    )
  );
};

/* =========================================================
   INTERVIEW READINESS
========================================================= */

const calculateInterviewReadiness = (
  interview?:
    ICareerInterviewContext
): number | undefined => {
  if (
    !interview
  ) {
    return undefined;
  }

  const values:
    number[] = [];

  if (
    typeof interview.overallScore ===
    "number"
  ) {
    values.push(
      interview.overallScore
    );
  }

  if (
    typeof interview
      .averageTechnicalAccuracy ===
    "number"
  ) {
    values.push(
      interview
        .averageTechnicalAccuracy
    );
  }

  if (
    typeof interview
      .averageCompleteness ===
    "number"
  ) {
    values.push(
      interview
        .averageCompleteness
    );
  }

  if (
    typeof interview
      .averageCommunication ===
    "number"
  ) {
    values.push(
      interview
        .averageCommunication
    );
  }

  if (
    values.length ===
    0
  ) {
    return undefined;
  }

  const average =
    values.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
    values.length;

  return round(
    clamp(
      average
    )
  );
};

/* =========================================================
   PROGRESS READINESS ADJUSTMENT
========================================================= */

const calculateProgressAdjustment = (
  progress?:
    ICareerProgressContext
): number => {
  if (
    !progress
  ) {
    return 0;
  }

  let adjustment =
    0;

  const metrics = [
    progress.resume
      .overallScore,

    progress.resume
      .atsScore,

    progress.resume
      .skillsScore,

    progress.interview
      .overallScore,

    progress.interview
      .technicalAccuracy,

    progress.interview
      .communication,
  ];

  for (
    const metric
    of metrics
  ) {
    if (
      metric.direction ===
      "improved"
    ) {
      adjustment +=
        1;
    }

    if (
      metric.direction ===
      "declined"
    ) {
      adjustment -=
        1;
    }
  }

  return clamp(
    adjustment,
    -5,
    5
  );
};

/* =========================================================
   TOTAL READINESS SCORE
========================================================= */

const calculateReadinessScore = ({
  resume,
  jobMatches,
  interview,
  progress,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;
}): number => {
  const resumeScore =
    calculateResumeReadiness(
      resume
    );

  const jobScore =
    calculateJobReadiness(
      jobMatches
    );

  const interviewScore =
    calculateInterviewReadiness(
      interview
    );

  const weightedValues: Array<{
    score: number;
    weight: number;
  }> = [];

  if (
    typeof resumeScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        resumeScore,

      weight:
        0.35,
    });
  }

  if (
    typeof jobScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        jobScore,

      weight:
        0.40,
    });
  }

  if (
    typeof interviewScore ===
    "number"
  ) {
    weightedValues.push({
      score:
        interviewScore,

      weight:
        0.25,
    });
  }

  if (
    weightedValues.length ===
    0
  ) {
    return 0;
  }

  const totalWeight =
    weightedValues.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.weight,
      0
    );

  const weightedScore =
    weightedValues.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          item.score *
          item.weight
        ),
      0
    ) /
    totalWeight;

  const progressAdjustment =
    calculateProgressAdjustment(
      progress
    );

  return round(
    clamp(
      weightedScore +
        progressAdjustment
    )
  );
};

/* =========================================================
   BUILD STRENGTHS
========================================================= */

const buildGoalStrengths = ({
  resume,
  jobMatches,
  interview,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;
}): ICareerGoalStrength[] => {
  const strengths:
    ICareerGoalStrength[] = [];

  /* =====================================================
     CV
  ===================================================== */

  if (
    resume
  ) {
    if (
      resume.experienceScore >=
      75
    ) {
      strengths.push({
        category:
          "CV",

        title:
          "Relevant experience profile",

        description:
          `Your experience score is ${resume.experienceScore}/100, which supports your target role readiness.`,

        score:
          resume.experienceScore,
      });
    }

    if (
      resume.skillsScore >=
      70
    ) {
      strengths.push({
        category:
          "SKILL",

        title:
          "Solid technical skill base",

        description:
          `Your current CV skills score is ${resume.skillsScore}/100.`,

        score:
          resume.skillsScore,
      });
    }

    if (
      resume.skillsDetected
        .length >
      0
    ) {
      strengths.push({
        category:
          "SKILL",

        title:
          "Detected technical skills",

        description:
          `Your CV currently highlights ${resume.skillsDetected
            .slice(
              0,
              6
            )
            .join(
              ", "
            )}.`,
      });
    }
  }

  /* =====================================================
     JOB MATCH
  ===================================================== */

  if (
    jobMatches?.bestMatch
  ) {
    const best =
      jobMatches.bestMatch;

    if (
      best.match.matchScore >=
      75
    ) {
      strengths.push({
        category:
          "JOB",

        title:
          "Strong job-market alignment",

        description:
          `Your strongest active match is ${best.title} at ${best.company} with a ${best.match.matchScore}% match.`,

        score:
          best.match
            .matchScore,
      });
    }

    if (
      best.match
        .matchedSkills
        .length >
      0
    ) {
      strengths.push({
        category:
          "JOB",

        title:
          "Skills already aligned with jobs",

        description:
          `Your strongest job match recognizes skills including ${best.match.matchedSkills
            .slice(
              0,
              5
            )
            .join(
              ", "
            )}.`,
      });
    }
  }

  /* =====================================================
     INTERVIEW
  ===================================================== */

  if (
    interview
  ) {
    if (
      typeof interview
        .overallScore ===
        "number" &&
      interview.overallScore >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong interview performance",

        description:
          `Your latest completed interview score is ${interview.overallScore}/100.`,

        score:
          interview.overallScore,
      });
    }

    if (
      typeof interview
        .averageCommunication ===
        "number" &&
      interview
        .averageCommunication >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong communication",

        description:
          `Your average interview communication score is ${interview.averageCommunication}/100.`,

        score:
          interview
            .averageCommunication,
      });
    }

    if (
      typeof interview
        .averageTechnicalAccuracy ===
        "number" &&
      interview
        .averageTechnicalAccuracy >=
        80
    ) {
      strengths.push({
        category:
          "INTERVIEW",

        title:
          "Strong technical interview accuracy",

        description:
          `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100.`,

        score:
          interview
            .averageTechnicalAccuracy,
      });
    }
  }

  return strengths.slice(
    0,
    8
  );
};

/* =========================================================
   BUILD GAPS
========================================================= */

const buildGoalGaps = ({
  resume,
  jobMatches,
  interview,
  progress,
}: {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;
}): ICareerGoalGap[] => {
  const gaps:
    ICareerGoalGap[] = [];

  /* =====================================================
     CV ATS
  ===================================================== */

  if (
    resume &&
    resume.atsScore <
    70
  ) {
    gaps.push({
      category:
        "CV",

      priority:
        resume.atsScore <
        60
          ? "high"
          : "medium",

      title:
        "ATS readiness needs improvement",

      description:
        `Your current ATS score is ${resume.atsScore}/100.`,

      reason:
        "Improving ATS alignment can make your CV more competitive for target-role applications.",

      score:
        resume.atsScore,
    });
  }

  /* =====================================================
     CV STRUCTURE
  ===================================================== */

  if (
    resume &&
    resume.structureScore <
    70
  ) {
    gaps.push({
      category:
        "CV",

      priority:
        "medium",

      title:
        "CV structure can be stronger",

      description:
        `Your current CV structure score is ${resume.structureScore}/100.`,

      reason:
        "Better structure improves readability and ATS compatibility.",

      score:
        resume.structureScore,
    });
  }

  /* =====================================================
     RESUME MISSING SKILLS
  ===================================================== */

  if (
    resume &&
    resume.missingSkills.length >
      0
  ) {
    gaps.push({
      category:
        "SKILL",

      priority:
        "high",

      title:
        "Close CV skill gaps",

      description:
        `Your CV analysis identified these possible missing skills: ${resume.missingSkills
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "Skill gaps can reduce job matching quality.",
    });
  }

  /* =====================================================
     JOB MISSING SKILLS
  ===================================================== */

  if (
    jobMatches?.bestMatch &&
    jobMatches
      .bestMatch
      .match
      .missingSkills
      .length >
      0
  ) {
    const missing =
      uniqueStrings(
        jobMatches
          .bestMatch
          .match
          .missingSkills
      );

    gaps.push({
      category:
        "JOB",

      priority:
        "high",

      title:
        "Close target-job skill gaps",

      description:
        `For your strongest current job match, focus on ${missing
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "These skills are relevant to the job but are not strongly represented in your current CV.",
    });
  }

  /* =====================================================
     JOB IMPROVEMENT AREAS
  ===================================================== */

  if (
    jobMatches?.bestMatch &&
    jobMatches
      .bestMatch
      .match
      .improvementAreas
      .length >
      0
  ) {
    gaps.push({
      category:
        "JOB",

      priority:
        "medium",

      title:
        "Improve target-job alignment",

      description:
        jobMatches
          .bestMatch
          .match
          .improvementAreas[0],

      reason:
        "Improving this area can increase your compatibility with similar roles.",
    });
  }

  /* =====================================================
     INTERVIEW TECHNICAL
  ===================================================== */

  if (
    interview &&
    typeof interview
      .averageTechnicalAccuracy ===
      "number" &&
    interview
      .averageTechnicalAccuracy <
      75
  ) {
    gaps.push({
      category:
        "INTERVIEW",

      priority:
        "high",

      title:
        "Improve technical interview accuracy",

      description:
        `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100.`,

      reason:
        "Technical accuracy is important for reaching your target role.",

      score:
        interview
          .averageTechnicalAccuracy,
    });
  }

  /* =====================================================
     INTERVIEW COMMUNICATION
  ===================================================== */

  if (
    interview &&
    typeof interview
      .averageCommunication ===
      "number" &&
    interview
      .averageCommunication <
      75
  ) {
    gaps.push({
      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Improve interview communication",

      description:
        `Your average communication score is ${interview.averageCommunication}/100.`,

      reason:
        "Clear communication helps turn technical knowledge into stronger interview performance.",

      score:
        interview
          .averageCommunication,
    });
  }

  /* =====================================================
     PROGRESS
  ===================================================== */

  if (
    progress
  ) {
    if (
      progress.resume
        .atsScore
        .direction ===
        "declined" &&
      typeof progress.resume
        .atsScore
        .change ===
        "number"
    ) {
      gaps.push({
        category:
          "PROGRESS",

        priority:
          Math.abs(
            progress.resume
              .atsScore
              .change
          ) >= 15
            ? "high"
            : "medium",

        title:
          "Reverse the recent ATS decline",

        description:
          `Your ATS score decreased by ${Math.abs(
            progress.resume
              .atsScore
              .change
          )} points between your last two CV analyses.`,

        reason:
          "This negative trend could reduce application effectiveness.",

        score:
          progress.resume
            .atsScore
            .current,
      });
    }
  }

  const priorityWeight = (
    priority:
      CareerGoalPriority
  ): number => {
    switch (priority) {
      case "high":
        return 3;

      case "medium":
        return 2;

      case "low":
        return 1;

      default:
        return 0;
    }
  };

  return gaps
    .sort(
      (
        a,
        b
      ) =>
        priorityWeight(
          b.priority
        ) -
        priorityWeight(
          a.priority
        )
    )
    .slice(
      0,
      8
    );
};

/* =========================================================
   BUILD MILESTONES
========================================================= */

const buildGoalMilestones = ({
  targetRole,
  resume,
  jobMatches,
  interview,
}: {
  targetRole: string;

  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;
}): ICareerGoalMilestone[] => {
  const bestMatch =
    jobMatches?.bestMatch;

  const resumeReady =
    Boolean(
      resume &&
      resume.overallScore >=
        75 &&
      resume.atsScore >=
        70
    );

  const skillReady =
    Boolean(
      resume &&
      resume.skillsScore >=
        75
    );

  const jobReady =
    Boolean(
      bestMatch &&
      bestMatch.match
        .matchScore >=
        80
    );

  const interviewReady =
    Boolean(
      interview &&
      typeof interview
        .overallScore ===
        "number" &&
      interview.overallScore >=
        80
    );

  return [
    {
      order:
        1,

      title:
        "Build a target-role-ready CV",

      description:
        `Optimize your CV specifically for ${targetRole} opportunities and maintain strong ATS compatibility.`,

      completed:
        resumeReady,
    },

    {
      order:
        2,

      title:
        "Close critical skill gaps",

      description:
        `Strengthen the technical skills most frequently required for ${targetRole} roles.`,

      completed:
        skillReady,
    },

    {
      order:
        3,

      title:
        "Reach strong job-match readiness",

      description:
        `Aim for at least an 80% match with relevant ${targetRole} opportunities.`,

      completed:
        jobReady,
    },

    {
      order:
        4,

      title:
        "Demonstrate interview readiness",

      description:
        "Maintain strong technical accuracy, completeness, and communication during mock interviews.",

      completed:
        interviewReady,
    },

    {
      order:
        5,

      title:
        "Apply strategically",

      description:
        `Prioritize ${targetRole} opportunities where your skills and experience already align strongly.`,

      completed:
        false,
    },
  ];
};

/* =========================================================
   BUILD SUMMARY
========================================================= */

const buildGoalSummary = ({
  targetRole,
  readinessScore,
  status,
  jobMatches,
  gaps,
}: {
  targetRole: string;

  readinessScore: number;

  status:
    CareerGoalStatus;

  jobMatches?:
    ICareerJobMatchingResult;

  gaps:
    ICareerGoalGap[];
}): string => {
  const bestMatch =
    jobMatches?.bestMatch;

  if (
    status ===
    "well_aligned"
  ) {
    return bestMatch
      ? `Your current profile is strongly aligned with a ${targetRole} goal. Your readiness score is ${readinessScore}/100, and your strongest current job match is ${bestMatch.title} at ${bestMatch.company} with a ${bestMatch.match.matchScore}% match.`
      : `Your current profile is strongly aligned with a ${targetRole} goal, with a readiness score of ${readinessScore}/100.`;
  }

  if (
    status ===
    "realistic_with_improvements"
  ) {
    const priorityGap =
      gaps[0];

    return priorityGap
      ? `Becoming a ${targetRole} is realistic based on your current InterviewIQ data. Your readiness score is ${readinessScore}/100. Your highest-priority improvement is: ${priorityGap.title}.`
      : `Becoming a ${targetRole} is realistic based on your current InterviewIQ data. Your readiness score is ${readinessScore}/100.`;
  }

  if (
    status ===
    "needs_development"
  ) {
    return `A ${targetRole} goal is possible, but your current readiness score is ${readinessScore}/100, so I would strengthen your CV, target-role skills, and interview readiness before making it your primary application focus.`;
  }

  return `I need more InterviewIQ data before I can reliably evaluate your readiness for ${targetRole}.`;
};

/* =========================================================
   MAIN CAREER GOAL CONTEXT
========================================================= */

export const buildCareerGoalContext =
  async (
    input:
      ICareerGoalInput
  ): Promise<
    ICareerGoalResult
  > => {
    const userId =
      normalizeString(
        input.userId
      );

    const targetRole =
      normalizeString(
        input.targetRole
      );

    const careerGoal =
      normalizeString(
        input.careerGoal
      );

    /* =====================================================
       VALIDATION
    ===================================================== */

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

    if (
      !targetRole
    ) {
      return {
        found:
          false,

        reason:
          "TARGET_ROLE_REQUIRED",
      };
    }

    let resume:
      ICareerResumeContext | undefined;

    let jobMatches:
      ICareerJobMatchingResult | undefined;

    let interview:
      ICareerInterviewContext | undefined;

    let progress:
      ICareerProgressContext | undefined;

    /* =====================================================
       RESUME
    ===================================================== */

    try {
      const result =
        await resolveResumeContext({
          userId,

          activeResumeId:
            input.activeResumeId,
        });

      if (
        result.found &&
        result.data
      ) {
        resume =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Resume context failed:",
        error
      );
    }

    /* =====================================================
       JOB MATCHING
    ===================================================== */

    if (
      resume
    ) {
      try {
        const result =
          await getCareerJobMatches({
            userId,

            activeResumeId:
              resume.id,

            targetRole,

            limit:
              5,
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
          "[Career Goal] Job matching failed:",
          error
        );
      }
    }

    /* =====================================================
       INTERVIEW
    ===================================================== */

    try {
      const result =
        await resolveCareerInterviewContext({
          userId,

          activeInterviewId:
            input.activeInterviewId,
        });

      if (
        result.found &&
        result.data
      ) {
        interview =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Interview context failed:",
        error
      );
    }

    /* =====================================================
       PROGRESS
    ===================================================== */

    try {
      const result =
        await buildCareerProgressContext(
          userId
        );

      if (
        result.found &&
        result.data
      ) {
        progress =
          result.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Goal] Progress context failed:",
        error
      );
    }

    /* =====================================================
       NO DATA
    ===================================================== */

    if (
      !resume &&
      !jobMatches &&
      !interview &&
      !progress
    ) {
      return {
        found:
          false,

        reason:
          "NO_CAREER_DATA",
      };
    }

    /* =====================================================
       SCORE
    ===================================================== */

    const readinessScore =
      calculateReadinessScore({
        resume,
        jobMatches,
        interview,
        progress,
      });

    const readinessLevel =
      getReadinessLevel(
        readinessScore
      );

    const status =
      getGoalStatus(
        readinessScore,
        true
      );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    const strengths =
      buildGoalStrengths({
        resume,
        jobMatches,
        interview,
      });

    /* =====================================================
       GAPS
    ===================================================== */

    const gaps =
      buildGoalGaps({
        resume,
        jobMatches,
        interview,
        progress,
      });

    /* =====================================================
       MILESTONES
    ===================================================== */

    const milestones =
      buildGoalMilestones({
        targetRole,
        resume,
        jobMatches,
        interview,
      });

    /* =====================================================
       SUMMARY
    ===================================================== */

    const summary =
      buildGoalSummary({
        targetRole,
        readinessScore,
        status,
        jobMatches,
        gaps,
      });

    return {
      found:
        true,

      data: {
        targetRole,

        careerGoal,

        readinessScore,

        readinessLevel,

        status,

        resume,

        jobMatches,

        interview,

        progress,

        strengths,

        gaps,

        milestones,

        summary,
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerGoalReply =
  (
    context:
      ICareerGoalContext
  ): string => {
    const parts:
      string[] = [];

    parts.push(
      context.summary
    );

    /* =====================================================
       STRENGTHS
    ===================================================== */

    if (
      context.strengths.length >
      0
    ) {
      parts.push(
        `Your strongest readiness signals are: ${context.strengths
          .slice(
            0,
            3
          )
          .map(
            (
              strength
            ) =>
              strength.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       GAPS
    ===================================================== */

    if (
      context.gaps.length >
      0
    ) {
      parts.push(
        `Your top areas to improve are: ${context.gaps
          .slice(
            0,
            3
          )
          .map(
            (
              gap
            ) =>
              gap.title
          )
          .join(
            ", "
          )}.`
      );
    }

    /* =====================================================
       NEXT MILESTONE
    ===================================================== */

    const nextMilestone =
      context.milestones.find(
        (
          milestone
        ) =>
          !milestone.completed
      );

    if (
      nextMilestone
    ) {
      parts.push(
        `Your next milestone should be: ${nextMilestone.title}. ${nextMilestone.description}`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerGoalSummary =
  (
    context:
      ICareerGoalContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      careerGoal:
        context.careerGoal,

      readinessScore:
        context.readinessScore,

      readinessLevel:
        context.readinessLevel,

      status:
        context.status,

      summary:
        context.summary,

      strengths:
        context.strengths,

      gaps:
        context.gaps,

      milestones:
        context.milestones,

      sources: {
        resume:
          Boolean(
            context.resume
          ),

        jobs:
          Boolean(
            context.jobMatches
          ),

        interview:
          Boolean(
            context.interview
          ),

        progress:
          Boolean(
            context.progress
          ),
      },

      bestJobMatch:
        context.jobMatches
          ?.bestMatch
        ? {
            id:
              context
                .jobMatches
                .bestMatch
                ?.id,

            title:
              context
                .jobMatches
                .bestMatch
                ?.title,

            company:
              context
                .jobMatches
                .bestMatch
                ?.company,

            matchScore:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchScore,

            matchedSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .matchedSkills,

            missingSkills:
              context
                .jobMatches
                .bestMatch
                ?.match
                .missingSkills,
          }
        : null,

      resumeReadiness:
        context.resume
        ? {
            overallScore:
              context.resume
                .overallScore,

            atsScore:
              context.resume
                .atsScore,

            skillsScore:
              context.resume
                .skillsScore,

            experienceScore:
              context.resume
                .experienceScore,
          }
        : null,

      interviewReadiness:
        context.interview
        ? {
            overallScore:
              context.interview
                .overallScore,

            technicalAccuracy:
              context.interview
                .averageTechnicalAccuracy,

            completeness:
              context.interview
                .averageCompleteness,

            communication:
              context.interview
                .averageCommunication,
          }
        : null,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerGoalContext,

  buildCareerGoalReply,

  buildCareerGoalSummary,
};