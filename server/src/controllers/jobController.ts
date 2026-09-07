import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose from "mongoose";

import {
  Job,
} from "../models/Job";

import {
  ResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  calculateJobMatch,
  rankJobsForResume,
} from "../services/jobMatchingService";

const getParamString = (
  value:
    | string
    | string[]
    | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value;
};

const getExperienceFilter = (
  value: string
): {
  experienceMin?: {
    $lte: number;
  };
  experienceMax?: {
    $gte: number;
  } | null;
} | null => {
  switch (
    value.toLowerCase()
  ) {
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
        } as any,
      };

    case "mid":
      return {
        experienceMin: {
          $gte: 2,
          $lte: 4,
        } as any,
      };

    case "senior":
      return {
        experienceMin: {
          $gte: 4,
          $lte: 6,
        } as any,
      };

    case "lead":
      return {
        experienceMin: {
          $gte: 6,
        } as any,
      };

    default:
      return null;
  }
};

export const getJobs =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(
          401
        ).json({
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
      } =
        req.query;

      const filter:
        Record<
          string,
          any
        > = {
        isActive: true,
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

      const jobs =
        await Job.find(
          filter
        )
          .sort({
            postedAt: -1,
            createdAt: -1,
          })
          .lean();

      const latestResume =
        await ResumeAnalysis.findOne({
          user:
            req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      if (
        !latestResume
      ) {
        res.status(
          200
        ).json({
          success: true,

          hasResume:
            false,

          message:
            "Upload and analyze a resume to see personalized job matches.",

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

      const rankedJobs =
        rankJobsForResume(
          latestResume,
          jobs
        );

      res.status(
        200
      ).json({
        success: true,

        hasResume: true,

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

        data: {
          jobs:
            rankedJobs.map(
              ({
                job,
                match,
              }) => ({
                ...job,
                match,
              })
            ),

          total:
            rankedJobs.length,
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

export const getJobById =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(
          401
        ).json({
          success: false,
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
        !mongoose.Types.ObjectId.isValid(
          jobId
        )
      ) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid job ID",
        });

        return;
      }

      const job =
        await Job.findOne({
          _id:
            new mongoose.Types.ObjectId(
              jobId
            ),

          isActive: true,
        }).lean();

      if (!job) {
        res.status(
          404
        ).json({
          success: false,
          message:
            "Job not found",
        });

        return;
      }

      const latestResume =
        await ResumeAnalysis.findOne({
          user:
            req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      if (
        !latestResume
      ) {
        res.status(
          200
        ).json({
          success: true,

          hasResume:
            false,

          message:
            "Upload and analyze a resume to see your match for this job.",

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
          latestResume,
          job
        );

      res.status(
        200
      ).json({
        success: true,

        hasResume: true,

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

export const getJobMatch =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(
          401
        ).json({
          success: false,
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
        !mongoose.Types.ObjectId.isValid(
          jobId
        )
      ) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Invalid job ID",
        });

        return;
      }

      const job =
        await Job.findOne({
          _id:
            new mongoose.Types.ObjectId(
              jobId
            ),

          isActive: true,
        }).lean();

      if (!job) {
        res.status(
          404
        ).json({
          success: false,
          message:
            "Job not found",
        });

        return;
      }

      const latestResume =
        await ResumeAnalysis.findOne({
          user:
            req.user._id,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      if (
        !latestResume
      ) {
        res.status(
          404
        ).json({
          success: false,

          message:
            "No analyzed resume found. Please upload and analyze your resume first.",
        });

        return;
      }

      const match =
        calculateJobMatch(
          latestResume,
          job
        );

      res.status(
        200
      ).json({
        success: true,

        data: {
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

          job: {
            id:
              job._id,

            title:
              job.title,

            company:
              job.company,
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