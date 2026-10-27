import { careerReadContext, careerFromSource } from '../services/careerReadContextService';
import { matchesCareerPreferences } from '../services/careerMatchPreferences';
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
  createCachedJobMatcher,
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
    automationTargetRole ||
    preferenceTargetRole ||
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
  }).select("userId status __v targetRole jobPreferences activeResumeId jobMatches lastJobSearchAt nextJobSearchAt").read('primary').readConcern('majority').maxTimeMS(5000).lean();
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
        location,
        minimumSalary,
        market,
        matchLevel,
        page,
        limit,
      } =
        req.query;

      /* =====================================================
         PAGINATION
      ===================================================== */

      const parsedPage =
        Math.max(
          1,
          Number(page) || 1
        );

      const parsedLimit =
        Math.min(
          100,
          Math.max(
            1,
            Number(limit) || 18
          )
        );

      /* =====================================================
         BASE FILTER
      ===================================================== */

      const allowedJobSources = [
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
            $in:
              allowedJobSources,
          },
        };

      /* =====================================================
         SEARCH
      ===================================================== */

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

      /* =====================================================
         EMPLOYMENT TYPE
         Supports:
         full-time
         OR
         full-time,contract
      ===================================================== */

      if (
        typeof employmentType ===
          "string" &&
        employmentType.trim()
      ) {
        const values =
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
          values.length === 1
        ) {
          filter.employmentType =
            values[0];
        } else if (
          values.length > 1
        ) {
          filter.employmentType = {
            $in: values,
          };
        }
      }

      /* =====================================================
         WORK MODE
      ===================================================== */

      if (
        typeof remoteType ===
          "string" &&
        remoteType.trim()
      ) {
        const values =
          remoteType
            .split(",")
            .map(
              (value) =>
                value
                  .trim()
                  .toLowerCase()
            )
            .filter(Boolean);

        if (
          values.length === 1
        ) {
          filter.remoteType =
            values[0];
        } else if (
          values.length > 1
        ) {
          filter.remoteType = {
            $in: values,
          };
        }
      }

      /* =====================================================
         SOURCE
      ===================================================== */

      if (
        typeof source ===
          "string" &&
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
                allowedJobSources
                  .some(
                    (
                      allowedSource
                    ) =>
                      allowedSource
                        .toLowerCase() ===
                      value
                        .toLowerCase()
                  )
            )
            .map(
              (value) =>
                allowedJobSources
                  .find(
                    (
                      allowedSource
                    ) =>
                      allowedSource
                        .toLowerCase() ===
                      value
                        .toLowerCase()
                  )!
            );

        if (
          requestedSources.length ===
          1
        ) {
          filter.source =
            requestedSources[0];
        } else if (
          requestedSources.length >
          1
        ) {
          filter.source = {
            $in:
              requestedSources,
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

      /* =====================================================
         LOCATION / MARKET
      ===================================================== */

      const locationConditions:
        Record<string, any>[] =
        [];

      const azerbaijanLocationRegex =
        /(^|[\s,;(\/-])(azerbaijan|azerbaycan|azərbaycan|baku|bakı|ganja|gəncə|sumqayit|sumqayıt|mingachevir|mingəçevir|nakhchivan|naxçıvan|shirvan|şirvan|shaki|şəki|lankaran|lənkəran|yevlakh|yevlax|barda|bərdə|quba|qusar|gabala|qəbələ|salyan|samukh|samux|goychay|göyçay)(?=$|[\s,;.)\/-])/i;

      if (
        typeof location ===
          "string" &&
        location.trim()
      ) {
        const normalizedLocation =
          location
            .trim()
            .toLowerCase();

        let locationRegex:
          RegExp;

        if (
          [
            "usa",
            "us",
            "u.s.",
            "u.s.a.",
            "united states",
            "united states of america",
          ].includes(
            normalizedLocation
          )
        ) {
          locationRegex =
            /(^|[\s,;(\/-])(usa|us|u\.s\.|u\.s\.a\.|united states|united states of america)(?=$|[\s,;.)\/-])/i;
        } else if (
          [
            "azerbaijan",
            "azerbaycan",
            "azərbaycan",
          ].includes(
            normalizedLocation
          )
        ) {
          locationRegex =
            azerbaijanLocationRegex;
        } else {
          const escapedLocation =
            location
              .trim()
              .replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              );

          locationRegex =
            new RegExp(
              escapedLocation,
              "i"
            );
        }

        locationConditions.push({
          location:
            locationRegex,
        });
      }

      if (
        typeof market ===
          "string" &&
        market.trim() &&
        market !== "all"
      ) {
        const normalizedMarket =
          market
            .trim()
            .toLowerCase();

        if (
          normalizedMarket ===
          "azerbaijan"
        ) {
          locationConditions.push({
            location:
              azerbaijanLocationRegex,
          });
        }

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

      if (
        locationConditions.length >
        0
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
            ...(
              Array.isArray(
                filter.$and
              )
                ? filter.$and
                : []
            ),

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
         USER DATA
      ===================================================== */

      const needsMatchFiltering = typeof matchLevel === "string" && Boolean(matchLevel.trim()) && matchLevel !== "all";
      // Preserve legacy fractional/infinite pagination behavior without passing
      // invalid skip/limit values to the MongoDB driver.
      const needsWholePool = needsMatchFiltering || !Number.isSafeInteger(parsedPage) ||
        !Number.isSafeInteger(parsedLimit) || !Number.isSafeInteger((parsedPage - 1) * parsedLimit);
      const userObjectId =
        new mongoose.Types.ObjectId(
          userId
        );

      const [
        jobs,
        automation,
        latestResume,
        totalCount,
      ] =
        await Promise.all([
          needsWholePool ? Job.find(
            filter
          )
            .sort({
              postedAt: -1,
              createdAt: -1,
            })
            .lean() : Job.find(filter).sort({ postedAt: -1, createdAt: -1 })
              .skip((parsedPage - 1) * parsedLimit).limit(parsedLimit).lean(),

          getUserAutomation(
            userObjectId
          ),

          ResumeAnalysis.findOne({
            user:
              userObjectId,
          })
            .sort({
              createdAt: -1,
            })
            .lean(),
          needsWholePool ? Promise.resolve(0) : Job.countDocuments(filter),
        ]);

      /* =====================================================
         CAREER PROFILE
      ===================================================== */

      const context=careerReadContext(String(userId),req.careerReadVersions,careerFromSource(automation),automation);
      const originalJson=res.json.bind(res);
      res.json=((body:any)=>originalJson(body?.success===true?{...body,careerContext:context}:body)) as typeof res.json;
      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
          preloadedLatestResume: latestResume,
        });

      const matchJob = createCachedJobMatcher(careerProfile, getMatchOptions(automation));

      // Newest-first ordering does not depend on score. Only a matchLevel
      // predicate requires scoring the complete candidate pool before pagination.
      if (!needsMatchFiltering || careerProfile.totalSkills === 0) {
        const total = needsWholePool ? jobs.length : totalCount;
        const totalPages = Math.max(1, Math.ceil(total / parsedLimit));
        const safePage = Math.min(parsedPage, totalPages);
        const startIndex = (safePage - 1) * parsedLimit;
        const pageJobs = needsWholePool
          ? jobs.slice(startIndex, startIndex + parsedLimit)
          : safePage === parsedPage ? jobs : await Job.find(filter).sort({ postedAt: -1, createdAt: -1 })
            .skip(startIndex).limit(parsedLimit).lean();
        const hasCareerProfile = careerProfile.totalSkills > 0;
        const paginatedJobs = pageJobs.map(job => {
          const match = hasCareerProfile ? matchJob(job) : null;
          return { ...job, match: match ? {
            matchScore: match.matchScore, matchLevel: match.matchLevel,
            matchedSkills: match.matchedSkills, missingSkills: match.missingSkills,
          } : null };
        });
        res.status(200).json({
          success: true, hasResume: Boolean(latestResume), hasCareerProfile,
          ...(!hasCareerProfile ? { message: "Add resume or skill evidence to see personalized job matches." } : {}),
          resume: latestResume,
          data: { jobs: paginatedJobs, total, page: safePage, limit: parsedLimit, totalPages,
            hasNextPage: safePage < totalPages, hasPreviousPage: safePage > 1 },
        });
        return;
      }

      /* =====================================================
         CALCULATE CV MATCH

         Keep match information because:
         - matchLevel filter needs it
         - Job Details needs it

         The frontend job card will simply stop displaying
         the large percentage box.
      ===================================================== */

      let jobsWithMatch =
        jobs.map(
          (job) => {
            const match =
              matchJob(job);

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
         MATCH LEVEL
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
                .matchLevel
                .toLowerCase() ===
              normalizedMatchLevel
          );
      }

      /* =====================================================
         SORT
         NEWEST -> OLDEST
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

          if (
            bPostedAt !==
            aPostedAt
          ) {
            return (
              bPostedAt -
              aPostedAt
            );
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
         BACKEND PAGINATION
      ===================================================== */

      const total =
        jobsWithMatch.length;

      const totalPages =
        Math.max(
          1,
          Math.ceil(
            total /
              parsedLimit
          )
        );

      const safePage =
        Math.min(
          parsedPage,
          totalPages
        );

      const startIndex =
        (
          safePage -
          1
        ) *
        parsedLimit;

      const paginatedJobs =
        jobsWithMatch.slice(
          startIndex,
          startIndex +
            parsedLimit
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
            paginatedJobs,

          total,

          page:
            safePage,

          limit:
            parsedLimit,

          totalPages,

          hasNextPage:
            safePage <
            totalPages,

          hasPreviousPage:
            safePage >
            1,
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

      const context=careerReadContext(String(userId),req.careerReadVersions,careerFromSource(automation),automation);
      const originalJson=res.json.bind(res);
      res.json=((body:any)=>originalJson(body?.success===true?{...body,careerContext:context}:body)) as typeof res.json;
      const careerProfile =
        await buildCareerSkillProfile({
          userId:
            userObjectId,

          resumeAnalysisId:
            automation
              ?.activeResumeId,
          preloadedLatestResume: latestResume,
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
        createCachedJobMatcher(careerProfile, getMatchOptions(automation))(job);

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

      const context=careerReadContext(String(userId),req.careerReadVersions,careerFromSource(automation),automation);
      const originalJson=res.json.bind(res);
      res.json=((body:any)=>originalJson(body?.success===true?{...body,careerContext:context}:body)) as typeof res.json;
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
        createCachedJobMatcher(careerProfile, getMatchOptions(automation))(job);

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

      // Preserve synchronous completion: refresh providers/catalog first, then
      // rank the current user's jobs. Concurrent calls share in-flight work.
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

      const context=careerReadContext(String(userId),req.careerReadVersions,careerFromSource(automation),automation);
      const originalJson=res.json.bind(res);
      res.json=((body:any)=>originalJson(body?.success===true?{...body,careerContext:context}:body)) as typeof res.json;
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

      const matchSavedJob = createCachedJobMatcher(careerProfile, matchOptions);
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

              if (!job || !matchesCareerPreferences(job,automation.jobPreferences)) {
                return null;
              }

              const currentMatch =
                matchSavedJob(job);

              if(currentMatch.breakdown.roleRelevance < 60 || currentMatch.matchScore < (automation.jobPreferences?.minimumMatchScore ?? 0))return null;
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
      // Navigation recalculates a read-only view; stored historical scores are never rewritten here.
      res.status(
        200
      ).json({
        success:
          true,

        data: {
          matchContext:{targetRole:automation.targetRole,revision:automation.__v ?? 0,candidateSource:'saved-history',status:'recalculated',catalogRefreshed:false},
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