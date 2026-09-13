import {
  Request,
  Response,
} from "express";

import CareerAutomation, {
  type CareerAutomationStatus,
  type CareerTaskStatus,
  type CareerWorkMode,
  type CareerEmploymentType,
  type CareerExperienceLevel,
} from "../models/CareerAutomation";

import {
  createCareerAutomation,
  generateDailyCareerPlan,
  getCareerAutomation,
  getCareerAutomationSummary,
  refreshCareerAutomationProgress,
  replanCareerAutomation,
  setCareerAutomationStatus,
  updateCareerTaskStatus,
} from "../services/careerAutomationService";

import {
  getAllCareerFields,
} from "../services/careerFieldService";

/* =========================================================
   TYPES
========================================================= */

interface ICreateAutomationBody {
  targetRole?: unknown;

  careerGoal?: unknown;

  targetDate?: unknown;

  roadmapDurationDays?: unknown;

  activeResumeId?: unknown;

  activeInterviewId?: unknown;

  jobPreferences?: {
    enabled?: unknown;

    targetRoles?: unknown;

    locations?: unknown;

    workModes?: unknown;

    employmentTypes?: unknown;

    experienceLevels?: unknown;

    minimumMatchScore?: unknown;

    dailyApplicationTarget?: unknown;

    notifyOnNewMatches?: unknown;

    notificationMatchThreshold?: unknown;
  };

  settings?: {
    automationEnabled?: unknown;

    dailyTasksEnabled?: unknown;

    jobSearchEnabled?: unknown;

    interviewPrepEnabled?: unknown;

    learningTasksEnabled?: unknown;

    cvTasksEnabled?: unknown;

    portfolioTasksEnabled?: unknown;

    automaticReplanningEnabled?: unknown;

    maxDailyTasks?: unknown;

    preferredDailyMinutes?: unknown;

    timezone?: unknown;
  };
}

interface IUpdateJobPreferencesBody {
  targetRole?: unknown;

  enabled?: unknown;

  locations?: unknown;

  workModes?: unknown;

  employmentTypes?: unknown;

  experienceLevels?: unknown;

  minimumMatchScore?: unknown;

  dailyApplicationTarget?: unknown;

  notifyOnNewMatches?: unknown;

  notificationMatchThreshold?: unknown;
}

interface IUpdateTaskBody {
  status?: unknown;
}

interface IReplanBody {
  reason?: unknown;

  preserveCompletedTasks?: unknown;
}

interface IStatusBody {
  status?: unknown;
}

interface IDailyPlanBody {
  date?: unknown;

  force?: unknown;
}

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_AUTOMATION_STATUSES:
  CareerAutomationStatus[] = [
    "active",
    "paused",
    "completed",
    "archived",
  ];

const VALID_TASK_STATUSES:
  CareerTaskStatus[] = [
    "pending",
    "in_progress",
    "completed",
    "skipped",
  ];

const VALID_WORK_MODES:
  CareerWorkMode[] = [
    "remote",
    "hybrid",
    "onsite",
  ];

const VALID_EMPLOYMENT_TYPES:
  CareerEmploymentType[] = [
    "full_time",
    "part_time",
    "internship",
    "contract",
    "temporary",
  ];

const VALID_EXPERIENCE_LEVELS:
  CareerExperienceLevel[] = [
    "internship",
    "entry",
    "junior",
    "mid",
    "senior",
    "lead",
  ];

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value:
    unknown
): string | undefined => {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const normalized =
    value
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    normalized ||
    undefined
  );
};

const normalizeBoolean = (
  value:
    unknown
): boolean | undefined => {
  return (
    typeof value ===
      "boolean"
      ? value
      : undefined
  );
};

const normalizeNumber = (
  value:
    unknown
): number | undefined => {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    const parsed =
      Number(
        value
      );

    if (
      Number.isFinite(
        parsed
      )
    ) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeDate = (
  value:
    unknown
): Date | undefined => {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  const parsed =
    value instanceof
      Date
      ? new Date(
          value
        )
      : typeof value ===
          "string" ||
        typeof value ===
          "number"
        ? new Date(
            value
          )
        : null;

  if (
    !parsed ||
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return undefined;
  }

  return parsed;
};

const normalizeStringArray = (
  value:
    unknown
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          normalizeString
        )
        .filter(
          (
            item
          ): item is string =>
            Boolean(
              item
            )
        )
    )
  );
};

const normalizeEnumArray = <
  T extends string
>(
  value:
    unknown,
  allowed:
    readonly T[]
): T[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const allowedSet =
    new Set<string>(
      allowed
    );

  return Array.from(
    new Set(
      value.filter(
        (
          item
        ): item is T =>
          typeof item ===
            "string" &&
          allowedSet.has(
            item
          )
      )
    )
  );
};

const getAuthenticatedUserId = (
  req:
    Request
): string | undefined => {
  const user =
    req.user;

  if (
    !user ||
    !user._id
  ) {
    return undefined;
  }

  return (
    String(
      user._id
    ).trim() ||
    undefined
  );
};

const requireAuthenticatedUserId = (
  req:
    Request,
  res:
    Response
): string | null => {
  const userId =
    getAuthenticatedUserId(
      req
    );

  if (
    !userId
  ) {
    res.status(
      401
    ).json({
      success:
        false,

      message:
        "Authentication is required.",
    });

    return null;
  }

  return userId;
};

const getErrorMessage = (
  error:
    unknown,
  fallback:
    string
): string => {
  if (
    error instanceof
      Error
  ) {
    return (
      error.message ||
      fallback
    );
  }

  return fallback;
};

/* =========================================================
   CREATE / INITIALIZE
========================================================= */

export const createAutomation =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as ICreateAutomationBody;

      const targetRole =
        normalizeString(
          body.targetRole
        );

      const careerGoal =
        normalizeString(
          body.careerGoal
        );

      if (
        !targetRole
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Target role is required.",
        });

        return;
      }

      if (
        !careerGoal
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Career goal is required.",
        });

        return;
      }

      const targetDate =
        normalizeDate(
          body.targetDate
        );

      if (
        body.targetDate !==
          undefined &&
        body.targetDate !==
          null &&
        body.targetDate !==
          "" &&
        !targetDate
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Target date is invalid.",
        });

        return;
      }

      const automation =
        await createCareerAutomation({
          userId,

          targetRole,

          careerGoal,

          targetDate,

          roadmapDurationDays:
            normalizeNumber(
              body.roadmapDurationDays
            ),

          activeResumeId:
            normalizeString(
              body.activeResumeId
            ),

          activeInterviewId:
            normalizeString(
              body.activeInterviewId
            ),

          jobPreferences: {
            enabled:
              normalizeBoolean(
                body
                  .jobPreferences
                  ?.enabled
              ),

            /*
             * Main targetRole is always included.
             */
            targetRoles:
              Array.from(
                new Set([
                  targetRole,

                  ...normalizeStringArray(
                    body
                      .jobPreferences
                      ?.targetRoles
                  ),
                ])
              ),

            locations:
              normalizeStringArray(
                body
                  .jobPreferences
                  ?.locations
              ),

            workModes:
              normalizeEnumArray(
                body
                  .jobPreferences
                  ?.workModes,
                VALID_WORK_MODES
              ),

            employmentTypes:
              normalizeEnumArray(
                body
                  .jobPreferences
                  ?.employmentTypes,
                VALID_EMPLOYMENT_TYPES
              ),

            experienceLevels:
              normalizeEnumArray(
                body
                  .jobPreferences
                  ?.experienceLevels,
                VALID_EXPERIENCE_LEVELS
              ),

            minimumMatchScore:
              normalizeNumber(
                body
                  .jobPreferences
                  ?.minimumMatchScore
              ),

            dailyApplicationTarget:
              normalizeNumber(
                body
                  .jobPreferences
                  ?.dailyApplicationTarget
              ) ??
              3,

            notifyOnNewMatches:
              normalizeBoolean(
                body
                  .jobPreferences
                  ?.notifyOnNewMatches
              ),

            notificationMatchThreshold:
              normalizeNumber(
                body
                  .jobPreferences
                  ?.notificationMatchThreshold
              ),
          },

          settings: {
            automationEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.automationEnabled
              ),

            dailyTasksEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.dailyTasksEnabled
              ),

            jobSearchEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.jobSearchEnabled
              ),

            interviewPrepEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.interviewPrepEnabled
              ),

            learningTasksEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.learningTasksEnabled
              ),

            cvTasksEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.cvTasksEnabled
              ),

            portfolioTasksEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.portfolioTasksEnabled
              ),

            automaticReplanningEnabled:
              normalizeBoolean(
                body
                  .settings
                  ?.automaticReplanningEnabled
              ),

            maxDailyTasks:
              normalizeNumber(
                body
                  .settings
                  ?.maxDailyTasks
              ),

            preferredDailyMinutes:
              normalizeNumber(
                body
                  .settings
                  ?.preferredDailyMinutes
              ),

            timezone:
              normalizeString(
                body
                  .settings
                  ?.timezone
              ),
          },
        });

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        201
      ).json({
        success:
          true,

        message:
          "Career automation created successfully.",

        data: {
          automation,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Create failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to create career automation."
          ),
      });
    }
  };

/* =========================================================
   UPDATE JOB SEARCH PREFERENCES
========================================================= */

export const updateJobPreferences =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as IUpdateJobPreferencesBody;

      const automation =
        await CareerAutomation.findOne({
          userId,

          status: {
            $in: [
              "active",
              "paused",
            ],
          },
        });

      if (
        !automation
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Career automation was not found.",
        });

        return;
      }

      const targetRole =
        normalizeString(
          body.targetRole
        );

      if (
        body.targetRole !==
          undefined &&
        !targetRole
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Target role cannot be empty.",
        });

        return;
      }

      if (
        targetRole
      ) {
        automation.targetRole =
          targetRole;

        /*
         * Keep jobPreferences target role aligned with the
         * primary Career Automation target role.
         */
        automation
          .jobPreferences
          .targetRoles = [
            targetRole,
          ];
      }

      const enabled =
        normalizeBoolean(
          body.enabled
        );

      if (
        enabled !==
        undefined
      ) {
        automation
          .jobPreferences
          .enabled =
          enabled;
      }

      if (
        body.locations !==
        undefined
      ) {
        automation
          .jobPreferences
          .locations =
          normalizeStringArray(
            body.locations
          );
      }

      if (
        body.workModes !==
        undefined
      ) {
        automation
          .jobPreferences
          .workModes =
          normalizeEnumArray(
            body.workModes,
            VALID_WORK_MODES
          );
      }

      if (
        body.employmentTypes !==
        undefined
      ) {
        automation
          .jobPreferences
          .employmentTypes =
          normalizeEnumArray(
            body.employmentTypes,
            VALID_EMPLOYMENT_TYPES
          );
      }

      if (
        body.experienceLevels !==
        undefined
      ) {
        automation
          .jobPreferences
          .experienceLevels =
          normalizeEnumArray(
            body.experienceLevels,
            VALID_EXPERIENCE_LEVELS
          );
      }

      const minimumMatchScore =
        normalizeNumber(
          body.minimumMatchScore
        );

      if (
        minimumMatchScore !==
        undefined
      ) {
        automation
          .jobPreferences
          .minimumMatchScore =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(
                minimumMatchScore
              )
            )
          );
      }

      const dailyApplicationTarget =
        normalizeNumber(
          body.dailyApplicationTarget
        );

      if (
        dailyApplicationTarget !==
        undefined
      ) {
        automation
          .jobPreferences
          .dailyApplicationTarget =
          Math.max(
            1,
            Math.min(
              20,
              Math.round(
                dailyApplicationTarget
              )
            )
          );
      }

      const notifyOnNewMatches =
        normalizeBoolean(
          body.notifyOnNewMatches
        );

      if (
        notifyOnNewMatches !==
        undefined
      ) {
        automation
          .jobPreferences
          .notifyOnNewMatches =
          notifyOnNewMatches;
      }

      const notificationMatchThreshold =
        normalizeNumber(
          body.notificationMatchThreshold
        );

      if (
        notificationMatchThreshold !==
        undefined
      ) {
        automation
          .jobPreferences
          .notificationMatchThreshold =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(
                notificationMatchThreshold
              )
            )
          );
      }

      /*
       * Role/preferences changed.
       * Force next external search to be considered due.
       */
      automation.nextJobSearchAt =
        new Date();

      await automation.save();

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          "Job search preferences updated successfully.",

        data: {
          automation,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Job preferences update failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to update job search preferences."
          ),
      });
    }
  };

/* =========================================================
   GET CAREER FIELDS
========================================================= */

export const getCareerFields =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const fields =
        await getAllCareerFields();

      /*
       * The frontend dropdown only needs stable UI-facing
       * information. Search queries, skills, related roles,
       * and other internal matching data stay on the backend.
       */
      const options =
        fields.map(
          (
            field
          ) => ({
            slug:
              field.slug,

            name:
              field.name,

            category:
              field.category,

            description:
              field.description,
          })
        );

      res.status(
        200
      ).json({
        success:
          true,

        data: {
          fields:
            options,

          total:
            options.length,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Career fields load failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to load career fields."
          ),
      });
    }
  };

/* =========================================================
   GET AUTOMATION
========================================================= */

export const getAutomation =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const automation =
        await getCareerAutomation(
          userId
        );

      if (
        !automation
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Career automation was not found.",
        });

        return;
      }

      res.status(
        200
      ).json({
        success:
          true,

        data:
          automation,
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Get failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to load career automation."
          ),
      });
    }
  };

