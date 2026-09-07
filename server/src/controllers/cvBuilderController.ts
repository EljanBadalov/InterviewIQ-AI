import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose, {
  Types,
} from "mongoose";

import {
  Job,
  type IJob,
} from "../models/Job";

import {
  ResumeAnalysis,
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  ResumeProfile,
} from "../models/ResumeProfile";

import {
  buildOptimizedCV,
  buildGeneralImprovedCV,
} from "../services/cvBuilderService";

import {
  runCVImprovementQualityGate,
  type IRejectedCVImprovementResult,
} from "../services/cvImprovementOrchestratorService";

import {
  persistAcceptedImprovedCV,
} from "../services/cvImprovementPersistenceService";

import {
  getLatestOriginalResumeProfile,
  type ICVBuilderResumeProfile,
} from "../services/resumeProfileService";

/* =========================================================
   TYPES
========================================================= */

interface ISendPdfMetadata {
  analysisId:
    string;

  baselineScore:
    number;

  generatedScore:
    number;

  improvement:
    number;

  attempts:
    number;
}



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

  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value;
};

const getBodyString = (
  value:
    unknown
): string | null => {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned ||
    null;
};

const encodeFileName = (
  fileName: string
): string => {
  return encodeURIComponent(
    fileName
  );
};

