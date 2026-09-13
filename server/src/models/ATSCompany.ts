import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export type ATSProvider =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "successfactors";

export interface IATSCompany
  extends Document {
  _id:
    Types.ObjectId;

  companyName:
    string;

  ats:
    ATSProvider;

  /*
   * Provider-specific identifier.
   *
   * Examples:
   *
   * Greenhouse:
   * figma
   *
   * Lever:
   * spotify
   *
   * Ashby:
   * linear
   *
   * SuccessFactors:
   * https://careers.azercell.com
   *
   * For SuccessFactors we use the career-site base URL
   * because these sites do not always expose a short board
   * slug like Greenhouse/Lever/Ashby.
   */
  boardSlug:
    string;

  careersUrl?:
    string;

  isActive:
    boolean;

  priority:
    number;

  jobCount:
    number;

  failureCount:
    number;

  lastSuccessfulFetchAt?:
    Date;

  lastFailedFetchAt?:
    Date;

  lastCheckedAt?:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;
}

/* =========================================================
   SCHEMA
========================================================= */

const ATSCompanySchema =
  new Schema<IATSCompany>(
    {
      companyName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        index:
          true,
      },

      ats: {
        type:
          String,

        enum: [
          "greenhouse",
          "lever",
          "ashby",
          "successfactors",
        ],

        required:
          true,

        index:
          true,
      },

      boardSlug: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      careersUrl: {
        type:
          String,

        trim:
          true,

        default:
          "",
      },

      isActive: {
        type:
          Boolean,

        default:
          true,

        index:
          true,
      },

      priority: {
        type:
          Number,

        default:
          50,

        min:
          0,

        max:
          100,

        index:
          true,
      },

      jobCount: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      failureCount: {
        type:
          Number,

        default:
          0,

        min:
          0,
      },

      lastSuccessfulFetchAt: {
        type:
          Date,
      },

      lastFailedFetchAt: {
        type:
          Date,
      },

      lastCheckedAt: {
        type:
          Date,
      },
    },
    {
      timestamps:
        true,
    }
  );

/* =========================================================
   INDEXES
========================================================= */

ATSCompanySchema.index(
  {
    ats:
      1,

    boardSlug:
      1,
  },
  {
    unique:
      true,
  }
);

ATSCompanySchema.index({
  isActive:
    1,

  ats:
    1,

  priority:
    -1,

  lastCheckedAt:
    1,
});

/* =========================================================
   MODEL
========================================================= */

const ATSCompany:
  Model<IATSCompany> =
  mongoose.models.ATSCompany ||
  mongoose.model<IATSCompany>(
    "ATSCompany",
    ATSCompanySchema
  );

export default ATSCompany;