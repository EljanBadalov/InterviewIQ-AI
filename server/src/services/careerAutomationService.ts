import { roadmapContextStatus } from './careerIntelligenceService';
import { timeGenerationStage } from './roadmapGenerationMetrics';
import { coordinateRoadmapGeneration, saveGeneratedAutomation, createGeneratedAutomation, readGenerationAutomation } from './roadmapGenerationService';
import { decorateRoadmapNarratives } from "./roadmapNarrativeService";
import {
  withRoadmapEvidence,
  measureRoadmapStage,
} from "./roadmapEvidenceScope";
import { MIN_ROADMAP_DAYS, MAX_ROADMAP_DAYS, normalizeString, clamp, startOfUTCDay, endOfUTCDay, addDays, createStableId, uniqueStrings, mapStepCategory, mapStepPriority, mapTaskSource, getEstimatedMinutes, isTaskEnabled, buildRoadmapFromGoal, preserveCompletedRoadmapState, buildTasksFromNextSteps, calculateTaskProgress } from './roadmapAutomationPlanner';
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
  careerContext?: ReturnType<typeof roadmapContextStatus>;
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

/* =========================================================
   BASIC HELPERS
========================================================= */

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

/* =========================================================
   ROADMAP BUILDING
========================================================= */

/*
 * Replanning can produce new Qwen wording and therefore new milestone IDs.
 * Preserve an already-completed roadmap section by stable category when
 * possible. For legacy milestones that do not yet have category, fall back
 * to a normalized title match.
 */

/* =========================================================
   TASK BUILDING
========================================================= */

/* =========================================================
   PROGRESS CALCULATION
========================================================= */

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

