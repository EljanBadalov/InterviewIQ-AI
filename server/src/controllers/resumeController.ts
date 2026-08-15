import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose, { Types } from "mongoose";
import { GridFSBucket } from "mongodb";
import { PDFParse } from "pdf-parse";

import { analyzeResume } from "../services/resumeService";
import { ResumeAnalysis } from "../models/resumeAnalysis";

const getResumeBucket = (): GridFSBucket => {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB connection is not ready");
  }

  return new GridFSBucket(db, {
    bucketName: "resumeFiles",
  });
};

const getParamString = (
  value: string | string[] | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const getUserObjectId = (
  req: Request
): Types.ObjectId | null => {
  if (!req.user || !req.user._id) {
    return null;
  }

  const value = req.user._id.toString();

  if (!Types.ObjectId.isValid(value)) {
    return null;
  }

  return new Types.ObjectId(value);
};

const saveResumeFile = async (
  file: Express.Multer.File,
  userId: Types.ObjectId
): Promise<Types.ObjectId> => {
  const bucket = getResumeBucket();

  return new Promise<Types.ObjectId>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(
      file.originalname,
      {
        metadata: {
          user: userId.toString(),
          uploadedAt: new Date(),
          contentType: file.mimetype,
          originalName: file.originalname,
          fileSize: file.size,
        },
      }
    );

    uploadStream.on("error", (error) => {
      reject(error);
    });

    uploadStream.on("finish", () => {
      resolve(uploadStream.id);
    });

    uploadStream.end(file.buffer);
  });
};

const deleteResumeFile = async (
  fileId: Types.ObjectId
): Promise<void> => {
  try {
    const bucket = getResumeBucket();

    await bucket.delete(fileId);
  } catch (error) {
    console.error(
      "Could not delete GridFS resume file:",
      error
    );
  }
};

const serializeAnalysis = (analysis: any) => {
  return {
    _id: analysis._id,
    analysisId: analysis._id,
    fileName: analysis.fileName,
    fileSize: analysis.fileSize,
    mimeType: analysis.mimeType,

    overallScore: analysis.overallScore ?? 0,
    atsScore: analysis.atsScore ?? 0,
    contentScore: analysis.contentScore ?? 0,
    structureScore: analysis.structureScore ?? 0,
    skillsScore: analysis.skillsScore ?? 0,
    experienceScore: analysis.experienceScore ?? 0,

    summary: analysis.summary ?? "",

    skillsDetected: analysis.skillsDetected ?? [],
    strengths: analysis.strengths ?? [],
    weaknesses: analysis.weaknesses ?? [],
    missingSkills: analysis.missingSkills ?? [],
    recommendedSkills: analysis.missingSkills ?? [],
    atsSuggestions: analysis.atsSuggestions ?? [],
    formattingFeedback:
      analysis.formattingFeedback ?? [],
    recommendations: analysis.recommendations ?? [],

    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  };
};

export const analyzeResumeController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let savedFileId: Types.ObjectId | null = null;

  try {
    const userId = getUserObjectId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });

      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message:
          "Please upload a valid PDF resume file",
      });

      return;
    }

    if (
      req.file.mimetype !== "application/pdf"
    ) {
      res.status(400).json({
        success: false,
        message: "Only PDF files are allowed",
      });

      return;
    }

    const parser = new PDFParse({
      data: req.file.buffer,
    });

    let resumeText = "";

    try {
      const pdfData = await parser.getText();

      resumeText =
        pdfData.text?.trim() ?? "";
    } finally {
      await parser.destroy();
    }

    if (
      !resumeText ||
      resumeText.length < 20
    ) {
      res.status(400).json({
        success: false,
        message:
          "Could not extract readable text from the uploaded PDF resume",
      });

      return;
    }

    const analysis = await analyzeResume({
      resumeText,
    });

    savedFileId = await saveResumeFile(
      req.file,
      userId
    );

    const document =
      await ResumeAnalysis.create({
        user: userId,

        fileId: savedFileId,

        fileName: req.file.originalname,

        fileSize: req.file.size,

        mimeType:
          req.file.mimetype ||
          "application/pdf",

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
          analysis.skillsDetected,

        strengths:
          analysis.strengths,

        weaknesses:
          analysis.weaknesses,

        missingSkills:
          analysis.missingSkills,

        atsSuggestions:
          analysis.atsSuggestions,

        formattingFeedback:
          analysis.formattingFeedback,

        recommendations:
          analysis.recommendations,
      });

    res.status(200).json({
      success: true,
      message:
        "Resume analyzed successfully",

      data: {
        analysis:
          serializeAnalysis(document),
      },
    });
  } catch (error) {
    if (savedFileId) {
      await deleteResumeFile(
        savedFileId
      );
    }

    next(error);
  }
};

export const getResumeHistoryController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId =
      getUserObjectId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });

      return;
    }

    const analyses =
      await ResumeAnalysis.find({
        user: userId,
      }).sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,

      data: {
        analyses: analyses.map(
          (analysis) =>
            serializeAnalysis(
              analysis
            )
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getResumeAnalysisController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params.analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id: new Types.ObjectId(
            analysisId
          ),
          user: userId,
        });

      if (!analysis) {
        res.status(404).json({
          success: false,
          message:
            "Resume analysis not found",
        });

        return;
      }

      res.status(200).json({
        success: true,

        data: {
          analysis:
            serializeAnalysis(
              analysis
            ),
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const getResumeFileController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params.analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id: new Types.ObjectId(
            analysisId
          ),
          user: userId,
        });

      if (!analysis) {
        res.status(404).json({
          success: false,
          message:
            "Resume analysis not found",
        });

        return;
      }

      if (!analysis.fileId) {
        res.status(404).json({
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
        (error) => {
          console.error(
            "Resume GridFS download error:",
            error
          );

          if (!res.headersSent) {
            res.status(404).json({
              success: false,
              message:
                "Resume PDF file not found",
            });

            return;
          }

          res.end();
        }
      );

      downloadStream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

export const deleteResumeAnalysisController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserObjectId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const analysisId =
        getParamString(
          req.params.analysisId
        );

      if (
        !analysisId ||
        !Types.ObjectId.isValid(
          analysisId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid resume analysis ID",
        });

        return;
      }

      const analysis =
        await ResumeAnalysis.findOne({
          _id: new Types.ObjectId(
            analysisId
          ),
          user: userId,
        });

      if (!analysis) {
        res.status(404).json({
          success: false,
          message:
            "Resume analysis not found",
        });

        return;
      }

      if (analysis.fileId) {
        await deleteResumeFile(
          analysis.fileId
        );
      }

      await analysis.deleteOne();

      res.status(200).json({
        success: true,
        message:
          "Resume analysis deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };