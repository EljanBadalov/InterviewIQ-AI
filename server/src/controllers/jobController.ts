import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose from "mongoose";

import {
  Job,
  type JobExperienceLevel,
} from "../models/Job";

import CareerAutomation, {
  type CareerExperienceLevel,
} from "../models/CareerAutomation";

import {
  ResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  calculateJobMatch,
  rankJobsForProfile,
  type IJobMatchOptions,
} from "../services/jobMatchingService";

import {
  buildCareerSkillProfile,
} from "../services/careerSkillProfileService";

import {
  refreshGeneralExternalJobsForUser,
  refreshSharedJobCatalog,
} from "../services/jobAggregationService";

/* =========================================================
   HELPERS
========================================================= */

const getParamString = (
  value:
    | string
    | string[]
    | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const getExperienceFilter = (
  value: string
):
  | Record<string, unknown>
  | null => {
  switch (value.toLowerCase()) {
    case "entry":
      return {
        experienceMin: {
          $lte: 1,
        },
      };

    case "junior":
      return {
        experienceMin: {
          $gte: 1,
          $lte: 2,
        },
      };

    case "mid":
      return {
        experienceMin: {
          $gte: 2,
          $lte: 4,
        },
      };

    case "senior":
      return {
        experienceMin: {
          $gte: 4,
        },
      };

    default:
      return null;
  }
};

const getAuthenticatedUserId = (
  req: Request
): string | null => {
  const userId =
    req.user
      ?._id
      ?.toString();

  return userId || null;
};

const isJobExperienceLevel = (
  value: CareerExperienceLevel
): value is JobExperienceLevel => {
  return [
    "internship",
    "entry",
    "junior",
    "mid",
    "senior",
    "lead",
  ].includes(value);
};

const getPreferredExperienceLevels = (
  values:
    CareerExperienceLevel[]
): JobExperienceLevel[] => {
  return values.filter(
    isJobExperienceLevel
  );
};

const getMatchOptions = (
  automation:
    | {
      targetRole?: string;
      jobPreferences?: {
        targetRoles?: string[];
        experienceLevels?: CareerExperienceLevel[];
      };
    }
    | null
    | undefined
): IJobMatchOptions => {
  if (!automation) {
    return {};
  }

  const preferenceTargetRole =
    automation
      .jobPreferences
      ?.targetRoles
      ?.find(
        (role) =>
          typeof role === "string" &&
          Boolean(role.trim())
      )
      ?.trim();

  const automationTargetRole =
    typeof automation.targetRole === "string"
      ? automation.targetRole.trim()
      : "";

  const targetRole =
    preferenceTargetRole ||
    automationTargetRole ||
    undefined;

  const preferredExperienceLevels =
    getPreferredExperienceLevels(
      automation
        .jobPreferences
        ?.experienceLevels ??
      []
    );

  return {
    ...(targetRole
      ? {
        targetRole,
      }
      : {}),

    ...(preferredExperienceLevels.length > 0
      ? {
        preferredExperienceLevels,
      }
      : {}),
  };
};

const getUserAutomation = async (
  userObjectId:
    mongoose.Types.ObjectId
) => {
  return CareerAutomation.findOne({
    userId:
      userObjectId,

    status: {
      $in: [
        "active",
        "paused",
      ],
    },
  }).lean();
};

const synchronizeStoredMatchScores = async (
  automationId:
    mongoose.Types.ObjectId,
  recalculatedScores:
    Map<string, number>
): Promise<void> => {
  if (recalculatedScores.size === 0) {
    return;
  }

  const automation =
    await CareerAutomation.findById(
      automationId
    );

  if (!automation) {
    return;
  }

  let changed =
    false;

  for (
    const storedMatch of
    automation.jobMatches
  ) {
    const jobId =
      storedMatch.jobId.toString();

    const currentScore =
      recalculatedScores.get(
        jobId
      );

    if (
      typeof currentScore !==
      "number"
    ) {
      continue;
    }

    if (
      storedMatch.matchScore !==
      currentScore
    ) {
      storedMatch.matchScore =
        currentScore;

      changed =
        true;
    }
  }

  if (changed) {
    await automation.save();
  }
};

/* =========================================================
   GET JOBS
========================================================= */

export const getJobs =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const {
        search,
        experienceLevel,
        employmentType,
        remoteType,
        source,
      } =
        req.query;

      /*
       * Job Matching exposes vacancies from every
       * supported external source.
       *
       * IMPORTANT:
       * Glorri must be included here or Glorri jobs
       * stored in MongoDB will never reach frontend.
       */
      const supportedSources = [
        "Greenhouse",
        "Lever",
        "Ashby",
        "SuccessFactors",
        "Bir Careers",
        "ABB Careers",
        "Glorri",
      ];

      const filter:
        Record<string, unknown> = {
        isActive:
          true,

        source: {
          $in:
            supportedSources,
        },
      };

      if (
        typeof employmentType ===
        "string" &&
        employmentType.trim()
      ) {
        filter.employmentType =
          employmentType
            .trim()
            .toLowerCase();
      }

      if (
        typeof remoteType ===
        "string" &&
        remoteType.trim()
      ) {
        filter.remoteType =
          remoteType
            .trim()
            .toLowerCase();
      }

      /*
       * Source filtering is optional.
       * Only supported source names are accepted.
       */
      const allowedSources =
        new Set(
          supportedSources
        );

      if (
        typeof source ===
        "string" &&
        source.trim() &&
        allowedSources.has(
          source.trim()
        )
      ) {
        filter.source =
          source.trim();
      }

      if (
        typeof experienceLevel ===
        "string" &&
        experienceLevel.trim()
      ) {
        const experienceFilter =
          getExperienceFilter(
            experienceLevel.trim()
          );

        if (
          experienceFilter
        ) {
          Object.assign(
            filter,
            experienceFilter
          );
        }
      }

      if (
        typeof search ===
        "string" &&
        search.trim()
      ) {
        const escapedSearch =
          search
            .trim()
            .replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

        const regex =
          new RegExp(
            escapedSearch,
            "i"
          );

        filter.$or = [
          {
            title:
              regex,
          },

          {
            company:
              regex,
          },

          {
            location:
              regex,
          },

          {
            skills:
              regex,
          },

          {
            keywords:
              regex,
          },
        ];
      }

      const userObjectId =
        new mongoose
          .Types
          .ObjectId(
            userId
          );

      /*
       * Load the COMPLETE active vacancy pool.
       *
       * There is intentionally NO .limit(1000).
       *
       * MongoDB returns newest vacancies first.
       */
      const [
        jobs,
        automation,
        latestResume,
      ] =
        await Promise.all([
          Job.find(
            filter
          )
            .sort({
              postedAt:
                -1,

              createdAt:
                -1,
            })
            .lean(),

          getUserAutomation(
            userObjectId
          ),

          ResumeAnalysis.findOne({
            user:
              userObjectId,
          })
            .sort({
              createdAt:
                -1,
            })
            .lean(),
        ]);

      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
        });

      /*
       * If there is no CV/career profile yet,
       * still return the complete vacancy pool.
       */
      if (
        careerProfile.totalSkills ===
        0
      ) {
        res.status(
          200
        ).json({
          success:
            true,

          hasResume:
            Boolean(
              latestResume
            ),

          hasCareerProfile:
            false,

          message:
            "Add resume or skill evidence to see personalized job matches.",

          data: {
            jobs:
              jobs.map(
                (job) => ({
                  ...job,

                  match:
                    null,
                })
              ),

            total:
              jobs.length,
          },
        });

        return;
      }

      /*
       * Calculate CV/profile matching for every vacancy.
       *
       * Career Automation target role/location/etc.
       * does NOT filter the general Job Matching page.
       */
      const rankedJobs =
        rankJobsForProfile(
          careerProfile,
          jobs,
          {}
        );

      /*
       * Job Matching page is freshness-first.
       *
       * rankJobsForProfile() calculates match data,
       * but final frontend order is:
       *
       * newest -> oldest
       *
       * Match score is preserved and returned,
       * but it does not control the primary ordering.
       */
      const sortedJobs =
        [
          ...rankedJobs,
        ].sort(
          (
            a,
            b
          ) => {
            /*
             * Primary sorting:
             * newest vacancy -> oldest vacancy
             */
            const aPostedAt =
              a.job.postedAt
                ? new Date(
                  a.job.postedAt
                ).getTime()
                : 0;

            const bPostedAt =
              b.job.postedAt
                ? new Date(
                  b.job.postedAt
                ).getTime()
                : 0;

            const safeAPostedAt =
              Number.isFinite(
                aPostedAt
              )
                ? aPostedAt
                : 0;

            const safeBPostedAt =
              Number.isFinite(
                bPostedAt
              )
                ? bPostedAt
                : 0;

            const postedDifference =
              safeBPostedAt -
              safeAPostedAt;

            if (
              postedDifference !==
              0
            ) {
              return postedDifference;
            }

            /*
             * If postedAt is identical,
             * match score is only a tie-breaker.
             */
            return (
              b.match.matchScore -
              a.match.matchScore
            );
          }
        );

      console.log(
        "[GET JOBS] Complete job pool loaded:",
        {
          total:
            jobs.length,

          returned:
            sortedJobs.length,

          sources:
            supportedSources,
        }
      );

      res.status(
        200
      ).json({
        success:
          true,

        hasResume:
          Boolean(
            latestResume
          ),

        hasCareerProfile:
          true,

        ...(latestResume
          ? {
            resume: {
              id:
                latestResume._id,

              fileName:
                latestResume.fileName,

              overallScore:
                latestResume.overallScore,

              analyzedAt:
                latestResume.createdAt,
            },
          }
          : {}),

        careerProfile: {
          totalSkills:
            careerProfile.totalSkills,

          generatedAt:
            careerProfile.generatedAt,
        },

        data: {
          jobs:
            sortedJobs.map(
              ({
                job,
                match,
              }) => ({
                ...job,

                match,
              })
            ),

          total:
            sortedJobs.length,
        },
      });
    } catch (
    error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   GET JOB BY ID
========================================================= */

export const getJobById =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const jobId =
        getParamString(
          req.params.jobId
        );

      if (
        !jobId ||
        !mongoose
          .Types
          .ObjectId
          .isValid(
            jobId
          )
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Invalid job ID",
        });

        return;
      }

      const userObjectId =
        new mongoose
          .Types
          .ObjectId(
            userId
          );

      const [
        job,
        automation,
        latestResume,
      ] =
        await Promise.all([
          Job.findOne({
            _id:
              new mongoose
                .Types
                .ObjectId(
                  jobId
                ),

            isActive:
              true,
          }).lean(),

          getUserAutomation(
            userObjectId
          ),

          ResumeAnalysis.findOne({
            user:
              userObjectId,
          })
            .sort({
              createdAt:
                -1,
            })
            .lean(),
        ]);

      if (!job) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Job not found",
        });

        return;
      }

      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
        });

      if (
        careerProfile.totalSkills ===
        0
      ) {
        res.status(
          200
        ).json({
          success:
            true,

          hasResume:
            Boolean(
              latestResume
            ),

          hasCareerProfile:
            false,

          message:
            "Add resume or skill evidence to see your match for this job.",

          data: {
            job: {
              ...job,

              match:
                null,
            },
          },
        });

        return;
      }

      const match =
        calculateJobMatch(
          careerProfile,
          job,
          getMatchOptions(
            automation
          )
        );

      res.status(
        200
      ).json({
        success:
          true,

        hasResume:
          Boolean(
            latestResume
          ),

        hasCareerProfile:
          true,

        ...(latestResume
          ? {
            resume: {
              id:
                latestResume._id,

              fileName:
                latestResume.fileName,

              overallScore:
                latestResume.overallScore,

              analyzedAt:
                latestResume.createdAt,
            },
          }
          : {}),

        data: {
          job: {
            ...job,

            match,
          },
        },
      });
    } catch (
    error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   GET JOB MATCH
========================================================= */

export const getJobMatch =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const jobId =
        getParamString(
          req.params.jobId
        );

      if (
        !jobId ||
        !mongoose
          .Types
          .ObjectId
          .isValid(
            jobId
          )
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Invalid job ID",
        });

        return;
      }

      const userObjectId =
        new mongoose
          .Types
          .ObjectId(
            userId
          );

      const [
        job,
        automation,
      ] =
        await Promise.all([
          Job.findOne({
            _id:
              new mongoose
                .Types
                .ObjectId(
                  jobId
                ),

            isActive:
              true,
          }).lean(),

          getUserAutomation(
            userObjectId
          ),
        ]);

      if (!job) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Job not found",
        });

        return;
      }

      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
        });

      if (
        careerProfile.totalSkills ===
        0
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "No career skill evidence found. Please analyze a resume or add skill evidence first.",
        });

        return;
      }

      const match =
        calculateJobMatch(
          careerProfile,
          job,
          getMatchOptions(
            automation
          )
        );

      res.status(
        200
      ).json({
        success:
          true,

        data: {
          profile: {
            resumeAnalysisId:
              careerProfile
                .resumeAnalysisId,

            resumeFileName:
              careerProfile
                .resumeFileName,

            totalSkills:
              careerProfile
                .totalSkills,

            generatedAt:
              careerProfile
                .generatedAt,
          },

          job: {
            id:
              job._id,

            title:
              job.title,

            company:
              job.company,

            source:
              job.source,

            externalUrl:
              job.externalUrl,
          },

          match,
        },
      });
    } catch (
    error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   REFRESH REAL EXTERNAL JOBS
========================================================= */

export const refreshExternalJobs =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      /*
       * FAST USER-FACING REFRESH
       *
       * Search Again must not wait for live ATS/provider crawling.
       * The shared Job collection is populated separately by the
       * ingestion/background flow. Here we only read MongoDB,
       * apply Career Automation preferences, calculate CV match,
       * rank the jobs, and save the current recommendations.
       */
      /*
 * First synchronize the complete external provider catalog
 * with MongoDB. This pulls the latest GitHub career snapshots
 * (Bir, ABB, Glorri, etc.), upserts current vacancies and
 * deactivates stale vacancies.
 */
      const catalogSync =
        await refreshSharedJobCatalog();

      /*
       * After MongoDB is fresh, calculate CV matching against the
       * complete active vacancy pool.
       */
      const result =
        await refreshGeneralExternalJobsForUser(
          userId
        );

      console.log(
        "[JOB REFRESH] Catalog synchronized and matching completed:",
        {
          catalogSync,
          analyzed:
            result.analyzed,
          returned:
            result.returned,
        }
      );

      res.status(
        200
      ).json({
        success:
          true,

        message:
          result.returned >
            0
            ? `Found ${result.returned} matching vacancies.`
            : "No matching vacancies were found in the current job database.",

        data:
          result,
      });
    } catch (
    error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   GET CAREER AUTOMATION EXTERNAL MATCHES
========================================================= */

export const getExternalJobMatches =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getAuthenticatedUserId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const userObjectId =
        new mongoose
          .Types
          .ObjectId(
            userId
          );

      const automation =
        await getUserAutomation(
          userObjectId
        );

      if (!automation) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "Career Automation was not found.",
        });

        return;
      }

      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              .activeResumeId,
        });

      if (
        careerProfile.totalSkills ===
        0
      ) {
        res.status(
          200
        ).json({
          success:
            true,

          data: {
            jobs:
              [],

            total:
              0,

            lastJobSearchAt:
              automation
                .lastJobSearchAt,

            nextJobSearchAt:
              automation
                .nextJobSearchAt,
          },
        });

        return;
      }

      const savedMatches =
        [
          ...automation
            .jobMatches,
        ];

      const jobIds =
        savedMatches.map(
          (item) =>
            item.jobId
        );

      if (
        jobIds.length ===
        0
      ) {
        res.status(
          200
        ).json({
          success:
            true,

          data: {
            jobs:
              [],

            total:
              0,

            lastJobSearchAt:
              automation
                .lastJobSearchAt,

            nextJobSearchAt:
              automation
                .nextJobSearchAt,
          },
        });

        return;
      }

      const jobs =
        await Job.find({
          _id: {
            $in:
              jobIds,
          },

          isActive:
            true,
        }).lean();

      const jobById =
        new Map(
          jobs.map(
            (job) => [
              job
                ._id
                .toString(),
              job,
            ]
          )
        );

      const storedMatchByJobId =
        new Map(
          savedMatches.map(
            (match) => [
              match
                .jobId
                .toString(),
              match,
            ]
          )
        );

      const matchOptions =
        getMatchOptions(
          automation
        );

      const recalculatedScores =
        new Map<
          string,
          number
        >();

      const recalculatedMatches =
        savedMatches
          .map(
            (storedMatch) => {
              const jobId =
                storedMatch
                  .jobId
                  .toString();

              const job =
                jobById.get(
                  jobId
                );

              if (!job) {
                return null;
              }

              const currentMatch =
                calculateJobMatch(
                  careerProfile,
                  job,
                  matchOptions
                );

              recalculatedScores.set(
                jobId,
                currentMatch
                  .matchScore
              );

              const storedState =
                storedMatchByJobId.get(
                  jobId
                );

              return {
                job,

                matchScore:
                  currentMatch
                    .matchScore,

                matchedSkills:
                  currentMatch
                    .matchedSkills,

                missingSkills:
                  currentMatch
                    .missingSkills,

                breakdown:
                  currentMatch
                    .breakdown,

                matchLevel:
                  currentMatch
                    .matchLevel,

                matchLabel:
                  currentMatch
                    .matchLabel,

                strengths:
                  currentMatch
                    .strengths,

                improvementAreas:
                  currentMatch
                    .improvementAreas,

                matchedKeywords:
                  currentMatch
                    .matchedKeywords,

                missingKeywords:
                  currentMatch
                    .missingKeywords,

                firstSeenAt:
                  storedState
                    ?.firstSeenAt ??
                  storedMatch
                    .firstSeenAt,

                lastSeenAt:
                  storedState
                    ?.lastSeenAt ??
                  storedMatch
                    .lastSeenAt,

                notificationSent:
                  storedState
                    ?.notificationSent ??
                  storedMatch
                    .notificationSent,
              };
            }
          )
          .filter(
            (
              item
            ): item is NonNullable<
              typeof item
            > =>
              item !==
              null
          )
          .sort(
            (
              a,
              b
            ) =>
              b.matchScore -
              a.matchScore
          )
          .slice(
            0,
            20
          );

      /*
       * Stored scores are only cached state.
       *
       * The current CareerSkillProfile +
       * calculateJobMatch() result is the
       * source of truth returned to frontend.
       *
       * We synchronize the cached scores after
       * recalculation so future stored state does
       * not drift unnecessarily.
       */
      try {
        await synchronizeStoredMatchScores(
          automation._id,
          recalculatedScores
        );
      } catch (
      synchronizationError
      ) {
        console.warn(
          "[JOB CONTROLLER] Could not synchronize cached match scores:",
          synchronizationError
        );
      }

      res.status(
        200
      ).json({
        success:
          true,

        data: {
          jobs:
            recalculatedMatches,

          total:
            recalculatedMatches
              .length,

          lastJobSearchAt:
            automation
              .lastJobSearchAt,

          nextJobSearchAt:
            automation
              .nextJobSearchAt,
        },
      });
    } catch (
    error
    ) {
      next(
        error
      );
    }
  };