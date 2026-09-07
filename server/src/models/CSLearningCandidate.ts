import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export type CSLearningCandidateStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "disabled";

export type CSLearningCandidateSource =
  | "conversation"
  | "agent"
  | "manual"
  | "import";

export interface ICSLearningCandidate
  extends Document {
  phrase: string;

  normalizedPhrase: string;

  suggestedIntent: string;

  occurrences: number;

  averageConfidence: number;

  highestConfidence: number;

  lowestConfidence: number;

  source: CSLearningCandidateSource;

  status: CSLearningCandidateStatus;

  conversationIds: Types.ObjectId[];

  sessionIds: string[];

  customerMessages: string[];

  approvedBy?: Types.ObjectId;

  approvedAt?: Date;

  rejectedBy?: Types.ObjectId;

  rejectedAt?: Date;

  rejectionReason?: string;

  notes?: string;

  metadata: Record<
    string,
    unknown
  >;

  firstSeenAt: Date;

  lastSeenAt: Date;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   NORMALIZATION
========================================================= */

const normalizePhrase = (
  value: string
): string => {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* =========================================================
   SCHEMA
========================================================= */

const csLearningCandidateSchema =
  new Schema<ICSLearningCandidate>(
    {
      phrase: {
        type: String,

        required: true,

        trim: true,

        maxlength: 2000,
      },

      normalizedPhrase: {
        type: String,

        required: true,

        trim: true,

        index: true,
      },

      suggestedIntent: {
        type: String,

        required: true,

        trim: true,

        uppercase: true,

        index: true,
      },

      occurrences: {
        type: Number,

        default: 1,

        min: 1,
      },

      averageConfidence: {
        type: Number,

        default: 0,

        min: 0,

        max: 1,
      },

      highestConfidence: {
        type: Number,

        default: 0,

        min: 0,

        max: 1,
      },

      lowestConfidence: {
        type: Number,

        default: 0,

        min: 0,

        max: 1,
      },

      source: {
        type: String,

        enum: [
          "conversation",
          "agent",
          "manual",
          "import",
        ],

        default:
          "conversation",

        index: true,
      },

      status: {
        type: String,

        enum: [
          "candidate",
          "approved",
          "rejected",
          "disabled",
        ],

        default:
          "candidate",

        index: true,
      },

      conversationIds: {
        type: [
          Schema.Types.ObjectId,
        ],

        ref:
          "CustomerConversation",

        default:
          [],
      },

      sessionIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      customerMessages: {
        type: [
          String,
        ],

        default:
          [],
      },

      approvedBy: {
        type:
          Schema.Types.ObjectId,

        ref:
          "User",
      },

      approvedAt: {
        type:
          Date,
      },

      rejectedBy: {
        type:
          Schema.Types.ObjectId,

        ref:
          "User",
      },

      rejectedAt: {
        type:
          Date,
      },

      rejectionReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          2000,
      },

      notes: {
        type:
          String,

        trim:
          true,

        maxlength:
          4000,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },

      firstSeenAt: {
        type:
          Date,

        default:
          Date.now,

        index:
          true,
      },

      lastSeenAt: {
        type:
          Date,

        default:
          Date.now,

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        "cs_learning_candidates",
    }
  );

/* =========================================================
   PRE VALIDATE
========================================================= */

csLearningCandidateSchema.pre(
  "validate",
  function () {
    if (this.phrase) {
      this.normalizedPhrase =
        normalizePhrase(
          this.phrase
        );
    }
  }
);

/* =========================================================
   INDEXES
========================================================= */

/*
 * Same phrase can exist under different intents,
 * but the same phrase + same intent should only have
 * one learning candidate.
 */

csLearningCandidateSchema.index(
  {
    normalizedPhrase: 1,

    suggestedIntent: 1,
  },
  {
    unique: true,
  }
);

csLearningCandidateSchema.index(
  {
    status: 1,

    occurrences: -1,

    averageConfidence: -1,
  }
);

csLearningCandidateSchema.index(
  {
    suggestedIntent: 1,

    status: 1,

    lastSeenAt: -1,
  }
);

csLearningCandidateSchema.index(
  {
    source: 1,

    createdAt: -1,
  }
);

/* =========================================================
   MODEL
========================================================= */

const CSLearningCandidate:
  Model<ICSLearningCandidate> =
    mongoose.models.CSLearningCandidate ||
    mongoose.model<ICSLearningCandidate>(
      "CSLearningCandidate",
      csLearningCandidateSchema
    );

export {
  normalizePhrase,
};

export default CSLearningCandidate;