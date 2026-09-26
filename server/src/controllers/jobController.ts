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
        res.status(401).json({
          success: false,
          message: "Not authorized",
        });

        return;
      }

      const {
        search,
        location,
        experienceLevel,
        employmentType,
        remoteType,
        source,
        market,
        minimumSalary,
        matchLevel,
      } = req.query;

      /* =====================================================
         BASE FILTER
      ===================================================== */

      const allowedSources = [
        "Greenhouse",
        "Lever",
        "Ashby",
        "SuccessFactors",
        "Bir Careers",
        "ABB Careers",
        "Glorri",
      ];

      const filter:
        Record<string, any> = {
        isActive: true,

        source: {
          $in: allowedSources,
        },
      };

      /* =====================================================
         SEARCH
      ===================================================== */

      if (
        typeof search === "string" &&
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
            title: regex,
          },
          {
            company: regex,
          },
          {
            location: regex,
          },
          {
            skills: regex,
          },
          {
            keywords: regex,
          },
        ];
      }

      /* =====================================================
         EMPLOYMENT TYPE
      ===================================================== */

      if (
        typeof employmentType ===
        "string" &&
        employmentType.trim()
      ) {
        const employmentTypes =
          employmentType
            .split(",")
            .map(
              (value) =>
                value
                  .trim()
                  .toLowerCase()
            )
            .filter(Boolean);

        if (
          employmentTypes.length === 1
        ) {
          filter.employmentType =
            employmentTypes[0];
        } else if (
          employmentTypes.length > 1
        ) {
          filter.employmentType = {
            $in: employmentTypes,
          };
        }
      }

      /* =====================================================
         WORK MODE
      ===================================================== */

      if (
        typeof remoteType === "string" &&
        remoteType.trim()
      ) {
        const remoteTypes =
          remoteType
            .split(",")
            .map(
              (value) =>
                value
                  .trim()
                  .toLowerCase()
            )
            .filter(Boolean);

        if (remoteTypes.length === 1) {
          filter.remoteType =
            remoteTypes[0];
        } else if (
          remoteTypes.length > 1
        ) {
          filter.remoteType = {
            $in: remoteTypes,
          };
        }
      }

      /* =====================================================
         EXPERIENCE
      ===================================================== */

      if (
        typeof experienceLevel ===
        "string" &&
        experienceLevel.trim() &&
        experienceLevel !== "all"
      ) {
        const experienceFilterResult =
          getExperienceFilter(
            experienceLevel.trim()
          );

        if (
          experienceFilterResult
        ) {
          Object.assign(
            filter,
            experienceFilterResult
          );
        }
      }

      /* =====================================================
         SOURCE
      ===================================================== */

      if (
        typeof source === "string" &&
        source.trim()
      ) {
        const requestedSources =
          source
            .split(",")
            .map(
              (value) =>
                value.trim()
            )
            .filter(
              (value) =>
                allowedSources.includes(
                  value
                )
            );

        if (
          requestedSources.length === 1
        ) {
          filter.source =
            requestedSources[0];
        } else if (
          requestedSources.length > 1
        ) {
          filter.source = {
            $in: requestedSources,
          };
        }
      }

      /* =====================================================
   LOCATION + MARKET
   ===================================================== */

      const locationConditions:
        Record<string, unknown>[] = [];

      /*
       * Azerbaijan locations.
       *
       * Used both for:
       * - market=azerbaijan
       * - excluding Azerbaijan from market=global
       */
      const azerbaijanLocationRegex =
        /(?:\bazerbaijan\b|\bazərbaycan\b|\bbaku\b|\bbakı\b|\bganja\b|\bgəncə\b|\bsumqayit\b|\bsumqayıt\b|\bmingachevir\b|\bmingəçevir\b|\byevelakh\b|\byevlakh\b|\byevlax\b|\bqusar\b|\bquba\b|\bshaki\b|\bşəki\b|\blankaran\b|\blənkəran\b|\bnakhchivan\b|\bnaxçıvan\b|\barda\b|\bbarda\b|\bbərdə\b|\bkhirdalan\b|\bxırdalan\b)/i;

      /*
       * USA detection.
       *
       * Supports:
       * USA
       * US
       * U.S.
       * U.S.A.
       * United States
       * United States of America
       *
       * Also supports normal US city/state strings:
       * Boston, MA
       * New York, NY
       * Austin, TX
       * San Francisco, CA
       *
       * IMPORTANT:
       * State abbreviations are expected as standalone
       * uppercase-style tokens in the stored location.
       */
      const usaLocationRegex =
        /(?:\bUSA\b|\bU\.?S\.?A?\.?\b|\bUnited States(?: of America)?\b|(?:^|,\s*|\s)(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\s|,|$))/i;

      /* =====================================================
         LOCATION FILTER
         ===================================================== */

      if (
        typeof location === "string" &&
        location.trim()
      ) {
        const rawLocation =
          location.trim();

        const normalizedLocation =
          rawLocation.toLowerCase();

        const usaAliases =
          new Set([
            "usa",
            "us",
            "u.s.",
            "u.s.a.",
            "united states",
            "united states of america",
          ]);

        const azerbaijanAliases =
          new Set([
            "azerbaijan",
            "azərbaycan",
          ]);

        /*
         * USA
         */
        if (
          usaAliases.has(
            normalizedLocation
          )
        ) {
          locationConditions.push({
            location:
              usaLocationRegex,
          });
        }

        /*
         * Azerbaijan
         */
        else if (
          azerbaijanAliases.has(
            normalizedLocation
          )
        ) {
          locationConditions.push({
            location:
              azerbaijanLocationRegex,
          });
        }

        /*
         * Normal city/country/location search.
         *
         * Examples:
         * Germany
         * Berlin
         * London
         * Boston
         * Canada
         */
        else {
          const escapedLocation =
            rawLocation.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          locationConditions.push({
            location:
              new RegExp(
                escapedLocation,
                "i"
              ),
          });
        }
      }

      /* =====================================================
         MARKET FILTER
         ===================================================== */

      if (
        typeof market === "string" &&
        market.trim()
      ) {
        const normalizedMarket =
          market
            .trim()
            .toLowerCase();

        /*
         * Azerbaijan market:
         * only Azerbaijan vacancies.
         */
        if (
          normalizedMarket ===
          "azerbaijan"
        ) {
          locationConditions.push({
            location:
              azerbaijanLocationRegex,
          });
        }

        /*
         * Global market:
         * exclude Azerbaijan vacancies.
         *
         * IMPORTANT:
         * This is additive.
         *
         * Therefore:
         *
         * location=USA
         * market=global
         *
         * becomes:
         *
         * USA location
         * AND
         * NOT Azerbaijan
         *
         * instead of one filter overwriting another.
         */
        if (
          normalizedMarket ===
          "global"
        ) {
          locationConditions.push({
            location: {
              $not:
                azerbaijanLocationRegex,
            },
          });
        }
      }

      /* =====================================================
         APPLY LOCATION CONDITIONS
         ===================================================== */

      if (
        locationConditions.length > 0
      ) {
        filter.$and = [
          ...(
            Array.isArray(
              filter.$and
            )
              ? filter.$and
              : []
          ),

          ...locationConditions,
        ];
      }

      /* =====================================================
         MINIMUM SALARY
      ===================================================== */

      if (
        typeof minimumSalary ===
        "string" &&
        minimumSalary.trim()
      ) {
        const parsedMinimumSalary =
          Number(
            minimumSalary
          );

        if (
          Number.isFinite(
            parsedMinimumSalary
          ) &&
          parsedMinimumSalary > 0
        ) {
          filter.$and = [
            ...(Array.isArray(
              filter.$and
            )
              ? filter.$and
              : []),

            {
              $or: [
                {
                  salary: {
                    $gte:
                      parsedMinimumSalary,
                  },
                },
                {
                  salaryMin: {
                    $gte:
                      parsedMinimumSalary,
                  },
                },
                {
                  salaryMax: {
                    $gte:
                      parsedMinimumSalary,
                  },
                },
              ],
            },
          ];
        }
      }

      /* =====================================================
         USER
      ===================================================== */

      const userObjectId =
        new mongoose.Types.ObjectId(
          userId
        );

      /* =====================================================
         DATABASE
      ===================================================== */

      const [
        jobs,
        automation,
        latestResume,
      ] =
        await Promise.all([
          Job.find(filter)
            /*
             * IMPORTANT:
             * No 1000-job cap.
             *
             * Return the complete matching pool.
             * Newest vacancies first.
             */
            .sort({
              postedAt: -1,
              createdAt: -1,
            })
            .lean(),

          getUserAutomation(
            userObjectId
          ),

          ResumeAnalysis.findOne({
            user: userObjectId,
          })
            .sort({
              createdAt: -1,
            })
            .lean(),
        ]);

      /* =====================================================
         CAREER PROFILE
      ===================================================== */

      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
        });

      /* =====================================================
         NO CAREER PROFILE
      ===================================================== */

      if (
        careerProfile.totalSkills === 0
      ) {
        res.status(200).json({
          success: true,

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
                  match: null,
                })
              ),

            total:
              jobs.length,
          },
        });

        return;
      }

      /* =====================================================
         CALCULATE MATCH
      ===================================================== */

      let jobsWithMatch =
        jobs.map(
          (job) => {
            const match =
              calculateJobMatch(
                careerProfile,
                job,
                {}
              );

            return {
              ...job,

              match: {
                matchScore:
                  match.matchScore,

                matchLevel:
                  match.matchLevel,

                matchedSkills:
                  match.matchedSkills,

                missingSkills:
                  match.missingSkills,
              },
            };
          }
        );

      /* =====================================================
         MATCH LEVEL FILTER
      ===================================================== */

      if (
        typeof matchLevel ===
        "string" &&
        matchLevel.trim() &&
        matchLevel !== "all"
      ) {
        const normalizedMatchLevel =
          matchLevel
            .trim()
            .toLowerCase();

        jobsWithMatch =
          jobsWithMatch.filter(
            (job) =>
              job.match
                ?.matchLevel
                ?.toLowerCase() ===
              normalizedMatchLevel
          );
      }

      /* =====================================================
         FINAL SORT
         NEWEST -> OLDEST

         Match score remains available for display,
         but does not control the primary order.
      ===================================================== */

      jobsWithMatch.sort(
        (
          a,
          b
        ) => {
          const aPostedAt =
            a.postedAt
              ? new Date(
                a.postedAt
              ).getTime()
              : 0;

          const bPostedAt =
            b.postedAt
              ? new Date(
                b.postedAt
              ).getTime()
              : 0;

          const postedDifference =
            bPostedAt -
            aPostedAt;

          if (
            postedDifference !== 0
          ) {
            return postedDifference;
          }

          const aCreatedAt =
            a.createdAt
              ? new Date(
                a.createdAt
              ).getTime()
              : 0;

          const bCreatedAt =
            b.createdAt
              ? new Date(
                b.createdAt
              ).getTime()
              : 0;

          return (
            bCreatedAt -
            aCreatedAt
          );
        }
      );

      /* =====================================================
         RESPONSE
      ===================================================== */

      res.status(200).json({
        success: true,

        hasResume:
          Boolean(
            latestResume
          ),

        hasCareerProfile:
          true,

        resume:
          latestResume,

        data: {
          jobs:
            jobsWithMatch,

          total:
            jobsWithMatch.length,
        },
      });
    } catch (error) {
      next(error);
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
  * First synchronize the complete shared vacancy catalog.
  *
  * This refreshes Greenhouse / Lever / Ashby /
  * SuccessFactors / Bir Careers / ABB Careers / Glorri
  * data in MongoDB before calculating the user's matches.
  */
      const catalogSync =
        await refreshSharedJobCatalog();

      /*
       * MongoDB is now fresh.
       * Calculate CV matching against the complete
       * active vacancy pool.
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