import {
  Types,
} from "mongoose";

import {
  ResumeAnalysis,
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  Interview,
  type IInterview,
  type IInterviewAnswer,
} from "../models/Interview";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerProgressDelta {
  previous?: number;

  current?: number;

  change?: number;

  direction:
    | "improved"
    | "declined"
    | "unchanged"
    | "unknown";
}

export interface ICareerResumeProgress {
  available: boolean;

  previousAnalysisId?: string;

  currentAnalysisId?: string;

  previousAnalyzedAt?: Date;

  currentAnalyzedAt?: Date;

  overallScore:
    ICareerProgressDelta;

  atsScore:
    ICareerProgressDelta;

  contentScore:
    ICareerProgressDelta;

  structureScore:
    ICareerProgressDelta;

  skillsScore:
    ICareerProgressDelta;

  experienceScore:
    ICareerProgressDelta;

  previousSkills: string[];

  currentSkills: string[];

  addedSkills: string[];

  removedSkills: string[];
}

export interface ICareerInterviewProgress {
  available: boolean;

  previousInterviewId?: string;

  currentInterviewId?: string;

  previousCompletedAt?: Date;

  currentCompletedAt?: Date;

  overallScore:
    ICareerProgressDelta;

  technicalAccuracy:
    ICareerProgressDelta;

  completeness:
    ICareerProgressDelta;

  communication:
    ICareerProgressDelta;
}

export interface ICareerProgressContext {
  resume:
    ICareerResumeProgress;

  interview:
    ICareerInterviewProgress;

  strongestImprovements:
    string[];

  areasToWatch:
    string[];

  highlights:
    string[];
}

export interface ICareerProgressResult {
  found: boolean;

  data?:
    ICareerProgressContext;

  reason?:
    | "INVALID_USER_ID"
    | "NO_PROGRESS_DATA";
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

const isValidObjectId = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return false;
  }

  return Types.ObjectId.isValid(
    normalized
  );
};

const roundMetric = (
  value: number
): number => {
  return Math.round(
    value
  );
};

const buildDelta = (
  previous:
    | number
    | undefined,
  current:
    | number
    | undefined
): ICareerProgressDelta => {
  if (
    typeof previous !==
      "number" ||
    typeof current !==
      "number"
  ) {
    return {
      previous,
      current,
      direction:
        "unknown",
    };
  }

  const change =
    roundMetric(
      current -
        previous
    );

  if (
    change >
    0
  ) {
    return {
      previous:
        roundMetric(
          previous
        ),

      current:
        roundMetric(
          current
        ),

      change,

      direction:
        "improved",
    };
  }

  if (
    change <
    0
  ) {
    return {
      previous:
        roundMetric(
          previous
        ),

      current:
        roundMetric(
          current
        ),

      change,

      direction:
        "declined",
    };
  }

  return {
    previous:
      roundMetric(
        previous
      ),

    current:
      roundMetric(
        current
      ),

    change:
      0,

    direction:
      "unchanged",
  };
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
            value
              .trim()
        )
        .filter(
          Boolean
        )
    )
  );
};

const normalizeSkill = (
  value: string
): string => {
  return value
    .trim()
    .toLowerCase();
};

