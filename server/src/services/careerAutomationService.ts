import {
  Types,
} from "mongoose";

import CareerAutomation, {
  type CareerAutomationStatus,
  type CareerTaskCategory,
  type CareerTaskPriority,
  type CareerTaskSource,
  type CareerTaskStatus,
  type ICareerAutomation,
  type ICareerAutomationProgress,
  type ICareerAutomationTask,
  type ICareerJobPreferences,
  type ICareerRoadmapMilestone,
  type ICareerAutomationSettings,
} from "../models/CareerAutomation";

import {
  buildCareerGoalContext,
} from "./careerGoalService";

import {
  buildCareerNextStepsContext,
  type CareerNextStepCategory,
  type ICareerNextStep,
} from "./careerNextStepsService";

import {
  buildCareerProgressContext,
} from "./careerProgressService";

/* =========================================================
   TYPES
========================================================= */

export interface ICreateCareerAutomationInput {
  userId: string;

  targetRole: string;

  careerGoal: string;

  targetDate?: Date;

  roadmapDurationDays?: number;

  activeResumeId?: string;

  activeInterviewId?: string;

  jobPreferences?:
    Partial<ICareerJobPreferences>;

  settings?:
    Partial<ICareerAutomationSettings>;
}

export interface IGenerateDailyPlanInput {
  userId: string;

  date?: Date;

  force?: boolean;
}

export interface IUpdateCareerTaskInput {
  userId: string;

  taskId: string;

  status:
    CareerTaskStatus;
}

export interface IReplanCareerAutomationInput {
  userId: string;

  reason?:
    string;

  preserveCompletedTasks?:
    boolean;
}

export interface ICareerAutomationSummary {
  id: string;

  status:
    CareerAutomationStatus;

  targetRole: string;

  careerGoal: string;

  roadmapDurationDays: number;

  currentReadinessScore?: number;

  roadmap: {
    total: number;

    completed: number;

    inProgress: number;

    notStarted: number;
  };

  tasks: {
    total: number;

    completed: number;

    pending: number;

    inProgress: number;

    skipped: number;
  };

  today: {
    date: string;

    tasks:
      ICareerAutomationTask[];

    total:
      number;

    completed:
      number;
  };

  progress:
    ICareerAutomationProgress;

  nextDailyPlanAt?: Date;

  nextJobSearchAt?: Date;
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_ROADMAP_DAYS =
  90;

const DEFAULT_MAX_DAILY_TASKS =
  5;

const DEFAULT_DAILY_MINUTES =
  90;

const MAX_ROADMAP_DAYS =
  730;

const MIN_ROADMAP_DAYS =
  7;

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeString = (
  value:
    | string
    | undefined
    | null
): string => {
  return (
    value
      ?.replace(
        /\s+/g,
        " "
      )
      .trim() ||
    ""
  );
};

const clamp = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
};

const ensureObjectId = (
  value:
    | string
    | undefined,
  label:
    string
): Types.ObjectId | undefined => {
  const normalized =
    normalizeString(
      value
    );

  if (
    !normalized
  ) {
    return undefined;
  }

  if (
    !Types.ObjectId.isValid(
      normalized
    )
  ) {
    throw new Error(
      `${label} is invalid.`
    );
  }

  return new Types.ObjectId(
    normalized
  );
};

const ensureUserObjectId = (
  userId:
    string
): Types.ObjectId => {
  const normalized =
    normalizeString(
      userId
    );

  if (
    !normalized ||
    !Types.ObjectId.isValid(
      normalized
    )
  ) {
    throw new Error(
      "A valid user ID is required."
    );
  }

  return new Types.ObjectId(
    normalized
  );
};

const startOfUTCDay = (
  value:
    Date
): Date => {
  const result =
    new Date(
      value
    );

  result.setUTCHours(
    0,
    0,
    0,
    0
  );

  return result;
};

const endOfUTCDay = (
  value:
    Date
): Date => {
  const result =
    new Date(
      value
    );

  result.setUTCHours(
    23,
    59,
    59,
    999
  );

  return result;
};

const addDays = (
  value:
    Date,
  days:
    number
): Date => {
  const result =
    new Date(
      value
    );

  result.setUTCDate(
    result.getUTCDate() +
    days
  );

  return result;
};

