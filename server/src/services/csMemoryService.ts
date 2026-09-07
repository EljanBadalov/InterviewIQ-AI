import {
  Types,
} from "mongoose";

import CustomerConversation from "../models/CustomerConversation";

/* =========================================================
   TYPES
========================================================= */

export interface ICSConversationMessageInput {
  sessionId: string;

  sender:
    | "customer"
    | "assistant"
    | "system";

  text: string;

  intent?: string;

  confidence?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICSConversationCreateContext {
  userId?: string;

  customerId?: string;

  customerName?: string;

  email?: string;
}

export interface ICSCareerMemoryUpdate {
  activeResumeId?: string | null;

  activeJobId?: string | null;

  activeInterviewId?: string | null;

  targetRole?: string | null;

  careerGoal?: string | null;

  skillsFocus?: string[] | null;

  awaitingField?: string | null;

  lastIntent?: string | null;

  lastResolvedIntent?: string | null;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICSCareerConversationContext {
  userId?: string;

  customerId?: string;

  customerName?: string;

  email?: string;

  activeResumeId?: string;

  activeJobId?: string;

  activeInterviewId?: string;

  targetRole?: string;

  careerGoal?: string;

  skillsFocus?: string[];

  previousIntent?: string;

  lastResolvedIntent?: string;

  awaitingField?: string;

  metadata: Record<
    string,
    unknown
  >;
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeOptionalString = (
  value:
    | string
    | null
    | undefined
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized ||
    undefined;
};

const normalizeEmail = (
  value:
    | string
    | null
    | undefined
): string | undefined => {
  const normalized =
    normalizeOptionalString(
      value
    );

  if (!normalized) {
    return undefined;
  }

  return normalized
    .toLowerCase();
};

const normalizeStringArray = (
  value:
    | string[]
    | null
    | undefined
): string[] | undefined => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const normalized =
    value
      .map(
        (
          item
        ) =>
          normalizeOptionalString(
            item
          )
      )
      .filter(
        (
          item
        ): item is string =>
          Boolean(
            item
          )
      );

  if (
    normalized.length ===
    0
  ) {
    return undefined;
  }

  return Array.from(
    new Set(
      normalized
    )
  );
};

const normalizeResourceId = (
  value:
    | string
    | null
    | undefined
): string | undefined => {
  return normalizeOptionalString(
    value
  );
};

/* =========================================================
   USER ID -> OBJECT ID
========================================================= */

const toObjectId = (
  value:
    | string
    | null
    | undefined
): Types.ObjectId | undefined => {
  const normalized =
    normalizeOptionalString(
      value
    );

  if (
    !normalized
  ) {
    return undefined;
  }

  if (
    !Types.ObjectId.isValid(
      normalized
    )
  ) {
    return undefined;
  }

  return new Types.ObjectId(
    normalized
  );
};

/* =========================================================
   METADATA HELPERS
========================================================= */

const getMetadataString = (
  metadata:
    | Record<
        string,
        unknown
      >
    | undefined,
  key: string
): string | undefined => {
  const value =
    metadata?.[key];

  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  return normalizeOptionalString(
    value
  );
};

const getMetadataStringArray = (
  metadata:
    | Record<
        string,
        unknown
      >
    | undefined,
  key: string
): string[] | undefined => {
  const value =
    metadata?.[key];

  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const strings =
    value.filter(
      (
        item
      ): item is string =>
        typeof item ===
        "string"
    );

  return normalizeStringArray(
    strings
  );
};

/* =========================================================
   EXTRACT CAREER ENTITIES
========================================================= */

const extractCareerEntities = (
  text: string
): {
  targetRole?: string;

  careerGoal?: string;
} => {
  const normalized =
    text
      .replace(/\s+/g, " ")
      .trim();

  const lower =
    normalized
      .toLowerCase();

  /* =====================================================
     TARGET ROLE
  ===================================================== */

  const targetRolePatterns =
    [
      /(?:target role is|target job is|i want to become|i want to be|i'm targeting|i am targeting)\s+(?:an?\s+)?(.{2,80})/i,

      /(?:applying for|looking for)\s+(?:an?\s+)?(.{2,80}?)(?:\s+role|\s+roles|\s+jobs?|$)/i,
    ];

  for (
    const pattern
    of targetRolePatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      const value =
        match[1]
          .replace(
            /[.!?]+$/,
            ""
          )
          .trim();

      if (
        value.length >=
          2 &&
        value.length <=
          80
      ) {
        return {
          targetRole:
            value,
        };
      }
    }
  }

  /* =====================================================
     CAREER GOAL
  ===================================================== */

  if (
    lower.includes(
      "my career goal is"
    )
  ) {
    const index =
      lower.indexOf(
        "my career goal is"
      );

    const value =
      normalized
        .slice(
          index +
            "my career goal is"
              .length
        )
        .replace(
          /[.!?]+$/,
          ""
        )
        .trim();

    if (
      value.length >=
        3 &&
      value.length <=
        300
    ) {
      return {
        careerGoal:
          value,
      };
    }
  }

  return {};
};

/* =========================================================
   GET OR CREATE CONVERSATION
========================================================= */

export const getOrCreateConversation =
  async (
    sessionId: string,
    context: ICSConversationCreateContext = {}
  ) => {
    const normalizedSessionId =
      normalizeOptionalString(
        sessionId
      );

    if (
      !normalizedSessionId
    ) {
      throw new Error(
        "Session ID is required"
      );
    }

    let conversation =
      await CustomerConversation.findOne({
        sessionId:
          normalizedSessionId,
      });

    /* =====================================================
       CREATE NEW
    ===================================================== */

    if (
      !conversation
    ) {
      const userObjectId =
        toObjectId(
          context.userId
        );

      conversation =
        await CustomerConversation.create({
          sessionId:
            normalizedSessionId,

          userId:
            userObjectId,

          customerId:
            normalizeOptionalString(
              context.customerId
            ),

          customerName:
            normalizeOptionalString(
              context.customerName
            ),

          email:
            normalizeEmail(
              context.email
            ),

          status:
            "active",

          messages:
            [],

          memory: {
            skillsFocus:
              [],

            metadata:
              {},
          },

          resolution: {
            resolved:
              false,
          },

          feedback:
            {},
        });

      return conversation;
    }

    /* =====================================================
       UPDATE EXISTING CONTEXT
    ===================================================== */

    let changed =
      false;

    const userObjectId =
      toObjectId(
        context.userId
      );

    const normalizedCustomerId =
      normalizeOptionalString(
        context.customerId
      );

    const normalizedCustomerName =
      normalizeOptionalString(
        context.customerName
      );

    const normalizedCustomerEmail =
      normalizeEmail(
        context.email
      );

    if (
      userObjectId &&
      !conversation.userId
    ) {
      conversation.userId =
        userObjectId;

      changed =
        true;
    }

    if (
      normalizedCustomerId &&
      !conversation.customerId
    ) {
      conversation.customerId =
        normalizedCustomerId;

      changed =
        true;
    }

    if (
      normalizedCustomerName &&
      !conversation.customerName
    ) {
      conversation.customerName =
        normalizedCustomerName;

      changed =
        true;
    }

    if (
      normalizedCustomerEmail &&
      !conversation.email
    ) {
      conversation.email =
        normalizedCustomerEmail;

      changed =
        true;
    }

    if (
      changed
    ) {
      await conversation.save();
    }

    return conversation;
  };

/* =========================================================
   ADD CONVERSATION MESSAGE
========================================================= */

export const addConversationMessage =
  async (
    input: ICSConversationMessageInput
  ) => {
    const sessionId =
      normalizeOptionalString(
        input.sessionId
      );

    const text =
      normalizeOptionalString(
        input.text
      );

    if (
      !sessionId
    ) {
      throw new Error(
        "Session ID is required"
      );
    }

    if (
      !text
    ) {
      throw new Error(
        "Conversation message is required"
      );
    }

    const conversation =
      await getOrCreateConversation(
        sessionId
      );

    conversation.messages.push(
      {
        sender:
          input.sender,

        text,

        intent:
          normalizeOptionalString(
            input.intent
          ),

        confidence:
          typeof input.confidence ===
          "number"
            ? Math.max(
                0,
                Math.min(
                  1,
                  input.confidence
                )
              )
            : undefined,

        entities:
          [],

        metadata:
          input.metadata ??
          {},

        createdAt:
          new Date(),
      }
    );

    conversation.memory =
      conversation.memory ??
      {};

    /* =====================================================
       LAST INTENT
    ===================================================== */

    if (
      input.sender ===
        "customer" &&
      input.intent
    ) {
      conversation.memory.lastIntent =
        normalizeOptionalString(
          input.intent
        );
    }

    /* =====================================================
       CAREER ENTITY EXTRACTION
    ===================================================== */

    if (
      input.sender ===
      "customer"
    ) {
      const entities =
        extractCareerEntities(
          text
        );

      if (
        entities.targetRole
      ) {
        conversation.memory.targetRole =
          entities.targetRole;
      }

      if (
        entities.careerGoal
      ) {
        conversation.memory.careerGoal =
          entities.careerGoal;
      }

      /* ===================================================
         AWAITING TARGET ROLE
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "targetRole" &&
        text.length >=
          2
      ) {
        conversation.memory.targetRole =
          text;

        conversation.memory.awaitingField =
          undefined;
      }

      /* ===================================================
         AWAITING CAREER GOAL
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "careerGoal" &&
        text.length >=
          3
      ) {
        conversation.memory.careerGoal =
          text;

        conversation.memory.awaitingField =
          undefined;
      }

      /* ===================================================
         AWAITING RESUME
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "activeResumeId"
      ) {
        const value =
          normalizeResourceId(
            text
          );

        if (
          value
        ) {
          conversation.memory.activeResumeId =
            value;

          conversation.memory.awaitingField =
            undefined;
        }
      }

      /* ===================================================
         AWAITING JOB
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "activeJobId"
      ) {
        const value =
          normalizeResourceId(
            text
          );

        if (
          value
        ) {
          conversation.memory.activeJobId =
            value;

          conversation.memory.awaitingField =
            undefined;
        }
      }

      /* ===================================================
         AWAITING INTERVIEW
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "activeInterviewId"
      ) {
        const value =
          normalizeResourceId(
            text
          );

        if (
          value
        ) {
          conversation.memory.activeInterviewId =
            value;

          conversation.memory.awaitingField =
            undefined;
        }
      }

      /* ===================================================
         AWAITING SKILLS FOCUS
      =================================================== */

      if (
        conversation.memory
          .awaitingField ===
          "skillsFocus"
      ) {
        const skills =
          text
            .split(
              /[,;/]+/
            )
            .map(
              (
                skill
              ) =>
                skill
                  .trim()
            )
            .filter(
              Boolean
            );

        if (
          skills.length >
          0
        ) {
          conversation.memory.skillsFocus =
            Array.from(
              new Set(
                skills
              )
            );

          conversation.memory.awaitingField =
            undefined;
        }
      }
    }

    await conversation.save();

    return conversation;
  };

/* =========================================================
   BUILD CONVERSATION CONTEXT
========================================================= */

export const buildConversationContext =
  (
    conversation: Awaited<
      ReturnType<
        typeof getOrCreateConversation
      >
    >
  ): ICSCareerConversationContext => {
    const memory =
      conversation.memory ??
      {};

    const metadata =
      memory.metadata &&
      typeof memory.metadata ===
        "object" &&
      !Array.isArray(
        memory.metadata
      )
        ? (
            memory.metadata as Record<
              string,
              unknown
            >
          )
        : {};

    const userId =
      conversation.userId
        ? String(
            conversation.userId
          )
        : undefined;

    const customerId =
      normalizeOptionalString(
        conversation.customerId
      );

    const customerName =
      normalizeOptionalString(
        conversation.customerName
      );

    const email =
      normalizeEmail(
        conversation.email
      );

    const activeResumeId =
      normalizeResourceId(
        memory.activeResumeId
      ) ??
      getMetadataString(
        metadata,
        "activeResumeId"
      );

    const activeJobId =
      normalizeResourceId(
        memory.activeJobId
      ) ??
      getMetadataString(
        metadata,
        "activeJobId"
      );

    const activeInterviewId =
      normalizeResourceId(
        memory.activeInterviewId
      ) ??
      getMetadataString(
        metadata,
        "activeInterviewId"
      );

    const targetRole =
      normalizeOptionalString(
        memory.targetRole
      ) ??
      getMetadataString(
        metadata,
        "targetRole"
      );

    const careerGoal =
      normalizeOptionalString(
        memory.careerGoal
      ) ??
      getMetadataString(
        metadata,
        "careerGoal"
      );

    const skillsFocus =
      normalizeStringArray(
        memory.skillsFocus
      ) ??
      getMetadataStringArray(
        metadata,
        "skillsFocus"
      );

    const previousIntent =
      normalizeOptionalString(
        memory.lastIntent
      );

    const lastResolvedIntent =
      normalizeOptionalString(
        memory.lastResolvedIntent
      );

    const awaitingField =
      normalizeOptionalString(
        memory.awaitingField
      );

    return {
      userId,

      customerId,

      customerName,

      email,

      activeResumeId,

      activeJobId,

      activeInterviewId,

      targetRole,

      careerGoal,

      skillsFocus,

      previousIntent,

      lastResolvedIntent,

      awaitingField,

      metadata,
    };
  };

/* =========================================================
   UPDATE CONVERSATION MEMORY
========================================================= */

export const updateConversationMemory =
  async (
    sessionId: string,
    updates: ICSCareerMemoryUpdate
  ) => {
    const normalizedSessionId =
      normalizeOptionalString(
        sessionId
      );

    if (
      !normalizedSessionId
    ) {
      throw new Error(
        "Session ID is required"
      );
    }

    const conversation =
      await getOrCreateConversation(
        normalizedSessionId
      );

    conversation.memory =
      conversation.memory ??
      {};

    /* =====================================================
       ACTIVE RESUME
    ===================================================== */

    if (
      updates.activeResumeId !==
      undefined
    ) {
      conversation.memory.activeResumeId =
        updates.activeResumeId ===
        null
          ? undefined
          : normalizeResourceId(
              updates.activeResumeId
            );
    }

    /* =====================================================
       ACTIVE JOB
    ===================================================== */

    if (
      updates.activeJobId !==
      undefined
    ) {
      conversation.memory.activeJobId =
        updates.activeJobId ===
        null
          ? undefined
          : normalizeResourceId(
              updates.activeJobId
            );
    }

    /* =====================================================
       ACTIVE INTERVIEW
    ===================================================== */

    if (
      updates.activeInterviewId !==
      undefined
    ) {
      conversation.memory.activeInterviewId =
        updates.activeInterviewId ===
        null
          ? undefined
          : normalizeResourceId(
              updates.activeInterviewId
            );
    }

    /* =====================================================
       TARGET ROLE
    ===================================================== */

    if (
      updates.targetRole !==
      undefined
    ) {
      conversation.memory.targetRole =
        updates.targetRole ===
        null
          ? undefined
          : normalizeOptionalString(
              updates.targetRole
            );
    }

    /* =====================================================
       CAREER GOAL
    ===================================================== */

    if (
      updates.careerGoal !==
      undefined
    ) {
      conversation.memory.careerGoal =
        updates.careerGoal ===
        null
          ? undefined
          : normalizeOptionalString(
              updates.careerGoal
            );
    }

    /* =====================================================
       SKILLS FOCUS
    ===================================================== */

    if (
      updates.skillsFocus !==
      undefined
    ) {
      conversation.memory.skillsFocus =
        updates.skillsFocus ===
        null
          ? []
          : (
              normalizeStringArray(
                updates.skillsFocus
              ) ??
              []
            );
    }

    /* =====================================================
       AWAITING FIELD
    ===================================================== */

    if (
      updates.awaitingField !==
      undefined
    ) {
      conversation.memory.awaitingField =
        updates.awaitingField ===
        null
          ? undefined
          : normalizeOptionalString(
              updates.awaitingField
            );
    }

    /* =====================================================
       LAST INTENT
    ===================================================== */

    if (
      updates.lastIntent !==
      undefined
    ) {
      conversation.memory.lastIntent =
        updates.lastIntent ===
        null
          ? undefined
          : normalizeOptionalString(
              updates.lastIntent
            );
    }

    /* =====================================================
       LAST RESOLVED INTENT
    ===================================================== */

    if (
      updates.lastResolvedIntent !==
      undefined
    ) {
      conversation.memory.lastResolvedIntent =
        updates.lastResolvedIntent ===
        null
          ? undefined
          : normalizeOptionalString(
              updates.lastResolvedIntent
            );
    }

    /* =====================================================
       METADATA
    ===================================================== */

    if (
      updates.metadata
    ) {
      const currentMetadata =
        conversation.memory
          .metadata &&
        typeof conversation.memory
          .metadata ===
          "object" &&
        !Array.isArray(
          conversation.memory
            .metadata
        )
          ? (
              conversation.memory
                .metadata as Record<
                string,
                unknown
              >
            )
          : {};

      conversation.memory.metadata = {
        ...currentMetadata,

        ...updates.metadata,
      };
    }

    await conversation.save();

    return conversation;
  };

/* =========================================================
   SET AWAITING FIELD
========================================================= */

export const setAwaitingField =
  async (
    sessionId: string,
    field:
      | "activeResumeId"
      | "activeJobId"
      | "activeInterviewId"
      | "targetRole"
      | "careerGoal"
      | "skillsFocus"
      | string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        awaitingField:
          field,
      }
    );
  };