const averageNumbers = (
  values: Array<
    number | undefined
  >
): number | undefined => {
  const valid =
    values.filter(
      (
        value
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(
          value
        )
    );

  if (
    valid.length ===
    0
  ) {
    return undefined;
  }

  const total =
    valid.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  return roundMetric(
    total /
      valid.length
  );
};

/* =========================================================
   INTERVIEW METRICS
========================================================= */

const getInterviewMetricAverage = (
  answers:
    IInterviewAnswer[],
  field:
    | "technicalAccuracy"
    | "completeness"
    | "communication"
): number | undefined => {
  return averageNumbers(
    answers.map(
      (
        answer
      ) =>
        answer[
          field
        ]
    )
  );
};

/* =========================================================
   RESUME PROGRESS
========================================================= */

const buildResumeProgress = (
  analyses:
    IResumeAnalysis[]
): ICareerResumeProgress => {
  if (
    analyses.length ===
    0
  ) {
    return {
      available:
        false,

      overallScore:
        buildDelta(
          undefined,
          undefined
        ),

      atsScore:
        buildDelta(
          undefined,
          undefined
        ),

      contentScore:
        buildDelta(
          undefined,
          undefined
        ),

      structureScore:
        buildDelta(
          undefined,
          undefined
        ),

      skillsScore:
        buildDelta(
          undefined,
          undefined
        ),

      experienceScore:
        buildDelta(
          undefined,
          undefined
        ),

      previousSkills:
        [],

      currentSkills:
        [],

      addedSkills:
        [],

      removedSkills:
        [],
    };
  }

  const current =
    analyses[0];

  const previous =
    analyses[1];

  const currentSkills =
    uniqueStrings(
      current
        ?.skillsDetected ??
        []
    );

  const previousSkills =
    uniqueStrings(
      previous
        ?.skillsDetected ??
        []
    );

  const currentMap =
    new Map(
      currentSkills.map(
        (
          skill
        ) => [
          normalizeSkill(
            skill
          ),
          skill,
        ]
      )
    );

  const previousMap =
    new Map(
      previousSkills.map(
        (
          skill
        ) => [
          normalizeSkill(
            skill
          ),
          skill,
        ]
      )
    );

  const addedSkills =
    currentSkills.filter(
      (
        skill
      ) =>
        !previousMap.has(
          normalizeSkill(
            skill
          )
        )
    );

  const removedSkills =
    previousSkills.filter(
      (
        skill
      ) =>
        !currentMap.has(
          normalizeSkill(
            skill
          )
        )
    );

  return {
    available:
      Boolean(
        current
      ),

    previousAnalysisId:
      previous?._id
        ? String(
            previous._id
          )
        : undefined,

    currentAnalysisId:
      current?._id
        ? String(
            current._id
          )
        : undefined,

    previousAnalyzedAt:
      previous
        ?.createdAt,

    currentAnalyzedAt:
      current
        ?.createdAt,

    overallScore:
      buildDelta(
        previous
          ?.overallScore,
        current
          ?.overallScore
      ),

    atsScore:
      buildDelta(
        previous
          ?.atsScore,
        current
          ?.atsScore
      ),

    contentScore:
      buildDelta(
        previous
          ?.contentScore,
        current
          ?.contentScore
      ),

    structureScore:
      buildDelta(
        previous
          ?.structureScore,
        current
          ?.structureScore
      ),

    skillsScore:
      buildDelta(
        previous
          ?.skillsScore,
        current
          ?.skillsScore
      ),

    experienceScore:
      buildDelta(
        previous
          ?.experienceScore,
        current
          ?.experienceScore
      ),

    previousSkills,

    currentSkills,

    addedSkills,

    removedSkills,
  };
};

/* =========================================================
   INTERVIEW PROGRESS
========================================================= */

const buildInterviewProgress = (
  interviews:
    IInterview[]
): ICareerInterviewProgress => {
  if (
    interviews.length ===
    0
  ) {
    return {
      available:
        false,

      overallScore:
        buildDelta(
          undefined,
          undefined
        ),

      technicalAccuracy:
        buildDelta(
          undefined,
          undefined
        ),

      completeness:
        buildDelta(
          undefined,
          undefined
        ),

      communication:
        buildDelta(
          undefined,
          undefined
        ),
    };
  }

  const current =
    interviews[0];

  const previous =
    interviews[1];

  const currentAnswers =
    current
      ?.answers ??
      [];

  const previousAnswers =
    previous
      ?.answers ??
      [];

  const currentTechnical =
    getInterviewMetricAverage(
      currentAnswers,
      "technicalAccuracy"
    );

  const previousTechnical =
    getInterviewMetricAverage(
      previousAnswers,
      "technicalAccuracy"
    );

  const currentCompleteness =
    getInterviewMetricAverage(
      currentAnswers,
      "completeness"
    );

  const previousCompleteness =
    getInterviewMetricAverage(
      previousAnswers,
      "completeness"
    );

  const currentCommunication =
    getInterviewMetricAverage(
      currentAnswers,
      "communication"
    );

  const previousCommunication =
    getInterviewMetricAverage(
      previousAnswers,
      "communication"
    );

  return {
    available:
      Boolean(
        current
      ),

    previousInterviewId:
      previous?._id
        ? String(
            previous._id
          )
        : undefined,

    currentInterviewId:
      current?._id
        ? String(
            current._id
          )
        : undefined,

    previousCompletedAt:
      previous
        ?.completedAt,

    currentCompletedAt:
      current
        ?.completedAt,

    overallScore:
      buildDelta(
        previous
          ?.overallScore,
        current
          ?.overallScore
      ),

    technicalAccuracy:
      buildDelta(
        previousTechnical,
        currentTechnical
      ),

    completeness:
      buildDelta(
        previousCompleteness,
        currentCompleteness
      ),

    communication:
      buildDelta(
        previousCommunication,
        currentCommunication
      ),
  };
};

/* =========================================================
   PROGRESS INSIGHTS
========================================================= */

const buildProgressInsights = (
  resume:
    ICareerResumeProgress,
  interview:
    ICareerInterviewProgress
): {
  strongestImprovements:
    string[];

  areasToWatch:
    string[];

  highlights:
    string[];
} => {
  const strongestImprovements:
    string[] = [];

  const areasToWatch:
    string[] = [];

  const highlights:
    string[] = [];

  /* =====================================================
     RESUME
  ===================================================== */

  const resumeMetrics = [
    {
      label:
        "CV overall score",

      metric:
        resume.overallScore,
    },

    {
      label:
        "ATS score",

      metric:
        resume.atsScore,
    },

    {
      label:
        "CV content score",

      metric:
        resume.contentScore,
    },

    {
      label:
        "CV structure score",

      metric:
        resume.structureScore,
    },

    {
      label:
        "CV skills score",

      metric:
        resume.skillsScore,
    },

    {
      label:
        "CV experience score",

      metric:
        resume.experienceScore,
    },
  ];

  for (
    const item
    of resumeMetrics
  ) {
    if (
      item.metric.direction ===
        "improved" &&
      typeof item.metric.change ===
        "number"
    ) {
      strongestImprovements.push(
        `${item.label} improved by ${item.metric.change} points.`
      );
    }

    if (
      item.metric.direction ===
        "declined" &&
      typeof item.metric.change ===
        "number"
    ) {
      areasToWatch.push(
        `${item.label} decreased by ${Math.abs(
          item.metric.change
        )} points.`
      );
    }
  }

  if (
    resume.addedSkills.length >
    0
  ) {
    highlights.push(
      `New skills detected in your latest CV: ${resume.addedSkills
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
     INTERVIEW
  ===================================================== */

  const interviewMetrics = [
    {
      label:
        "Interview score",

      metric:
        interview.overallScore,
    },

    {
      label:
        "Technical accuracy",

      metric:
        interview.technicalAccuracy,
    },

    {
      label:
        "Answer completeness",

      metric:
        interview.completeness,
    },

    {
      label:
        "Communication",

      metric:
        interview.communication,
    },
  ];

  for (
    const item
    of interviewMetrics
  ) {
    if (
      item.metric.direction ===
        "improved" &&
      typeof item.metric.change ===
        "number"
    ) {
      strongestImprovements.push(
        `${item.label} improved by ${item.metric.change} points.`
      );
    }

    if (
      item.metric.direction ===
        "declined" &&
      typeof item.metric.change ===
        "number"
    ) {
      areasToWatch.push(
        `${item.label} decreased by ${Math.abs(
          item.metric.change
        )} points.`
      );
    }
  }

  /* =====================================================
     SORT BIGGEST CHANGES FIRST
  ===================================================== */

  const improvementScore = (
    value: string
  ): number => {
    const match =
      value.match(
        /(\d+)\s+points/
      );

    if (
      !match
    ) {
      return 0;
    }

    return Number(
      match[1]
    );
  };

  strongestImprovements.sort(
    (
      a,
      b
    ) =>
      improvementScore(
        b
      ) -
      improvementScore(
        a
      )
  );

  return {
    strongestImprovements:
      strongestImprovements.slice(
        0,
        5
      ),

    areasToWatch:
      areasToWatch.slice(
        0,
        5
      ),

    highlights:
      highlights.slice(
        0,
        5
      ),
  };
};

/* =========================================================
   MAIN PROGRESS CONTEXT
========================================================= */

export const buildCareerProgressContext =
  async (
    userId: string
  ): Promise<
    ICareerProgressResult
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER_ID",
      };
    }

    const objectId =
      new Types.ObjectId(
        normalizedUserId
      );

    /* =====================================================
       LOAD LAST TWO RESUME ANALYSES
    ===================================================== */

    const resumeAnalyses =
      await ResumeAnalysis
        .find({
          user:
            objectId,
        })
        .sort({
          createdAt:
            -1,
        })
        .limit(
          2
        )
        .lean<IResumeAnalysis[]>()
        .exec();

    /* =====================================================
       LOAD LAST TWO COMPLETED INTERVIEWS
    ===================================================== */

    const interviews =
      await Interview
        .find({
          user:
            objectId,

          status:
            "completed",
        })
        .sort({
          completedAt:
            -1,

          createdAt:
            -1,
        })
        .limit(
          2
        )
        .lean<IInterview[]>()
        .exec();

    if (
      resumeAnalyses.length ===
        0 &&
      interviews.length ===
        0
    ) {
      return {
        found:
          false,

        reason:
          "NO_PROGRESS_DATA",
      };
    }

    const resume =
      buildResumeProgress(
        resumeAnalyses
      );

    const interview =
      buildInterviewProgress(
        interviews
      );

    const insights =
      buildProgressInsights(
        resume,
        interview
      );

    return {
      found:
        true,

      data: {
        resume,

        interview,

        strongestImprovements:
          insights
            .strongestImprovements,

        areasToWatch:
          insights
            .areasToWatch,

        highlights:
          insights.highlights,
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerProgressReply =
  (
    context:
      ICareerProgressContext
  ): string => {
    const parts:
      string[] = [];

    /* =====================================================
       CV
    ===================================================== */

    if (
      context.resume.available
    ) {
      const overall =
        context.resume
          .overallScore;

      if (
        typeof overall.previous ===
          "number" &&
        typeof overall.current ===
          "number"
      ) {
        if (
          overall.direction ===
            "improved"
        ) {
          parts.push(
            `Your CV overall score improved from ${overall.previous} to ${overall.current}, a gain of ${overall.change} points.`
          );
        } else if (
          overall.direction ===
            "declined"
        ) {
          parts.push(
            `Your CV overall score changed from ${overall.previous} to ${overall.current}, a decrease of ${Math.abs(
              overall.change ??
                0
            )} points.`
          );
        } else {
          parts.push(
            `Your CV overall score is currently ${overall.current}/100 and has not changed from the previous analysis.`
          );
        }
      } else if (
        typeof overall.current ===
        "number"
      ) {
        parts.push(
          `Your latest CV overall score is ${overall.current}/100. I need another CV analysis before I can measure the trend.`
        );
      }

      const ats =
        context.resume
          .atsScore;

      if (
        typeof ats.previous ===
          "number" &&
        typeof ats.current ===
          "number" &&
        ats.direction !==
          "unchanged"
      ) {
        parts.push(
          ats.direction ===
          "improved"
            ? `Your ATS score improved from ${ats.previous} to ${ats.current}.`
            : `Your ATS score decreased from ${ats.previous} to ${ats.current}.`
        );
      }
    }

    /* =====================================================
       INTERVIEW
    ===================================================== */

    if (
      context.interview.available
    ) {
      const score =
        context.interview
          .overallScore;

      if (
        typeof score.previous ===
          "number" &&
        typeof score.current ===
          "number"
      ) {
        if (
          score.direction ===
            "improved"
        ) {
          parts.push(
            `Your interview score improved from ${score.previous} to ${score.current}, a gain of ${score.change} points.`
          );
        } else if (
          score.direction ===
            "declined"
        ) {
          parts.push(
            `Your interview score changed from ${score.previous} to ${score.current}, a decrease of ${Math.abs(
              score.change ??
                0
            )} points.`
          );
        } else {
          parts.push(
            `Your latest interview score is ${score.current}/100 and is unchanged from your previous completed interview.`
          );
        }
      } else if (
        typeof score.current ===
        "number"
      ) {
        parts.push(
          `Your latest completed interview score is ${score.current}/100. I need another completed interview before I can measure the trend.`
        );
      }
    }

    /* =====================================================
       STRONGEST IMPROVEMENTS
    ===================================================== */

    if (
      context
        .strongestImprovements
        .length >
      0
    ) {
      parts.push(
        `Your strongest recent improvements are: ${context.strongestImprovements
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
       AREAS TO WATCH
    ===================================================== */

    if (
      context
        .areasToWatch
        .length >
      0
    ) {
      parts.push(
        `Areas to watch: ${context.areasToWatch
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
       HIGHLIGHTS
    ===================================================== */

    if (
      context.highlights
        .length >
      0
    ) {
      parts.push(
        context.highlights
          .slice(
            0,
            2
          )
          .join(
            " "
          )
      );
    }

    if (
      parts.length ===
      0
    ) {
      return "I found career activity for your account, but there is not enough historical data yet to calculate meaningful progress trends.";
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerProgressSummary =
  (
    context:
      ICareerProgressContext
  ): Record<
    string,
    unknown
  > => {
    return {
      resume: {
        available:
          context.resume
            .available,

        previousAnalysisId:
          context.resume
            .previousAnalysisId,

        currentAnalysisId:
          context.resume
            .currentAnalysisId,

        overallScore:
          context.resume
            .overallScore,

        atsScore:
          context.resume
            .atsScore,

        contentScore:
          context.resume
            .contentScore,

        structureScore:
          context.resume
            .structureScore,

        skillsScore:
          context.resume
            .skillsScore,

        experienceScore:
          context.resume
            .experienceScore,

        addedSkills:
          context.resume
            .addedSkills,

        removedSkills:
          context.resume
            .removedSkills,
      },

      interview: {
        available:
          context.interview
            .available,

        previousInterviewId:
          context.interview
            .previousInterviewId,

        currentInterviewId:
          context.interview
            .currentInterviewId,

        overallScore:
          context.interview
            .overallScore,

        technicalAccuracy:
          context.interview
            .technicalAccuracy,

        completeness:
          context.interview
            .completeness,

        communication:
          context.interview
            .communication,
      },

      strongestImprovements:
        context
          .strongestImprovements,

      areasToWatch:
        context
          .areasToWatch,

      highlights:
        context.highlights,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerProgressContext,

  buildCareerProgressReply,

  buildCareerProgressSummary,
};