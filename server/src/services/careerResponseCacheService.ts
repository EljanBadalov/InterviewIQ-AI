import {
  Types,
} from "mongoose";

import CareerResponseCache, {
  type ICareerResponseCache,
} from "../models/CareerResponseCache";

import {
  findBestCareerQuestionMatch,
  normalizeCareerQuestion,
} from "./careerResponseSimilarityService";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerCacheContext {
  resumeId?: string;

  interviewId?: string;

  targetRole?: string;

  resumeUpdatedAt?: Date;

  interviewUpdatedAt?: Date;
}

export interface ICareerCacheLookupInput {
  userId: string;

  question: string;

  intent: string;

  context?: ICareerCacheContext;

  similarityThreshold?: number;
}

export interface ICareerCacheSaveInput {
  userId: string;

  question: string;

  intent: string;

  response: string;

  context?: ICareerCacheContext;

  ttlMinutes?: number;
}

export interface ICareerCacheHit {
  found: true;

  cacheId: string;

  response: string;

  intent: string;

  originalQuestion: string;

  normalizedQuestion: string;

  similarity: number;

  exactMatch: boolean;

  hitCount: number;
}

export interface ICareerCacheMiss {
  found: false;

  reason:
    | "INVALID_USER_ID"
    | "NO_CACHE"
    | "NO_SIMILAR_MATCH"
    | "CONTEXT_MISMATCH"
    | "CACHE_EXPIRED";
}

export type ICareerCacheLookupResult =
  | ICareerCacheHit
  | ICareerCacheMiss;

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_TTL_MINUTES =
  60;

const DEFAULT_SIMILARITY_THRESHOLD =
  0.82;

const MAX_CACHE_CANDIDATES =
  30;

/* =========================================================
   DYNAMIC INTENTS
========================================================= */

/*
  These intents depend heavily on current InterviewIQ data.

  Their cache can only be reused when the relevant context
  still matches.
*/

const RESUME_DEPENDENT_INTENTS =
  new Set<string>([
    "CV_ANALYSIS",
    "CV_IMPROVEMENT",
    "SKILL_GAP",
    "PROFILE_SUMMARY",
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "NEXT_STEPS",
    "CAREER_GOAL",
  ]);

const INTERVIEW_DEPENDENT_INTENTS =
  new Set<string>([
    "INTERVIEW_FEEDBACK",
    "INTERVIEW_PREP",
    "CAREER_PROGRESS",
    "NEXT_STEPS",
    "CAREER_GOAL",
  ]);

const TARGET_ROLE_DEPENDENT_INTENTS =
  new Set<string>([
    "JOB_MATCHING",
    "JOB_SEARCH_HELP",
    "INTERVIEW_PREP",
    "SKILL_GAP",
    "NEXT_STEPS",
    "CAREER_GOAL",
  ]);

/* =========================================================
   NON-CACHEABLE INTENTS
========================================================= */

/*
  These are lightweight and context-sensitive enough
  that caching provides little value.
*/

const NON_CACHEABLE_INTENTS =
  new Set<string>([
    "GREETING",
    "THANK_YOU",
  ]);

/* =========================================================
   HELPERS
========================================================= */

