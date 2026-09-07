import {
  Schema,
  model,
  type Types,
} from "mongoose";

export type SkillLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type SkillEvidenceSource =
  | "resume"
  | "mock-interview"
  | "technical-question"
  | "quiz"
  | "project"
  | "manual";

export interface ISkillEvidence {
  source: SkillEvidenceSource;

  sourceId?: Types.ObjectId;

  score?: number;

  note?: string;

  recordedAt: Date;
}

export interface IUserSkill {
  name: string;

  normalizedName: string;

  confidence: number;

  level: SkillLevel;

  evidenceCount: number;

  averageScore: number;

  sources: SkillEvidenceSource[];

  evidence: ISkillEvidence[];

  lastEvaluatedAt: Date;
}

export interface IUserSkillProfile {
  _id?: Types.ObjectId;

  user: Types.ObjectId;

  skills: IUserSkill[];

  totalEvidenceCount: number;

  createdAt?: Date;

  updatedAt?: Date;
}

/* =========================================
   SKILL EVIDENCE SCHEMA
========================================= */

const skillEvidenceSchema =
  new Schema<ISkillEvidence>(
    {
      source: {
        type: String,
        enum: [
          "resume",
          "mock-interview",
          "technical-question",
          "quiz",
          "project",
          "manual",
        ],
        required: true,
      },

      sourceId: {
        type: Schema.Types.ObjectId,
        required: false,
      },

      score: {
        type: Number,
        min: 0,
        max: 100,
        required: false,
      },

      note: {
        type: String,
        trim: true,
        required: false,
      },

      recordedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================
   USER SKILL SCHEMA
========================================= */

const userSkillSchema =
  new Schema<IUserSkill>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      normalizedName: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },

      confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0,
      },

      level: {
        type: String,
        enum: [
          "beginner",
          "intermediate",
          "advanced",
          "expert",
        ],
        required: true,
        default: "beginner",
      },

      evidenceCount: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      averageScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0,
      },

      sources: {
        type: [String],
        enum: [
          "resume",
          "mock-interview",
          "technical-question",
          "quiz",
          "project",
          "manual",
        ],
        default: [],
      },

      evidence: {
        type: [skillEvidenceSchema],
        default: [],
      },

      lastEvaluatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================
   USER SKILL PROFILE SCHEMA
========================================= */

const userSkillProfileSchema =
  new Schema<IUserSkillProfile>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,

        /*
          unique: true already creates
          the MongoDB index for this field.

          Do NOT also add:
          userSkillProfileSchema.index({ user: 1 })
          because that creates the duplicate-index warning.
        */
        unique: true,
      },

      skills: {
        type: [userSkillSchema],
        default: [],
      },

      totalEvidenceCount: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
    },
    {
      timestamps: true,
    }
  );

/* =========================================
   INDEXES
========================================= */

/*
  Search/index support for skills.

  We intentionally do NOT declare another
  index for "user" because unique: true
  already creates it.
*/
userSkillProfileSchema.index({
  "skills.normalizedName": 1,
});

/* =========================================
   MODEL
========================================= */

export const UserSkillProfile =
  model<IUserSkillProfile>(
    "UserSkillProfile",
    userSkillProfileSchema
  );