import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose, {
  Types,
} from "mongoose";

import {
  GridFSBucket,
} from "mongodb";

import {
  type IExtractedResumeProfile,
} from "../services/resumeService";

import {
  analyzeResumeLocally,
} from "../services/resumeFallbackAnalysisService";

import {
  extractPdfText,
} from "../services/pdfTextService";

import {
  extractStructuredResume,
  type StructuredCertificationStatus,
} from "../services/resumeStructuredExtractionService";

import {
  ResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  ResumeProfile,
} from "../models/ResumeProfile";

import {
  createResumeProfile,
} from "../services/resumeProfileService";

/* =========================================================
   CERTIFICATION STATUS MAPPING
========================================================= */

const mapCertificationStatus = (
  status:
    StructuredCertificationStatus
):
  | "completed"
  | "in-progress"
  | "expired" => {
  switch (
    status
  ) {
    case "in-progress":
      return "in-progress";

    case "expired":
      return "expired";

    case "active":
    case "unknown":
    default:
      return "completed";
  }
};

/* =========================================================
   HELPERS
========================================================= */

const getResumeBucket =
  (): GridFSBucket => {
    const db =
      mongoose.connection.db;

    if (!db) {
      throw new Error(
        "MongoDB connection is not ready"
      );
    }

    return new GridFSBucket(
      db,
      {
        bucketName:
          "resumeFiles",
      }
    );
  };

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

const getUserObjectId = (
  req: Request
): Types.ObjectId | null => {
  if (
    !req.user ||
    !req.user._id
  ) {
    return null;
  }

  const value =
    req.user._id.toString();

  if (
    !Types.ObjectId.isValid(
      value
    )
  ) {
    return null;
  }

  return new Types.ObjectId(
    value
  );
};

const saveResumeFile =
  async (
    file:
      Express.Multer.File,
    userId:
      Types.ObjectId
  ): Promise<Types.ObjectId> => {
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
            file.originalname,
            {
              metadata: {
                user:
                  userId.toString(),

                uploadedAt:
                  new Date(),

                contentType:
                  file.mimetype,

                originalName:
                  file.originalname,

                fileSize:
                  file.size,
              },
            }
          );

        uploadStream.on(
          "error",
          (
            error
          ) => {
            reject(
              error
            );
          }
        );

        uploadStream.on(
          "finish",
          () => {
            resolve(
              uploadStream.id
            );
          }
        );

        uploadStream.end(
          file.buffer
        );
      }
    );
  };

const deleteResumeFile =
  async (
    fileId:
      Types.ObjectId
  ): Promise<void> => {
    try {
      const bucket =
        getResumeBucket();

      await bucket.delete(
        fileId
      );
    } catch (
      error
    ) {
      console.error(
        "Could not delete GridFS resume file:",
        error
      );
    }
  };

