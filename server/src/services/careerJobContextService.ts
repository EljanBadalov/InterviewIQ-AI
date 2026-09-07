import {
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
  rankJobsForResume,
  type IJobMatchResult,
} from "./jobMatchingService";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerJobSummary {
  id: string;

  title: string;

  company: string;

  location: string;

  remoteType:
    | "onsite"
    | "hybrid"
    | "remote";

  employmentType:
    | "full-time"
    | "part-time"
    | "contract"
    | "internship";

  experienceLevel:
    | "entry"
    | "junior"
    | "mid"
    | "senior";

  experienceMin: number;

  experienceMax:
    | number
    | null;

  salary: number;

  skills: string[];

  requirements: string[];

  preferredQualifications: string[];

  source: string;

  postedAt: Date;

  match: IJobMatchResult;
}

export interface ICareerJobMatchingResult {
  found: boolean;

  resumeId?: string;

  resumeFileId?: string;

  totalActiveJobs: number;

  matchedJobs:
    ICareerJobSummary[];

  bestMatch?:
    ICareerJobSummary;

  reason?:
    | "INVALID_USER_ID"
    | "INVALID_RESUME_ID"
    | "RESUME_NOT_FOUND"
    | "NO_ACTIVE_JOBS"
    | "JOB_NOT_FOUND";
}

export interface ICareerSingleJobMatchResult {
  found: boolean;

  resumeId?: string;

  job?:
    ICareerJobSummary;

  reason?:
    | "INVALID_USER_ID"
    | "INVALID_RESUME_ID"
    | "INVALID_JOB_ID"
    | "RESUME_NOT_FOUND"
    | "JOB_NOT_FOUND";
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value:
    | string
    | undefined
    | null
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized ||
    undefined;
};

const isValidObjectId = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return false;
  }

  return Types.ObjectId.isValid(
    normalized
  );
};

const toObjectId = (
  value: string
): Types.ObjectId => {
  return new Types.ObjectId(
    value
  );
};

/* =========================================================
   MAP JOB
========================================================= */

const mapJobMatch = (
  job: IJob,
  match: IJobMatchResult
): ICareerJobSummary => {
  return {
    id:
      job._id
        ? String(
            job._id
          )
        : "",

    title:
      job.title,

    company:
      job.company,

    location:
      job.location,

    remoteType:
      job.remoteType,

    employmentType:
      job.employmentType,

    experienceLevel:
      job.experienceLevel,

    experienceMin:
      job.experienceMin,

    experienceMax:
      job.experienceMax,

    salary:
      job.salary,

    skills:
      job.skills ??
      [],

    requirements:
      job.requirements ??
      [],

    preferredQualifications:
      job.preferredQualifications ??
      [],

    source:
      job.source,

    postedAt:
      job.postedAt,

    match,
  };
};

/* =========================================================
   RESOLVE RESUME ANALYSIS

   activeResumeId can be:

   1. ResumeAnalysis._id
   2. ResumeAnalysis.fileId

   If no activeResumeId is provided,
   latest analysis for the user is used.
========================================================= */

const resolveResumeAnalysis =
  async ({
    userId,
    activeResumeId,
  }: {
    userId: string;

    activeResumeId?: string;
  }): Promise<
    IResumeAnalysis | null
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return null;
    }

    const userObjectId =
      toObjectId(
        normalizedUserId
      );

    const normalizedResumeId =
      normalizeString(
        activeResumeId
      );

    /* =====================================================
       SPECIFIC RESUME
    ===================================================== */

    if (
      normalizedResumeId
    ) {
      if (
        !isValidObjectId(
          normalizedResumeId
        )
      ) {
        return null;
      }

      const resumeObjectId =
        toObjectId(
          normalizedResumeId
        );

      /*
       * Try ResumeAnalysis._id first.
       */

      const byAnalysisId =
        await ResumeAnalysis
          .findOne({
            _id:
              resumeObjectId,

            user:
              userObjectId,
          })
          .lean<IResumeAnalysis>()
          .exec();

      if (
        byAnalysisId
      ) {
        return byAnalysisId;
      }

      /*
       * Then try uploaded fileId.
       */

      const byFileId =
        await ResumeAnalysis
          .findOne({
            user:
              userObjectId,

            fileId:
              resumeObjectId,
          })
          .sort({
            createdAt:
              -1,
          })
          .lean<IResumeAnalysis>()
          .exec();

      return (
        byFileId ??
        null
      );
    }

    /* =====================================================
       LATEST USER RESUME
    ===================================================== */

    const latest =
      await ResumeAnalysis
        .findOne({
          user:
            userObjectId,
        })
        .sort({
          createdAt:
            -1,
        })
        .lean<IResumeAnalysis>()
        .exec();

    return (
      latest ??
      null
    );
  };

/* =========================================================
   TARGET ROLE FILTER

   This does NOT replace job matching.

   It simply prioritizes jobs whose title / keywords
   are related to the user's target role.

   If no matching title exists, all active jobs remain
   available so the assistant still returns useful matches.
========================================================= */