const normalizeOptionalString = (
  value?:
    | string
    | null
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

const normalizeIntent = (
  value: string
): string => {
  return value
    .replace(/\s+/g, "_")
    .trim()
    .toUpperCase();
};

const normalizeTargetRole = (
  value?:
    | string
    | null
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

const objectIdToString = (
  value:
    | Types.ObjectId
    | string
    | null
    | undefined
): string | undefined => {
  if (!value) {
    return undefined;
  }

  return String(
    value
  );
};

const sameOptionalString = (
  a?: string,
  b?: string
): boolean => {
  return (
    (
      !a &&
      !b
    ) ||
    a ===
      b
  );
};

const sameOptionalDate = (
  a?:
    | Date
    | null,
  b?:
    | Date
    | null
): boolean => {
  if (
    !a &&
    !b
  ) {
    return true;
  }

  if (
    !a ||
    !b
  ) {
    return false;
  }

  return (
    new Date(
      a
    ).getTime() ===
    new Date(
      b
    ).getTime()
  );
};

/* =========================================================
   CACHEABLE
========================================================= */

export const isCareerIntentCacheable =
  (
    intent: string
  ): boolean => {
    const normalizedIntent =
      normalizeIntent(
        intent
      );

    return (
      !NON_CACHEABLE_INTENTS.has(
        normalizedIntent
      )
    );
  };

/* =========================================================
   CONTEXT VALIDATION
========================================================= */

const isCacheContextValid = (
  cache:
    ICareerResponseCache,
  current:
    ICareerCacheContext | undefined,
  intent:
    string
): boolean => {
  const normalizedIntent =
    normalizeIntent(
      intent
    );

  const currentResumeId =
    normalizeOptionalString(
      current?.resumeId
    );

  const currentInterviewId =
    normalizeOptionalString(
      current?.interviewId
    );

  const currentTargetRole =
    normalizeTargetRole(
      current?.targetRole
    );

  const cachedResumeId =
    objectIdToString(
      cache.context
        ?.resumeId
    );

  const cachedInterviewId =
    objectIdToString(
      cache.context
        ?.interviewId
    );

  const cachedTargetRole =
    normalizeTargetRole(
      cache.context
        ?.targetRole
    );

  /* =====================================================
     RESUME CHECK
  ===================================================== */

  if (
    RESUME_DEPENDENT_INTENTS.has(
      normalizedIntent
    )
  ) {
    if (
      !sameOptionalString(
        cachedResumeId,
        currentResumeId
      )
    ) {
      return false;
    }

    if (
      !sameOptionalDate(
        cache.context
          ?.resumeUpdatedAt,
        current
          ?.resumeUpdatedAt
      )
    ) {
      return false;
    }
  }

  /* =====================================================
     INTERVIEW CHECK
  ===================================================== */

  if (
    INTERVIEW_DEPENDENT_INTENTS.has(
      normalizedIntent
    )
  ) {
    if (
      !sameOptionalString(
        cachedInterviewId,
        currentInterviewId
      )
    ) {
      return false;
    }

    if (
      !sameOptionalDate(
        cache.context
          ?.interviewUpdatedAt,
        current
          ?.interviewUpdatedAt
      )
    ) {
      return false;
    }
  }

  /* =====================================================
     TARGET ROLE CHECK
  ===================================================== */

  if (
    TARGET_ROLE_DEPENDENT_INTENTS.has(
      normalizedIntent
    )
  ) {
    if (
      !sameOptionalString(
        cachedTargetRole,
        currentTargetRole
      )
    ) {
      return false;
    }
  }

  return true;
};

/* =========================================================
   EXPIRY CHECK
========================================================= */

const isExpired = (
  cache:
    ICareerResponseCache
): boolean => {
  return (
    new Date(
      cache.expiresAt
    ).getTime() <=
    Date.now()
  );
};

/* =========================================================
   FIND EXACT CACHE
========================================================= */

const findExactCache =
  async (
    userId:
      Types.ObjectId,
    intent: string,
    normalizedQuestion: string
  ): Promise<
    ICareerResponseCache | null
  > => {
    return CareerResponseCache
      .findOne({
        userId,

        intent,

        normalizedQuestion,

        expiresAt: {
          $gt:
            new Date(),
        },
      })
      .sort({
        updatedAt:
          -1,
      });
  };

/* =========================================================
   FIND SIMILAR CACHE
========================================================= */

const findSimilarCache =
  async (
    userId:
      Types.ObjectId,
    intent: string,
    question: string,
    threshold: number
  ): Promise<
    | {
        cache:
          ICareerResponseCache;

        similarity:
          number;
      }
    | undefined
  > => {
    const candidates =
      await CareerResponseCache
        .find({
          userId,

          intent,

          expiresAt: {
            $gt:
              new Date(),
          },
        })
        .sort({
          updatedAt:
            -1,
        })
        .limit(
          MAX_CACHE_CANDIDATES
        );

    if (
      candidates.length ===
      0
    ) {
      return undefined;
    }

    const best =
      findBestCareerQuestionMatch(
        question,
        candidates,
        threshold
      );

    if (!best) {
      return undefined;
    }

    return {
      cache:
        best.candidate,

      similarity:
        best.similarity,
    };
  };

/* =========================================================
   REGISTER CACHE HIT
========================================================= */

const registerCacheHit =
  async (
    cache:
      ICareerResponseCache
  ): Promise<void> => {
    await CareerResponseCache
      .updateOne(
        {
          _id:
            cache._id,
        },
        {
          $inc: {
            hitCount:
              1,
          },

          $set: {
            lastUsedAt:
              new Date(),
          },
        }
      );
  };

/* =========================================================
   LOOKUP CACHE
========================================================= */

export const getCareerCachedResponse =
  async (
    input:
      ICareerCacheLookupInput
  ): Promise<
    ICareerCacheLookupResult
  > => {
    if (
      !Types.ObjectId.isValid(
        input.userId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER_ID",
      };
    }

    const intent =
      normalizeIntent(
        input.intent
      );

    if (
      !isCareerIntentCacheable(
        intent
      )
    ) {
      return {
        found:
          false,

        reason:
          "NO_CACHE",
      };
    }

    const question =
      normalizeOptionalString(
        input.question
      );

    if (!question) {
      return {
        found:
          false,

        reason:
          "NO_CACHE",
      };
    }

    const normalizedQuestion =
      normalizeCareerQuestion(
        question
      );

    const userObjectId =
      new Types.ObjectId(
        input.userId
      );

    /* =====================================================
       1. EXACT MATCH
    ===================================================== */

    const exactCache =
      await findExactCache(
        userObjectId,
        intent,
        normalizedQuestion
      );

    if (
      exactCache
    ) {
      if (
        isExpired(
          exactCache
        )
      ) {
        return {
          found:
            false,

          reason:
            "CACHE_EXPIRED",
        };
      }

      if (
        !isCacheContextValid(
          exactCache,
          input.context,
          intent
        )
      ) {
        return {
          found:
            false,

          reason:
            "CONTEXT_MISMATCH",
        };
      }

      await registerCacheHit(
        exactCache
      );

      return {
        found:
          true,

        cacheId:
          String(
            exactCache._id
          ),

        response:
          exactCache.response,

        intent:
          exactCache.intent,

        originalQuestion:
          exactCache.originalQuestion,

        normalizedQuestion:
          exactCache.normalizedQuestion,

        similarity:
          1,

        exactMatch:
          true,

        hitCount:
          exactCache.hitCount +
          1,
      };
    }

    /* =====================================================
       2. SIMILAR MATCH
    ===================================================== */

    const threshold =
      input.similarityThreshold ??
      DEFAULT_SIMILARITY_THRESHOLD;

    const similarResult =
      await findSimilarCache(
        userObjectId,
        intent,
        question,
        threshold
      );

    if (
      !similarResult
    ) {
      return {
        found:
          false,

        reason:
          "NO_SIMILAR_MATCH",
      };
    }

    const {
      cache,
      similarity,
    } =
      similarResult;

    if (
      isExpired(
        cache
      )
    ) {
      return {
        found:
          false,

        reason:
          "CACHE_EXPIRED",
      };
    }

    if (
      !isCacheContextValid(
        cache,
        input.context,
        intent
      )
    ) {
      return {
        found:
          false,

        reason:
          "CONTEXT_MISMATCH",
      };
    }

    await registerCacheHit(
      cache
    );

    return {
      found:
        true,

      cacheId:
        String(
          cache._id
        ),

      response:
        cache.response,

      intent:
        cache.intent,

      originalQuestion:
        cache.originalQuestion,

      normalizedQuestion:
        cache.normalizedQuestion,

      similarity,

      exactMatch:
        false,

      hitCount:
        cache.hitCount +
        1,
    };
  };

/* =========================================================
   SAVE CACHE
========================================================= */

export const saveCareerResponseCache =
  async (
    input:
      ICareerCacheSaveInput
  ): Promise<
    ICareerResponseCache | undefined
  > => {
    if (
      !Types.ObjectId.isValid(
        input.userId
      )
    ) {
      return undefined;
    }

    const intent =
      normalizeIntent(
        input.intent
      );

    if (
      !isCareerIntentCacheable(
        intent
      )
    ) {
      return undefined;
    }

    const question =
      normalizeOptionalString(
        input.question
      );

    const response =
      normalizeOptionalString(
        input.response
      );

    if (
      !question ||
      !response
    ) {
      return undefined;
    }

    const normalizedQuestion =
      normalizeCareerQuestion(
        question
      );

    const userObjectId =
      new Types.ObjectId(
        input.userId
      );

    const ttlMinutes =
      typeof input.ttlMinutes ===
        "number" &&
      input.ttlMinutes >
        0
        ? input.ttlMinutes
        : DEFAULT_TTL_MINUTES;

    const expiresAt =
      new Date(
        Date.now() +
        ttlMinutes *
          60 *
          1000
      );

    const resumeId =
      input.context
        ?.resumeId &&
      Types.ObjectId.isValid(
        input.context
          .resumeId
      )
        ? new Types.ObjectId(
            input.context
              .resumeId
          )
        : null;

    const interviewId =
      input.context
        ?.interviewId &&
      Types.ObjectId.isValid(
        input.context
          .interviewId
      )
        ? new Types.ObjectId(
            input.context
              .interviewId
          )
        : null;

    const targetRole =
      normalizeOptionalString(
        input.context
          ?.targetRole
      ) ??
      null;

    /* =====================================================
       UPSERT

       Same user + same intent + same normalized question
       gets refreshed instead of creating duplicates.
    ===================================================== */

    const cache =
      await CareerResponseCache
        .findOneAndUpdate(
          {
            userId:
              userObjectId,

            intent,

            normalizedQuestion,
          },
          {
            $set: {
              originalQuestion:
                question,

              response,

              context: {
                resumeId,

                interviewId,

                targetRole,

                resumeUpdatedAt:
                  input.context
                    ?.resumeUpdatedAt ??
                  null,

                interviewUpdatedAt:
                  input.context
                    ?.interviewUpdatedAt ??
                  null,
              },

              expiresAt,
            },

            $setOnInsert: {
              hitCount:
                0,

              lastUsedAt:
                null,
            },
          },
          {
            upsert:
              true,

            new:
              true,

            setDefaultsOnInsert:
              true,
          }
        );

    return cache;
  };


/* =========================================================
   SAFE CACHE HELPERS
========================================================= */

/*
 * These wrappers are intended for conversational flows where
 * a temporary MongoDB/cache failure should never break the chat.
 *
 * The original lookup/save functions remain unchanged and can
 * still be used directly by other services.
 */

export const tryGetCareerCachedResponse =
  async (
    input:
      ICareerCacheLookupInput
  ): Promise<
    ICareerCacheLookupResult
  > => {
    try {
      return await getCareerCachedResponse(
        input
      );
    } catch (
      error
    ) {
      console.warn(
        "[Career Cache] Lookup failed. Continuing without cache.",
        error
      );

      return {
        found:
          false,

        reason:
          "NO_CACHE",
      };
    }
  };

export const trySaveCareerResponseCache =
  async (
    input:
      ICareerCacheSaveInput
  ): Promise<
    ICareerResponseCache | undefined
  > => {
    try {
      return await saveCareerResponseCache(
        input
      );
    } catch (
      error
    ) {
      console.warn(
        "[Career Cache] Save failed. Chat response will still be returned.",
        error
      );

      return undefined;
    }
  };

/* =========================================================
   INVALIDATE USER CACHE
========================================================= */

export const invalidateCareerResponseCache =
  async (
    userId: string
  ): Promise<number> => {
    if (
      !Types.ObjectId.isValid(
        userId
      )
    ) {
      return 0;
    }

    const result =
      await CareerResponseCache
        .deleteMany({
          userId:
            new Types.ObjectId(
              userId
            ),
        });

    return (
      result.deletedCount ??
      0
    );
  };

/* =========================================================
   INVALIDATE BY INTENT
========================================================= */

export const invalidateCareerResponseCacheByIntent =
  async (
    userId: string,
    intent: string
  ): Promise<number> => {
    if (
      !Types.ObjectId.isValid(
        userId
      )
    ) {
      return 0;
    }

    const result =
      await CareerResponseCache
        .deleteMany({
          userId:
            new Types.ObjectId(
              userId
            ),

          intent:
            normalizeIntent(
              intent
            ),
        });

    return (
      result.deletedCount ??
      0
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getCareerCachedResponse,
  saveCareerResponseCache,
  tryGetCareerCachedResponse,
  trySaveCareerResponseCache,
  invalidateCareerResponseCache,
  invalidateCareerResponseCacheByIntent,
  isCareerIntentCacheable,
};