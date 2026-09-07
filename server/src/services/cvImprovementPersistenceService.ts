import mongoose, {
  Types,
} from "mongoose";

import {
  GridFSBucket,
} from "mongodb";

import {
  ResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  createResumeProfile,
} from "./resumeProfileService";

import {
  type IResumeServiceResult,
} from "./resumeService";

/* =========================================================
   TYPES
========================================================= */

export interface IPersistAcceptedImprovedCVParams {
  userId:
    Types.ObjectId;

  pdfBuffer:
    Buffer;

  fileName:
    string;

  candidateAnalysis:
    IResumeServiceResult;
}

export interface IPersistAcceptedImprovedCVResult {
  analysisId:
    Types.ObjectId;

  profileId:
    Types.ObjectId;

  fileId:
    Types.ObjectId;

  fileName:
    string;

  fileSize:
    number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const PDF_MIME_TYPE =
  "application/pdf";

const RESUME_BUCKET_NAME =
  "resumeFiles";

/* =========================================================
   DEBUG HELPERS
========================================================= */

const nowMs = (): number => {
  return Date.now();
};

const elapsedMs = (
  startedAt:
    number
): number => {
  return (
    Date.now() -
    startedAt
  );
};

const logPersist = (
  message:
    string,
  data?:
    Record<
      string,
      unknown
    >
): void => {
  if (data) {
    console.log(
      `[CV Persist] ${message}`,
      JSON.stringify(
        data,
        null,
        2
      )
    );

    return;
  }

  console.log(
    `[CV Persist] ${message}`
  );
};

/* =========================================================
   GRIDFS
========================================================= */

const getResumeBucket =
  (): GridFSBucket => {
    const db =
      mongoose
        .connection
        .db;

    if (!db) {
      throw new Error(
        "MongoDB connection is not ready"
      );
    }

    return new GridFSBucket(
      db,
      {
        bucketName:
          RESUME_BUCKET_NAME,
      }
    );
  };

const saveAcceptedPdf =
  async ({
    userId,
    pdfBuffer,
    fileName,
  }: {
    userId:
      Types.ObjectId;

    pdfBuffer:
      Buffer;

    fileName:
      string;
  }): Promise<Types.ObjectId> => {
    const startedAt =
      nowMs();

    logPersist(
      "GridFS upload START",
      {
        fileName,

        bytes:
          pdfBuffer.length,

        userId:
          userId.toString(),
      }
    );

    const bucket =
      getResumeBucket();

    return new Promise<
      Types.ObjectId
    >(
      (
        resolve,
        reject
      ) => {
        const uploadStream =
          bucket.openUploadStream(
            fileName,
            {
              metadata: {
                user:
                  userId.toString(),

                uploadedAt:
                  new Date(),

                contentType:
                  PDF_MIME_TYPE,

                originalName:
                  fileName,

                fileSize:
                  pdfBuffer.length,

                source:
                  "cv-improvement-quality-gate",

                qualityGateAccepted:
                  true,
              },
            }
          );

        uploadStream.on(
          "error",
          (
            error
          ) => {
            console.error(
              `[CV Persist] GridFS upload FAILED after ${elapsedMs(
                startedAt
              )}ms`,
              error
            );

            reject(
              error
            );
          }
        );

        uploadStream.on(
          "finish",
          () => {
            logPersist(
              "GridFS upload DONE",
              {
                fileId:
                  uploadStream
                    .id
                    .toString(),

                durationMs:
                  elapsedMs(
                    startedAt
                  ),
              }
            );

            resolve(
              uploadStream.id
            );
          }
        );

        uploadStream.end(
          pdfBuffer
        );
      }
    );
  };

const deleteAcceptedPdf =
  async (
    fileId:
      Types.ObjectId
  ): Promise<void> => {
    try {
      logPersist(
        "GridFS cleanup START",
        {
          fileId:
            fileId.toString(),
        }
      );

      const bucket =
        getResumeBucket();

      await bucket.delete(
        fileId
      );

      logPersist(
        "GridFS cleanup DONE",
        {
          fileId:
            fileId.toString(),
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Could not clean up accepted improved CV GridFS file:",
        error
      );
    }
  };

/* =========================================================
   PERSIST ACCEPTED IMPROVED CV
========================================================= */

export const persistAcceptedImprovedCV =
  async ({
    userId,
    pdfBuffer,
    fileName,
    candidateAnalysis,
  }: IPersistAcceptedImprovedCVParams): Promise<IPersistAcceptedImprovedCVResult> => {
    const flowStartedAt =
      nowMs();

    logPersist(
      "START",
      {
        userId:
          userId.toString(),

        fileName,

        bytes:
          pdfBuffer.length,

        overallScore:
          candidateAnalysis
            .analysis
            .overallScore,
      }
    );

    if (
      !Types.ObjectId.isValid(
        userId
      )
    ) {
      throw new Error(
        "A valid user ID is required to persist an improved CV."
      );
    }

    if (
      !Buffer.isBuffer(
        pdfBuffer
      ) ||
      pdfBuffer.length ===
        0
    ) {
      throw new Error(
        "A valid improved CV PDF buffer is required."
      );
    }

    const normalizedFileName =
      fileName
        .trim();

    if (
      !normalizedFileName
    ) {
      throw new Error(
        "A valid improved CV file name is required."
      );
    }

    const {
      analysis,
      profile:
        extractedProfile,
    } =
      candidateAnalysis;

    let savedFileId:
      Types.ObjectId | null =
        null;

    let createdAnalysisId:
      Types.ObjectId | null =
        null;

    try {
      /* =====================================================
         STEP 1
         GRIDFS
      ===================================================== */

      const gridFsStartedAt =
        nowMs();

      savedFileId =
        await saveAcceptedPdf({
          userId,

          pdfBuffer,

          fileName:
            normalizedFileName,
        });

      logPersist(
        "STEP 1 COMPLETE: GridFS saved",
        {
          fileId:
            savedFileId
              .toString(),

          durationMs:
            elapsedMs(
              gridFsStartedAt
            ),
        }
      );

      /* =====================================================
         STEP 2
         RESUME ANALYSIS
      ===================================================== */

      const analysisStartedAt =
        nowMs();

      logPersist(
        "STEP 2 START: ResumeAnalysis.create"
      );

      const document =
        await ResumeAnalysis.create({
          user:
            userId,

          fileId:
            savedFileId,

          fileName:
            normalizedFileName,

          fileSize:
            pdfBuffer.length,

          mimeType:
            PDF_MIME_TYPE,

          overallScore:
            analysis
              .overallScore,

          atsScore:
            analysis
              .atsScore,

          contentScore:
            analysis
              .contentScore,

          structureScore:
            analysis
              .structureScore,

          skillsScore:
            analysis
              .skillsScore,

          experienceScore:
            analysis
              .experienceScore,

          summary:
            analysis
              .summary,

          skillsDetected:
            analysis
              .skillsDetected,

          strengths:
            analysis
              .strengths,

          weaknesses:
            analysis
              .weaknesses,

          missingSkills:
            analysis
              .missingSkills,

          atsSuggestions:
            analysis
              .atsSuggestions,

          formattingFeedback:
            analysis
              .formattingFeedback,

          recommendations:
            analysis
              .recommendations,
        });

      createdAnalysisId =
        document._id;

      logPersist(
        "STEP 2 COMPLETE: ResumeAnalysis saved",
        {
          analysisId:
            document
              ._id
              .toString(),

          durationMs:
            elapsedMs(
              analysisStartedAt
            ),
        }
      );

      /* =====================================================
         STEP 3
         RESUME PROFILE
      ===================================================== */

      const profileStartedAt =
        nowMs();

      logPersist(
        "STEP 3 START: createResumeProfile",
        {
          analysisId:
            document
              ._id
              .toString(),

          experienceItems:
            extractedProfile
              .experience
              .length,

          projectItems:
            extractedProfile
              .projects
              .length,

          educationItems:
            extractedProfile
              .education
              .length,
        }
      );

      const profile =
        await createResumeProfile({
          userId,

          resumeAnalysisId:
            document._id,

          fileId:
            savedFileId,

          fileName:
            normalizedFileName,

          contact:
            extractedProfile
              .contact,

          professionalSummary:
            extractedProfile
              .professionalSummary,

          skills:
            extractedProfile
              .skills,

          technicalSkills:
            extractedProfile
              .technicalSkills,

          softSkills:
            extractedProfile
              .softSkills,

          experience:
            extractedProfile
              .experience,

          projects:
            extractedProfile
              .projects,

          education:
            extractedProfile
              .education,

          certifications:
            extractedProfile
              .certifications,

          languages:
            extractedProfile
              .languages,

          volunteering:
            extractedProfile
              .volunteering,

          achievements:
            extractedProfile
              .achievements,

          interests:
            extractedProfile
              .interests,

          rawSections:
            extractedProfile
              .rawSections,

          extractionStatus:
            extractedProfile
              .extractionStatus,

          extractionWarnings:
            extractedProfile
              .extractionWarnings,
        });

      logPersist(
        "STEP 3 COMPLETE: ResumeProfile saved",
        {
          profileId:
            profile
              ._id
              .toString(),

          durationMs:
            elapsedMs(
              profileStartedAt
            ),
        }
      );

      logPersist(
        "DONE",
        {
          totalDurationMs:
            elapsedMs(
              flowStartedAt
            ),

          analysisId:
            document
              ._id
              .toString(),

          profileId:
            profile
              ._id
              .toString(),

          fileId:
            savedFileId
              .toString(),
        }
      );

      return {
        analysisId:
          document._id,

        profileId:
          profile._id,

        fileId:
          savedFileId,

        fileName:
          normalizedFileName,

        fileSize:
          pdfBuffer.length,
      };
    } catch (
      error
    ) {
      console.error(
        `[CV Persist] FAILED after ${elapsedMs(
          flowStartedAt
        )}ms`,
        error
      );

      if (
        createdAnalysisId
      ) {
        try {
          logPersist(
            "ResumeAnalysis cleanup START",
            {
              analysisId:
                createdAnalysisId
                  .toString(),
            }
          );

          await ResumeAnalysis.deleteOne({
            _id:
              createdAnalysisId,
          });

          logPersist(
            "ResumeAnalysis cleanup DONE",
            {
              analysisId:
                createdAnalysisId
                  .toString(),
            }
          );
        } catch (
          cleanupError
        ) {
          console.error(
            "Could not clean up improved CV ResumeAnalysis:",
            cleanupError
          );
        }
      }

      if (
        savedFileId
      ) {
        await deleteAcceptedPdf(
          savedFileId
        );
      }

      throw error;
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  persistAcceptedImprovedCV,
};
