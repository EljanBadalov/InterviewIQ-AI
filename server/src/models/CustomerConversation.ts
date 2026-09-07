import mongoose, {
  Document,
  Model,
  Schema,
  Types,
} from "mongoose";

/* =========================================================
   TYPES
========================================================= */

export type CustomerConversationStatus =
  | "active"
  | "resolved"
  | "closed";

export type CustomerMessageSender =
  | "customer"
  | "assistant"
  | "system";

export interface ICustomerConversationEntity {
  key: string;

  value: string;

  confidence?: number;
}

export interface ICustomerConversationMessage {
  sender: CustomerMessageSender;

  text: string;

  intent?: string;

  confidence?: number;

  entities: ICustomerConversationEntity[];

  metadata?: Record<
    string,
    unknown
  >;

  createdAt: Date;
}

/* =========================================================
   CAREER MEMORY
========================================================= */

export interface ICustomerConversationMemory {
  lastIntent?: string;

  lastResolvedIntent?: string;

  awaitingField?: string;

  activeResumeId?: string;

  activeJobId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  skillsFocus?: string[];

  metadata?: Record<
    string,
    unknown
  >;
}

/* =========================================================
   RESOLUTION
========================================================= */

export interface ICustomerConversationResolution {
  resolved: boolean;

  resolvedBy?:
    | "system"
    | "user";

  resolutionType?: string;

  resolutionSummary?: string;

  resolvedAt?: Date;
}

/* =========================================================
   FEEDBACK
========================================================= */

export interface ICustomerConversationFeedback {
  rating?: number;

  helpful?: boolean;

  comment?: string;
}

/* =========================================================
   MAIN DOCUMENT
========================================================= */

export interface ICustomerConversation
  extends Document {
  userId?: Types.ObjectId;

  customerId?: string;

  customerName?: string;

  email?: string;

  sessionId: string;

  status: CustomerConversationStatus;

  messages:
    ICustomerConversationMessage[];

  memory:
    ICustomerConversationMemory;

  resolution:
    ICustomerConversationResolution;

  feedback:
    ICustomerConversationFeedback;

  startedAt: Date;

  lastMessageAt: Date;

  closedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

/* =========================================================
   ENTITY SCHEMA
========================================================= */

const customerConversationEntitySchema =
  new Schema<ICustomerConversationEntity>(
    {
      key: {
        type: String,

        required: true,

        trim: true,
      },

      value: {
        type: String,

        required: true,

        trim: true,
      },

      confidence: {
        type: Number,

        min: 0,

        max: 1,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   MESSAGE SCHEMA
========================================================= */

const customerConversationMessageSchema =
  new Schema<ICustomerConversationMessage>(
    {
      sender: {
        type: String,

        enum: [
          "customer",
          "assistant",
          "system",
        ],

        required: true,
      },

      text: {
        type: String,

        required: true,

        trim: true,
      },

      intent: {
        type: String,

        trim: true,
      },

      confidence: {
        type: Number,

        min: 0,

        max: 1,
      },

      entities: {
        type: [
          customerConversationEntitySchema,
        ],

        default: [],
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },

      createdAt: {
        type: Date,

        default:
          Date.now,
      },
    },
    {
      _id: true,
    }
  );

/* =========================================================
   CAREER MEMORY SCHEMA
========================================================= */

const customerConversationMemorySchema =
  new Schema<ICustomerConversationMemory>(
    {
      lastIntent: {
        type: String,

        trim: true,
      },

      lastResolvedIntent: {
        type: String,

        trim: true,
      },

      awaitingField: {
        type: String,

        trim: true,
      },

      activeResumeId: {
        type: String,

        trim: true,

        index: true,
      },

      activeJobId: {
        type: String,

        trim: true,

        index: true,
      },

      activeInterviewId: {
        type: String,

        trim: true,

        index: true,
      },

      targetRole: {
        type: String,

        trim: true,

        maxlength: 200,
      },

      careerGoal: {
        type: String,

        trim: true,

        maxlength: 1000,
      },

      skillsFocus: {
        type: [
          String,
        ],

        default: [],
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   RESOLUTION SCHEMA
========================================================= */

const customerConversationResolutionSchema =
  new Schema<ICustomerConversationResolution>(
    {
      resolved: {
        type: Boolean,

        default: false,
      },

      resolvedBy: {
        type: String,

        enum: [
          "system",
          "user",
        ],
      },

      resolutionType: {
        type: String,

        trim: true,
      },

      resolutionSummary: {
        type: String,

        trim: true,
      },

      resolvedAt: {
        type: Date,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   FEEDBACK SCHEMA
========================================================= */

const customerConversationFeedbackSchema =
  new Schema<ICustomerConversationFeedback>(
    {
      rating: {
        type: Number,

        min: 1,

        max: 5,
      },

      helpful: {
        type: Boolean,
      },

      comment: {
        type: String,

        trim: true,

        maxlength: 2000,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   MAIN SCHEMA
========================================================= */

const customerConversationSchema =
  new Schema<ICustomerConversation>(
    {
      userId: {
        type:
          Schema.Types.ObjectId,

        ref:
          "User",

        index:
          true,
      },

      /*
       * Kept temporarily for backwards compatibility
       * while the old CS system is being refactored.
       *
       * Career Assistant should primarily use userId.
       */
      customerId: {
        type: String,

        trim: true,

        index: true,
      },

      customerName: {
        type: String,

        trim: true,
      },

      email: {
        type: String,

        trim: true,

        lowercase: true,

        index: true,
      },

      sessionId: {
        type: String,

        required: true,

        unique: true,

        trim: true,

        index: true,
      },

      status: {
        type: String,

        enum: [
          "active",
          "resolved",
          "closed",
        ],

        default:
          "active",

        index:
          true,
      },

      messages: {
        type: [
          customerConversationMessageSchema,
        ],

        default:
          [],
      },

      memory: {
        type:
          customerConversationMemorySchema,

        default:
          () => ({
            skillsFocus:
              [],

            metadata:
              {},
          }),
      },

      resolution: {
        type:
          customerConversationResolutionSchema,

        default:
          () => ({
            resolved:
              false,
          }),
      },

      feedback: {
        type:
          customerConversationFeedbackSchema,

        default:
          () => ({}),
      },

      startedAt: {
        type: Date,

        default:
          Date.now,
      },

      lastMessageAt: {
        type: Date,

        default:
          Date.now,

        index:
          true,
      },

      closedAt: {
        type: Date,
      },
    },
    {
      timestamps:
        true,

      collection:
        "customer_conversations",
    }
  );

/* =========================================================
   MESSAGE TIMESTAMP UPDATE
========================================================= */

customerConversationSchema.pre(
  "save",
  function () {
    if (
      this.isModified(
        "messages"
      )
    ) {
      this.lastMessageAt =
        new Date();
    }
  }
);

/* =========================================================
   INDEXES
========================================================= */

customerConversationSchema.index(
  {
    userId: 1,

    createdAt: -1,
  }
);

customerConversationSchema.index(
  {
    customerId: 1,

    createdAt: -1,
  }
);

customerConversationSchema.index(
  {
    status: 1,

    lastMessageAt: -1,
  }
);

customerConversationSchema.index(
  {
    "memory.activeResumeId":
      1,

    updatedAt:
      -1,
  }
);

customerConversationSchema.index(
  {
    "memory.activeJobId":
      1,

    updatedAt:
      -1,
  }
);

customerConversationSchema.index(
  {
    "memory.activeInterviewId":
      1,

    updatedAt:
      -1,
  }
);

/* =========================================================
   MODEL
========================================================= */

const CustomerConversation:
  Model<ICustomerConversation> =
    mongoose.models
      .CustomerConversation ||
    mongoose.model<ICustomerConversation>(
      "CustomerConversation",
      customerConversationSchema
    );

export default CustomerConversation;