const runCreateCareerAutomation =
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
      await readGenerationAutomation(input.userId, async () => CareerAutomation.findOne({ userId: userObjectId }));

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
      }, existing ? { userId:String(existing.userId),targetRole:existing.targetRole,roadmap:existing.roadmap } : { userId:input.userId,targetRole,roadmap:[] });

    if (
      !goalResult.found ||
      !goalResult.data
    ) {
      throw new Error(
        `Could not build career goal context: ${goalResult.reason ||
        "UNKNOWN_REASON"
        }.`
      );
    }

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
      decorateRoadmapNarratives(buildRoadmapFromGoal(
        goalResult
          .data
          .milestones ||
        [],
        roadmapDurationDays,
        startedAt
      ), goalResult.data.milestones, existing?.roadmap || [], existing?.tasks?.filter(task=>task.status==='completed').map(task=>task.roadmapMilestoneId || '') || []);

    const nextStepsResult =
      await timeGenerationStage('nextSteps', () => buildCareerNextStepsContext({
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
      }, { userId: input.userId, roadmap }));

    const generatedTasks =
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

    const completedTasks = existing?.tasks.filter(task=>task.status==='completed') || [];
    const tasks = [...completedTasks,...generatedTasks.filter(task=>!completedTasks.some(done=>done.id===task.id))];

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

      await saveGeneratedAutomation(existing);

      return existing;
    }

    return createGeneratedAutomation({
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

    return readGenerationAutomation(userId, async () => CareerAutomation.findOne({ userId: userObjectId }));
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

const runReplanCareerAutomation =
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

    const now =
      new Date();

    /*
     * Rebuild the personalized roadmap from the latest InterviewIQ
     * evidence. buildCareerGoalContext now owns:
     * - deterministic readiness / gap evidence
     * - Qwen roadmap wording and recommendations
     * - safe deterministic fallback when Qwen is unavailable
     */
    let refreshedRoadmap =
      automation.roadmap;

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
            automation
              .targetRole,

          careerGoal:
            automation
              .careerGoal,
        }, { userId:String(automation.userId),targetRole:automation.targetRole,roadmap:automation.roadmap });

      if (
        goalResult.found &&
        goalResult.data
      ) {
        automation.currentReadinessScore =
          goalResult
            .data
            .readinessScore;

        const rebuiltRoadmap =
          decorateRoadmapNarratives(buildRoadmapFromGoal(
            goalResult
              .data
              .milestones ||
            [],
            automation
              .roadmapDurationDays,
            now
          ), goalResult.data.milestones, automation.roadmap, automation.tasks?.filter(task=>task.status==='completed').map(task=>task.roadmapMilestoneId || '') || []);

        refreshedRoadmap =
          preserveCompletedRoadmapState(
            automation
              .roadmap,
            rebuiltRoadmap
          );

        automation.roadmap =
          refreshedRoadmap;
      }
    } catch (
      error
    ) {
      /*
       * Roadmap generation failure must not destroy the user's current
       * automation. Keep the existing roadmap and continue refreshing
       * practical next steps.
       */
      console.error(
        "[Career Automation] Personalized roadmap replan failed:",
        error
      );
    }

    const nextStepsResult =
      await timeGenerationStage('nextSteps', () => buildCareerNextStepsContext({
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
      }, { userId, roadmap: refreshedRoadmap }));

    if (
      !nextStepsResult.found ||
      !nextStepsResult.data
    ) {
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

      await saveGeneratedAutomation(automation);

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

    const freshTasks =
      buildTasksFromNextSteps({
        steps:
          nextStepsResult
            .data
            .steps,

        roadmap:
          refreshedRoadmap,

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

    await saveGeneratedAutomation(automation);

    return automation;
  };

/* =========================================================
   REFRESH READINESS / EXTERNAL PROGRESS
========================================================= */

const runRefreshCareerAutomationProgress =
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
        }, { userId:String(automation.userId),targetRole:automation.targetRole,roadmap:automation.roadmap });

      if (
        goalResult.found &&
        goalResult.data
      ) {
        automation.currentReadinessScore =
          goalResult
            .data
            .readinessScore;

        const refreshedRoadmap =
          decorateRoadmapNarratives(buildRoadmapFromGoal(
            goalResult
              .data
              .milestones ||
            [],
            automation
              .roadmapDurationDays,
            new Date()
          ), goalResult.data.milestones, automation.roadmap, automation.tasks?.filter(task=>task.status==='completed').map(task=>task.roadmapMilestoneId || '') || []);

        automation.roadmap =
          preserveCompletedRoadmapState(
            automation
              .roadmap,
            refreshedRoadmap
          );
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

    await saveGeneratedAutomation(automation);

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
      new Date(),
    prepared?: ICareerAutomation
  ): Promise<ICareerAutomationSummary | null> => {
    const automation =
      prepared ?? await getCareerAutomation(
        userId
      );

    if (
      !automation
    ) {
      return null;
    }

    if (String(automation.userId).toLowerCase() !== String(userId).toLowerCase()) throw new Error('Career summary owner mismatch');

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
      careerContext:roadmapContextStatus(automation.roadmap,automation.targetRole,String(automation.userId)),
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

export const createCareerAutomation = (input: Parameters<typeof runCreateCareerAutomation>[0]) =>
  coordinateRoadmapGeneration(input.userId, "create", input, () => withRoadmapEvidence(input.userId, () => measureRoadmapStage("createCareerAutomation", () => runCreateCareerAutomation(input))));
export const replanCareerAutomation = (input: Parameters<typeof runReplanCareerAutomation>[0]) =>
  coordinateRoadmapGeneration(input.userId, "replan", input, () => withRoadmapEvidence(input.userId, () => measureRoadmapStage("replanCareerAutomation", () => runReplanCareerAutomation(input))));
export const refreshCareerAutomationProgress = (userId: string) =>
  coordinateRoadmapGeneration(userId, "progress-refresh", {}, () => withRoadmapEvidence(userId, () => measureRoadmapStage("refreshCareerAutomationProgress", () => runRefreshCareerAutomationProgress(userId))));

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