const createStableId = (
  prefix:
    string,
  value:
    string,
  index:
    number
): string => {
  const slug =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(
        0,
        50
      );

  return `${prefix}-${index + 1}-${slug || "item"}`;
};

const uniqueStrings = (
  values:
    string[]
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
      normalizeString(
        value
      );

    if (
      !cleaned
    ) {
      continue;
    }

    const key =
      cleaned
        .toLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    result.push(
      cleaned
    );
  }

  return result;
};

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const buildDefaultJobPreferences = (
  targetRole:
    string,
  input?:
    Partial<ICareerJobPreferences>
): ICareerJobPreferences => {
  return {
    enabled:
      input
        ?.enabled ??
      true,

    targetRoles:
      uniqueStrings(
        input
          ?.targetRoles
          ?.length
          ? input.targetRoles
          : [
              targetRole,
            ]
      ),

    locations:
      uniqueStrings(
        input
          ?.locations ||
        []
      ),

    workModes: [
      ...(
        input
          ?.workModes ||
        []
      ),
    ],

    employmentTypes: [
      ...(
        input
          ?.employmentTypes ||
        []
      ),
    ],

    experienceLevels: [
      ...(
        input
          ?.experienceLevels ||
        []
      ),
    ],

    minimumMatchScore:
      clamp(
        input
          ?.minimumMatchScore ??
        65,
        0,
        100
      ),

    dailyApplicationTarget:
      clamp(
        input
          ?.dailyApplicationTarget ??
        3,
        0,
        50
      ),

    notifyOnNewMatches:
      input
        ?.notifyOnNewMatches ??
      true,

    notificationMatchThreshold:
      clamp(
        input
          ?.notificationMatchThreshold ??
        75,
        0,
        100
      ),
  };
};

const buildDefaultSettings = (
  input?:
    Partial<ICareerAutomationSettings>
): ICareerAutomationSettings => {
  return {
    automationEnabled:
      input
        ?.automationEnabled ??
      true,

    dailyTasksEnabled:
      input
        ?.dailyTasksEnabled ??
      true,

    jobSearchEnabled:
      input
        ?.jobSearchEnabled ??
      true,

    interviewPrepEnabled:
      input
        ?.interviewPrepEnabled ??
      true,

    learningTasksEnabled:
      input
        ?.learningTasksEnabled ??
      true,

    cvTasksEnabled:
      input
        ?.cvTasksEnabled ??
      true,

    portfolioTasksEnabled:
      input
        ?.portfolioTasksEnabled ??
      true,

    automaticReplanningEnabled:
      input
        ?.automaticReplanningEnabled ??
      true,

    maxDailyTasks:
      clamp(
        input
          ?.maxDailyTasks ??
        DEFAULT_MAX_DAILY_TASKS,
        1,
        20
      ),

    preferredDailyMinutes:
      clamp(
        input
          ?.preferredDailyMinutes ??
        DEFAULT_DAILY_MINUTES,
        10,
        1440
      ),

    timezone:
      normalizeString(
        input
          ?.timezone
      ) ||
      "UTC",
  };
};

/* =========================================================
   NEXT STEP -> AUTOMATION TASK MAPPING
========================================================= */

const mapStepCategory = (
  step:
    ICareerNextStep
): CareerTaskCategory => {
  const title =
    step.title
      .toLowerCase();

  const description =
    step.description
      .toLowerCase();

  if (
    step.category ===
      "SKILL"
  ) {
    /*
     * Project-building tasks are portfolio work even when they came
     * from a skill roadmap.
     */
    if (
      /portfolio|project|build one|build a/i.test(
        `${title} ${description}`
      )
    ) {
      return "PORTFOLIO";
    }

    return "LEARNING";
  }

  switch (
    step.category
  ) {
    case "CV":
      return "CV";

    case "JOB":
      return "JOB_APPLICATION";

    case "INTERVIEW":
      return "INTERVIEW";

    case "PROGRESS":
    case "CAREER":
    default:
      return "CAREER";
  }
};

const mapStepPriority = (
  priority:
    "high" |
    "medium" |
    "low"
): CareerTaskPriority => {
  switch (
    priority
  ) {
    case "high":
      return "high";

    case "low":
      return "low";

    case "medium":
    default:
      return "medium";
  }
};

