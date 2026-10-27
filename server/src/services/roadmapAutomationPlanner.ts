// Existing scheduling, identifiers and completion rules, extracted unchanged.
import { Types } from 'mongoose';
import type { CareerTaskCategory, CareerTaskPriority, CareerTaskSource, ICareerAutomationSettings, ICareerAutomationTask, ICareerRoadmapMilestone, ICareerAutomationProgress } from '../models/CareerAutomation';
import type { ICareerNextStep, CareerNextStepCategory } from './careerNextStepsService';
export const MAX_ROADMAP_DAYS =
  730;

export const MIN_ROADMAP_DAYS =
  7;

export const normalizeString = (
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

export const clamp = (
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

export const startOfUTCDay = (
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

export const endOfUTCDay = (
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

export const addDays = (
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

export const createStableId = (
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

export const uniqueStrings = (
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

export const mapStepCategory = (
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

export const mapStepPriority = (
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

export const mapTaskSource = (
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

export const getEstimatedMinutes = (
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

export const isTaskEnabled = (
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

export const buildRoadmapFromGoal = (
  milestones:
    Array<{
      order: number;

      category?:
        ICareerRoadmapMilestone[
          "category"
        ];

      title: string;

      description: string;

      reason?: string;

      readinessScore?: number;

      completed: boolean;

      relatedSkills?:
        string[];

      recommendations?:
        ICareerRoadmapMilestone[
          "recommendations"
        ];

      generatedBy?:
        ICareerRoadmapMilestone[
          "generatedBy"
        ];
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

  const generatedAt =
    new Date();

  return [
    ...milestones,
  ]
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

        const title =
          normalizeString(
            milestone.title
          );

        const description =
          normalizeString(
            milestone.description
          );

        const reason =
          normalizeString(
            milestone.reason
          ) ||
          undefined;

        const relatedSkills =
          uniqueStrings(
            milestone
              .relatedSkills ||
            []
          );

        /*
         * The CareerGoal service already validates Qwen output before it
         * reaches this layer. We still normalize strings here because this
         * object becomes persistent MongoDB state and later feeds the UI.
         */
        const recommendations =
          (
            milestone
              .recommendations ||
            []
          )
            .map(
              (
                recommendation
              ) => ({
                title:
                  normalizeString(
                    recommendation
                      .title
                  ),

                whyItMatters:
                  normalizeString(
                    recommendation
                      .whyItMatters
                  ),

                whatToLearn:
                  uniqueStrings(
                    recommendation
                      .whatToLearn ||
                    []
                  ),

                action:
                  normalizeString(
                    recommendation
                      .action
                  ),

                proofOfCompletion:
                  normalizeString(
                    recommendation
                      .proofOfCompletion
                  ) ||
                  undefined,

                priority:
                  recommendation
                    .priority,

                source:
                  recommendation
                    .source,

                evidence:
                  uniqueStrings(
                    recommendation
                      .evidence ||
                    []
                  ),

                metadata:
                  recommendation
                    .metadata,
              })
            )
            .filter(
              (
                recommendation
              ) =>
                Boolean(
                  recommendation
                    .title &&
                  recommendation
                    .whyItMatters &&
                  recommendation
                    .action
                )
            );

        return {
          id:
            createStableId(
              "milestone",
              milestone.category
                ? `${milestone.category}-${title}`
                : title,
              index
            ),

          order:
            index +
            1,

          category:
            milestone
              .category,

          title,

          description,

          reason,

          readinessScore:
            typeof milestone
              .readinessScore ===
              "number"
              ? clamp(
                  milestone
                    .readinessScore,
                  0,
                  100
                )
              : undefined,

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

          relatedSkills,

          recommendations,

          generatedBy:
            milestone
              .generatedBy ||
            "system",

          generatedAt,

          metadata: {
            originalOrder:
              milestone.order,

            personalized:
              (
                milestone
                  .generatedBy ===
                "qwen"
              ),

            recommendationCount:
              recommendations
                .length,
          },
        };
      }
    );
};

export const preserveCompletedRoadmapState = (
  previous:
    ICareerRoadmapMilestone[],
  next:
    ICareerRoadmapMilestone[]
): ICareerRoadmapMilestone[] => {
  const completedCategories =
    new Set(
      previous
        .filter(
          (
            milestone
          ) =>
            milestone.status ===
              "completed" &&
            Boolean(
              milestone.category
            )
        )
        .map(
          (
            milestone
          ) =>
            milestone.category
        )
    );

  const completedTitles =
    new Set(
      previous
        .filter(
          (
            milestone
          ) =>
            milestone.status ===
            "completed"
        )
        .map(
          (
            milestone
          ) =>
            normalizeString(
              milestone.title
            )
              .toLowerCase()
        )
    );

  return next.map(
    (
      milestone
    ) => {
      const shouldRemainCompleted =
        (
          milestone.category &&
          completedCategories.has(
            milestone.category
          )
        ) ||
        completedTitles.has(
          normalizeString(
            milestone.title
          )
            .toLowerCase()
        );

      if (
        !shouldRemainCompleted
      ) {
        return milestone;
      }

      return {
        ...milestone,

        status:
          "completed",

        completedAt:
          milestone.completedAt ||
          new Date(),
      };
    }
  );
};

export const buildTasksFromNextSteps = ({
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

export const calculateTaskProgress = (
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
