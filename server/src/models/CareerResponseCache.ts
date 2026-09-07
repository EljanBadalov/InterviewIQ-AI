import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerResponseCacheContext {
  resumeId?: Types.ObjectId | null;

  interviewId?: Types.ObjectId | null;

  targetRole?: string | null;

  resumeUpdatedAt?: Date | null;

  interviewUpdatedAt?: Date | null;
}

export interface ICareerResponseCache
  extends Document {
  userId: Types.ObjectId;

  normalizedQuestion: string;

  originalQuestion: string;

  intent: string;

  response: string;

  context: ICareerResponseCacheContext;

  hitCount: number;

  lastUsedAt: Date | null;

  expiresAt: Date;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   CONTEXT SCHEMA
========================================================= */

const careerResponseCacheContextSchema =
  new Schema<ICareerResponseCacheContext>(
    {
      resumeId: {
        type: Schema.Types.ObjectId,
        default: null,
      },

      interviewId: {
        type: Schema.Types.ObjectId,
        default: null,
      },

      targetRole: {
        type: String,
        trim: true,
        default: null,
      },

      resumeUpdatedAt: {
        type: Date,
        default: null,
      },

      interviewUpdatedAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   MAIN SCHEMA
========================================================= */

const careerResponseCacheSchema =
  new Schema<ICareerResponseCache>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      normalizedQuestion: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      originalQuestion: {
        type: String,
        required: true,
        trim: true,
      },

      intent: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        index: true,
      },

      response: {
        type: String,
        required: true,
      },

      context: {
        type: careerResponseCacheContextSchema,
        default: () => ({}),
      },

      hitCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastUsedAt: {
        type: Date,
        default: null,
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },
    },
    {
      timestamps: true,
      collection: "career_response_cache",
    }
  );

/* =========================================================
   INDEXES
========================================================= */

/*
  Fast lookup for:
  user + intent + normalized question
*/
careerResponseCacheSchema.index({
  userId: 1,
  intent: 1,
  normalizedQuestion: 1,
});

/*
  Useful when searching recent cache entries
  for similarity matching.
*/
careerResponseCacheSchema.index({
  userId: 1,
  intent: 1,
  updatedAt: -1,
});

/*
  MongoDB TTL index.

  MongoDB will automatically remove cache entries
  after expiresAt has passed.
*/
careerResponseCacheSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

/* =========================================================
   MODEL
========================================================= */

const CareerResponseCache:
  Model<ICareerResponseCache> =
    mongoose.models.CareerResponseCache ||
    mongoose.model<ICareerResponseCache>(
      "CareerResponseCache",
      careerResponseCacheSchema
    );

export default CareerResponseCache;