const mapTaskSource = (
  category:
    CareerNextStepCategory
): CareerTaskSource => {
  switch (
    category
  ) {
    case "CV":
      return "resume";

    case "JOB":
      return "job_match";

    case "INTERVIEW":
      return "interview";

    case "SKILL":
      return "roadmap";

    case "PROGRESS":
      return "progress";

    case "CAREER":
    default:
      return "system";
  }
};

const getEstimatedMinutes = (
  category:
    CareerTaskCategory
): number => {
  switch (
    category
  ) {
    case "LEARNING":
      return 45;

    case "PORTFOLIO":
      return 60;

    case "INTERVIEW":
      return 30;

    case "JOB_APPLICATION":
      return 25;

    case "CV":
      return 30;

    case "CAREER":
    default:
      return 20;
  }
};

const isTaskEnabled = (
  category:
    CareerTaskCategory,
  settings:
    ICareerAutomationSettings
): boolean => {
  switch (
    category
  ) {
    case "LEARNING":
      return settings
        .learningTasksEnabled;

    case "JOB_APPLICATION":
      return settings
        .jobSearchEnabled;

    case "CV":
      return settings
        .cvTasksEnabled;

    case "INTERVIEW":
      return settings
        .interviewPrepEnabled;

    case "PORTFOLIO":
      return settings
        .portfolioTasksEnabled;

    case "CAREER":
    default:
      return true;
  }
};

/* =========================================================
   ROADMAP BUILDING
========================================================= */

const buildRoadmapFromGoal = (
  milestones:
    Array<{
      order: number;

      title: string;

      description: string;

      completed: boolean;
    }>,
  roadmapDurationDays:
    number,
  startedAt:
    Date
): ICareerRoadmapMilestone[] => {
  if (
    milestones.length ===
    0
  ) {
    return [];
  }

  const safeDuration =
    clamp(
      roadmapDurationDays,
      MIN_ROADMAP_DAYS,
      MAX_ROADMAP_DAYS
    );

  const daysPerMilestone =
    Math.max(
      1,
      Math.floor(
        safeDuration /
        milestones.length
      )
    );

  return milestones
    .sort(
      (
        a,
        b
      ) =>
        a.order -
        b.order
    )
    .map(
      (
        milestone,
        index
      ) => {
        const targetOffset =
          Math.min(
            safeDuration,
            daysPerMilestone *
            (
              index +
              1
            )
          );

        return {
          id:
            createStableId(
              "milestone",
              milestone.title,
              index
            ),

          order:
            index +
            1,

          title:
            normalizeString(
              milestone.title
            ),

          description:
            normalizeString(
              milestone.description
            ),

          status:
            milestone.completed
              ? "completed"
              : index ===
                  0
                ? "in_progress"
                : "not_started",

          targetDate:
            addDays(
              startedAt,
              targetOffset
            ),

          completedAt:
            milestone.completed
              ? new Date()
              : undefined,

          relatedSkills:
            [],

          metadata: {
            originalOrder:
              milestone.order,
          },
        };
      }
    );
};

/* =========================================================
   TASK BUILDING
========================================================= */

const buildTasksFromNextSteps = ({
  steps,
  roadmap,
  settings,
  startedAt,
}: {
  steps:
    ICareerNextStep[];

  roadmap:
    ICareerRoadmapMilestone[];

  settings:
    ICareerAutomationSettings;

  startedAt:
    Date;
}): ICareerAutomationTask[] => {
  const tasks:
    ICareerAutomationTask[] =
      [];

  let currentDayOffset =
    0;

  let tasksOnCurrentDay =
    0;

  let minutesOnCurrentDay =
    0;

  for (
    const [
      index,
      step,
    ]
    of steps.entries()
  ) {
    const category =
      mapStepCategory(
        step
      );

    if (
      !isTaskEnabled(
        category,
        settings
      )
    ) {
      continue;
    }

    const estimatedMinutes =
      getEstimatedMinutes(
        category
      );

    const exceedsTaskLimit =
      tasksOnCurrentDay >=
      settings.maxDailyTasks;

    const exceedsTimeLimit =
      tasksOnCurrentDay >
        0 &&
      minutesOnCurrentDay +
        estimatedMinutes >
      settings
        .preferredDailyMinutes;

    if (
      exceedsTaskLimit ||
      exceedsTimeLimit
    ) {
      currentDayOffset +=
        1;

      tasksOnCurrentDay =
        0;

      minutesOnCurrentDay =
        0;
    }

    const scheduledFor =
      startOfUTCDay(
        addDays(
          startedAt,
          currentDayOffset
        )
      );

    const milestone =
      roadmap.length >
        0
        ? roadmap[
            Math.min(
              roadmap.length -
                1,
              Math.floor(
                (
                  index /
                  Math.max(
                    steps.length,
                    1
                  )
                ) *
                roadmap.length
              )
            )
          ]
        : undefined;

    tasks.push({
      id:
        createStableId(
          "task",
          step.id ||
          step.title,
          index
        ),

      category,

      title:
        normalizeString(
          step.title
        ),

      description:
        normalizeString(
          step.description
        ),

      reason:
        normalizeString(
          step.reason
        ) ||
        undefined,

      priority:
        mapStepPriority(
          step.priority
        ),

      status:
        "pending",

      source:
        mapTaskSource(
          step.category
        ),

      scheduledFor,

      dueAt:
        endOfUTCDay(
          scheduledFor
        ),

      estimatedMinutes,

      relatedSkill:
        typeof step
          .metadata
          ?.skill ===
          "string"
          ? normalizeString(
              step
                .metadata
                .skill as string
            ) ||
            undefined
          : undefined,

      relatedJobId:
        step.resourceId &&
        Types.ObjectId.isValid(
          step.resourceId
        )
          ? new Types.ObjectId(
              step.resourceId
            )
          : undefined,

      roadmapMilestoneId:
        milestone
          ?.id,

      createdAt:
        new Date(),

      metadata: {
        nextStepId:
          step.id,

        nextStepCategory:
          step.category,

        ...(
          step.metadata ||
          {}
        ),
      },
    });

    tasksOnCurrentDay +=
      1;

    minutesOnCurrentDay +=
      estimatedMinutes;
  }

  return tasks;
};

/* =========================================================
   PROGRESS CALCULATION
========================================================= */

const calculateTaskProgress = (
  tasks:
    ICareerAutomationTask[]
): ICareerAutomationProgress => {
  const totalTasks =
    tasks.length;

  const completed =
    tasks.filter(
      (
        task
      ) =>
        task.status ===
        "completed"
    );

  const skipped =
    tasks.filter(
      (
        task
      ) =>
        task.status ===
        "skipped"
    );

  const pending =
    tasks.filter(
      (
        task
      ) =>
        task.status ===
          "pending" ||
        task.status ===
          "in_progress"
    );

  const completedApplications =
    completed.filter(
      (
        task
      ) =>
        task.category ===
        "JOB_APPLICATION"
    ).length;

  const completedLearningTasks =
    completed.filter(
      (
        task
      ) =>
        task.category ===
        "LEARNING"
    ).length;

  const completedInterviews =
    completed.filter(
      (
        task
      ) =>
        task.category ===
        "INTERVIEW"
    ).length;

  const completedCVTasks =
    completed.filter(
      (
        task
      ) =>
        task.category ===
        "CV"
    ).length;

  const completedPortfolioTasks =
    completed.filter(
      (
        task
      ) =>
        task.category ===
        "PORTFOLIO"
    ).length;

  const overallProgress =
    totalTasks >
      0
      ? Math.round(
          (
            completed.length /
            totalTasks
          ) *
          100
        )
      : 0;

  const lastCompleted =
    completed
      .filter(
        (
          task
        ) =>
          Boolean(
            task.completedAt
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            b.completedAt
              ?.getTime() ||
            0
          ) -
          (
            a.completedAt
              ?.getTime() ||
            0
          )
      )[0];

  return {
    totalTasks,

    completedTasks:
      completed.length,

    skippedTasks:
      skipped.length,

    pendingTasks:
      pending.length,

    completedLearningTasks,

    completedApplications,

    completedInterviews,

    completedCVTasks,

    completedPortfolioTasks,

    /*
     * Streak logic will be expanded when daily task history is mature.
     * Preserve existing values at the service update layer.
     */
    currentStreak:
      0,

    longestStreak:
      0,

    overallProgress,

    lastTaskCompletedAt:
      lastCompleted
        ?.completedAt,
  };
};

