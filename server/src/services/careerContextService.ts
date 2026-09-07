import {
  Types,
} from "mongoose";

import {
  ResumeAnalysis,
  IResumeAnalysis,
} from "../models/resumeAnalysis";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerResumeContext {
  id: string;

  fileId: string;

  fileName: string;

  overallScore: number;

  atsScore: number;

  contentScore: number;

  structureScore: number;

  skillsScore: number;

  experienceScore: number;

  summary: string;

  skillsDetected: string[];

  strengths: string[];

  weaknesses: string[];

  missingSkills: string[];

  atsSuggestions: string[];

  formattingFeedback: string[];

  recommendations: string[];

  createdAt?: Date;

  updatedAt?: Date;
}

export interface ICareerContextResult<T> {
  found: boolean;

  data?: T;

  reason?:
    | "NOT_FOUND"
    | "INVALID_USER_ID"
    | "INVALID_RESOURCE_ID";
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeId = (
  value?: string
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
};

const isValidObjectId = (
  value?: string
): boolean => {
  if (!value) {
    return false;
  }

  return Types.ObjectId.isValid(
    value
  );
};

const mapResumeAnalysis = (
  analysis: IResumeAnalysis
): ICareerResumeContext => {
  return {
    id:
      analysis._id
        ? String(
            analysis._id
          )
        : "",

    fileId:
      String(
        analysis.fileId
      ),

    fileName:
      analysis.fileName,

    overallScore:
      analysis.overallScore,

    atsScore:
      analysis.atsScore,

    contentScore:
      analysis.contentScore,

    structureScore:
      analysis.structureScore,

    skillsScore:
      analysis.skillsScore,

    experienceScore:
      analysis.experienceScore,

    summary:
      analysis.summary,

    skillsDetected:
      analysis.skillsDetected ??
      [],

    strengths:
      analysis.strengths ??
      [],

    weaknesses:
      analysis.weaknesses ??
      [],

    missingSkills:
      analysis.missingSkills ??
      [],

    atsSuggestions:
      analysis.atsSuggestions ??
      [],

    formattingFeedback:
      analysis.formattingFeedback ??
      [],

    recommendations:
      analysis.recommendations ??
      [],

    createdAt:
      analysis.createdAt,

    updatedAt:
      analysis.updatedAt,
  };
};

/* =========================================================
   GET LATEST RESUME ANALYSIS

   Used when the user says:

   "Analyze my CV"
   "What are my CV weaknesses?"
   "How good is my resume?"
   "What should I improve in my CV?"

   and no specific resume has been selected.
========================================================= */

export const getLatestResumeAnalysis =
  async (
    userId: string
  ): Promise<
    ICareerContextResult<ICareerResumeContext>
  > => {
    const normalizedUserId =
      normalizeId(
        userId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_USER_ID",
      };
    }

    const analysis =
      await ResumeAnalysis
        .findOne({
          user:
            new Types.ObjectId(
              normalizedUserId
            ),
        })
        .sort({
          createdAt: -1,
        })
        .lean<IResumeAnalysis>()
        .exec();

    if (!analysis) {
      return {
        found: false,
        reason:
          "NOT_FOUND",
      };
    }

    return {
      found: true,
      data:
        mapResumeAnalysis(
          analysis
        ),
    };
  };

/* =========================================================
   GET RESUME ANALYSIS BY ANALYSIS ID

   activeResumeId may point directly to the
   ResumeAnalysis document.
========================================================= */

export const getResumeAnalysisById =
  async (
    userId: string,
    analysisId: string
  ): Promise<
    ICareerContextResult<ICareerResumeContext>
  > => {
    const normalizedUserId =
      normalizeId(
        userId
      );

    const normalizedAnalysisId =
      normalizeId(
        analysisId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_USER_ID",
      };
    }

    if (
      !normalizedAnalysisId ||
      !isValidObjectId(
        normalizedAnalysisId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_RESOURCE_ID",
      };
    }

    const analysis =
      await ResumeAnalysis
        .findOne({
          _id:
            new Types.ObjectId(
              normalizedAnalysisId
            ),

          user:
            new Types.ObjectId(
              normalizedUserId
            ),
        })
        .lean<IResumeAnalysis>()
        .exec();

    if (!analysis) {
      return {
        found: false,
        reason:
          "NOT_FOUND",
      };
    }

    return {
      found: true,
      data:
        mapResumeAnalysis(
          analysis
        ),
    };
  };

