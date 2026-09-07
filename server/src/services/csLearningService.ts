import {
  Types,
} from "mongoose";

import CSLearningCandidate, {
  ICSLearningCandidate,
  normalizePhrase,
} from "../models/CSLearningCandidate";

/* =========================================================
   TYPES
========================================================= */

export interface ICSLearningObservation {
  phrase: string;

  suggestedIntent: string;

  confidence: number;

  sessionId?: string;

  conversationId?: string;

  source?:
    | "conversation"
    | "agent"
    | "manual"
    | "import";

  metadata?: Record<
    string,
    unknown
  >;
}

export interface ICSLearningCandidateResult {
  created: boolean;

  candidate:
    ICSLearningCandidate;
}

export interface ICSLearningCandidateQuery {
  status?:
    | "candidate"
    | "approved"
    | "rejected"
    | "disabled";

  intent?: string;

  limit?: number;

  skip?: number;
}

/* =========================================================
   SETTINGS
========================================================= */

const MIN_PHRASE_LENGTH = 3;

const MAX_PHRASE_LENGTH = 500;

const MAX_SESSION_IDS = 100;

const MAX_CONVERSATION_IDS = 100;

const MAX_CUSTOMER_MESSAGES = 100;

/*
 * We do not want to learn from extremely uncertain
 * predictions automatically.
 *
 * This is intentionally permissive for now because our
 * current model confidence values are generally low.
 *
 * Later we can tune this using evaluation data.
 */
const MIN_LEARNING_CONFIDENCE = 0.05;

/* =========================================================
   HELPERS
========================================================= */

const normalizeIntent = (
  value: string
): string => {
  return value
    .trim()
    .toUpperCase();
};

const normalizeConfidence = (
  value: number
): number => {
  if (
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
};

const normalizeOptionalString = (
  value?: string
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
};

const toObjectId = (
  value?: string
): Types.ObjectId | undefined => {
  if (!value) {
    return undefined;
  }

  if (
    !Types.ObjectId.isValid(
      value
    )
  ) {
    return undefined;
  }

  return new Types.ObjectId(
    value
  );
};

/* =========================================================
   SHOULD COLLECT PHRASE
========================================================= */

export const shouldCollectLearningCandidate =
  (
    input: ICSLearningObservation
  ): boolean => {
    const phrase =
      normalizePhrase(
        input.phrase
      );

    const intent =
      normalizeIntent(
        input.suggestedIntent
      );

    const confidence =
      normalizeConfidence(
        input.confidence
      );

    if (
      !phrase ||
      phrase.length <
        MIN_PHRASE_LENGTH ||
      phrase.length >
        MAX_PHRASE_LENGTH
    ) {
      return false;
    }

    if (!intent) {
      return false;
    }

    if (
      confidence <
      MIN_LEARNING_CONFIDENCE
    ) {
      return false;
    }

    /*
     * Do not learn from pure numeric values such as:
     *
     * "1842"
     * "2501"
     *
     * Those are usually order numbers / entities,
     * not useful intent-training phrases.
     */
    if (
      /^\d+$/.test(
        phrase
      )
    ) {
      return false;
    }

    /*
     * Avoid learning extremely short confirmation messages.
     */
    const ignoredPhrases =
      new Set([
        "yes",
        "no",
        "y",
        "n",
        "ok",
        "okay",
        "sure",
        "thanks",
        "thank you",
      ]);

    if (
      ignoredPhrases.has(
        phrase
      )
    ) {
      return false;
    }

    return true;
  };

/* =========================================================
   RECORD LEARNING CANDIDATE
========================================================= */

export const recordLearningCandidate =
  async (
    input: ICSLearningObservation
  ): Promise<
    ICSLearningCandidateResult | null
  > => {
    if (
      !shouldCollectLearningCandidate(
        input
      )
    ) {
      return null;
    }

    const phrase =
      input.phrase
        .replace(/\s+/g, " ")
        .trim();

    const normalizedPhrase =
      normalizePhrase(
        phrase
      );

    const suggestedIntent =
      normalizeIntent(
        input.suggestedIntent
      );

    const confidence =
      normalizeConfidence(
        input.confidence
      );

    const sessionId =
      normalizeOptionalString(
        input.sessionId
      );

    const conversationId =
      toObjectId(
        input.conversationId
      );

    const now =
      new Date();

    const existing =
      await CSLearningCandidate.findOne({
        normalizedPhrase,

        suggestedIntent,
      });

    /* =====================================================
       CREATE NEW CANDIDATE
    ===================================================== */

    if (!existing) {
      const conversationIds:
        Types.ObjectId[] = [];

      if (
        conversationId
      ) {
        conversationIds.push(
          conversationId
        );
      }

      const sessionIds:
        string[] = [];

      if (
        sessionId
      ) {
        sessionIds.push(
          sessionId
        );
      }

      const candidate =
        await CSLearningCandidate.create({
          phrase,

          normalizedPhrase,

          suggestedIntent,

          occurrences:
            1,

          averageConfidence:
            confidence,

          highestConfidence:
            confidence,

          lowestConfidence:
            confidence,

          source:
            input.source ??
            "conversation",

          status:
            "candidate",

          conversationIds,

          sessionIds,

          customerMessages: [
            phrase,
          ],

          metadata: {
            ...(
              input.metadata ??
              {}
            ),
          },

          firstSeenAt:
            now,

          lastSeenAt:
            now,
        });

      return {
        created:
          true,

        candidate,
      };
    }

    /* =====================================================
       UPDATE EXISTING CANDIDATE
    ===================================================== */

    const previousOccurrences =
      existing.occurrences;

    const newOccurrences =
      previousOccurrences + 1;

    const previousAverage =
      existing.averageConfidence;

    const newAverage =
      (
        (
          previousAverage *
          previousOccurrences
        ) +
        confidence
      ) /
      newOccurrences;

    existing.occurrences =
      newOccurrences;

    existing.averageConfidence =
      Number(
        newAverage.toFixed(
          6
        )
      );

    existing.highestConfidence =
      Math.max(
        existing.highestConfidence,
        confidence
      );

    existing.lowestConfidence =
      Math.min(
        existing.lowestConfidence,
        confidence
      );

    existing.lastSeenAt =
      now;

    /*
     * Keep latest human-readable phrase.
     */
    existing.phrase =
      phrase;

    /* =====================================================
       SESSION IDS
    ===================================================== */

    if (
      sessionId &&
      !existing.sessionIds.includes(
        sessionId
      )
    ) {
      existing.sessionIds.push(
        sessionId
      );

      if (
        existing.sessionIds.length >
        MAX_SESSION_IDS
      ) {
        existing.sessionIds =
          existing.sessionIds.slice(
            -MAX_SESSION_IDS
          );
      }
    }

    /* =====================================================
       CONVERSATION IDS
    ===================================================== */

    if (
      conversationId
    ) {
      const alreadyExists =
        existing.conversationIds.some(
          (
            item
          ) =>
            item.equals(
              conversationId
            )
        );

      if (
        !alreadyExists
      ) {
        existing.conversationIds.push(
          conversationId
        );

        if (
          existing.conversationIds.length >
          MAX_CONVERSATION_IDS
        ) {
          existing.conversationIds =
            existing.conversationIds.slice(
              -MAX_CONVERSATION_IDS
            );
        }
      }
    }

    /* =====================================================
       EXAMPLE MESSAGES
    ===================================================== */

    if (
      !existing.customerMessages.includes(
        phrase
      )
    ) {
      existing.customerMessages.push(
        phrase
      );

      if (
        existing.customerMessages.length >
        MAX_CUSTOMER_MESSAGES
      ) {
        existing.customerMessages =
          existing.customerMessages.slice(
            -MAX_CUSTOMER_MESSAGES
          );
      }
    }

    /* =====================================================
       METADATA
    ===================================================== */

    existing.metadata = {
      ...(
        existing.metadata ??
        {}
      ),

      ...(
        input.metadata ??
        {}
      ),
    };

    await existing.save();

    return {
      created:
        false,

      candidate:
        existing,
    };
  };

/* =========================================================
   LIST CANDIDATES
========================================================= */

export const listLearningCandidates =
  async (
    query: ICSLearningCandidateQuery = {}
  ): Promise<
    ICSLearningCandidate[]
  > => {
    const filter:
      Record<
        string,
        unknown
      > = {};

    if (
      query.status
    ) {
      filter.status =
        query.status;
    }

    if (
      query.intent
    ) {
      filter.suggestedIntent =
        normalizeIntent(
          query.intent
        );
    }

    const limit =
      Math.max(
        1,
        Math.min(
          query.limit ??
            50,
          200
        )
      );

    const skip =
      Math.max(
        0,
        query.skip ??
          0
      );

    return CSLearningCandidate.find(
      filter
    )
      .sort({
        occurrences:
          -1,

        averageConfidence:
          -1,

        lastSeenAt:
          -1,
      })
      .skip(
        skip
      )
      .limit(
        limit
      );
  };

/* =========================================================
   GET CANDIDATE
========================================================= */

export const getLearningCandidateById =
  async (
    candidateId: string
  ): Promise<
    ICSLearningCandidate | null
  > => {
    if (
      !Types.ObjectId.isValid(
        candidateId
      )
    ) {
      return null;
    }

    return CSLearningCandidate.findById(
      candidateId
    );
  };

/* =========================================================
   APPROVE CANDIDATE
========================================================= */

export const approveLearningCandidate =
  async (
    candidateId: string,
    options?: {
      approvedBy?: string;

      notes?: string;
    }
  ): Promise<
    ICSLearningCandidate | null
  > => {
    const candidate =
      await getLearningCandidateById(
        candidateId
      );

    if (!candidate) {
      return null;
    }

    candidate.status =
      "approved";

    candidate.approvedAt =
      new Date();

    const approvedBy =
      toObjectId(
        options?.approvedBy
      );

    if (
      approvedBy
    ) {
      candidate.approvedBy =
        approvedBy;
    }

    if (
      options?.notes
    ) {
      candidate.notes =
        options.notes
          .trim();
    }

    candidate.rejectedAt =
      undefined;

    candidate.rejectedBy =
      undefined;

    candidate.rejectionReason =
      undefined;

    await candidate.save();

    return candidate;
  };

/* =========================================================
   REJECT CANDIDATE
========================================================= */

export const rejectLearningCandidate =
  async (
    candidateId: string,
    options?: {
      rejectedBy?: string;

      reason?: string;

      notes?: string;
    }
  ): Promise<
    ICSLearningCandidate | null
  > => {
    const candidate =
      await getLearningCandidateById(
        candidateId
      );

    if (!candidate) {
      return null;
    }

    candidate.status =
      "rejected";

    candidate.rejectedAt =
      new Date();

    const rejectedBy =
      toObjectId(
        options?.rejectedBy
      );

    if (
      rejectedBy
    ) {
      candidate.rejectedBy =
        rejectedBy;
    }

    if (
      options?.reason
    ) {
      candidate.rejectionReason =
        options.reason
          .trim();
    }

    if (
      options?.notes
    ) {
      candidate.notes =
        options.notes
          .trim();
    }

    await candidate.save();

    return candidate;
  };

/* =========================================================
   DISABLE CANDIDATE
========================================================= */

export const disableLearningCandidate =
  async (
    candidateId: string
  ): Promise<
    ICSLearningCandidate | null
  > => {
    const candidate =
      await getLearningCandidateById(
        candidateId
      );

    if (!candidate) {
      return null;
    }

    candidate.status =
      "disabled";

    await candidate.save();

    return candidate;
  };

/* =========================================================
   RESET TO CANDIDATE
========================================================= */

export const resetLearningCandidate =
  async (
    candidateId: string
  ): Promise<
    ICSLearningCandidate | null
  > => {
    const candidate =
      await getLearningCandidateById(
        candidateId
      );

    if (!candidate) {
      return null;
    }

    candidate.status =
      "candidate";

    candidate.approvedAt =
      undefined;

    candidate.approvedBy =
      undefined;

    candidate.rejectedAt =
      undefined;

    candidate.rejectedBy =
      undefined;

    candidate.rejectionReason =
      undefined;

    await candidate.save();

    return candidate;
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  shouldCollectLearningCandidate,

  recordLearningCandidate,

  listLearningCandidates,

  getLearningCandidateById,

  approveLearningCandidate,

  rejectLearningCandidate,

  disableLearningCandidate,

  resetLearningCandidate,
};