const refreshStoredProgress = (
  automation:
    ICareerAutomation
): void => {
  const calculated =
    calculateTaskProgress(
      automation.tasks
    );

  automation.progress = {
    ...calculated,

    currentStreak:
      automation
        .progress
        ?.currentStreak ??
      0,

    longestStreak:
      automation
        .progress
        ?.longestStreak ??
      0,
  };

  automation
    .lastProgressCalculatedAt =
    new Date();
};

/* =========================================================
   CREATE / INITIALIZE AUTOMATION
========================================================= */

export const createCareerAutomation =
  async (
    input:
      ICreateCareerAutomationInput
  ): Promise<ICareerAutomation> => {
    const userObjectId =
      ensureUserObjectId(
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

    if (
      !targetRole
    ) {
      throw new Error(
        "Target role is required."
      );
    }

    if (
      !careerGoal
    ) {
      throw new Error(
        "Career goal is required."
      );
    }

    const roadmapDurationDays =
      clamp(
        input
          .roadmapDurationDays ??
        DEFAULT_ROADMAP_DAYS,
        MIN_ROADMAP_DAYS,
        MAX_ROADMAP_DAYS
      );

    const activeResumeId =
      ensureObjectId(
        input.activeResumeId,
        "Active resume ID"
      );

    const activeInterviewId =
      ensureObjectId(
        input.activeInterviewId,
        "Active interview ID"
      );

    const existing =
      await CareerAutomation
        .findOne({
          userId:
            userObjectId,
        });

    const startedAt =
      new Date();

    const goalResult =
      await buildCareerGoalContext({
        userId:
          input.userId,

        activeResumeId:
          input.activeResumeId,

        activeInterviewId:
          input.activeInterviewId,

        targetRole,

        careerGoal,
      });

    if (
      !goalResult.found ||
      !goalResult.data
    ) {
      throw new Error(
        `Could not build career goal context: ${
          goalResult.reason ||
          "UNKNOWN_REASON"
        }.`
      );
    }

    const nextStepsResult =
      await buildCareerNextStepsContext({
        userId:
          input.userId,

        activeResumeId:
          input.activeResumeId,

        activeInterviewId:
          input.activeInterviewId,

        targetRole,

        careerGoal,

        contextIntent:
          "CAREER_AUTOMATION",

        userMessage:
          "Build a personalized career roadmap and practical action plan.",
      });

    const settings =
      buildDefaultSettings(
        input.settings
      );

    const jobPreferences =
      buildDefaultJobPreferences(
        targetRole,
        input.jobPreferences
      );

    const roadmap =
      buildRoadmapFromGoal(
        goalResult
          .data
          .milestones ||
        [],
        roadmapDurationDays,
        startedAt
      );

    const tasks =
      buildTasksFromNextSteps({
        steps:
          nextStepsResult
            .data
            ?.steps ||
          [],

        roadmap,

        settings,

        startedAt,
      });

    const progress =
      calculateTaskProgress(
        tasks
      );

    const nextDailyPlanAt =
      startOfUTCDay(
        addDays(
          startedAt,
          1
        )
      );

    const nextJobSearchAt =
      settings
        .jobSearchEnabled
        ? startOfUTCDay(
            addDays(
              startedAt,
              1
            )
          )
        : undefined;

    if (
      existing
    ) {
      existing.status =
        "active";

      existing.targetRole =
        targetRole;

      existing.careerGoal =
        careerGoal;

      existing.targetDate =
        input.targetDate;

      existing.roadmapDurationDays =
        roadmapDurationDays;

      existing.activeResumeId =
        activeResumeId;

      existing.activeInterviewId =
        activeInterviewId;

      existing.currentReadinessScore =
        goalResult
          .data
          .readinessScore;

      existing.jobPreferences =
        jobPreferences;

      existing.settings =
        settings;

      existing.roadmap =
        roadmap;

      existing.tasks =
        tasks;

      existing.jobMatches =
        [];

      existing.progress =
        progress;

      existing.lastDailyPlanGeneratedAt =
        startedAt;

      existing.nextDailyPlanAt =
        nextDailyPlanAt;

      existing.lastJobSearchAt =
        undefined;

      existing.nextJobSearchAt =
        nextJobSearchAt;

      existing.lastReplannedAt =
        startedAt;

      existing.lastProgressCalculatedAt =
        startedAt;

      await existing.save();

      return existing;
    }

    return CareerAutomation.create({
      userId:
        userObjectId,

      status:
        "active",

      targetRole,

      careerGoal,

      targetDate:
        input.targetDate,

      roadmapDurationDays,

      activeResumeId,

      activeInterviewId,

      currentReadinessScore:
        goalResult
          .data
          .readinessScore,

      jobPreferences,

      settings,

      roadmap,

      tasks,

      jobMatches:
        [],

      progress,

      lastDailyPlanGeneratedAt:
        startedAt,

      nextDailyPlanAt,

      nextJobSearchAt,

      lastReplannedAt:
        startedAt,

      lastProgressCalculatedAt:
        startedAt,
    });
  };

/* =========================================================
   GET AUTOMATION
========================================================= */

export const getCareerAutomation =
  async (
    userId:
      string
  ): Promise<ICareerAutomation | null> => {
    const userObjectId =
      ensureUserObjectId(
        userId
      );

    return CareerAutomation
      .findOne({
        userId:
          userObjectId,
      });
  };

/* =========================================================
   DAILY PLAN
========================================================= */

const getTasksForDay = (
  automation:
    ICareerAutomation,
  date:
    Date
): ICareerAutomationTask[] => {
  const start =
    startOfUTCDay(
      date
    );

  const end =
    endOfUTCDay(
      date
    );

  return automation
    .tasks
    .filter(
      (
        task
      ) =>
        task
          .scheduledFor
          .getTime() >=
          start.getTime() &&
        task
          .scheduledFor
          .getTime() <=
          end.getTime()
    )
    .sort(
      (
        a,
        b
      ) => {
        const priorityWeight:
          Record<
            CareerTaskPriority,
            number
          > = {
          high:
            3,

          medium:
            2,

          low:
            1,
        };

        return (
          priorityWeight[
            b.priority
          ] -
          priorityWeight[
            a.priority
          ]
        );
      }
    );
};

const getIncompleteCarryOverTasks = (
  automation:
    ICareerAutomation,
  date:
    Date
): ICareerAutomationTask[] => {
  const start =
    startOfUTCDay(
      date
    );

  return automation
    .tasks
    .filter(
      (
        task
      ) =>
        task
          .scheduledFor
          .getTime() <
          start.getTime() &&
        (
          task.status ===
            "pending" ||
          task.status ===
            "in_progress"
        )
    );
};

export const generateDailyCareerPlan =
  async ({
    userId,
    date =
      new Date(),
    force =
      false,
  }: IGenerateDailyPlanInput): Promise<ICareerAutomationTask[]> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      throw new Error(
        "Career automation was not found."
      );
    }

    if (
      automation.status !==
        "active" ||
      !automation
        .settings
        .automationEnabled ||
      !automation
        .settings
        .dailyTasksEnabled
    ) {
      return [];
    }

    const today =
      startOfUTCDay(
        date
      );

    const existingTodayTasks =
      getTasksForDay(
        automation,
        today
      );

    if (
      existingTodayTasks.length >
        0 &&
      !force
    ) {
      return existingTodayTasks;
    }

    /*
     * Carry unfinished work forward first. We do not duplicate the
     * task; we reschedule the same task.
     */
    const carryOver =
      getIncompleteCarryOverTasks(
        automation,
        today
      );

    const maxDailyTasks =
      automation
        .settings
        .maxDailyTasks;

    const carryLimit =
      Math.min(
        carryOver.length,
        Math.max(
          0,
          maxDailyTasks -
          existingTodayTasks.length
        )
      );

    for (
      const task
      of carryOver.slice(
        0,
        carryLimit
      )
    ) {
      task.scheduledFor =
        today;

      task.dueAt =
        endOfUTCDay(
          today
        );
    }

    automation
      .lastDailyPlanGeneratedAt =
      new Date();

    automation.nextDailyPlanAt =
      startOfUTCDay(
        addDays(
          today,
          1
        )
      );

    refreshStoredProgress(
      automation
    );

    await automation.save();

    return getTasksForDay(
      automation,
      today
    );
  };

