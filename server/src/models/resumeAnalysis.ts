import {
  Schema,
  model,
  Types,
} from "mongoose";

export interface IResumeAnalysis {
  _id?: Types.ObjectId;

  user: Types.ObjectId;

  fileId: Types.ObjectId;

  fileName: string;

  fileSize: number;

  mimeType: string;

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

const resumeAnalysisSchema =
  new Schema<IResumeAnalysis>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      fileId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      fileName: {
        type: String,
        required: true,
        trim: true,
      },

      fileSize: {
        type: Number,
        required: true,
      },

      mimeType: {
        type: String,
        required: true,
        default: "application/pdf",
      },

      overallScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      atsScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      contentScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      structureScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      skillsScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      experienceScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      summary: {
        type: String,
        default: "",
        trim: true,
      },

      skillsDetected: {
        type: [String],
        default: [],
      },

      strengths: {
        type: [String],
        default: [],
      },

      weaknesses: {
        type: [String],
        default: [],
      },

      missingSkills: {
        type: [String],
        default: [],
      },

      atsSuggestions: {
        type: [String],
        default: [],
      },

      formattingFeedback: {
        type: [String],
        default: [],
      },

      recommendations: {
        type: [String],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

resumeAnalysisSchema.index({
  user: 1,
  createdAt: -1,
});

export const ResumeAnalysis =
  model<IResumeAnalysis>(
    "ResumeAnalysis",
    resumeAnalysisSchema
  );