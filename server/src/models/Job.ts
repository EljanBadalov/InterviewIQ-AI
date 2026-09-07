import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type JobRemoteType =
  | "onsite"
  | "hybrid"
  | "remote";

export type JobEmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship";

export type JobExperienceLevel =
  | "entry"
  | "junior"
  | "mid"
  | "senior";

export interface IJob {
  _id?: Types.ObjectId;

  title: string;

  company: string;

  location: string;

  remoteType: JobRemoteType;

  employmentType: JobEmploymentType;

  experienceLevel: JobExperienceLevel;

  experienceMin: number;

  experienceMax: number | null;

  description: string;

  responsibilities: string[];

  requirements: string[];

  preferredQualifications: string[];

  skills: string[];

  keywords: string[];

  education: string[];

  salary: number;

  source: string;

  isActive: boolean;

  postedAt: Date;

  createdAt?: Date;

  updatedAt?: Date;
}

const jobSchema =
  new Schema<IJob>(
    {
      title: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      company: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      location: {
        type: String,
        required: true,
        trim: true,
      },

      remoteType: {
        type: String,
        enum: [
          "onsite",
          "hybrid",
          "remote",
        ],
        required: true,
        index: true,
      },

      employmentType: {
        type: String,
        enum: [
          "full-time",
          "part-time",
          "contract",
          "internship",
        ],
        required: true,
        index: true,
      },

      experienceLevel: {
        type: String,
        enum: [
          "entry",
          "junior",
          "mid",
          "senior",
        ],
        required: true,
        index: true,
      },

      experienceMin: {
        type: Number,
        required: true,
        min: 0,
        index: true,
      },

      experienceMax: {
        type: Number,
        default: null,
        min: 0,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      responsibilities: {
        type: [String],
        default: [],
      },

      requirements: {
        type: [String],
        default: [],
      },

      preferredQualifications: {
        type: [String],
        default: [],
      },

      skills: {
        type: [String],
        default: [],
      },

      keywords: {
        type: [String],
        default: [],
      },

      education: {
        type: [String],
        default: [],
      },

      salary: {
        type: Number,
        required: true,
        min: 0,
      },

      source: {
        type: String,
        required: true,
        default: "InterviewIQ",
        trim: true,
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      postedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

jobSchema.index({
  title: "text",
  company: "text",
  description: "text",
  skills: "text",
  keywords: "text",
});

jobSchema.index({
  isActive: 1,
  postedAt: -1,
});

jobSchema.index({
  experienceMin: 1,
  experienceMax: 1,
});

jobSchema.index({
  remoteType: 1,
  employmentType: 1,
});

jobSchema.index({
  experienceLevel: 1,
});

export const Job =
  model<IJob>(
    "Job",
    jobSchema
  );