/* =========================================================
   GET RESUME ANALYSIS BY FILE ID

   This is useful because InterviewIQ stores both:

   ResumeAnalysis._id
   ResumeAnalysis.fileId

   Depending on the frontend, activeResumeId may actually
   represent the uploaded resume/file id.
========================================================= */

export const getResumeAnalysisByFileId =
  async (
    userId: string,
    fileId: string
  ): Promise<
    ICareerContextResult<ICareerResumeContext>
  > => {
    const normalizedUserId =
      normalizeId(
        userId
      );

    const normalizedFileId =
      normalizeId(
        fileId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_USER_ID",
      };
    }

    if (
      !normalizedFileId ||
      !isValidObjectId(
        normalizedFileId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_RESOURCE_ID",
      };
    }

    const analysis =
      await ResumeAnalysis
        .findOne({
          user:
            new Types.ObjectId(
              normalizedUserId
            ),

          fileId:
            new Types.ObjectId(
              normalizedFileId
            ),
        })
        .sort({
          createdAt: -1,
        })
        .lean<IResumeAnalysis>()
        .exec();

    if (!analysis) {
      return {
        found: false,
        reason:
          "NOT_FOUND",
      };
    }

    return {
      found: true,
      data:
        mapResumeAnalysis(
          analysis
        ),
    };
  };

/* =========================================================
   RESOLVE RESUME CONTEXT

   This is the main function Career Assistant should use.

   Logic:

   1. If activeResumeId exists:
      - try ResumeAnalysis._id
      - then try fileId

   2. If no activeResumeId:
      - use user's latest ResumeAnalysis

   IMPORTANT:
   Every lookup is also restricted by userId.

   This prevents one user from accessing another
   user's resume analysis by guessing an ObjectId.
========================================================= */

export const resolveResumeContext =
  async ({
    userId,
    activeResumeId,
  }: {
    userId: string;

    activeResumeId?: string;
  }): Promise<
    ICareerContextResult<ICareerResumeContext>
  > => {
    const normalizedUserId =
      normalizeId(
        userId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found: false,
        reason:
          "INVALID_USER_ID",
      };
    }

    const normalizedResumeId =
      normalizeId(
        activeResumeId
      );

    /* -----------------------------------------------------
       SPECIFIC RESUME
    ----------------------------------------------------- */

    if (
      normalizedResumeId
    ) {
      if (
        !isValidObjectId(
          normalizedResumeId
        )
      ) {
        return {
          found: false,
          reason:
            "INVALID_RESOURCE_ID",
        };
      }

      /*
       * First assume activeResumeId is
       * ResumeAnalysis._id
       */

      const byAnalysisId =
        await getResumeAnalysisById(
          normalizedUserId,
          normalizedResumeId
        );

      if (
        byAnalysisId.found
      ) {
        return byAnalysisId;
      }

      /*
       * If not found, assume activeResumeId
       * is the uploaded fileId.
       */

      const byFileId =
        await getResumeAnalysisByFileId(
          normalizedUserId,
          normalizedResumeId
        );

      if (
        byFileId.found
      ) {
        return byFileId;
      }

      return {
        found: false,
        reason:
          "NOT_FOUND",
      };
    }

    /* -----------------------------------------------------
       LATEST RESUME
    ----------------------------------------------------- */

    return getLatestResumeAnalysis(
      normalizedUserId
    );
  };

/* =========================================================
   BUILD COMPACT CV SUMMARY

   Later csChatService / response layer can use this
   without needing to understand the database model.
========================================================= */

export const buildResumeCareerSummary =
  (
    resume: ICareerResumeContext
  ): Record<
    string,
    unknown
  > => {
    return {
      resumeId:
        resume.id,

      fileId:
        resume.fileId,

      fileName:
        resume.fileName,

      scores: {
        overall:
          resume.overallScore,

        ats:
          resume.atsScore,

        content:
          resume.contentScore,

        structure:
          resume.structureScore,

        skills:
          resume.skillsScore,

        experience:
          resume.experienceScore,
      },

      summary:
        resume.summary,

      skills:
        resume.skillsDetected,

      strengths:
        resume.strengths,

      weaknesses:
        resume.weaknesses,

      missingSkills:
        resume.missingSkills,

      atsSuggestions:
        resume.atsSuggestions,

      formattingFeedback:
        resume.formattingFeedback,

      recommendations:
        resume.recommendations,

      analyzedAt:
        resume.createdAt,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getLatestResumeAnalysis,

  getResumeAnalysisById,

  getResumeAnalysisByFileId,

  resolveResumeContext,

  buildResumeCareerSummary,
};