/* =========================================================
   UPDATE TASK STATUS
========================================================= */

export const updateCareerTaskStatus =
  async ({
    userId,
    taskId,
    status,
  }: IUpdateCareerTaskInput): Promise<ICareerAutomationTask> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      throw new Error(
        "Career automation was not found."
      );
    }

    const normalizedTaskId =
      normalizeString(
        taskId
      );

    const task =
      automation
        .tasks
        .find(
          (
            item
          ) =>
            item.id ===
            normalizedTaskId
        );

    if (
      !task
    ) {
      throw new Error(
        "Career task was not found."
      );
    }

    const now =
      new Date();

    task.status =
      status;

    switch (
      status
    ) {
      case "in_progress":
        task.startedAt =
          task.startedAt ||
          now;

        task.completedAt =
          undefined;

        task.skippedAt =
          undefined;

        break;

      case "completed":
        task.startedAt =
          task.startedAt ||
          now;

        task.completedAt =
          now;

        task.skippedAt =
          undefined;

        break;

      case "skipped":
        task.skippedAt =
          now;

        task.completedAt =
          undefined;

        break;

      case "pending":
      default:
        task.startedAt =
          undefined;

        task.completedAt =
          undefined;

        task.skippedAt =
          undefined;

        break;
    }

    refreshStoredProgress(
      automation
    );

    await automation.save();

    return task;
  };

