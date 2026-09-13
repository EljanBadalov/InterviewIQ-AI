import {
  Schema,
  model,
  models,
  type Model,
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

export type JobSalaryPeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "unknown";

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

  /*
   * Legacy / display fallback salary.
   *
   * Kept for backwards compatibility with existing
   * frontend and backend code.
   *
   * For new external jobs prefer the explicit
   * salaryMin / salaryMax / salaryPeriod fields.
   */
  salary: number;

  salaryMin?: number;

  salaryMax?: number;

  salaryCurrency?: string;

  salaryPeriod?: JobSalaryPeriod;

  salaryIsPredicted?: boolean;

  source: string;

  externalId?: string;

  /*
   * Source listing URL.
   *
   * Example:
   * Adzuna listing URL.
   */
  externalUrl?: string;

  /*
   * Preferred direct employer/application URL when
   * the external source legitimately exposes one.
   *
   * If this is unavailable, frontend can fall back
   * to externalUrl.
   */
  applyUrl?: string;

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
        default: 0,
      },

      salaryMin: {
        type: Number,
        min: 0,
        default: undefined,
      },

      salaryMax: {
        type: Number,
        min: 0,
        default: undefined,
      },

      salaryCurrency: {
        type: String,
        trim: true,
        uppercase: true,
        default: undefined,
      },

      salaryPeriod: {
        type: String,
        enum: [
          "hour",
          "day",
          "week",
          "month",
          "year",
          "unknown",
        ],
        default: undefined,
      },

      salaryIsPredicted: {
        type: Boolean,
        default: undefined,
      },

      source: {
        type: String,
        required: true,
        default: "InterviewIQ",
        trim: true,
        index: true,
      },

      externalId: {
        type: String,
        trim: true,
        default: undefined,
      },

      externalUrl: {
        type: String,
        trim: true,
        default: undefined,
      },

      applyUrl: {
        type: String,
        trim: true,
        default: undefined,
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

/*
 * External sources are refreshed repeatedly.
 * This index prevents the same source vacancy from
 * being inserted more than once.
 *
 * sparse: true keeps old InterviewIQ jobs without an
 * externalId valid.
 */
jobSchema.index(
  {
    source: 1,
    externalId: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

const Job:
  Model<IJob> =
    (
      models.Job as
        Model<IJob> |
        undefined
    ) ||
    model<IJob>(
      "Job",
      jobSchema
    );

export {
  Job,
};

export default Job;