const serializeAnalysis = (
  analysis: any
) => {
  return {
    _id:
      analysis._id,

    analysisId:
      analysis._id,

    fileName:
      analysis.fileName,

    fileSize:
      analysis.fileSize,

    mimeType:
      analysis.mimeType,

    overallScore:
      analysis.overallScore ??
      0,

    atsScore:
      analysis.atsScore ??
      0,

    contentScore:
      analysis.contentScore ??
      0,

    structureScore:
      analysis.structureScore ??
      0,

    skillsScore:
      analysis.skillsScore ??
      0,

    experienceScore:
      analysis.experienceScore ??
      0,

    summary:
      analysis.summary ??
      "",

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

    recommendedSkills:
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

const serializeProfile = (
  profile: any
) => {
  if (!profile) {
    return null;
  }

  return {
    _id:
      profile._id,

    profileId:
      profile._id,

    resumeAnalysis:
      profile.resumeAnalysis,

    fileName:
      profile.fileName,

    contact:
      profile.contact,

    professionalSummary:
      profile.professionalSummary,

    skills:
      profile.skills ??
      [],

    technicalSkills:
      profile.technicalSkills ??
      [],

    softSkills:
      profile.softSkills ??
      [],

    experience:
      profile.experience ??
      [],

    projects:
      profile.projects ??
      [],

    education:
      profile.education ??
      [],

    certifications:
      profile.certifications ??
      [],

    languages:
      profile.languages ??
      [],

    volunteering:
      profile.volunteering ??
      [],

    achievements:
      profile.achievements ??
      [],

    interests:
      profile.interests ??
      [],

    extractionStatus:
      profile.extractionStatus,

    extractionWarnings:
      profile.extractionWarnings ??
      [],

    createdAt:
      profile.createdAt,

    updatedAt:
      profile.updatedAt,
  };
};

/* =========================================================
   ANALYZE RESUME
========================================================= */

export const analyzeResumeController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let savedFileId:
      Types.ObjectId | null =
      null;

    let createdAnalysisId:
      Types.ObjectId | null =
      null;

    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success: false,

          message:
            "Not authorized",
        });

        return;
      }

      if (!req.file) {
        res.status(
          400
        ).json({
          success: false,

          message:
            "Please upload a valid PDF resume file",
        });

        return;
      }

      if (
        req.file
          .mimetype !==
        "application/pdf"
      ) {
        res.status(
          400
        ).json({
          success: false,

          message:
            "Only PDF files are allowed",
        });

        return;
      }

      const pdfExtraction =
        await extractPdfText(
          req.file.buffer
        );

      const resumeText =
        pdfExtraction.text;

      /* =============================================
         ANALYSIS + CANONICAL STRUCTURED PROFILE
      ============================================= */

      /*
       * CANONICAL STRUCTURED EXTRACTION
       * -------------------------------------------------------
       * The structured profile is extracted first and becomes the
       * factual source of truth for BOTH scoring and Improve CV.
       */
      const structuredResult =
        await extractStructuredResume({
          resumeText,

          rawResumeText:
            pdfExtraction.rawText,

          layoutPages:
            pdfExtraction.pages,
        });

      const extractedProfile =
        structuredResult.profile;

      /*
       * Convert the canonical deterministic profile to the lightweight
       * analysis profile contract used by the local scorer.
       *
       * This avoids parsing the same resume a second time and prevents
       * different parsers from scoring different interpretations.
       */
      const analysisProfile:
        IExtractedResumeProfile = {
          contact: {
            fullName:
              extractedProfile
                .contact
                .fullName ||
              undefined,

            email:
              extractedProfile
                .contact
                .email ||
              undefined,

            phone:
              extractedProfile
                .contact
                .phone ||
              undefined,

            location:
              extractedProfile
                .contact
                .location ||
              undefined,

            linkedin:
              extractedProfile
                .contact
                .linkedin ||
              undefined,

            github:
              extractedProfile
                .contact
                .github ||
              undefined,

            website:
              extractedProfile
                .contact
                .website ||
              undefined,
          },

          professionalSummary:
            extractedProfile
              .professionalSummary,

          skills: [
            ...extractedProfile
              .skills,
          ],

          technicalSkills: [
            ...extractedProfile
              .technicalSkills,
          ],

          softSkills: [
            ...extractedProfile
              .softSkills,
          ],

          experience:
            extractedProfile
              .experience
              .map(
                (
                  item
                ) => ({
                  title:
                    item.title,

                  company:
                    item.company ||
                    undefined,

                  location:
                    item.location ||
                    undefined,

                  employmentType:
                    item.employmentType ||
                    undefined,

                  startDate:
                    item.startDate ||
                    undefined,

                  endDate:
                    item.endDate ||
                    undefined,

                  isCurrent:
                    item.isCurrent,

                  description:
                    item.description ||
                    undefined,

                  bullets: [
                    ...item.bullets,
                  ],

                  technologies: [
                    ...item.technologies,
                  ],
                })
              ),

          projects:
            extractedProfile
              .projects
              .map(
                (
                  item
                ) => ({
                  name:
                    item.name,

                  role:
                    item.role ||
                    undefined,

                  description:
                    item.description ||
                    undefined,

                  startDate:
                    item.startDate ||
                    undefined,

                  endDate:
                    item.endDate ||
                    undefined,

                  technologies: [
                    ...item.technologies,
                  ],

                  bullets: [
                    ...item.bullets,
                  ],

                  url:
                    item.url ||
                    undefined,

                  github:
                    item.github ||
                    undefined,
                })
              ),

          education:
            extractedProfile
              .education
              .map(
                (
                  item
                ) => ({
                  institution:
                    item.institution,

                  degree:
                    item.degree ||
                    undefined,

                  field:
                    item.field ||
                    undefined,

                  location:
                    item.location ||
                    undefined,

                  startDate:
                    item.startDate ||
                    undefined,

                  endDate:
                    item.endDate ||
                    undefined,

                  isCurrent:
                    item.isCurrent,

                  gpa:
                    item.gpa ||
                    undefined,

                  coursework: [
                    ...item.coursework,
                  ],

                  achievements: [
                    ...item.achievements,
                  ],
                })
              ),

          certifications:
            extractedProfile
              .certifications
              .map(
                (
                  item
                ) => ({
                  name:
                    item.name,

                  issuer:
                    item.issuer ||
                    undefined,

                  issueDate:
                    item.issueDate ||
                    undefined,

                  expirationDate:
                    item.expirationDate ||
                    undefined,

                  credentialId:
                    item.credentialId ||
                    undefined,

                  credentialUrl:
                    item.credentialUrl ||
                    undefined,

                  status:
                    mapCertificationStatus(
                      item.status
                    ),
                })
              ),

          languages:
            extractedProfile
              .languages
              .map(
                (
                  item
                ) => ({
                  language:
                    item.language,

                  level:
                    item.level ||
                    undefined,
                })
              ),

          volunteering:
            extractedProfile
              .volunteering
              .map(
                (
                  item
                ) => ({
                  organization:
                    item.organization,

                  role:
                    item.role ||
                    undefined,

                  startDate:
                    item.startDate ||
                    undefined,

                  endDate:
                    item.endDate ||
                    undefined,

                  bullets: [
                    ...item.bullets,
                  ],
                })
              ),

          achievements: [
            ...extractedProfile
              .achievements,
          ],

          interests: [
            ...extractedProfile
              .interests,
          ],

          rawSections:
            extractedProfile
              .rawSections
              .map(
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
            extractedProfile
              .extractionStatus,

          extractionWarnings: [
            ...extractedProfile
              .extractionWarnings,
          ],
        };

      /*
       * REALISTIC DETERMINISTIC SCORING
       * -------------------------------------------------------
       * The score now uses:
       * - canonical parsed content
       * - PDF layout risk
       * - column count
       * - extraction confidence
       *
       * It no longer awards a near-perfect ATS score just because the
       * resume contains many skills and recognizable headings.
       */
      console.log(
        "[Resume Analyze] Scoring input profile",
        {
          fileName:
            req.file.originalname,

          pdfLayout:
            pdfExtraction.layout,

          selectedExtractionMode:
            structuredResult
              .selectedMode,

          pageColumns:
            pdfExtraction
              .pages
              .map(
                (
                  page
                ) =>
                  page.columnCount
              ),

          fullName:
            analysisProfile
              .contact
              .fullName ||
            null,

          hasSummary:
            analysisProfile
              .professionalSummary
              .trim()
              .length >=
            40,

          summaryLength:
            analysisProfile
              .professionalSummary
              .trim()
              .length,

          technicalSkills:
            analysisProfile
              .technicalSkills
              .length,

          softSkills:
            analysisProfile
              .softSkills
              .length,

          experience:
            analysisProfile
              .experience
              .length,

          experienceBullets:
            analysisProfile
              .experience
              .reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item
                    .bullets
                    .length,
                0
              ),

          projects:
            analysisProfile
              .projects
              .length,

          projectBullets:
            analysisProfile
              .projects
              .reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item
                    .bullets
                    .length,
                0
              ),

          education:
            analysisProfile
              .education
              .length,

          certifications:
            analysisProfile
              .certifications
              .length,

          languages:
            analysisProfile
              .languages
              .length,

          volunteering:
            analysisProfile
              .volunteering
              .length,

          extractionStatus:
            analysisProfile
              .extractionStatus,

          extractionWarnings:
            analysisProfile
              .extractionWarnings,

          rawSectionTitles:
            analysisProfile
              .rawSections
              .map(
                (
                  section
                ) =>
                  section.title
              ),
        }
      );

      const localResult =
        analyzeResumeLocally({
          /*
           * Score the exact same text representation that produced
           * the selected canonical profile.
           */
          resumeText:
            structuredResult
              .selectedText ||
            resumeText,

          profileOverride:
            analysisProfile,

          documentSignals: {
            layout:
              pdfExtraction
                .layout,

            pageCount:
              pdfExtraction
                .pages
                .length,

            columnCounts:
              pdfExtraction
                .pages
                .map(
                  (
                    page
                  ) =>
                    page
                      .columnCount
                ),

            extractionWarnings: [
              ...pdfExtraction
                .warnings,

              ...structuredResult
                .warnings,
            ],
          },
        });

      const analysis =
        localResult.analysis;

      console.log(
        "[Resume Analyze] Canonical structured profile + realistic scoring ready",
        {
          fileName:
            req.file.originalname,

          pdfLayout:
            pdfExtraction.layout,

          pages:
            pdfExtraction.pages.length,

          experience:
            extractedProfile
              .experience
              .length,

          projects:
            extractedProfile
              .projects
              .length,

          education:
            extractedProfile
              .education
              .length,

          certifications:
            extractedProfile
              .certifications
              .length,

          volunteering:
            extractedProfile
              .volunteering
              .length,

          hackathons:
            extractedProfile
              .hackathons
              .length,

          languages:
            extractedProfile
              .languages
              .length,

          warnings:
            extractedProfile
              .extractionWarnings
              .length,
        }
      );

      /* =============================================
         SAVE ORIGINAL PDF
      ============================================= */

      savedFileId =
        await saveResumeFile(
          req.file,
          userId
        );

      /* =============================================
         SAVE ANALYSIS
      ============================================= */

      const document =
        await ResumeAnalysis.create({
          user:
            userId,

          fileId:
            savedFileId,

          fileName:
            req.file
              .originalname,

          fileSize:
            req.file
              .size,

          mimeType:
            req.file
              .mimetype ||
            "application/pdf",

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

      /* =============================================
         SAVE CANONICAL STRUCTURED RESUME PROFILE
      ============================================= */

      const profile =
        await createResumeProfile({
          userId,

          resumeAnalysisId:
            document._id,

          fileId:
            savedFileId,

          fileName:
            req.file
              .originalname,

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
              .certifications
              .map(
                (
                  item
                ) => ({
                  name:
                    item.name,

                  issuer:
                    item.issuer ||
                    undefined,

                  issueDate:
                    item.issueDate ||
                    undefined,

                  expirationDate:
                    item.expirationDate ||
                    undefined,

                  credentialId:
                    item.credentialId ||
                    undefined,

                  credentialUrl:
                    item.credentialUrl ||
                    undefined,

                  status:
                    mapCertificationStatus(
                      item.status
                    ),
                })
              ),

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

      /* =============================================
         RESPONSE
      ============================================= */

      res.status(
        200
      ).json({
        success: true,

        message:
          "Resume analyzed and structured profile created successfully",

        data: {
          analysis:
            serializeAnalysis(
              document
            ),

          profile:
            serializeProfile(
              profile
            ),
        },
      });
    } catch (
      error
    ) {
      /*
       * If profile creation fails after ResumeAnalysis
       * was created, remove the analysis so we do not
       * leave inconsistent records behind.
       */

      if (
        createdAnalysisId
      ) {
        try {
          await ResumeAnalysis.deleteOne({
            _id:
              createdAnalysisId,
          });
        } catch (
          cleanupError
        ) {
          console.error(
            "Could not clean up ResumeAnalysis:",
            cleanupError
          );
        }
      }

      if (
        savedFileId
      ) {
        await deleteResumeFile(
          savedFileId
        );
      }

      next(
        error
      );
    }
  };

/* =========================================================
   HISTORY
========================================================= */

export const getResumeHistoryController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success: false,

          message:
            "Not authorized",
        });

        return;
      }

      const analyses =
        await ResumeAnalysis.find({
          user:
            userId,
        }).sort({
          createdAt:
            -1,
        });

      res.status(
        200
      ).json({
        success: true,

        data: {
          analyses:
            analyses.map(
              (
                analysis
              ) =>
                serializeAnalysis(
                  analysis
                )
            ),
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
   GET ONE ANALYSIS
========================================================= */

export const getResumeAnalysisController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success: false,

          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params
            .analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(
          400
        ).json({
          success: false,

          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id:
            new Types.ObjectId(
              analysisId
            ),

          user:
            userId,
        });

      if (!analysis) {
        res.status(
          404
        ).json({
          success: false,

          message:
            "Resume analysis not found",
        });

        return;
      }

      const profile =
        await ResumeProfile.findOne({
          user:
            userId,

          resumeAnalysis:
            analysis._id,
        });

      res.status(
        200
      ).json({
        success: true,

        data: {
          analysis:
            serializeAnalysis(
              analysis
            ),

          profile:
            serializeProfile(
              profile
            ),
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
   GET ORIGINAL PDF
========================================================= */

export const getResumeFileController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success: false,

          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params
            .analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(
          400
        ).json({
          success: false,

          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id:
            new Types.ObjectId(
              analysisId
            ),

          user:
            userId,
        });

      if (!analysis) {
        res.status(
          404
        ).json({
          success: false,

          message:
            "Resume analysis not found",
        });

        return;
      }

      if (
        !analysis.fileId
      ) {
        res.status(
          404
        ).json({
          success: false,

          message:
            "Resume PDF file not found",
        });

        return;
      }

      const bucket =
        getResumeBucket();

      res.setHeader(
        "Content-Type",
        analysis.mimeType ||
          "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(
          analysis.fileName
        )}`
      );

      res.setHeader(
        "Cache-Control",
        "private, max-age=3600"
      );

      const downloadStream =
        bucket.openDownloadStream(
          analysis.fileId
        );

      downloadStream.on(
        "error",
        (
          error
        ) => {
          console.error(
            "Resume GridFS download error:",
            error
          );

          if (
            !res.headersSent
          ) {
            res.status(
              404
            ).json({
              success: false,

              message:
                "Resume PDF file not found",
            });

            return;
          }

          res.end();
        }
      );

      downloadStream.pipe(
        res
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
   DELETE ANALYSIS + PROFILE + PDF
========================================================= */

export const deleteResumeAnalysisController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(
          req
        );

      if (!userId) {
        res.status(
          401
        ).json({
          success: false,

          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params
            .analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(
          400
        ).json({
          success: false,

          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id:
            new Types.ObjectId(
              analysisId
            ),

          user:
            userId,
        });

      if (!analysis) {
        res.status(
          404
        ).json({
          success: false,

          message:
            "Resume analysis not found",
        });

        return;
      }

      /*
       * Delete linked structured profile first.
       */

      await ResumeProfile.deleteMany({
        user:
          userId,

        resumeAnalysis:
          analysis._id,
      });

      /*
       * Delete original GridFS PDF.
       */

      if (
        analysis.fileId
      ) {
        await deleteResumeFile(
          analysis.fileId
        );
      }

      /*
       * Delete analysis.
       */

      await analysis.deleteOne();

      res.status(
        200
      ).json({
        success: true,

        message:
          "Resume analysis, structured profile, and PDF deleted successfully",
      });
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };