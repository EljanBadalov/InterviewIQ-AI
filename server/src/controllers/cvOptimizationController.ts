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
  optimizeCVForJob,
} from "../services/cvOptimizationService";

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
      value[0] ||
      null
    );
  }

  return value;
};

export const optimizeCVForJobController =
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

      const userId =
        req.user._id;

      const jobId =
        getParamString(
          req.params.jobId
        );

      if (!jobId) {
        res.status(
          400
        ).json({
          success: false,
          message:
            "Job ID is required",
        });

        return;
      }

      if (
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

      const jobObjectId =
        new mongoose.Types.ObjectId(
          jobId
        );

      const job =
        await Job.findOne({
          _id:
            jobObjectId,

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
            userId,
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

          code:
            "RESUME_REQUIRED",
        });

        return;
      }

      const optimization =
        await optimizeCVForJob({
          userId,

          resume:
            latestResume,

          job,
        });

      res.status(
        200
      ).json({
        success: true,

        message:
          "CV optimization plan generated successfully",

        data: {
          resume: {
            id:
              latestResume._id,

            fileName:
              latestResume.fileName,

            currentScore:
              latestResume.overallScore,

            atsScore:
              latestResume.atsScore,

            contentScore:
              latestResume.contentScore,

            structureScore:
              latestResume.structureScore,

            skillsScore:
              latestResume.skillsScore,

            experienceScore:
              latestResume.experienceScore,

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

            location:
              job.location,

            employmentType:
              job.employmentType,

            remoteType:
              job.remoteType,

            experienceMin:
              job.experienceMin,

            experienceMax:
              job.experienceMax,

            salary:
              job.salary,

            skills:
              job.skills,

            keywords:
              job.keywords,

            requirements:
              job.requirements,

            responsibilities:
              job.responsibilities,

            preferredQualifications:
              job.preferredQualifications,
          },

          optimization,
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