/* =========================================================
   SUMMARY
========================================================= */

export const getAutomationSummary =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const date =
        normalizeDate(
          req.query.date
        ) ||
        new Date();

      const summary =
        await getCareerAutomationSummary(
          userId,
          date
        );

      if (
        !summary
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Career automation was not found.",
        });

        return;
      }

      res.status(
        200
      ).json({
        success:
          true,

        data:
          summary,
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Summary failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to load career automation summary."
          ),
      });
    }
  };

/* =========================================================
   DAILY PLAN
========================================================= */

export const generateDailyPlan =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as IDailyPlanBody;

      const requestedDate =
        normalizeDate(
          body.date
        );

      if (
        body.date !==
          undefined &&
        body.date !==
          null &&
        body.date !==
          "" &&
        !requestedDate
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Daily plan date is invalid.",
        });

        return;
      }

      const tasks =
        await generateDailyCareerPlan({
          userId,

          date:
            requestedDate ||
            new Date(),

          force:
            normalizeBoolean(
              body.force
            ) ||
            false,
        });

      const summary =
        await getCareerAutomationSummary(
          userId,
          requestedDate ||
          new Date()
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          "Daily career plan is ready.",

        data: {
          tasks,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Daily plan failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to generate daily career plan."
          ),
      });
    }
  };

/* =========================================================
   UPDATE TASK STATUS
========================================================= */

export const updateTaskStatus =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const taskId =
        normalizeString(
          req.params.taskId
        );

      if (
        !taskId
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Task ID is required.",
        });

        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as IUpdateTaskBody;

      const status =
        normalizeString(
          body.status
        ) as
          | CareerTaskStatus
          | undefined;

      if (
        !status ||
        !VALID_TASK_STATUSES.includes(
          status
        )
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Task status must be pending, in_progress, completed, or skipped.",
        });

        return;
      }

      const task =
        await updateCareerTaskStatus({
          userId,

          taskId,

          status,
        });

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          "Career task updated successfully.",

        data: {
          task,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Task update failed:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Failed to update career task."
        );

      res.status(
        /not found/i.test(
          message
        )
          ? 404
          : 500
      ).json({
        success:
          false,

        message,
      });
    }
  };

/* =========================================================
   REPLAN
========================================================= */

export const replanAutomation =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as IReplanBody;

      const automation =
        await replanCareerAutomation({
          userId,

          reason:
            normalizeString(
              body.reason
            ),

          preserveCompletedTasks:
            normalizeBoolean(
              body.preserveCompletedTasks
            ) ??
            true,
        });

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          "Career roadmap was recalculated successfully.",

        data: {
          automation,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Replan failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to replan career automation."
          ),
      });
    }
  };

/* =========================================================
   REFRESH PROGRESS
========================================================= */

export const refreshAutomationProgress =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const automation =
        await refreshCareerAutomationProgress(
          userId
        );

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          "Career progress refreshed successfully.",

        data: {
          automation,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Progress refresh failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to refresh career automation progress."
          ),
      });
    }
  };

/* =========================================================
   STATUS
========================================================= */

export const updateAutomationStatus =
  async (
    req:
      Request,
    res:
      Response
  ): Promise<void> => {
    try {
      const userId =
        requireAuthenticatedUserId(
          req,
          res
        );

      if (
        !userId
      ) {
        return;
      }

      const body =
        (
          req.body ||
          {}
        ) as IStatusBody;

      const status =
        normalizeString(
          body.status
        ) as
          | CareerAutomationStatus
          | undefined;

      if (
        !status ||
        !VALID_AUTOMATION_STATUSES.includes(
          status
        )
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Status must be active, paused, completed, or archived.",
        });

        return;
      }

      const automation =
        await setCareerAutomationStatus(
          userId,
          status
        );

      const summary =
        await getCareerAutomationSummary(
          userId
        );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          `Career automation status changed to ${status}.`,

        data: {
          automation,

          summary,
        },
      });
    } catch (
      error
    ) {
      console.error(
        "[Career Automation Controller] Status update failed:",
        error
      );

      res.status(
        500
      ).json({
        success:
          false,

        message:
          getErrorMessage(
            error,
            "Failed to update career automation status."
          ),
      });
    }
  };

export default {
  createAutomation,
  updateJobPreferences,
  getCareerFields,
  getAutomation,
  getAutomationSummary,
  generateDailyPlan,
  updateTaskStatus,
  replanAutomation,
  refreshAutomationProgress,
  updateAutomationStatus,
};