/* =========================================================
   REPLAN
========================================================= */

export const replanCareerAutomation =
  async ({
    userId,
    reason,
    preserveCompletedTasks =
      true,
  }: IReplanCareerAutomationInput): Promise<ICareerAutomation> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      throw new Error(
        "Career automation was not found."
      );
    }

    if (
      !automation
        .settings
        .automaticReplanningEnabled
    ) {
      return automation;
    }

    const nextStepsResult =
      await buildCareerNextStepsContext({
        userId,

        activeResumeId:
          automation
            .activeResumeId
            ?.toString(),

        activeInterviewId:
          automation
            .activeInterviewId
            ?.toString(),

        targetRole:
          automation.targetRole,

        careerGoal:
          automation.careerGoal,

        contextIntent:
          "CAREER_AUTOMATION",

        userMessage:
          reason ||
          "Re-evaluate my current progress and update my career action plan.",
      });

    if (
      !nextStepsResult.found ||
      !nextStepsResult.data
    ) {
      return automation;
    }

    const preserved =
      preserveCompletedTasks
        ? automation
            .tasks
            .filter(
              (
                task
              ) =>
                task.status ===
                "completed"
            )
        : [];

    const now =
      new Date();

    const freshTasks =
      buildTasksFromNextSteps({
        steps:
          nextStepsResult
            .data
            .steps,

        roadmap:
          automation
            .roadmap,

        settings:
          automation
            .settings,

        startedAt:
          now,
      });

    const completedIds =
      new Set(
        preserved.map(
          (
            task
          ) =>
            task.id
        )
      );

    const dedupedFresh =
      freshTasks.filter(
        (
          task
        ) =>
          !completedIds.has(
            task.id
          )
      );

    automation.tasks = [
      ...preserved,
      ...dedupedFresh,
    ];

    automation.lastReplannedAt =
      now;

    automation.nextDailyPlanAt =
      startOfUTCDay(
        addDays(
          now,
          1
        )
      );

    refreshStoredProgress(
      automation
    );

    await automation.save();

    return automation;
  };

/* =========================================================
   REFRESH READINESS / EXTERNAL PROGRESS
========================================================= */

export const refreshCareerAutomationProgress =
  async (
    userId:
      string
  ): Promise<ICareerAutomation> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      throw new Error(
        "Career automation was not found."
      );
    }

    try {
      const goalResult =
        await buildCareerGoalContext({
          userId,

          activeResumeId:
            automation
              .activeResumeId
              ?.toString(),

          activeInterviewId:
            automation
              .activeInterviewId
              ?.toString(),

          targetRole:
            automation.targetRole,

          careerGoal:
            automation.careerGoal,
        });

      if (
        goalResult.found &&
        goalResult.data
      ) {
        automation.currentReadinessScore =
          goalResult
            .data
            .readinessScore;
      }
    } catch (
      error
    ) {
      console.error(
        "[Career Automation] Readiness refresh failed:",
        error
      );
    }

    /*
     * Existing careerProgressService remains the owner of historical
     * CV/interview trend analysis. Calling it here keeps the automation
     * connected to the rest of InterviewIQ even though task progress is
     * calculated from CareerAutomation itself.
     */
    try {
      await buildCareerProgressContext(
        userId
      );
    } catch (
      error
    ) {
      console.error(
        "[Career Automation] Career progress refresh failed:",
        error
      );
    }

    refreshStoredProgress(
      automation
    );

    await automation.save();

    return automation;
  };

/* =========================================================
   PAUSE / RESUME
========================================================= */

export const setCareerAutomationStatus =
  async (
    userId:
      string,
    status:
      CareerAutomationStatus
  ): Promise<ICareerAutomation> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      throw new Error(
        "Career automation was not found."
      );
    }

    automation.status =
      status;

    if (
      status ===
      "active"
    ) {
      automation
        .settings
        .automationEnabled =
        true;

      automation.nextDailyPlanAt =
        startOfUTCDay(
          new Date()
        );

      if (
        automation
          .settings
          .jobSearchEnabled
      ) {
        automation.nextJobSearchAt =
          startOfUTCDay(
            new Date()
          );
      }
    }

    if (
      status ===
        "paused" ||
      status ===
        "archived" ||
      status ===
        "completed"
    ) {
      automation
        .settings
        .automationEnabled =
        false;

      automation.nextDailyPlanAt =
        undefined;

      automation.nextJobSearchAt =
        undefined;
    }

    await automation.save();

    return automation;
  };

/* =========================================================
   SUMMARY / DASHBOARD
========================================================= */

export const getCareerAutomationSummary =
  async (
    userId:
      string,
    date =
      new Date()
  ): Promise<ICareerAutomationSummary | null> => {
    const automation =
      await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      return null;
    }

    const todayTasks =
      getTasksForDay(
        automation,
        date
      );

    const roadmapCompleted =
      automation
        .roadmap
        .filter(
          (
            milestone
          ) =>
            milestone.status ===
            "completed"
        )
        .length;

    const roadmapInProgress =
      automation
        .roadmap
        .filter(
          (
            milestone
          ) =>
            milestone.status ===
            "in_progress"
        )
        .length;

    const taskCompleted =
      automation
        .tasks
        .filter(
          (
            task
          ) =>
            task.status ===
            "completed"
        )
        .length;

    const taskPending =
      automation
        .tasks
        .filter(
          (
            task
          ) =>
            task.status ===
            "pending"
        )
        .length;

    const taskInProgress =
      automation
        .tasks
        .filter(
          (
            task
          ) =>
            task.status ===
            "in_progress"
        )
        .length;

    const taskSkipped =
      automation
        .tasks
        .filter(
          (
            task
          ) =>
            task.status ===
            "skipped"
        )
        .length;

    return {
      id:
        automation
          ._id
          .toString(),

      status:
        automation.status,

      targetRole:
        automation.targetRole,

      careerGoal:
        automation.careerGoal,

      roadmapDurationDays:
        automation
          .roadmapDurationDays,

      currentReadinessScore:
        automation
          .currentReadinessScore,

      roadmap: {
        total:
          automation
            .roadmap
            .length,

        completed:
          roadmapCompleted,

        inProgress:
          roadmapInProgress,

        notStarted:
          Math.max(
            0,
            automation
              .roadmap
              .length -
            roadmapCompleted -
            roadmapInProgress
          ),
      },

      tasks: {
        total:
          automation
            .tasks
            .length,

        completed:
          taskCompleted,

        pending:
          taskPending,

        inProgress:
          taskInProgress,

        skipped:
          taskSkipped,
      },

      today: {
        date:
          startOfUTCDay(
            date
          )
            .toISOString()
            .slice(
              0,
              10
            ),

        tasks:
          todayTasks,

        total:
          todayTasks.length,

        completed:
          todayTasks.filter(
            (
              task
            ) =>
              task.status ===
              "completed"
          ).length,
      },

      progress:
        automation.progress,

      nextDailyPlanAt:
        automation
          .nextDailyPlanAt,

      nextJobSearchAt:
        automation
          .nextJobSearchAt,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  createCareerAutomation,
  getCareerAutomation,
  generateDailyCareerPlan,
  updateCareerTaskStatus,
  replanCareerAutomation,
  refreshCareerAutomationProgress,
  setCareerAutomationStatus,
  getCareerAutomationSummary,
};