const filterJobsByTargetRole = (
  jobs: IJob[],
  targetRole?: string
): IJob[] => {
  const normalizedTargetRole =
    normalizeString(
      targetRole
    )
      ?.toLowerCase();

  if (
    !normalizedTargetRole
  ) {
    return jobs;
  }

  const terms =
    normalizedTargetRole
      .split(
        /\s+/
      )
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .filter(
        (
          item
        ) =>
          item.length >=
          2
      );

  if (
    terms.length ===
    0
  ) {
    return jobs;
  }

  const filtered =
    jobs.filter(
      (
        job
      ) => {
        const searchable =
          [
            job.title,
            ...(
              job.skills ??
              []
            ),
            ...(
              job.keywords ??
              []
            ),
          ]
            .join(
              " "
            )
            .toLowerCase();

        return terms.some(
          (
            term
          ) =>
            searchable.includes(
              term
            )
        );
      }
    );

  /*
   * Important:
   *
   * If targetRole filtering finds nothing,
   * do NOT return an empty result.
   *
   * Fall back to all active jobs and let the
   * real matching engine rank them.
   */

  return filtered.length >
    0
    ? filtered
    : jobs;
};

/* =========================================================
   GET ACTIVE JOBS
========================================================= */

export const getActiveCareerJobs =
  async (): Promise<
    IJob[]
  > => {
    const jobs =
      await Job
        .find({
          isActive:
            true,
        })
        .sort({
          postedAt:
            -1,
        })
        .lean<IJob[]>()
        .exec();

    return jobs;
  };

/* =========================================================
   MATCH JOBS FOR USER

   Main Career Assistant job-matching function.

   Flow:

   userId
   ↓
   ResumeAnalysis
   ↓
   active jobs
   ↓
   optional target role prioritization
   ↓
   existing rankJobsForResume()
   ↓
   top results
========================================================= */

export const getCareerJobMatches =
  async ({
    userId,
    activeResumeId,
    targetRole,
    limit = 5,
  }: {
    userId: string;

    activeResumeId?: string;

    targetRole?: string;

    limit?: number;
  }): Promise<
    ICareerJobMatchingResult
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    /* =====================================================
       VALIDATE USER
    ===================================================== */

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found:
          false,

        totalActiveJobs:
          0,

        matchedJobs:
          [],

        reason:
          "INVALID_USER_ID",
      };
    }

    /* =====================================================
       VALIDATE RESUME ID
    ===================================================== */

    if (
      activeResumeId &&
      !isValidObjectId(
        activeResumeId
      )
    ) {
      return {
        found:
          false,

        totalActiveJobs:
          0,

        matchedJobs:
          [],

        reason:
          "INVALID_RESUME_ID",
      };
    }

    /* =====================================================
       RESOLVE RESUME
    ===================================================== */

    const resume =
      await resolveResumeAnalysis({
        userId:
          normalizedUserId,

        activeResumeId,
      });

    if (
      !resume
    ) {
      return {
        found:
          false,

        totalActiveJobs:
          0,

        matchedJobs:
          [],

        reason:
          "RESUME_NOT_FOUND",
      };
    }

    /* =====================================================
       GET ACTIVE JOBS
    ===================================================== */

    const jobs =
      await getActiveCareerJobs();

    if (
      jobs.length ===
      0
    ) {
      return {
        found:
          false,

        resumeId:
          resume._id
            ? String(
                resume._id
              )
            : undefined,

        resumeFileId:
          String(
            resume.fileId
          ),

        totalActiveJobs:
          0,

        matchedJobs:
          [],

        reason:
          "NO_ACTIVE_JOBS",
      };
    }

    /* =====================================================
       OPTIONAL TARGET ROLE FILTER
    ===================================================== */

    const candidateJobs =
      filterJobsByTargetRole(
        jobs,
        targetRole
      );

    /* =====================================================
       EXISTING MATCHING ENGINE
    ===================================================== */

    const ranked =
      rankJobsForResume(
        resume,
        candidateJobs
      );

    /* =====================================================
       LIMIT
    ===================================================== */

    const safeLimit =
      Math.max(
        1,
        Math.min(
          20,
          Math.floor(
            limit
          ) || 5
        )
      );

    const topMatches =
      ranked
        .slice(
          0,
          safeLimit
        )
        .map(
          ({
            job,
            match,
          }) =>
            mapJobMatch(
              job,
              match
            )
        );

    return {
      found:
        topMatches.length >
        0,

      resumeId:
        resume._id
          ? String(
              resume._id
            )
          : undefined,

      resumeFileId:
        String(
          resume.fileId
        ),

      totalActiveJobs:
        jobs.length,

      matchedJobs:
        topMatches,

      bestMatch:
        topMatches[0],
    };
  };

/* =========================================================
   MATCH ONE SPECIFIC JOB

   Useful later when user asks:

   "Am I a good fit for this job?"

   and activeJobId is already in memory.
========================================================= */