const sendPdfResponse = (
  res: Response,
  buffer: Buffer,
  fileName: string,
  metadata:
    ISendPdfMetadata
): void => {
  res.status(
    200
  );

  res.setHeader(
    "Content-Type",
    "application/pdf"
  );

  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeFileName(
      fileName
    )}`
  );

  res.setHeader(
    "Content-Length",
    buffer.length.toString()
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  /*
   * These headers let the frontend open the already-persisted
   * ResumeAnalysis directly instead of uploading the accepted
   * PDF to /resume/analyze for a second analysis.
   */
  res.setHeader(
    "X-Resume-Analysis-Id",
    metadata.analysisId
  );

  res.setHeader(
    "X-CV-Baseline-Score",
    metadata.baselineScore.toString()
  );

  res.setHeader(
    "X-CV-Generated-Score",
    metadata.generatedScore.toString()
  );

  res.setHeader(
    "X-CV-Improvement",
    metadata.improvement.toString()
  );

  res.setHeader(
    "X-CV-Quality-Attempts",
    metadata.attempts.toString()
  );

  res.send(
    buffer
  );
};


const uniqueStrings = (
  values:
    Array<
      | string
      | undefined
      | null
    >
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
      value
        ?.trim()
        .replace(
          /\s+/g,
          " "
        ) ||
      "";

    if (!cleaned) {
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

interface ISourceResumeContext {
  resume:
    IResumeAnalysis;

  profile:
    ICVBuilderResumeProfile;
}

/*
 * Canonical source selection:
 *
 * 1. Pick the latest ORIGINAL ResumeProfile.
 * 2. Resolve the ResumeAnalysis linked to that exact profile.
 * 3. Recover the original source text from rawSections when available.
 * 4. Run deterministic extraction to rebuild a fresh structured profile.
 * 5. Fall back to the stored profile only when full source text is unavailable.
 *
 * The selected original ResumeProfile remains the canonical source context.
 * Deterministic extraction exists only to repair stale/legacy parsing while
 * preserving the exact source facts and avoiding any AI generation.
 */
const getSourceResumeContext =
  async (
    userId:
      Types.ObjectId,
    sourceAnalysisId?:
      string | null
  ): Promise<ISourceResumeContext | null> => {
    let originalProfile:
      Awaited<
        ReturnType<
          typeof getLatestOriginalResumeProfile
        >
      > =
      null;

    let analysis:
      IResumeAnalysis | null =
      null;

    /*
     * EXPLICIT SOURCE SELECTION
     *
     * When the frontend says "improve this analysis", that exact
     * ResumeAnalysis + ResumeProfile pair is the source of truth.
     *
     * This is the important fix that prevents the newest uploaded CV
     * from replacing an older CV that the user intentionally opened.
     */
    if (
      sourceAnalysisId
    ) {
      if (
        !Types.ObjectId.isValid(
          sourceAnalysisId
        )
      ) {
        return null;
      }

      const analysisObjectId =
        new Types.ObjectId(
          sourceAnalysisId
        );

      analysis =
        await ResumeAnalysis.findOne({
          _id:
            analysisObjectId,

          user:
            userId,
        }).lean<IResumeAnalysis>();

      if (
        !analysis ||
        !analysis._id
      ) {
        console.error(
          "[CV Builder] Requested source ResumeAnalysis not found",
          {
            userId:
              userId.toString(),

            sourceAnalysisId,
          }
        );

        return null;
      }

      const selectedProfile =
        await ResumeProfile.findOne({
          user:
            userId,

          resumeAnalysis:
            analysisObjectId,
        });

      if (
        !selectedProfile
      ) {
        console.error(
          "[CV Builder] Requested source ResumeProfile not found",
          {
            userId:
              userId.toString(),

            sourceAnalysisId,
          }
        );

        return null;
      }

      /*
       * ResumeProfile documents returned by Mongoose expose the same
       * fields consumed below as getLatestOriginalResumeProfile().
       */
      originalProfile =
        selectedProfile as NonNullable<
          Awaited<
            ReturnType<
              typeof getLatestOriginalResumeProfile
            >
          >
        >;

      console.log(
        "[CV Builder] Explicit source selected",
        {
          sourceAnalysisId,

          profileId:
            selectedProfile
              ._id
              .toString(),

          fileName:
            selectedProfile
              .fileName,
        }
      );
    } else {
      /*
       * Backward-compatible fallback for older callers.
       * New frontend requests should always send sourceAnalysisId.
       */
      originalProfile =
        await getLatestOriginalResumeProfile(
          userId
        );

      if (
        !originalProfile
      ) {
        console.error(
          "[CV Builder] No original ResumeProfile found",
          {
            userId:
              userId.toString(),
          }
        );

        return null;
      }

      if (
        originalProfile
          .resumeAnalysis
      ) {
        analysis =
          await ResumeAnalysis.findOne({
            _id:
              originalProfile
                .resumeAnalysis,

            user:
              userId,
          }).lean<IResumeAnalysis>();
      }

      if (
        !analysis &&
        originalProfile.fileId
      ) {
        analysis =
          await ResumeAnalysis.findOne({
            user:
              userId,

            fileId:
              originalProfile
                .fileId,
          })
            .sort({
              createdAt:
                -1,
            })
            .lean<IResumeAnalysis>();
      }

      if (
        !analysis
      ) {
        analysis =
          await ResumeAnalysis.findOne({
            user:
              userId,
          })
            .sort({
              createdAt:
                -1,
            })
            .lean<IResumeAnalysis>();
      }
    }

    if (
      !originalProfile ||
      !analysis ||
      !analysis._id
    ) {
      console.error(
        "[CV Builder] No source resume context available",
        {
          userId:
            userId.toString(),

          sourceAnalysisId:
            sourceAnalysisId ||
            null,
        }
      );

      return null;
    }

    console.log(
      "[CV Builder] Source profile selected",
      {
        sourceAnalysisId:
          analysis
            ._id
            .toString(),

        originalProfileId:
          originalProfile
            ._id
            .toString(),

        fileName:
          originalProfile
            .fileName,

        hasRawSections:
          Boolean(
            originalProfile
              .rawSections
              ?.length
          ),
      }
    );

    /*
     * IMPORTANT SOURCE-OF-TRUTH RULE
     *
     * Once a ResumeAnalysis has been created, the ResumeProfile linked
     * to that exact analysis is the canonical structured source for
     * Improve CV.
     *
     * Do NOT re-run resumeStructuredExtractionService here.
     *
     * Re-parsing the raw PDF text during Improve caused previously
     * correct fields (education, certifications, training, volunteering)
     * to disappear or move after parser changes made for unusual Canva
     * layouts.
     *
     * Universal PDF/layout parsing belongs to the /resume/analyze path.
     * Improve CV must preserve the already-saved structured profile for
     * the CV that the user explicitly selected.
     */
    const builderProfile:
      ICVBuilderResumeProfile = {
        id:
          originalProfile
            ._id
            .toString(),

        fileName:
          originalProfile
            .fileName,

        contact: {
          fullName:
            originalProfile
              .contact
              ?.fullName,

          email:
            originalProfile
              .contact
              ?.email,

          phone:
            originalProfile
              .contact
              ?.phone,

          location:
            originalProfile
              .contact
              ?.location,

          linkedin:
            originalProfile
              .contact
              ?.linkedin,

          github:
            originalProfile
              .contact
              ?.github,

          website:
            originalProfile
              .contact
              ?.website,
        },

        professionalSummary:
          originalProfile
            .professionalSummary ||
          "",

        skills: [
          ...(
            originalProfile
              .skills ||
            []
          ),
        ],

        technicalSkills: [
          ...(
            originalProfile
              .technicalSkills ||
            []
          ),
        ],

        softSkills: [
          ...(
            originalProfile
              .softSkills ||
            []
          ),
        ],

        experience:
          (
            originalProfile
              .experience ||
            []
          ).map(
            (
              item
            ) => ({
              title:
                item.title,

              company:
                item.company,

              location:
                item.location,

              employmentType:
                item.employmentType,

              startDate:
                item.startDate,

              endDate:
                item.endDate,

              isCurrent:
                item.isCurrent,

              description:
                item.description,

              bullets: [
                ...(
                  item.bullets ||
                  []
                ),
              ],

              technologies: [
                ...(
                  item.technologies ||
                  []
                ),
              ],
            })
          ),

        projects:
          (
            originalProfile
              .projects ||
            []
          ).map(
            (
              item
            ) => ({
              name:
                item.name,

              role:
                item.role,

              description:
                item.description,

              startDate:
                item.startDate,

              endDate:
                item.endDate,

              technologies: [
                ...(
                  item.technologies ||
                  []
                ),
              ],

              bullets: [
                ...(
                  item.bullets ||
                  []
                ),
              ],

              url:
                item.url,

              github:
                item.github,
            })
          ),

        education:
          (
            originalProfile
              .education ||
            []
          ).map(
            (
              item
            ) => ({
              institution:
                item.institution,

              degree:
                item.degree,

              field:
                item.field,

              location:
                item.location,

              startDate:
                item.startDate,

              endDate:
                item.endDate,

              isCurrent:
                item.isCurrent,

              gpa:
                item.gpa,

              coursework: [
                ...(
                  item.coursework ||
                  []
                ),
              ],

              achievements: [
                ...(
                  item.achievements ||
                  []
                ),
              ],
            })
          ),

        certifications:
          (
            originalProfile
              .certifications ||
            []
          ).map(
            (
              item
            ) => ({
              name:
                item.name,

              issuer:
                item.issuer,

              issueDate:
                item.issueDate,

              expirationDate:
                item.expirationDate,

              credentialId:
                item.credentialId,

              credentialUrl:
                item.credentialUrl,

              status:
                item.status,
            })
          ),

        languages:
          (
            originalProfile
              .languages ||
            []
          ).map(
            (
              item
            ) => ({
              language:
                item.language,

              level:
                item.level,
            })
          ),

        volunteering:
          (
            originalProfile
              .volunteering ||
            []
          ).map(
            (
              item
            ) => ({
              organization:
                item.organization,

              role:
                item.role,

              location:
                item.location,

              startDate:
                item.startDate,

              endDate:
                item.endDate,

              isCurrent:
                item.isCurrent,

              description:
                item.description,

              bullets: [
                ...(
                  item.bullets ||
                  []
                ),
              ],
            })
          ),

        hackathons:
          (
            originalProfile
              .hackathons ||
            []
          ).map(
            (
              item
            ) => ({
              name:
                item.name,

              organization:
                item.organization,

              role:
                item.role,

              date:
                item.date,

              description:
                item.description,

              achievements: [
                ...(
                  item.achievements ||
                  []
                ),
              ],
            })
          ),

        achievements: [
          ...(
            originalProfile
              .achievements ||
            []
          ),
        ],

        interests: [
          ...(
            originalProfile
              .interests ||
            []
          ),
        ],

        rawSections:
          (
            originalProfile
              .rawSections ||
            []
          ).map(
            (
              section
            ) => ({
              title:
                section.title,

              content:
                section.content,
            })
          ),

        extractionStatus:
          originalProfile
            .extractionStatus,

        extractionWarnings: [
          ...(
            originalProfile
              .extractionWarnings ||
            []
          ),
        ],
      };

    console.log(
      "[CV Builder] Stored source profile preserved",
      {
        sourceAnalysisId:
          analysis
            ._id
            .toString(),

        profileId:
          originalProfile
            ._id
            .toString(),

        fileName:
          originalProfile
            .fileName,

        experience:
          builderProfile
            .experience
            .length,

        projects:
          builderProfile
            .projects
            .length,

        education:
          builderProfile
            .education
            .length,

        certifications:
          builderProfile
            .certifications
            .length,

        volunteering:
          builderProfile
            .volunteering
            .length,

        hackathons:
          builderProfile
            .hackathons
            .length,

        languages:
          builderProfile
            .languages
            .length,
      }
    );

    return {
      resume:
        analysis,

      profile:
        builderProfile,
    };
  };

const sendQualityGateFailure = (
  res:
    Response,
  result:
    IRejectedCVImprovementResult
): void => {
  res.status(
    422
  ).json({
    success:
      false,

    message:
      "The improved CV could not be generated because deterministic validation failed.",

    code:
      "CV_VALIDATION_FAILED",

    data: {
      baselineScore:
        result
          .baselineScore,

      generatedScore:
        result
          .generatedScore,

      improvement:
        result
          .improvement,

      totalAttempts:
        result
          .totalAttempts,

      summarySource:
        result
          .summarySource,

      validationErrors:
        result
          .validation
          .errors,

      validationWarnings:
        result
          .validation
          .warnings,

      failureReason:
        result
          .failureReason,
    },
  });
};

/* =========================================================
   JOB-SPECIFIC IMPROVED CV
========================================================= */

export const generateImprovedCVController =
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
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const userId =
        new Types.ObjectId(
          req.user._id
            .toString()
        );

      const jobId =
        getParamString(
          req.params.jobId
        );

      if (!jobId) {
        res.status(
          400
        ).json({
          success:
            false,

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
          success:
            false,

          message:
            "Invalid job ID",
        });

        return;
      }

      const job =
        await Job.findOne({
          _id:
            new Types.ObjectId(
              jobId
            ),

          isActive:
            true,
        }).lean<IJob>();

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

      const sourceAnalysisId =
        getBodyString(
          req.body
            ?.sourceAnalysisId
        );

      const sourceContext =
        await getSourceResumeContext(
          userId,
          sourceAnalysisId
        );

      if (
        !sourceContext
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "The selected analyzed resume could not be found. Please reopen the CV and try again.",

          code:
            "RESUME_REQUIRED",
        });

        return;
      }

      const generatedCV =
        await buildOptimizedCV({
          userId,

          resume:
            sourceContext
              .resume,

          job,

          sourceProfile:
            sourceContext
              .profile,
        });

      const qualityResult =
        await runCVImprovementQualityGate({
          baseline:
            sourceContext
              .resume,

          initialCV:
            generatedCV,
        });

      if (
        !qualityResult
          .accepted
      ) {
        sendQualityGateFailure(
          res,
          qualityResult
        );

        return;
      }

      const persisted =
        await persistAcceptedImprovedCV({
          userId,

          pdfBuffer:
            qualityResult
              .pdfBuffer,

          fileName:
            qualityResult
              .fileName,

          candidateAnalysis:
            qualityResult
              .candidateAnalysis,
        });

      sendPdfResponse(
        res,

        qualityResult
          .pdfBuffer,

        qualityResult
          .fileName,

        {
          analysisId:
            persisted
              .analysisId
              .toString(),

          baselineScore:
            qualityResult
              .baselineScore,

          generatedScore:
            qualityResult
              .generatedScore,

          improvement:
            qualityResult
              .improvement,

          attempts:
            qualityResult
              .totalAttempts,
        }
      );
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };

/* =========================================================
   GENERAL / CAREER-BASED IMPROVED CV
========================================================= */

export const generateGeneralImprovedCVController =
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
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      const userId =
        new Types.ObjectId(
          req.user._id
            .toString()
        );

      const sourceAnalysisId =
        getBodyString(
          req.body
            ?.sourceAnalysisId
        );

      const sourceContext =
        await getSourceResumeContext(
          userId,
          sourceAnalysisId
        );

      if (
        !sourceContext
      ) {
        res.status(
          404
        ).json({
          success:
            false,

          message:
            "The selected analyzed resume could not be found. Please reopen the CV and try again.",

          code:
            "RESUME_REQUIRED",
        });

        return;
      }

      const generatedCV =
        await buildGeneralImprovedCV({
          userId,

          resume:
            sourceContext
              .resume,

          sourceProfile:
            sourceContext
              .profile,
        });

      const qualityResult =
        await runCVImprovementQualityGate({
          baseline:
            sourceContext
              .resume,

          initialCV:
            generatedCV,
        });

      if (
        !qualityResult
          .accepted
      ) {
        sendQualityGateFailure(
          res,
          qualityResult
        );

        return;
      }

      const persisted =
        await persistAcceptedImprovedCV({
          userId,

          pdfBuffer:
            qualityResult
              .pdfBuffer,

          fileName:
            qualityResult
              .fileName,

          candidateAnalysis:
            qualityResult
              .candidateAnalysis,
        });

      sendPdfResponse(
        res,

        qualityResult
          .pdfBuffer,

        qualityResult
          .fileName,

        {
          analysisId:
            persisted
              .analysisId
              .toString(),

          baselineScore:
            qualityResult
              .baselineScore,

          generatedScore:
            qualityResult
              .generatedScore,

          improvement:
            qualityResult
              .improvement,

          attempts:
            qualityResult
              .totalAttempts,
        }
      );
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };
