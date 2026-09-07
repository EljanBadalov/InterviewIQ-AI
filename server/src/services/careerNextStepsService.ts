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

export type CareerNextStepCategory =
  | "CV"
  | "JOB"
  | "INTERVIEW"
  | "SKILL"
  | "PROGRESS"
  | "CAREER";

export type CareerNextStepPriority =
  | "high"
  | "medium"
  | "low";

export interface ICareerNextStep {
  id: string;

  category:
    CareerNextStepCategory;

  priority:
    CareerNextStepPriority;

  title: string;

  description: string;

  reason: string;

  score?: number;

  resourceId?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICareerNextStepsContext {
  resume?:
    ICareerResumeContext;

  jobMatches?:
    ICareerJobMatchingResult;

  interview?:
    ICareerInterviewContext;

  progress?:
    ICareerProgressContext;

  targetRole?: string;

  careerGoal?: string;

  contextIntent?: string;

  userMessage?: string;

  contextualMode?: string;

  steps:
    ICareerNextStep[];

  topStep?:
    ICareerNextStep;
}

export interface ICareerNextStepsResult {
  found: boolean;

  data?:
    ICareerNextStepsContext;

  reason?:
    | "USER_ID_REQUIRED"
    | "NO_CAREER_DATA";
}

export interface ICareerNextStepsInput {
  userId?: string;

  activeResumeId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  contextIntent?: string;

  userMessage?: string;
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
            item
          ) =>
            item
              .trim()
        )
        .filter(
          Boolean
        )
    )
  );
};

const createStepId = (
  category:
    CareerNextStepCategory,
  key: string
): string => {
  return `${category.toLowerCase()}-${key
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )}`;
};

const priorityWeight = (
  priority:
    CareerNextStepPriority
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


/* =========================================================
   CONTEXTUAL FOLLOW-UP HELPERS
========================================================= */

const CONTEXTUAL_JOB_INTENTS =
  new Set<string>([
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "SKILL_GAP",
  ]);

const CONTEXTUAL_CV_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
  ]);

const CONTEXTUAL_INTERVIEW_INTENTS =
  new Set<string>([
    "INTERVIEW_FEEDBACK",
    "INTERVIEW_PREP",
  ]);

const isRoadmapOrImprovementRequest = (
  message?: string
): boolean => {
  const normalized =
    normalizeString(
      message
    )
      ?.toLowerCase();

  if (
    !normalized
  ) {
    return false;
  }

  return (
    /\broad\s*map\b/i.test(
      normalized
    ) ||
    /\broadmap\b/i.test(
      normalized
    ) ||
    /\bstep[- ]by[- ]step\b/i.test(
      normalized
    ) ||
    /\baction plan\b/i.test(
      normalized
    ) ||
    /\blearning plan\b/i.test(
      normalized
    ) ||
    /\bimprovement plan\b/i.test(
      normalized
    ) ||
    /\bhow can i improve\b/i.test(
      normalized
    ) ||
    /\bhow should i improve\b/i.test(
      normalized
    ) ||
    /\bhelp me improve\b/i.test(
      normalized
    ) ||
    /\bimprove (this|that|these|those)\b/i.test(
      normalized
    ) ||
    /\bwhat should i learn\b/i.test(
      normalized
    ) ||
    /\bwhat should i practice\b/i.test(
      normalized
    )
  );
};

const getSkillRoadmapDescription = (
  skill: string,
  targetRole?: string
): string => {
  const normalized =
    skill
      .trim()
      .toLowerCase();

  const role =
    targetRole
      ? ` for ${targetRole} roles`
      : "";

  switch (
    normalized
  ) {
    case "typescript":
      return `Learn TypeScript fundamentals, interfaces, types, generics, and how to use TypeScript in real React projects${role}.`;

    case "rest api":
    case "rest apis":
      return `Practice consuming REST APIs with GET, POST, PUT, PATCH, and DELETE requests, including authentication, loading states, validation, and error handling${role}.`;

    case "figma":
      return `Learn to read Figma designs accurately, understand spacing and component systems, and convert design specifications into responsive frontend interfaces${role}.`;

    case "ui design":
      return `Strengthen layout, spacing, typography, responsive design, accessibility, and reusable component design so your interfaces feel production-ready${role}.`;

    case "react":
    case "react.js":
      return `Deepen React knowledge with reusable components, hooks, state management, forms, routing, API integration, and performance-conscious patterns${role}.`;

    case "next.js":
      return `Practice Next.js routing, layouts, data fetching, server and client components, metadata, and deployment patterns${role}.`;

    case "git":
      return `Practice real Git workflows including branching, pull requests, resolving conflicts, clean commits, and collaborative repository work${role}.`;

    default:
      return `Build practical confidence in ${skill} through focused study, small exercises, and at least one project feature where you use it in a realistic scenario${role}.`;
  }
};

const collectJobPrioritySkills = (
  jobMatches?:
    ICareerJobMatchingResult
): string[] => {
  if (
    !jobMatches?.found
  ) {
    return [];
  }

  const fromJobs =
    jobMatches.matchedJobs
      .flatMap(
        (
          job
        ) =>
          job.match
            .missingSkills ??
          []
      );

  const fromBest =
    jobMatches.bestMatch
      ?.match
      .missingSkills ??
    [];

  return uniqueStrings([
    ...fromBest,
    ...fromJobs,
  ]);
};

const buildContextualJobRoadmapSteps = (
  jobMatches?:
    ICareerJobMatchingResult,
  targetRole?: string
): ICareerNextStep[] => {
  if (
    !jobMatches?.found
  ) {
    return [];
  }

  const prioritySkills =
    collectJobPrioritySkills(
      jobMatches
    )
      .slice(
        0,
        4
      );

  const steps:
    ICareerNextStep[] = [];

  for (
    const [
      index,
      skill,
    ] of prioritySkills.entries()
  ) {
    steps.push({
      id:
        createStepId(
          "SKILL",
          `roadmap-${skill}`
        ),

      category:
        "SKILL",

      priority:
        index <= 1
          ? "high"
          : "medium",

      title:
        `Strengthen ${skill}`,

      description:
        getSkillRoadmapDescription(
          skill,
          targetRole
        ),

      reason:
        "This skill appears as a gap across relevant job matches and directly supports the job-search direction discussed in the previous message.",

      metadata: {
        skill,

        roadmapOrder:
          index + 1,

        contextIntent:
          "JOB_SEARCH_HELP",
      },
    });
  }

  const best =
    jobMatches.bestMatch;

  if (
    best
  ) {
    steps.push({
      id:
        createStepId(
          "JOB",
          "build-role-project"
        ),

      category:
        "JOB",

      priority:
        "medium",

      title:
        targetRole
          ? `Build a ${targetRole}-focused project`
          : "Build a role-focused portfolio project",

      description:
        prioritySkills.length >
          0
          ? `Build one portfolio project that combines ${prioritySkills
              .slice(
                0,
                4
              )
              .join(
                ", "
              )}. Use the project to demonstrate practical ability instead of only listing the skills on your CV.`
          : `Build a portfolio project aligned with ${best.title} responsibilities and use it to demonstrate the skills already recognized in your strongest job match.`,

      reason:
        "A practical project connects the skill roadmap to real job readiness.",

      resourceId:
        best.id,

      metadata: {
        prioritySkills,

        bestMatchTitle:
          best.title,

        bestMatchCompany:
          best.company,
      },
    });

    steps.push({
      id:
        createStepId(
          "JOB",
          "apply-after-roadmap"
        ),

      category:
        "JOB",

      priority:
        "low",

      title:
        "Update your CV and apply strategically",

      description:
        `After completing the priority skill work, update your CV and projects with evidence of those skills, then prioritize roles similar to ${best.title} at ${best.company}, where your current match is ${best.match.matchScore}%.`,

      reason:
        "The roadmap should end by converting new skills into stronger applications.",

      score:
        best.match.matchScore,

      resourceId:
        best.id,
    });
  }

  return steps;
};

const resolveContextualMode = (
  contextIntent?: string,
  userMessage?: string
):
  | "JOB_SKILL_ROADMAP"
  | "CV_FOCUS"
  | "INTERVIEW_FOCUS"
  | "GENERAL" => {
  if (
    contextIntent &&
    CONTEXTUAL_JOB_INTENTS.has(
      contextIntent
    ) &&
    isRoadmapOrImprovementRequest(
      userMessage
    )
  ) {
    return "JOB_SKILL_ROADMAP";
  }

  if (
    contextIntent &&
    CONTEXTUAL_CV_INTENTS.has(
      contextIntent
    )
  ) {
    return "CV_FOCUS";
  }

  if (
    contextIntent &&
    CONTEXTUAL_INTERVIEW_INTENTS.has(
      contextIntent
    )
  ) {
    return "INTERVIEW_FOCUS";
  }

  return "GENERAL";
};

/* =========================================================
   CV NEXT STEPS
========================================================= */

const buildCVSteps = (
  resume?: ICareerResumeContext
): ICareerNextStep[] => {
  if (
    !resume
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  /* =====================================================
     ATS
  ===================================================== */

  if (
    resume.atsScore <
    70
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          "improve-ats-score"
        ),

      category:
        "CV",

      priority:
        resume.atsScore <
        60
          ? "high"
          : "medium",

      title:
        "Improve your ATS score",

      description:
        `Your current ATS score is ${resume.atsScore}/100. Focus on ATS-friendly wording, section headings, and vacancy-specific keywords.`,

      reason:
        "Your ATS score is below the recommended target.",

      score:
        resume.atsScore,

      resourceId:
        resume.id,

      metadata: {
        atsSuggestions:
          resume.atsSuggestions,
      },
    });
  }

  /* =====================================================
     STRUCTURE
  ===================================================== */

  if (
    resume.structureScore <
    70
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          "improve-structure"
        ),

      category:
        "CV",

      priority:
        resume.structureScore <
        60
          ? "high"
          : "medium",

      title:
        "Improve CV structure",

      description:
        `Your structure score is ${resume.structureScore}/100. Review formatting, section order, readability, and ATS-safe layout.`,

      reason:
        "CV structure is one of the weaker scoring areas.",

      score:
        resume.structureScore,

      resourceId:
        resume.id,

      metadata: {
        formattingFeedback:
          resume.formattingFeedback,
      },
    });
  }

  /* =====================================================
     SKILLS SCORE
  ===================================================== */

  if (
    resume.skillsScore <
    75
  ) {
    steps.push({
      id:
        createStepId(
          "SKILL",
          "strengthen-skill-profile"
        ),

      category:
        "SKILL",

      priority:
        resume.skillsScore <
        60
          ? "high"
          : "medium",

      title:
        "Strengthen your skill profile",

      description:
        `Your CV skills score is ${resume.skillsScore}/100. Focus on relevant technical skills that are missing or underrepresented.`,

      reason:
        "A stronger skill profile can improve both CV quality and job matching.",

      score:
        resume.skillsScore,

      resourceId:
        resume.id,

      metadata: {
        missingSkills:
          resume.missingSkills,
      },
    });
  }

  /* =====================================================
     RESUME RECOMMENDATIONS
  ===================================================== */

  for (
    const recommendation
    of resume.recommendations
      .slice(
        0,
        2
      )
  ) {
    steps.push({
      id:
        createStepId(
          "CV",
          recommendation
        ),

      category:
        "CV",

      priority:
        "medium",

      title:
        "Apply a CV recommendation",

      description:
        recommendation,

      reason:
        "This recommendation comes from your latest saved CV analysis.",

      resourceId:
        resume.id,
    });
  }

  return steps;
};

/* =========================================================
   JOB NEXT STEPS
========================================================= */

const buildJobSteps = (
  jobMatches?:
    ICareerJobMatchingResult
): ICareerNextStep[] => {
  if (
    !jobMatches?.found ||
    !jobMatches.bestMatch
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  const best =
    jobMatches.bestMatch;

  /* =====================================================
     HIGH MATCH JOB
  ===================================================== */

  if (
    best.match.matchScore >=
    80
  ) {
    steps.push({
      id:
        createStepId(
          "JOB",
          `apply-${best.id}`
        ),

      category:
        "JOB",

      priority:
        best.match.matchScore >=
        90
          ? "high"
          : "medium",

      title:
        `Review ${best.title} at ${best.company}`,

      description:
        `This role has a ${best.match.matchScore}% match with your current CV. Review the job details and prepare a tailored application.`,

      reason:
        "This is currently one of your strongest job matches.",

      score:
        best.match.matchScore,

      resourceId:
        best.id,

      metadata: {
        company:
          best.company,

        matchedSkills:
          best.match
            .matchedSkills,

        missingSkills:
          best.match
            .missingSkills,
      },
    });
  }

  /* =====================================================
     MISSING JOB SKILLS
  ===================================================== */

  const missingSkills =
    uniqueStrings(
      best.match
        .missingSkills
    );

  if (
    missingSkills.length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "SKILL",
          "job-missing-skills"
        ),

      category:
        "SKILL",

      priority:
        "high",

      title:
        "Close the biggest job skill gaps",

      description:
        `For your strongest current job match, focus on: ${missingSkills
          .slice(
            0,
            5
          )
          .join(
            ", "
          )}.`,

      reason:
        "These skills were required by the job but were not detected strongly enough in your CV.",

      resourceId:
        best.id,

      metadata: {
        missingSkills,
      },
    });
  }

  /* =====================================================
     MATCHING IMPROVEMENT AREAS
  ===================================================== */

  if (
    best.match
      .improvementAreas
      .length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "JOB",
          "improve-match-quality"
        ),

      category:
        "JOB",

      priority:
        "medium",

      title:
        "Improve your strongest job match",

      description:
        best.match
          .improvementAreas[0],

      reason:
        "Improving this area can increase your match quality for similar roles.",

      resourceId:
        best.id,

      metadata: {
        improvementAreas:
          best.match
            .improvementAreas,
      },
    });
  }

  return steps;
};

/* =========================================================
   INTERVIEW NEXT STEPS
========================================================= */

const buildInterviewSteps = (
  interview?:
    ICareerInterviewContext
): ICareerNextStep[] => {
  if (
    !interview
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  /* =====================================================
     TECHNICAL ACCURACY
  ===================================================== */

  if (
    typeof interview
      .averageTechnicalAccuracy ===
      "number" &&
    interview
      .averageTechnicalAccuracy <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "technical-accuracy"
        ),

      category:
        "INTERVIEW",

      priority:
        interview
          .averageTechnicalAccuracy <
          70
          ? "high"
          : "medium",

      title:
        "Improve technical interview accuracy",

      description:
        `Your average technical accuracy is ${interview.averageTechnicalAccuracy}/100. Practice role-specific technical questions and explain your reasoning step by step.`,

      reason:
        "Technical accuracy is below your target interview level.",

      score:
        interview
          .averageTechnicalAccuracy,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     COMMUNICATION
  ===================================================== */

  if (
    typeof interview
      .averageCommunication ===
      "number" &&
    interview
      .averageCommunication <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "communication"
        ),

      category:
        "INTERVIEW",

      priority:
        interview
          .averageCommunication <
          70
          ? "high"
          : "medium",

      title:
        "Practice clearer interview communication",

      description:
        `Your average communication score is ${interview.averageCommunication}/100. Focus on concise explanations and structured examples.`,

      reason:
        "Communication can materially affect otherwise strong interview answers.",

      score:
        interview
          .averageCommunication,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     COMPLETENESS
  ===================================================== */

  if (
    typeof interview
      .averageCompleteness ===
      "number" &&
    interview
      .averageCompleteness <
      80
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "answer-completeness"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Give more complete interview answers",

      description:
        `Your average answer completeness is ${interview.averageCompleteness}/100. Practice covering the full question before ending your response.`,

      reason:
        "Some answers may be correct but still incomplete.",

      score:
        interview
          .averageCompleteness,

      resourceId:
        interview.id,
    });
  }

  /* =====================================================
     FINAL REPORT RECOMMENDATION
  ===================================================== */

  if (
    interview
      .finalReport
      .recommendations
      .length >
    0
  ) {
    steps.push({
      id:
        createStepId(
          "INTERVIEW",
          "report-recommendation"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Follow your latest interview recommendation",

      description:
        interview
          .finalReport
          .recommendations[0],

      reason:
        "This recommendation comes from your latest completed interview report.",

      resourceId:
        interview.id,
    });
  }

  return steps;
};

/* =========================================================
   PROGRESS NEXT STEPS
========================================================= */

const buildProgressSteps = (
  progress?:
    ICareerProgressContext
): ICareerNextStep[] => {
  if (
    !progress
  ) {
    return [];
  }

  const steps:
    ICareerNextStep[] = [];

  const ats =
    progress.resume
      .atsScore;

  if (
    ats.direction ===
      "declined" &&
    typeof ats.change ===
      "number"
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "recover-ats-decline"
        ),

      category:
        "PROGRESS",

      priority:
        Math.abs(
          ats.change
        ) >= 15
          ? "high"
          : "medium",

      title:
        "Recover your ATS score",

      description:
        `Your ATS score dropped by ${Math.abs(
          ats.change
        )} points between your last two CV analyses.`,

      reason:
        "This is one of the clearest negative trends in your recent progress.",

      score:
        ats.current,
    });
  }

  const structure =
    progress.resume
      .structureScore;

  if (
    structure.direction ===
      "declined" &&
    typeof structure.change ===
      "number"
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "recover-cv-structure"
        ),

      category:
        "PROGRESS",

      priority:
        Math.abs(
          structure.change
        ) >= 15
          ? "high"
          : "medium",

      title:
        "Recover CV structure quality",

      description:
        `Your CV structure score decreased by ${Math.abs(
          structure.change
        )} points.`,

      reason:
        "The latest CV version scored materially lower on structure.",

      score:
        structure.current,
    });
  }

  const communication =
    progress.interview
      .communication;

  if (
    communication.direction ===
      "declined" &&
    typeof communication.change ===
      "number" &&
    Math.abs(
      communication.change
    ) >= 5
  ) {
    steps.push({
      id:
        createStepId(
          "PROGRESS",
          "interview-communication-trend"
        ),

      category:
        "INTERVIEW",

      priority:
        "medium",

      title:
        "Protect your interview communication performance",

      description:
        `Your interview communication score decreased by ${Math.abs(
          communication.change
        )} points.`,

      reason:
        "A downward interview communication trend is worth correcting early.",

      score:
        communication.current,
    });
  }

  return steps;
};

/* =========================================================
   CAREER GOAL STEP
========================================================= */

const buildCareerGoalSteps = (
  targetRole?: string,
  careerGoal?: string
): ICareerNextStep[] => {
  const steps:
    ICareerNextStep[] = [];

  if (
    !targetRole
  ) {
    steps.push({
      id:
        createStepId(
          "CAREER",
          "define-target-role"
        ),

      category:
        "CAREER",

      priority:
        "medium",

      title:
        "Define your target role",

      description:
        "Choose a specific target role so InterviewIQ can make job matching, CV improvement, and interview preparation more focused.",

      reason:
        "A clear target role improves the quality of personalized career guidance.",
    });
  }

  if (
    targetRole &&
    !careerGoal
  ) {
    steps.push({
      id:
        createStepId(
          "CAREER",
          "define-career-goal"
        ),

      category:
        "CAREER",

      priority:
        "low",

      title:
        "Turn your target role into a career goal",

      description:
        `You are targeting ${targetRole}. Define a measurable career goal around that role.`,

      reason:
        "A concrete career goal makes progress easier to evaluate.",
    });
  }

  return steps;
};

/* =========================================================
   SORT NEXT STEPS
========================================================= */

const sortSteps = (
  steps:
    ICareerNextStep[]
): ICareerNextStep[] => {
  return [
    ...steps,
  ].sort(
    (
      a,
      b
    ) => {
      const priorityDifference =
        priorityWeight(
          b.priority
        ) -
        priorityWeight(
          a.priority
        );

      if (
        priorityDifference !==
        0
      ) {
        return priorityDifference;
      }

      /*
       * When priority is equal,
       * lower score generally means greater urgency.
       */

      if (
        typeof a.score ===
          "number" &&
        typeof b.score ===
          "number"
      ) {
        return (
          a.score -
          b.score
        );
      }

      return 0;
    }
  );
};

/* =========================================================
   MAIN NEXT STEPS CONTEXT
========================================================= */

export const buildCareerNextStepsContext =
  async (
    input:
      ICareerNextStepsInput
  ): Promise<
    ICareerNextStepsResult
  > => {
    const userId =
      normalizeString(
        input.userId
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

    let interview:
      ICareerInterviewContext | undefined;

    let progress:
      ICareerProgressContext | undefined;

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
        "[Career Next Steps] Resume context failed:",
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
        const jobResult =
          await getCareerJobMatches({
            userId,

            activeResumeId:
              resume.id,

            targetRole:
              input.targetRole,

            limit:
              5,
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
          "[Career Next Steps] Job context failed:",
          error
        );
      }
    }

    /* =====================================================
       INTERVIEW
    ===================================================== */

    try {
      const interviewResult =
        await resolveCareerInterviewContext({
          userId,

          activeInterviewId:
            input.activeInterviewId,
        });

      if (
        interviewResult.found &&
        interviewResult.data
      ) {
        interview =
          interviewResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Next Steps] Interview context failed:",
        error
      );
    }

    /* =====================================================
       CAREER PROGRESS
    ===================================================== */

    try {
      const progressResult =
        await buildCareerProgressContext(
          userId
        );

      if (
        progressResult.found &&
        progressResult.data
      ) {
        progress =
          progressResult.data;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Next Steps] Progress context failed:",
        error
      );
    }

    /* =====================================================
       NO DATA AT ALL
    ===================================================== */

    if (
      !resume &&
      !jobMatches &&
      !interview &&
      !progress &&
      !input.targetRole &&
      !input.careerGoal
    ) {
      return {
        found:
          false,

        reason:
          "NO_CAREER_DATA",
      };
    }

    /* =====================================================
       GENERATE CONTEXT-AWARE STEPS
    ===================================================== */

    const contextualMode =
      resolveContextualMode(
        input.contextIntent,
        input.userMessage
      );

    let steps:
      ICareerNextStep[] = [];

    switch (
      contextualMode
    ) {
      case "JOB_SKILL_ROADMAP": {
        const roadmapSteps =
          buildContextualJobRoadmapSteps(
            jobMatches,
            input.targetRole
          );

        steps =
          roadmapSteps.length >
            0
            ? roadmapSteps
            : sortSteps([
                ...buildJobSteps(
                  jobMatches
                ),

                ...buildCVSteps(
                  resume
                ),
              ]);

        break;
      }

      case "CV_FOCUS":
        steps =
          sortSteps([
            ...buildCVSteps(
              resume
            ),

            ...buildJobSteps(
              jobMatches
            ),
          ]);

        break;

      case "INTERVIEW_FOCUS":
        steps =
          sortSteps([
            ...buildInterviewSteps(
              interview
            ),

            ...buildJobSteps(
              jobMatches
            ),
          ]);

        break;

      case "GENERAL":
      default:
        steps =
          sortSteps([
            ...buildCVSteps(
              resume
            ),

            ...buildJobSteps(
              jobMatches
            ),

            ...buildInterviewSteps(
              interview
            ),

            ...buildProgressSteps(
              progress
            ),

            ...buildCareerGoalSteps(
              input.targetRole,
              input.careerGoal
            ),
          ]);

        break;
    }

    return {
      found:
        true,

      data: {
        resume,

        jobMatches,

        interview,

        progress,

        targetRole:
          input.targetRole,

        careerGoal:
          input.careerGoal,

        contextIntent:
          input.contextIntent,

        userMessage:
          input.userMessage,

        contextualMode,

        steps,

        topStep:
          steps[0],
      },
    };
  };

/* =========================================================
   BUILD CHAT REPLY
========================================================= */

export const buildCareerNextStepsReply =
  (
    context:
      ICareerNextStepsContext
  ): string => {
    if (
      context.steps.length ===
      0
    ) {
      return "Your current data looks stable. Keep applying to suitable roles, continue interview practice, and update your CV as your skills and experience grow.";
    }

    const topSteps =
      context.steps.slice(
        0,
        4
      );

    const formatted =
      topSteps.map(
        (
          step,
          index
        ) =>
          `${index + 1}. ${step.title}: ${step.description}`
      );

    const prefix =
      context.contextualMode ===
        "JOB_SKILL_ROADMAP"
        ? context.targetRole
          ? `Based on the ${context.targetRole} job-search direction we were discussing, here is a focused roadmap for the skills you should strengthen:`
          : "Based on the job-search direction we were discussing, here is a focused roadmap for the skills you should strengthen:"
        : context.contextualMode ===
            "CV_FOCUS"
          ? "Based on the CV topic we were discussing, these should be your next CV priorities:"
          : context.contextualMode ===
              "INTERVIEW_FOCUS"
            ? "Based on the interview topic we were discussing, these should be your next interview priorities:"
            : context.targetRole
              ? `Based on your current InterviewIQ data and your target role of ${context.targetRole}, these should be your next priorities:`
              : "Based on your current InterviewIQ data, these should be your next priorities:";

    return [
      prefix,
      ...formatted,
    ].join(
      " "
    );
  };

/* =========================================================
   BUILD API SUMMARY
========================================================= */

export const buildCareerNextStepsSummary =
  (
    context:
      ICareerNextStepsContext
  ): Record<
    string,
    unknown
  > => {
    return {
      targetRole:
        context.targetRole,

      careerGoal:
        context.careerGoal,

      contextIntent:
        context.contextIntent,

      contextualMode:
        context.contextualMode,

      userMessage:
        context.userMessage,

      totalSteps:
        context.steps.length,

      topStep:
        context.topStep,

      steps:
        context.steps,

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
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  buildCareerNextStepsContext,

  buildCareerNextStepsReply,

  buildCareerNextStepsSummary,
};