export const getCareerMatchForJob =
  async ({
    userId,
    jobId,
    activeResumeId,
  }: {
    userId: string;

    jobId: string;

    activeResumeId?: string;
  }): Promise<
    ICareerSingleJobMatchResult
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    const normalizedJobId =
      normalizeString(
        jobId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER_ID",
      };
    }

    if (
      activeResumeId &&
      !isValidObjectId(
        activeResumeId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_RESUME_ID",
      };
    }

    if (
      !normalizedJobId ||
      !isValidObjectId(
        normalizedJobId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_JOB_ID",
      };
    }

    /* =====================================================
       RESUME
    ===================================================== */

    const resume =
      await resolveResumeAnalysis({
        userId:
          normalizedUserId,

        activeResumeId,
      });

    if (
      !resume
    ) {
      return {
        found:
          false,

        reason:
          "RESUME_NOT_FOUND",
      };
    }

    /* =====================================================
       JOB
    ===================================================== */

    const job =
      await Job
        .findOne({
          _id:
            toObjectId(
              normalizedJobId
            ),

          isActive:
            true,
        })
        .lean<IJob>()
        .exec();

    if (
      !job
    ) {
      return {
        found:
          false,

        resumeId:
          resume._id
            ? String(
                resume._id
              )
            : undefined,

        reason:
          "JOB_NOT_FOUND",
      };
    }

    /* =====================================================
       USE EXISTING MATCHING ENGINE
    ===================================================== */

    const ranked =
      rankJobsForResume(
        resume,
        [
          job,
        ]
      );

    const result =
      ranked[0];

    if (
      !result
    ) {
      return {
        found:
          false,

        resumeId:
          resume._id
            ? String(
                resume._id
              )
            : undefined,

        reason:
          "JOB_NOT_FOUND",
      };
    }

    return {
      found:
        true,

      resumeId:
        resume._id
          ? String(
              resume._id
            )
          : undefined,

      job:
        mapJobMatch(
          result.job,
          result.match
        ),
    };
  };

/* =========================================================
   BUILD CHAT-FRIENDLY SUMMARY
========================================================= */

export const buildCareerJobMatchSummary =
  (
    result:
      ICareerJobMatchingResult
  ): Record<
    string,
    unknown
  > => {
    return {
      resumeId:
        result.resumeId,

      resumeFileId:
        result.resumeFileId,

      totalActiveJobs:
        result.totalActiveJobs,

      matchCount:
        result.matchedJobs.length,

      bestMatch:
        result.bestMatch,

      jobs:
        result.matchedJobs.map(
          (
            job
          ) => ({
            id:
              job.id,

            title:
              job.title,

            company:
              job.company,

            location:
              job.location,

            remoteType:
              job.remoteType,

            employmentType:
              job.employmentType,

            experienceLevel:
              job.experienceLevel,

            salary:
              job.salary,

            matchScore:
              job.match
                .matchScore,

            matchLevel:
              job.match
                .matchLevel,

            matchLabel:
              job.match
                .matchLabel,

            matchedSkills:
              job.match
                .matchedSkills,

            missingSkills:
              job.match
                .missingSkills,

            strengths:
              job.match
                .strengths,

            improvementAreas:
              job.match
                .improvementAreas,

            breakdown:
              job.match
                .breakdown,
          })
        ),
    };
  };

/* =========================================================
   BUILD TEXT RESPONSE FOR CAREER ASSISTANT
========================================================= */

export const buildCareerJobMatchReply =
  (
    result:
      ICareerJobMatchingResult,
    targetRole?: string
  ): string => {
    if (
      !result.found ||
      result.matchedJobs.length ===
        0
    ) {
      return targetRole
        ? `I couldn't find an active ${targetRole} opportunity that currently matches your profile.`
        : "I couldn't find an active job that currently matches your profile.";
    }

    const topJobs =
      result.matchedJobs
        .slice(
          0,
          3
        );

    const jobParts =
      topJobs.map(
        (
          job,
          index
        ) => {
          const matchedSkills =
            job.match
              .matchedSkills
              .slice(
                0,
                3
              );

          const missingSkills =
            job.match
              .missingSkills
              .slice(
                0,
                3
              );

          const matchedText =
            matchedSkills.length >
            0
              ? ` Matching skills: ${matchedSkills.join(
                  ", "
                )}.`
              : "";

          const missingText =
            missingSkills.length >
            0
              ? ` Skills to strengthen: ${missingSkills.join(
                  ", "
                )}.`
              : "";

          return `${index + 1}. ${job.title} at ${job.company} — ${job.match.matchScore}% match (${job.match.matchLevel}).${matchedText}${missingText}`;
        }
      );

    const prefix =
      targetRole
        ? `Based on your CV and your target role of ${targetRole}, these are your strongest current job matches:`
        : "Based on your CV, these are your strongest current job matches:";

    return [
      prefix,

      ...jobParts,
    ].join(
      " "
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getActiveCareerJobs,

  getCareerJobMatches,

  getCareerMatchForJob,

  buildCareerJobMatchSummary,

  buildCareerJobMatchReply,
};