/* =========================================================
   CLEAR AWAITING FIELD
========================================================= */

export const clearAwaitingField =
  async (
    sessionId: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET ACTIVE RESUME
========================================================= */

export const setActiveResume =
  async (
    sessionId: string,
    resumeId: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        activeResumeId:
          resumeId,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET ACTIVE JOB
========================================================= */

export const setActiveJob =
  async (
    sessionId: string,
    jobId: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        activeJobId:
          jobId,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET ACTIVE INTERVIEW
========================================================= */

export const setActiveInterview =
  async (
    sessionId: string,
    interviewId: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        activeInterviewId:
          interviewId,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET TARGET ROLE
========================================================= */

export const setTargetRole =
  async (
    sessionId: string,
    targetRole: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        targetRole,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET CAREER GOAL
========================================================= */

export const setCareerGoal =
  async (
    sessionId: string,
    careerGoal: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        careerGoal,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   SET SKILLS FOCUS
========================================================= */

export const setSkillsFocus =
  async (
    sessionId: string,
    skills: string[]
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        skillsFocus:
          skills,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   MARK INTENT RESOLVED
========================================================= */

export const markIntentResolved =
  async (
    sessionId: string,
    intent: string
  ) => {
    return updateConversationMemory(
      sessionId,
      {
        lastResolvedIntent:
          intent,

        awaitingField:
          null,
      }
    );
  };

/* =========================================================
   RESET CAREER MEMORY
========================================================= */

export const resetCareerMemory =
  async (
    sessionId: string
  ) => {
    const conversation =
      await getOrCreateConversation(
        sessionId
      );

    conversation.memory = {
      skillsFocus:
        [],

      metadata:
        {},
    };

    await conversation.save();

    return conversation;
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getOrCreateConversation,

  addConversationMessage,

  buildConversationContext,

  updateConversationMemory,

  setAwaitingField,

  clearAwaitingField,

  setActiveResume,

  setActiveJob,

  setActiveInterview,

  setTargetRole,

  setCareerGoal,

  setSkillsFocus,

  markIntentResolved,

  resetCareerMemory,
};