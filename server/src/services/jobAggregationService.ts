import {
  Types,
} from "mongoose";

import {
  Job,
  type IJob,
  type JobExperienceLevel,
} from "../models/Job";

import CareerAutomation from "../models/CareerAutomation";

import {
  calculateJobMatch,
  type IJobMatchResult,
} from "./jobMatchingService";

import {
  buildCareerSkillProfile,
} from "./careerSkillProfileService";

import {
  fetchExternalJobs,
  fetchGeneralExternalJobs,
  type IExternalJobRecord,
} from "./externalJobService";

import {
  buildCareerFieldSearchPlan,
  type ICareerFieldSearchPlan,
} from "./careerFieldService";

import {
  classifyJobRole,
} from "./jobRoleMatcherService";

/* =========================================================
   TYPES
========================================================= */

export interface IExternalMatchedJob {
  job: IJob;

  matchScore: number;

  matchedSkills: string[];

  missingSkills: string[];
}

export interface IRefreshExternalJobsResult {
  fetched: number;

  stored: number;

  matched: number;

  jobs: IExternalMatchedJob[];
}

export interface IGeneralJobRefreshResult {
  fetched: number;

  uniqueCandidates: number;

  stored: number;

  analyzed: number;

  returned: number;

  jobs: IExternalMatchedJob[];
}

type RoleTier =
  | "exact"
  | "strong"
  | "related"
  | "fallback"
  | "reject";

interface IScoredJob {
  job: IJob;

  match: IJobMatchResult;

  roleTier: RoleTier;

  fieldRelevance: number;

  relatedRoleSimilarity: number;

  matchedRole?: string;
}

interface IGeneralScoredJob {
  job: IJob;

  match: IJobMatchResult;
}

/* =========================================================
   CONSTANTS
========================================================= */

const ONE_DAY_MS =
  24 *
  60 *
  60 *
  1000;

/*
 * System decides the daily recommendation count.
 * User does not control this value.
 */
const DAILY_JOB_LIMIT =
  3;

/*
 * Standard configured threshold fallback.
 */
const DEFAULT_MINIMUM_MATCH_SCORE =
  55;

/*
 * Results requested from each external search query.
 */
const JOBS_PER_QUERY =
  30;

/*
 * Prevent excessive source calls.
 */
const MAX_SEARCH_QUERIES =
  12;

/*
 * Do not execute all role queries at once.
 *
 * Every role query fans out to many Greenhouse / Lever / Ashby
 * boards. Running 12 queries simultaneously can create hundreds
 * of concurrent requests and cause AbortController timeouts.
 */
const SEARCH_QUERY_CONCURRENCY =
  2;

const SEARCH_QUERY_RETRY_DELAY_MS =
  350;

/*
 * Job Matching page:
 * - broad vacancy search
 * - no required target role
 * - no required location
 * - no required work mode
 * - CV/profile is used only for ranking
 *
 * IMPORTANT:
 * 0 means "no provider-side result cap" for the general flow.
 * Frontend pagination/search/filtering decides what the user sees.
 */
/*
 * Keep Job Matching fast and fresh.
 *
 * Every manual refresh pulls the newest 1,000 deduplicated vacancies
 * from the complete provider pool. No Career Automation location/role
 * filter is applied here.
 */
const GENERAL_JOB_RAW_LIMIT =
  1_000;

const LOCAL_JOB_SOURCES =
  new Set<string>([
    "successfactors",
    "azerbaijan-local",
    "local-company",
    "bir careers",
  ]);

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeString = (
  value:
    string | undefined | null
): string => {
  return (
    value
      ?.replace(
        /\s+/g,
        " "
      )
      .trim() ||
    ""
  );
};

const normalizeLower = (
  value:
    string | undefined | null
): string => {
  return normalizeString(
    value
  ).toLowerCase();
};

const uniqueStrings = (
  values:
    string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const rawValue of
    values
  ) {
    const value =
      normalizeString(
        rawValue
      );

    if (
      !value
    ) {
      continue;
    }

    const key =
      value.toLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    result.push(
      value
    );
  }

  return result;
};

const logDivider = (
  label:
    string
): void => {
  console.log(
    "\n============================================================"
  );

  console.log(
    `[JOB DEBUG] ${label}`
  );

  console.log(
    "============================================================"
  );
};

/* =========================================================
   COUNTRY
========================================================= */

const getCountryCodeFromLocation = (
  location:
    string
): string => {
  const normalized =
    normalizeLower(
      location
    );

  if (
    normalized.includes(
      "united kingdom"
    ) ||
    /\buk\b/.test(
      normalized
    )
  ) {
    return "gb";
  }

  if (
    normalized.includes(
      "canada"
    )
  ) {
    return "ca";
  }

  if (
    normalized.includes(
      "australia"
    )
  ) {
    return "au";
  }

  if (
    normalized.includes(
      "germany"
    )
  ) {
    return "de";
  }

  if (
    normalized.includes(
      "france"
    )
  ) {
    return "fr";
  }

  /*
   * Azerbaijan support.
   *
   * Keep every existing global country mapping above.
   * This is an additive branch only.
   */
  if (
    normalized.includes(
      "azerbaijan"
    ) ||
    normalized.includes(
      "baku"
    ) ||
    normalized.includes(
      "bakı"
    ) ||
    /\bazerbaijani\b/.test(
      normalized
    ) ||
    /\baz\b/.test(
      normalized
    )
  ) {
    return "az";
  }

  return "us";
};

/* =========================================================
   DATA-DRIVEN CAREER FIELD MATCHING

   Single source of truth:
   jobRoleMatcherService.ts

   externalJobService and jobAggregationService now use the
   same canonical title matcher.
========================================================= */

const classifyRoleFromFieldPlan = (
  plan:
    ICareerFieldSearchPlan,
  job:
    IJob
): {
  roleTier: RoleTier;
  fieldRelevance: number;
  relatedRoleSimilarity: number;
  matchedRole?: string;
} => {
  const result =
    classifyJobRole(
      plan,
      job.title || ""
    );

  /*
   * The canonical matcher exposes an explicit "alias" type.
   * Inside aggregation we keep the existing 5-tier model and
   * treat aliases as strong matches.
   */
  const roleTier:
    RoleTier =
    result.type ===
      "alias"
      ? "strong"
      : result.type;

  return {
    roleTier,

    fieldRelevance:
      result.score,

    relatedRoleSimilarity:
      result.similarity,

    matchedRole:
      result.matchedRole,
  };
};

/* =========================================================
   LOCATION HELPERS
========================================================= */

const extractLocationTokens = (
  location:
    string
): string[] => {
  return normalizeLower(
    location
  )
    .split(
      /[,/|]+/
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      (
        item
      ) =>
        item.length >=
        2
    );
};

const isUSLocation = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    /\bunited states\b/.test(
      normalized
    ) ||
    /\busa\b/.test(
      normalized
    ) ||
    /\bu\.s\.\b/.test(
      normalized
    ) ||
    /\bus remote\b/.test(
      normalized
    ) ||
    /\bremote us\b/.test(
      normalized
    )
  );
};

const isGlobalRemoteLocation = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    normalized ===
      "remote" ||
    normalized.includes(
      "remote, global"
    ) ||
    normalized.includes(
      "remote global"
    ) ||
    normalized.includes(
      "global remote"
    ) ||
    normalized.includes(
      "worldwide"
    ) ||
    normalized.includes(
      "anywhere"
    )
  );
};

const containsBostonOrMassachusetts = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    normalized.includes(
      "boston"
    ) ||
    normalized.includes(
      "massachusetts"
    ) ||
    /\bboston,\s*ma\b/.test(
      normalized
    ) ||
    /\bma,\s*usa\b/.test(
      normalized
    )
  );
};

const containsAzerbaijanOrBaku = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    normalized.includes(
      "azerbaijan"
    ) ||
    normalized.includes(
      "baku"
    ) ||
    normalized.includes(
      "bakı"
    ) ||
    /\bbaku,\s*az\b/.test(
      normalized
    ) ||
    /\bbakı,\s*az\b/.test(
      normalized
    ) ||
    /\baz,\s*azerbaijan\b/.test(
      normalized
    )
  );
};

const prefersAzerbaijan = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    normalized.includes(
      "azerbaijan"
    ) ||
    normalized.includes(
      "baku"
    ) ||
    normalized.includes(
      "bakı"
    ) ||
    /\bazerbaijani\b/.test(
      normalized
    ) ||
    /\baz\b/.test(
      normalized
    )
  );
};

const isAzerbaijanRemoteLocation = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  return (
    containsAzerbaijanOrBaku(
      normalized
    ) &&
    (
      normalized.includes(
        "remote"
      ) ||
      normalized.includes(
        "hybrid"
      )
    )
  );
};

const isExplicitlyForeignOnly = (
  location:
    string
): boolean => {
  const normalized =
    normalizeLower(
      location
    );

  const foreignSignals = [
    "united kingdom",
    "london",
    "europe",
    "germany",
    "france",
    "spain",
    "italy",
    "netherlands",
    "india",
    "australia",
    "singapore",
    "dubai",
    "uae",
    "japan",
    "china",
    "brazil",
    "mexico",

    /*
     * Azerbaijan is foreign relative to the US/Boston branch.
     * This only protects Boston-specific filtering.
     */
    "azerbaijan",
    "baku",
    "bakı",
  ];

  const hasForeign =
    foreignSignals.some(
      (
        signal
      ) =>
        normalized.includes(
          signal
        )
    );

  const hasUS =
    isUSLocation(
      normalized
    ) ||
    containsBostonOrMassachusetts(
      normalized
    );

  return (
    hasForeign &&
    !hasUS
  );
};

/* =========================================================
   LOCATION ELIGIBILITY
========================================================= */

const locationMatchesPreference = (
  job:
    IJob,
  preferredLocation:
    string
): boolean => {
  const preference =
    normalizeLower(
      preferredLocation
    );

  /*
   * No location preference.
   */
  if (
    !preference ||
    preference ===
      "anywhere" ||
    preference ===
      "any"
  ) {
    return true;
  }

  const jobLocation =
    normalizeLower(
      job.location
    );

  /*
   * Truly global remote roles are eligible.
   */
  if (
    job.remoteType ===
      "remote" &&
    isGlobalRemoteLocation(
      jobLocation
    )
  ) {
    return true;
  }

  /* =====================================================
     AZERBAIJAN / BAKU

     This is additive. It does not remove global vacancies
     from the system. It only makes Career Automation's hard
     location preference understand Azerbaijan correctly.
  ===================================================== */

  if (
    prefersAzerbaijan(
      preference
    )
  ) {
    /*
     * Direct local vacancy:
     * - Baku
     * - Bakı
     * - Baku, AZ
     * - Baku, Azerbaijan
     * - Azerbaijan
     */
    if (
      containsAzerbaijanOrBaku(
        jobLocation
      )
    ) {
      return true;
    }

    /*
     * Global remote remains valid for an Azerbaijan-based
     * user. This preserves the existing global vacancy pool.
     */
    if (
      job.remoteType ===
        "remote" &&
      isGlobalRemoteLocation(
        jobLocation
      )
    ) {
      return true;
    }

    /*
     * Explicit Azerbaijan remote/hybrid records also pass.
     */
    if (
      isAzerbaijanRemoteLocation(
        jobLocation
      )
    ) {
      return true;
    }

    /*
     * A country-specific vacancy from another country should
     * not pass a Baku/Azerbaijan hard location preference.
     *
     * IMPORTANT:
     * This affects only Career Automation location filtering.
     * General Job Matching still keeps the broad global pool.
     */
    return false;
  }

  /* =====================================================
     BOSTON
  ===================================================== */

  if (
    preference.includes(
      "boston"
    )
  ) {
    /*
     * Exact Boston / Massachusetts vacancy.
     */
    if (
      containsBostonOrMassachusetts(
        jobLocation
      )
    ) {
      return true;
    }

    /*
     * Remote position available anywhere in the US.
     */
    if (
      job.remoteType ===
        "remote" &&
      isUSLocation(
        jobLocation
      )
    ) {
      return true;
    }

    /*
     * Explicit foreign-only vacancy must not pass.
     */
    if (
      isExplicitlyForeignOnly(
        jobLocation
      )
    ) {
      return false;
    }

    /*
     * West Coast-only / another city-only roles
     * should not pass merely because they are remote.
     */
    return false;
  }

  /* =====================================================
     GENERIC LOCATION
  ===================================================== */

  const preferenceTokens =
    extractLocationTokens(
      preference
    );

  const directLocationMatch =
    preferenceTokens.some(
      (
        token
      ) =>
        jobLocation.includes(
          token
        )
    );

  if (
    directLocationMatch
  ) {
    return true;
  }

  /*
   * US-wide remote roles can match US preferences.
   *
   * Keep this existing behavior for the global system, but
   * do not let an explicitly non-US preference accidentally
   * accept a US-only remote vacancy.
   */
  const preferenceLooksUS =
    isUSLocation(
      preference
    ) ||
    containsBostonOrMassachusetts(
      preference
    );

  if (
    preferenceLooksUS &&
    job.remoteType ===
      "remote" &&
    isUSLocation(
      jobLocation
    )
  ) {
    return true;
  }

  return false;
};

/* =========================================================
   UPSERT EXTERNAL JOB
========================================================= */

const upsertExternalJob =
  async (
    externalJob:
      IExternalJobRecord
  ): Promise<IJob> => {
    const job =
      await Job.findOneAndUpdate(
        {
          source:
            externalJob.source,

          externalId:
            externalJob.externalId,
        },
        {
          $set: {
            ...externalJob,

            isActive:
              true,
          },
        },
        {
          returnDocument:
            "after",

          upsert:
            true,

          setDefaultsOnInsert:
            true,
        }
      )
        .lean<IJob>();

    if (
      !job
    ) {
      throw new Error(
        `Could not store external job ${externalJob.source}:${externalJob.externalId}.`
      );
    }

    return job;
  };

/* =========================================================
   FETCH MULTIPLE SEARCH QUERIES
========================================================= */

const delay = (
  milliseconds:
    number
): Promise<void> => {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
};

const fetchJobsForSingleRoleQuery =
  async ({
    query,
    location,
    countryCode,
  }: {
    query:
      string;

    location?:
      string;

    countryCode:
      string;
  }): Promise<IExternalJobRecord[]> => {
    try {
      console.log(
        `[JOB DEBUG] Fetch query: "${query}"`
      );

      const jobs =
        await fetchExternalJobs({
          query,

          location,

          countryCode,

          limit:
            JOBS_PER_QUERY,
        });

      console.log(
        `[JOB DEBUG] Query "${query}" returned ${jobs.length} jobs.`
      );

      return jobs;
    } catch (
      firstError
    ) {
      console.warn(
        `[JOB DEBUG] Query "${query}" failed once. Retrying...`,
        firstError
      );

      await delay(
        SEARCH_QUERY_RETRY_DELAY_MS
      );

      try {
        const jobs =
          await fetchExternalJobs({
            query,

            location,

            countryCode,

            limit:
              JOBS_PER_QUERY,
          });

        console.log(
          `[JOB DEBUG] Query "${query}" returned ${jobs.length} jobs after retry.`
        );

        return jobs;
      } catch (
        secondError
      ) {
        console.error(
          `[JOB DEBUG] Query "${query}" failed after retry:`,
          secondError
        );

        return [];
      }
    }
  };

const fetchJobsForRoleQueries =
  async ({
    queries,
    location,
    countryCode,
  }: {
    queries:
      string[];

    location?:
      string;

    countryCode:
      string;
  }): Promise<IExternalJobRecord[]> => {
    const normalizedQueries =
      uniqueStrings(
        queries
      );

    const results:
      IExternalJobRecord[][] =
      new Array(
        normalizedQueries.length
      );

    let cursor =
      0;

    /*
     * Bounded worker pool.
     *
     * Previously Promise.allSettled() started every query at once.
     * Because each query itself searches many ATS boards, this could
     * create hundreds of simultaneous HTTP requests and trigger
     * "This operation was aborted" failures.
     */
    const workerCount =
      Math.min(
        SEARCH_QUERY_CONCURRENCY,
        normalizedQueries.length
      );

    const workers =
      Array.from({
        length:
          workerCount,
      }).map(
        async () => {
          while (
            true
          ) {
            const index =
              cursor++;

            if (
              index >=
              normalizedQueries.length
            ) {
              return;
            }

            results[index] =
              await fetchJobsForSingleRoleQuery({
                query:
                  normalizedQueries[
                    index
                  ],

                location,

                countryCode,
              });
          }
        }
      );

    await Promise.all(
      workers
    );

    const allJobs =
      results.flat();

    /* =====================================================
       DEDUPLICATE
    ===================================================== */

    const seen =
      new Set<string>();

    return allJobs.filter(
      (
        job
      ) => {
        const source =
          normalizeLower(
            job.source
          );

        const externalId =
          normalizeLower(
            job.externalId
          );

        const key =
          `${source}:${externalId}`;

        if (
          seen.has(
            key
          )
        ) {
          return false;
        }

        seen.add(
          key
        );

        return true;
      }
    );
  };

/* =========================================================
   GENERAL JOB MATCHING HELPERS
========================================================= */

const normalizeSkillName = (
  value:
    string | undefined | null
): string => {
  return normalizeLower(
    value
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const getGeneralProfileSkillSet = (
  profile:
    Awaited<
      ReturnType<
        typeof buildCareerSkillProfile
      >
    >
): Set<string> => {
  const values =
    [
      ...(profile.skills || [])
        .flatMap(
          (
            item
          ) => [
            item.name,
            item.normalizedName,
          ]
        ),

      ...(profile.strongestSkills || [])
        .flatMap(
          (
            item
          ) => [
            item.name,
            item.normalizedName,
          ]
        ),
    ];

  return new Set(
    values
      .map(
        normalizeSkillName
      )
      .filter(
        Boolean
      )
  );
};

const isAzerbaijanLocalJob = (
  job:
    IExternalJobRecord
): boolean => {
  const source =
    normalizeLower(
      job.source
    );

  const location =
    normalizeLower(
      job.location
    );

  const company =
    normalizeLower(
      job.company
    );

  /*
   * Source is the strongest signal because our local company
   * adapters are explicitly registered by provider.
   */
  if (
    LOCAL_JOB_SOURCES.has(
      source
    )
  ) {
    return true;
  }

  /*
   * Location fallback for future Azerbaijan providers that may
   * not use SuccessFactors.
   */
  if (
    containsAzerbaijanOrBaku(
      location
    )
  ) {
    return true;
  }

  /*
   * Initial explicit company fallback. This does not affect
   * global providers; it only helps normalize the first local
   * company while the local registry grows.
   */
  if (
    company.includes(
      "azercell"
    ) ||
    company.includes(
      "kapital bank"
    ) ||
    company.includes(
      "birbank"
    ) ||
    company.includes(
      "birmarket"
    ) ||
    company ===
      "bir"
  ) {
    return true;
  }

  return false;
};

const calculateGeneralPreStoreScore = (
  job:
    IExternalJobRecord,
  profileSkills:
    Set<string>
): number => {
  const jobSkills =
    uniqueStrings([
      ...(job.skills || []),
      ...(job.keywords || []),
    ])
      .map(
        normalizeSkillName
      )
      .filter(
        Boolean
      );

  const matchedSkillCount =
    jobSkills.filter(
      (
        skill
      ) =>
        profileSkills.has(
          skill
        )
    ).length;

  const skillScore =
    jobSkills.length >
    0
      ? (
          matchedSkillCount /
          Math.min(
            jobSkills.length,
            12
          )
        ) *
        100
      : 15;

  const ageDays =
    Math.max(
      0,
      (
        Date.now() -
        new Date(
          job.postedAt
        ).getTime()
      ) /
      ONE_DAY_MS
    );

  const recencyScore =
    ageDays <=
    7
      ? 100
      : ageDays <=
          30
        ? 80
        : ageDays <=
            90
          ? 55
          : 25;

  const descriptionEvidence =
    (
      job.description?.length ||
      0
    ) >=
    250
      ? 100
      : 55;

  /*
   * This is only a cheap pre-ingestion score.
   * Final match score is calculated later by jobMatchingService.
   */
  return (
    skillScore *
      0.65 +
    recencyScore *
      0.25 +
    descriptionEvidence *
      0.10
  );
};

const selectGeneralJobsForStorage = (
  jobs:
    IExternalJobRecord[],
  profile:
    Awaited<
      ReturnType<
        typeof buildCareerSkillProfile
      >
    >
): IExternalJobRecord[] => {
  const profileSkills =
    getGeneralProfileSkillSet(
      profile
    );

  const sortByPreStoreScore = (
    a:
      IExternalJobRecord,
    b:
      IExternalJobRecord
  ): number => {
    const scoreDifference =
      calculateGeneralPreStoreScore(
        b,
        profileSkills
      ) -
      calculateGeneralPreStoreScore(
        a,
        profileSkills
      );

    if (
      scoreDifference !==
      0
    ) {
      return scoreDifference;
    }

    return (
      new Date(
        b.postedAt
      ).getTime() -
      new Date(
        a.postedAt
      ).getTime()
    );
  };

  /*
   * GENERAL JOB MATCHING
   *
   * Keep the COMPLETE vacancy pool.
   *
   * We do not filter by:
   * - Career Automation target role
   * - Career Automation location
   * - Career Automation work mode
   * - experience preference
   *
   * We only deduplicate and order the jobs before DB upsert.
   */
  const seen =
    new Set<string>();

  const deduplicated =
    jobs.filter(
      (
        job
      ) => {
        const key =
          `${normalizeLower(
            job.source
          )}:${normalizeLower(
            job.externalId
          )}`;

        if (
          seen.has(
            key
          )
        ) {
          return false;
        }

        seen.add(
          key
        );

        return true;
      }
    );

  return [
    ...deduplicated,
  ].sort(
    sortByPreStoreScore
  );
};

const upsertExternalJobsWithConcurrency =
  async (
    jobs:
      IExternalJobRecord[]
  ): Promise<IJob[]> => {
    if (
      jobs.length ===
      0
    ) {
      return [];
    }

    /*
     * GENERAL JOB MATCHING FAST UPSERT
     *
     * The previous implementation executed one findOneAndUpdate()
     * for every vacancy through a worker pool. With up to 1,000 jobs,
     * that still meant hundreds of MongoDB round trips.
     *
     * bulkWrite() sends the complete set of upserts to MongoDB in one
     * bulk operation. ordered:false lets MongoDB continue processing
     * independent vacancies even if one operation fails.
     */
    const operations =
      jobs.map(
        (
          externalJob
        ) => ({
          updateOne: {
            filter: {
              source:
                externalJob.source,

              externalId:
                externalJob.externalId,
            },

            update: {
              $set: {
                ...externalJob,

                isActive:
                  true,
              },
            },

            upsert:
              true,
          },
        })
      );

    try {
      const bulkResult =
        await Job.bulkWrite(
          operations,
          {
            ordered:
              false,
          }
        );

      console.log(
        "[JOB MATCHING] Bulk vacancy upsert completed:",
        {
          requested:
            jobs.length,

          matched:
            bulkResult.matchedCount,

          modified:
            bulkResult.modifiedCount,

          upserted:
            bulkResult.upsertedCount,
        }
      );
    } catch (
      error
    ) {
      console.error(
        "[JOB MATCHING] Bulk vacancy upsert failed:",
        error
      );

      throw error;
    }

    /*
     * bulkWrite() returns write statistics rather than the updated
     * documents. Fetch the exact refreshed vacancy set in one query so
     * the existing CV scoring/ranking code can continue unchanged.
     */
    const sourceExternalPairs =
      jobs.map(
        (
          job
        ) => ({
          source:
            job.source,

          externalId:
            job.externalId,
        })
      );

    const storedJobs =
      await Job.find({
        $or:
          sourceExternalPairs,
      })
        .lean<IJob[]>();

    /*
     * Restore the input order. MongoDB does not guarantee result order
     * for an $or query. The general ranking step will sort again later,
     * but deterministic ordering here keeps behavior predictable.
     */
    const storedByKey =
      new Map<string, IJob>(
        storedJobs.map(
          (
            job
          ) => [
            `${normalizeLower(
              job.source
            )}:${normalizeLower(
              job.externalId
            )}`,
            job,
          ]
        )
      );

    const orderedStoredJobs =
      jobs
        .map(
          (
            job
          ) =>
            storedByKey.get(
              `${normalizeLower(
                job.source
              )}:${normalizeLower(
                job.externalId
              )}`
            )
        )
        .filter(
          (
            job
          ): job is IJob =>
            Boolean(
              job
            )
        );

    if (
      orderedStoredJobs.length !==
      jobs.length
    ) {
      console.warn(
        "[JOB MATCHING] Some refreshed vacancies could not be reloaded after bulk upsert:",
        {
          requested:
            jobs.length,

          loaded:
            orderedStoredJobs.length,

          missing:
            jobs.length -
            orderedStoredJobs.length,
        }
      );
    }

    return orderedStoredJobs;
  };

/* =========================================================
   ROLE TIER WEIGHT
========================================================= */

const roleTierWeight = (
  tier:
    RoleTier
): number => {
  switch (
    tier
  ) {
    case "exact":
      return 5;

    case "strong":
      return 4;

    case "related":
      return 3;

    case "fallback":
      return 2;

    case "reject":
    default:
      return 0;
  }
};

/* =========================================================
   SCORING SORT
========================================================= */

const sortScoredJobs = (
  a:
    IScoredJob,
  b:
    IScoredJob
): number => {
  /*
   * Role correctness first.
   */
  const roleDifference =
    roleTierWeight(
      b.roleTier
    ) -
    roleTierWeight(
      a.roleTier
    );

  if (
    roleDifference !==
    0
  ) {
    return roleDifference;
  }

  /*
   * Database-defined field relevance second.
   */
  const fieldDifference =
    b.fieldRelevance -
    a.fieldRelevance;

  if (
    fieldDifference !==
    0
  ) {
    return fieldDifference;
  }

  /*
   * Explicit related-field similarity third.
   */
  const relationDifference =
    b.relatedRoleSimilarity -
    a.relatedRoleSimilarity;

  if (
    relationDifference !==
    0
  ) {
    return relationDifference;
  }

  /*
   * User profile match fourth.
   */
  const scoreDifference =
    b.match.matchScore -
    a.match.matchScore;

  if (
    scoreDifference !==
    0
  ) {
    return scoreDifference;
  }

  /*
   * Newer vacancy fifth.
   */
  return (
    new Date(
      b.job.postedAt
    ).getTime() -
    new Date(
      a.job.postedAt
    ).getTime()
  );
};

/* =========================================================
   REFRESH EXTERNAL JOBS FOR USER
========================================================= */

export const refreshExternalJobsForUser =
  async (
    userId:
      string
  ): Promise<IRefreshExternalJobsResult> => {
    logDivider(
      "START FAST MONGODB ROLE-BASED JOB SEARCH"
    );

    /* =====================================================
       USER ID
    ===================================================== */

    if (
      !Types.ObjectId.isValid(
        userId
      )
    ) {
      throw new Error(
        "A valid user ID is required."
      );
    }

    const userObjectId =
      new Types.ObjectId(
        userId
      );

    /* =====================================================
       CAREER AUTOMATION
    ===================================================== */

    const automation =
      await CareerAutomation.findOne({
        userId:
          userObjectId,

        status: {
          $in: [
            "active",
            "paused",
          ],
        },
      });

    if (
      !automation
    ) {
      throw new Error(
        "Career Automation was not found. Create your Career Automation plan first."
      );
    }

    if (
      automation
        .jobPreferences
        .enabled ===
      false
    ) {
      throw new Error(
        "Job search is disabled in Career Automation settings."
      );
    }

    /* =====================================================
       TARGET ROLE
    ===================================================== */

    const preferenceTargetRole =
      automation
        .jobPreferences
        .targetRoles
        ?.find(
          (
            role
          ) =>
            Boolean(
              normalizeString(
                role
              )
            )
        );

    /*
     * The roadmap targetRole is the canonical source of truth.
     * jobPreferences.targetRoles can be stale after a roadmap rebuild.
     */
    const targetRole =
      normalizeString(
        automation.targetRole ||
        preferenceTargetRole
      );

    if (
      !targetRole
    ) {
      throw new Error(
        "Career Automation target role is missing."
      );
    }

    /* =====================================================
       LOCATION
    ===================================================== */

    const rawLocation =
      normalizeString(
        automation
          .jobPreferences
          .locations?.[0]
      );

    const sourceLocation =
      rawLocation &&
      normalizeLower(
        rawLocation
      ) !==
        "remote"
        ? rawLocation
        : undefined;

    const countryCode =
      getCountryCodeFromLocation(
        rawLocation
      );

    /* =====================================================
       ACTIVE RESUME
    ===================================================== */

    const activeResumeId =
      automation.activeResumeId &&
      Types.ObjectId.isValid(
        automation
          .activeResumeId
          .toString()
      )
        ? automation
          .activeResumeId
          .toString()
        : undefined;

    /* =====================================================
       CAREER SKILL PROFILE
    ===================================================== */

    logDivider(
      "CAREER SKILL PROFILE"
    );

    const skillProfile =
      await buildCareerSkillProfile({
        userId:
          userObjectId,

        resumeAnalysisId:
          activeResumeId,

        strongestSkillLimit:
          12,
      });

    console.log({
      targetRole,

      requestedLocation:
        rawLocation ||
        "Any",

      roadmapTargetRole:
        normalizeString(
          automation.targetRole
        ),

      preferenceTargetRole:
        normalizeString(
          preferenceTargetRole
        ),

      resolvedTargetRole:
        targetRole,

      totalSkills:
        skillProfile.totalSkills,

      verifiedSkills:
        skillProfile
          .verifiedSkills
          .map(
            (
              skill
            ) =>
              skill.name
          ),

      strongestSkills:
        skillProfile
          .strongestSkills
          .slice(
            0,
            12
          )
          .map(
            (
              skill
            ) => ({
              name:
                skill.name,

              score:
                skill.skillScore,

              confidence:
                skill.confidence,

              verified:
                skill.interviewVerified,

              sources:
                skill.sources,
            })
          ),
    });

    /* =====================================================
       SEARCH QUERIES
    ===================================================== */

    const fieldSearchPlan =
      await buildCareerFieldSearchPlan(
        targetRole,
        {
          /*
           * Vacancy search is driven by relatedRoles.
           * relatedFields remain available for later roadmap logic.
           */
          includeRelatedFields:
            true,

          minimumRelatedRoleSimilarity:
            50,

          minimumRelatedFieldSimilarity:
            50,

          maxRelatedRoles:
            20,

          maxRelatedFields:
            5,

          maxSearchQueries:
            MAX_SEARCH_QUERIES,
        }
      );

    if (
      !fieldSearchPlan
    ) {
      throw new Error(
        `Career field "${targetRole}" was not found in the fields collection.`
      );
    }

    const canonicalTargetRole =
      fieldSearchPlan
        .targetField
        .name;

    /*
     * Query priority comes from the MongoDB field document:
     *
     * 1. target field search queries
     * 2. target name / aliases
     * 3. relatedRoles ordered by similarity
     *
     * relatedFields are intentionally NOT expanded into vacancy
     * queries anymore. They represent broader career relationships,
     * not specific fallback job titles.
     */
    const primarySearchQueries =
      uniqueStrings([
        ...fieldSearchPlan
          .targetField
          .searchQueries,

        canonicalTargetRole,

        ...fieldSearchPlan
          .targetField
          .aliases,
      ])
        .slice(
          0,
          4
        );

    const relatedRoleQueries =
      fieldSearchPlan
        .relatedRoles
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            b.similarity -
            a.similarity
        )
        .map(
          (
            item
          ) =>
            item.title
        );

    const searchQueries =
      uniqueStrings([
        ...primarySearchQueries,
        ...relatedRoleQueries,
      ])
        .slice(
          0,
          MAX_SEARCH_QUERIES
        );

    logDivider(
      "DATABASE-DRIVEN ROLE SEARCH PLAN"
    );

    console.log({
      requestedTargetRole:
        targetRole,

      resolvedField: {
        slug:
          fieldSearchPlan
            .targetField
            .slug,

        name:
          canonicalTargetRole,

        coreSkills:
          fieldSearchPlan
            .coreSkills,
      },

      relatedRoles:
        fieldSearchPlan
          .relatedRoles
          .map(
            (
              item
            ) => ({
              title:
                item.title,

              similarity:
                item.similarity,
            })
          ),

      relatedFields:
        fieldSearchPlan
          .relatedFields
          .map(
            (
              item
            ) => ({
              slug:
                item.field.slug,

              name:
                item.field.name,

              similarity:
                item.similarity,
            })
          ),

      searchQueries,

      location:
        sourceLocation ||
        "No source-level location",

      countryCode,

      /*
       * Debug-only flags. They do not change ranking.
       */
      isAzerbaijanSearch:
        prefersAzerbaijan(
          rawLocation
        ),

      globalRemoteStillAllowed:
        true,

      dailyJobLimit:
        DAILY_JOB_LIMIT,
    });

    /* =====================================================
       FAST MONGODB JOB POOL

       IMPORTANT:
       User-facing Career Automation refresh must NOT wait for
       Greenhouse / Lever / Ashby / SuccessFactors / GitHub.

       Background ingestion keeps the shared Job collection fresh.
       This request only reads the newest active vacancies already
       stored in MongoDB and ranks them for the current user.
    ===================================================== */

    logDivider(
      "LOADING EXISTING JOBS FROM MONGODB"
    );

    /*
     * Load a larger current MongoDB window before applying location and
     * role filters. The old 1,500-global-job window could exclude valid
     * target-role vacancies before classification even started.
     * Adzuna is blocked defensively at read time as well.
     */
    const fetchedJobs:
      IJob[] =
      await Job.find({
        isActive:
          true,

        source: {
          $not: {
            $regex:
              /adzuna/i,
          },
        },
      })
        .sort({
          postedAt:
            -1,

          createdAt:
            -1,
        })
        .limit(
          5_000
        )
        .lean<IJob[]>();

    /*
     * Keep the existing downstream variable name so all current
     * preference filtering, role classification, CV matching,
     * ranking, saving, and debug summary logic stays intact.
     *
     * No upsert is needed because these jobs already exist in DB.
     */
    const storedJobs:
      IJob[] =
      fetchedJobs;

    console.log(
      "[FAST JOB SEARCH] MongoDB pool loaded:",
      {
        jobs:
          storedJobs.length,

        targetRole:
          canonicalTargetRole,

        requestedLocation:
          rawLocation ||
          "Any",

        networkProviderRequests:
          0,
      }
    );

    /* =====================================================
       USER PREFERENCES
    ===================================================== */

    const configuredMinimumMatchScore =
      Math.max(
        0,
        Math.min(
          100,
          automation
            .jobPreferences
            .minimumMatchScore ??
          DEFAULT_MINIMUM_MATCH_SCORE
        )
      );

    /*
     * Keep a reasonable CV threshold. Role correctness is handled
     * separately and always has priority over profile score.
     */
    const minimumMatchScore =
      Math.min(
        configuredMinimumMatchScore,
        65
      );

    const allowedWorkModes =
      new Set(
        automation
          .jobPreferences
          .workModes ??
        []
      );

    const allowedExperienceLevels =
      (
        automation
          .jobPreferences
          .experienceLevels ??
        []
      ) as JobExperienceLevel[];

    const allowedExperienceSet =
      new Set(
        allowedExperienceLevels
      );

    const allowedEmploymentTypes =
      new Set(
        automation
          .jobPreferences
          .employmentTypes ??
        []
      );

    /* =====================================================
       HARD PREFERENCE FILTER
    ===================================================== */

    const preferenceFilteredJobs =
      storedJobs.filter(
        (
          job
        ) => {
          /* ===========================
             LOCATION
          =========================== */

          const locationOkay =
            locationMatchesPreference(
              job,
              rawLocation
            );

          /* ===========================
             WORK MODE
          =========================== */

          const workModeOkay =
            allowedWorkModes.size ===
              0 ||
            allowedWorkModes.has(
              job.remoteType
            );

          /* ===========================
             EMPLOYMENT TYPE
          =========================== */

          const normalizedEmploymentType =
            job.employmentType ===
              "full-time"
              ? "full_time"
              : job.employmentType ===
                  "part-time"
                ? "part_time"
                : job.employmentType;

          const employmentOkay =
            allowedEmploymentTypes.size ===
              0 ||
            allowedEmploymentTypes.has(
              normalizedEmploymentType
            );

          /* ===========================
             EXPERIENCE
          =========================== */

          const experienceOkay =
            allowedExperienceSet.size ===
              0 ||
            allowedExperienceSet.has(
              job.experienceLevel
            ) ||
            (
              allowedExperienceSet.has(
                "entry"
              ) &&
              job.experienceLevel ===
                "junior"
            ) ||
            (
              allowedExperienceSet.has(
                "junior"
              ) &&
              job.experienceLevel ===
                "entry"
            );

          return (
            locationOkay &&
            workModeOkay &&
            employmentOkay &&
            experienceOkay
          );
        }
      );

    console.log({
      fetched:
        fetchedJobs.length,

      stored:
        storedJobs.length,

      preferencePassed:
        preferenceFilteredJobs.length,

      targetRole,

      requestedLocation:
        rawLocation ||
        "Any",

      workModes: [
        ...allowedWorkModes,
      ],

      experienceLevels:
        allowedExperienceLevels,

      employmentTypes: [
        ...allowedEmploymentTypes,
      ],

      minimumMatchScore,
    });

    /* =====================================================
       ROLE CLASSIFICATION + PROFILE MATCH
    ===================================================== */

    logDivider(
      "STRICT ROLE CLASSIFICATION"
    );

    const scoredJobs:
      IScoredJob[] =
      preferenceFilteredJobs.map(
        (
          job
        ) => {
          const fieldClassification =
            classifyRoleFromFieldPlan(
              fieldSearchPlan,
              job
            );

          const match =
            calculateJobMatch(
              skillProfile,
              job,
              {
                targetRole:
                  canonicalTargetRole,

                preferredExperienceLevels:
                  allowedExperienceLevels,
              }
            );

          return {
            job,

            match,

            roleTier:
              fieldClassification
                .roleTier,

            fieldRelevance:
              fieldClassification
                .fieldRelevance,

            relatedRoleSimilarity:
              fieldClassification
                .relatedRoleSimilarity,

            matchedRole:
              fieldClassification
                .matchedRole,
          };
        }
      );

    /* =====================================================
       REMOVE UNRELATED JOBS

       The MongoDB career-field definition is now the source
       of truth for role relevance. CV matching remains a
       separate score and is used for ranking afterwards.
    ===================================================== */

    const roleValidJobs =
      scoredJobs.filter(
        (
          item
        ) => {
          if (
            item.roleTier ===
            "reject"
          ) {
            return false;
          }

          if (
            item.roleTier ===
              "exact" ||
            item.roleTier ===
              "strong"
          ) {
            return true;
          }

          return (
            item.fieldRelevance >=
            38
          );
        }
      );

    /* =====================================================
       ROLE POOLS
    ===================================================== */

    const exactJobs =
      roleValidJobs
        .filter(
          (
            item
          ) =>
            item.roleTier ===
            "exact"
        )
        .sort(
          sortScoredJobs
        );

    const strongJobs =
      roleValidJobs
        .filter(
          (
            item
          ) =>
            item.roleTier ===
            "strong"
        )
        .sort(
          sortScoredJobs
        );

    const relatedJobs =
      roleValidJobs
        .filter(
          (
            item
          ) =>
            item.roleTier ===
            "related"
        )
        .sort(
          sortScoredJobs
        );

    /*
     * Fallback jobs are explicit lower-similarity relatedRoles
     * from the selected MongoDB career field.
     *
     * Fallback jobs are explicit lower-similarity relatedRoles
     * from MongoDB. Clearly conflicting titles are rejected by the
     * canonical role matcher before they can enter this pool.
     */
    const fallbackJobs =
      roleValidJobs
        .filter(
          (
            item
          ) =>
            item.roleTier ===
            "fallback"
        )
        .sort(
          sortScoredJobs
        );

        /* =====================================================
       SEARCH AGAIN ROTATION + DAILY TOP 3

       Search #1 -> A B C
       Search #2 -> D E F
       Search #3 -> G H I

       Previously shown vacancies are skipped while unseen,
       valid vacancies are available.
    ===================================================== */

    const previouslyShownJobIds =
      new Set<string>(
        automation.jobMatches
          .map(
            (item) =>
              item.jobId?.toString()
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      );

    const hasBeenShown = (
      item: IScoredJob
    ): boolean => {
      const id =
        item.job._id?.toString();

      return Boolean(
        id &&
        previouslyShownJobIds.has(id)
      );
    };

    const unseenExactJobs =
      exactJobs.filter(
        (item) =>
          !hasBeenShown(item)
      );

    const unseenStrongJobs =
      strongJobs.filter(
        (item) =>
          !hasBeenShown(item)
      );

    const unseenRelatedJobs =
      relatedJobs.filter(
        (item) =>
          !hasBeenShown(item)
      );

    const unseenFallbackJobs =
      fallbackJobs.filter(
        (item) =>
          !hasBeenShown(item)
      );

    console.log(
      "[JOB DEBUG] SEARCH ROTATION",
      {
        previouslyShown:
          previouslyShownJobIds.size,

        exact: {
          total:
            exactJobs.length,
          unseen:
            unseenExactJobs.length,
        },

        strong: {
          total:
            strongJobs.length,
          unseen:
            unseenStrongJobs.length,
        },

        related: {
          total:
            relatedJobs.length,
          unseen:
            unseenRelatedJobs.length,
        },

        fallback: {
          total:
            fallbackJobs.length,
          unseen:
            unseenFallbackJobs.length,
        },
      }
    );

    const selected:
      IScoredJob[] =
      [];

    const selectedIds =
      new Set<string>();

    const addFromPool = (
      pool:
        IScoredJob[],
      minimumProfileScore:
        number
    ): void => {
      for (
        const item of
        pool
      ) {
        if (
          selected.length >=
          DAILY_JOB_LIMIT
        ) {
          return;
        }

        if (
          item.match.matchScore <
          minimumProfileScore
        ) {
          continue;
        }

        const id =
          item.job._id?.toString();

        if (
          !id ||
          selectedIds.has(id)
        ) {
          continue;
        }

        selectedIds.add(id);

        selected.push(item);
      }
    };

    /* =====================================================
       PASS 1
       Only vacancies that have NEVER been shown before.
    ===================================================== */

    addFromPool(
      unseenExactJobs,
      Math.min(
        minimumMatchScore,
        42
      )
    );

    if (
      selected.length <
      DAILY_JOB_LIMIT
    ) {
      addFromPool(
        unseenStrongJobs,
        Math.min(
          minimumMatchScore,
          42
        )
      );
    }

    if (
      selected.length <
      DAILY_JOB_LIMIT
    ) {
      addFromPool(
        unseenRelatedJobs,
        Math.min(
          minimumMatchScore,
          40
        )
      );
    }

    if (
      selected.length <
      DAILY_JOB_LIMIT
    ) {
      addFromPool(
        unseenFallbackJobs,
        Math.min(
          minimumMatchScore,
          45
        )
      );
    }

    /*
     * If unseen jobs exist but their CV score is below
     * the preferred threshold, still prefer a relevant
     * unseen vacancy over recycling an old vacancy.
     */
    if (
      selected.length <
      DAILY_JOB_LIMIT
    ) {
      addFromPool(
        [
          ...unseenExactJobs,
          ...unseenStrongJobs,
          ...unseenRelatedJobs,
          ...unseenFallbackJobs,
        ].sort(
          sortScoredJobs
        ),
        0
      );
    }

    /* =====================================================
       PASS 2
       Only recycle old vacancies when unseen pool is empty.
    ===================================================== */

    if (
      selected.length <
      DAILY_JOB_LIMIT
    ) {
      console.log(
        "[JOB DEBUG] Unseen pool exhausted. Recycling previous vacancies."
      );

      addFromPool(
        [
          ...exactJobs,
          ...strongJobs,
          ...relatedJobs,
          ...fallbackJobs,
        ].sort(
          sortScoredJobs
        ),
        0
      );
    }

    const ranked =
      selected.slice(
        0,
        DAILY_JOB_LIMIT
      );
      
    /* =====================================================
       DEBUG ROLE POOLS
    ===================================================== */

    console.log(
      "[JOB DEBUG] ROLE POOLS",
      {
        exact:
          exactJobs.length,

        strong:
          strongJobs.length,

        related:
          relatedJobs.length,

        fallback:
          fallbackJobs.length,

        rejected:
          scoredJobs.filter(
            (
              item
            ) =>
              item.roleTier ===
              "reject"
          ).length,

        roleValid:
          roleValidJobs.length,

        selected:
          ranked.length,
      }
    );

    /* =====================================================
       DEBUG TOP 3
    ===================================================== */

    console.log(
      "[JOB DEBUG] DAILY TOP 3",
      ranked.map(
        (
          item
        ) => ({
          title:
            item.job.title,

          company:
            item.job.company,

          location:
            item.job.location,

          workMode:
            item.job.remoteType,

          employmentType:
            item.job.employmentType,

          source:
            item.job.source,

          roleTier:
            item.roleTier,

          fieldRelevance:
            item.fieldRelevance,

          relatedRoleSimilarity:
            item.relatedRoleSimilarity,

          matchedRole:
            item.matchedRole,

          matchScore:
            item.match.matchScore,

          roleRelevance:
            item
              .match
              .breakdown
              .roleRelevance,

          matchedSkills:
            item
              .match
              .matchedSkills,
        })
      )
    );

    /* =====================================================
       DEBUG SCORES
    ===================================================== */

    for (
      const item of
      [
        ...scoredJobs,
      ]
        .sort(
          sortScoredJobs
        )
        .slice(
          0,
          25
        )
    ) {
      console.log(
        "[JOB DEBUG] SCORE",
        {
          title:
            item.job.title,

          company:
            item.job.company,

          location:
            item.job.location,

          source:
            item.job.source,

          roleTier:
            item.roleTier,

          total:
            item.match.matchScore,

          skills:
            item
              .match
              .breakdown
              .skills,

          role:
            item
              .match
              .breakdown
              .roleRelevance,

          experience:
            item
              .match
              .breakdown
              .experience,

          evidence:
            item
              .match
              .breakdown
              .evidenceConfidence,

          matchedSkills:
            item
              .match
              .matchedSkills,

          selectedToday:
            Boolean(
              item.job._id &&
              selectedIds.has(
                item.job._id.toString()
              )
            ),
        }
      );
    }

    /* =====================================================
       SAVE TODAY'S MATCHES
    ===================================================== */

    const now =
      new Date();

    const existingByJobId =
      new Map(
        automation
          .jobMatches
          .map(
            (
              item
            ) => [
              item
                .jobId
                .toString(),

              item,
            ]
          )
      );

    for (
      const item of
      ranked
    ) {
      if (
        !item.job._id
      ) {
        continue;
      }

      const jobId =
        item.job._id
          .toString();

      const existing =
        existingByJobId.get(
          jobId
        );

      if (
        existing
      ) {
        existing.matchScore =
          item.match.matchScore;

        existing.lastSeenAt =
          now;

        continue;
      }

      automation.jobMatches.push({
        jobId:
          item.job._id,

        matchScore:
          item.match.matchScore,

        firstSeenAt:
          now,

        lastSeenAt:
          now,

        notificationSent:
          false,

        applicationTaskCreated:
          false,
      });
    }

    /* =====================================================
       PRESERVE SEARCH HISTORY

       IMPORTANT:
       Do not remove previous jobMatches.

       jobMatches now acts as persistent Search Again history.
       This allows the next request to exclude vacancies that
       the user has already seen.
    ===================================================== */

    automation.jobMatches =
      automation.jobMatches
        .sort(
          (a, b) =>
            new Date(
              b.lastSeenAt
            ).getTime() -
            new Date(
              a.lastSeenAt
            ).getTime()
        ) as typeof automation.jobMatches;

    console.log(
      "[JOB DEBUG] JOB SEARCH HISTORY",
      {
        totalShown:
          automation.jobMatches.length,

        currentResults:
          ranked.map(
            (item) => ({
              id:
                item.job._id?.toString(),

              title:
                item.job.title,

              company:
                item.job.company,

              roleTier:
                item.roleTier,

              matchScore:
                item.match.matchScore,
            })
          ),
      }
    );

    /* =====================================================
       SEARCH TIMESTAMPS
    ===================================================== */

    automation.lastJobSearchAt =
      now;

    automation.nextJobSearchAt =
      new Date(
        now.getTime() +
        ONE_DAY_MS
      );

    await automation.save();

    /* =====================================================
       FINAL SUMMARY
    ===================================================== */

    logDivider(
      "FINAL STRICT JOB SEARCH SUMMARY"
    );

    console.log({
      targetRole,

      requestedLocation:
        rawLocation ||
        "Any",

      searchQueries,

      fetched:
        fetchedJobs.length,

      stored:
        storedJobs.length,

      preferencePassed:
        preferenceFilteredJobs.length,

      roleValid:
        roleValidJobs.length,

      exact:
        exactJobs.length,

      strong:
        strongJobs.length,

      related:
        relatedJobs.length,

      fallback:
        fallbackJobs.length,

      selectedToday:
        ranked.length,

      dailyLimit:
        DAILY_JOB_LIMIT,
    });

    /* =====================================================
       RETURN
    ===================================================== */

    return {
      fetched:
        fetchedJobs.length,

      stored:
        storedJobs.length,

      matched:
        ranked.length,

      jobs:
        ranked.map(
          (
            item
          ) => ({
            job:
              item.job,

            matchScore:
              item.match.matchScore,

            matchedSkills:
              item.match.matchedSkills,

            missingSkills:
              item.match.missingSkills,
          })
        ),
    };
  };

/* =========================================================
   SHARED JOB CATALOG SYNC

   Runs in the background (GitHub Actions / cron), NOT from the
   user-facing Search Again request.

   Flow:
   providers + GitHub career snapshots -> normalize/dedupe -> MongoDB.
========================================================= */

export interface ISharedJobCatalogSyncResult {
  fetched: number;
  accepted: number;
  stored: number;
  deactivated: number;
  sources: string[];
}

const isBlockedJobSource = (
  source: string | undefined | null
): boolean => {
  const normalized =
    normalizeLower(
      source ||
      ""
    );

  return (
    normalized ===
      "adzuna" ||
    normalized.includes(
      "adzuna"
    )
  );
};

export const refreshSharedJobCatalog =
  async (): Promise<ISharedJobCatalogSyncResult> => {
    logDivider(
      "START SHARED JOB CATALOG SYNC"
    );

    /*
     * limit: 0 = complete deduplicated provider pool.
     * This is intentionally allowed here because this function runs in
     * the background, never inside the user's Search Again request.
     */
    const fetchedJobs =
      await fetchGeneralExternalJobs({
        limit:
          0,
      });

    const acceptedJobs =
      fetchedJobs.filter(
        (
          job
        ) =>
          !isBlockedJobSource(
            job.source
          )
      );

    if (
      acceptedJobs.length ===
      0
    ) {
      throw new Error(
        "Job catalog sync returned zero accepted vacancies. Existing MongoDB jobs were left untouched."
      );
    }

    const storedJobs =
      await upsertExternalJobsWithConcurrency(
        acceptedJobs
      );

    /*
     * Only deactivate stale vacancies for sources that were actually
     * present in this successful sync. If one provider completely fails,
     * we do not wipe its previous MongoDB snapshot by accident.
     */
    const externalIdsBySource =
      new Map<
        string,
        Set<string>
      >();

    for (
      const job of
      acceptedJobs
    ) {
      if (
        !job.source ||
        !job.externalId
      ) {
        continue;
      }

      const ids =
        externalIdsBySource.get(
          job.source
        ) ||
        new Set<string>();

      ids.add(
        job.externalId
      );

      externalIdsBySource.set(
        job.source,
        ids
      );
    }

    let deactivated =
      0;

    for (
      const [
        source,
        externalIds,
      ] of
      externalIdsBySource
    ) {
      const result =
        await Job.updateMany(
          {
            source,

            isActive:
              true,

            externalId: {
              $exists:
                true,

              $nin:
                Array.from(
                  externalIds
                ),
            },
          },
          {
            $set: {
              isActive:
                false,
            },
          }
        );

      deactivated +=
        result.modifiedCount ||
        0;
    }

    /*
     * Adzuna is intentionally no longer part of InterviewIQ's catalog.
     * Keep this defensive cleanup here so old records can never reappear
     * even if a legacy database still contains them.
     */
    const adzunaCleanup =
      await Job.updateMany(
        {
          source: {
            $regex:
              /adzuna/i,
          },

          isActive:
            true,
        },
        {
          $set: {
            isActive:
              false,
          },
        }
      );

    deactivated +=
      adzunaCleanup.modifiedCount ||
      0;

    const sources =
      Array.from(
        externalIdsBySource.keys()
      ).sort();

    console.log(
      "[JOB CATALOG SYNC] Completed:",
      {
        fetched:
          fetchedJobs.length,

        accepted:
          acceptedJobs.length,

        stored:
          storedJobs.length,

        deactivated,

        sources,
      }
    );

    return {
      fetched:
        fetchedJobs.length,

      accepted:
        acceptedJobs.length,

      stored:
        storedJobs.length,

      deactivated,

      sources,
    };
  };

/* =========================================================
   REFRESH GENERAL EXTERNAL JOBS FOR USER

   IMPORTANT:
   This is a USER-FACING request. It NEVER crawls providers.
   Daily/background sync keeps MongoDB fresh; Search Again only
   loads MongoDB, calculates CV match and returns ranked vacancies.
========================================================= */

export const refreshGeneralExternalJobsForUser =
  async (
    userId:
      string
  ): Promise<IGeneralJobRefreshResult> => {
    logDivider(
      "START FAST GENERAL CV-BASED JOB MATCHING"
    );

    if (
      !Types.ObjectId.isValid(
        userId
      )
    ) {
      throw new Error(
        "A valid user ID is required."
      );
    }

    const userObjectId =
      new Types.ObjectId(
        userId
      );

    const automation =
      await CareerAutomation.findOne({
        userId:
          userObjectId,

        status: {
          $in: [
            "active",
            "paused",
          ],
        },
      }).lean();

    const activeResumeId =
      automation?.activeResumeId &&
      Types.ObjectId.isValid(
        automation
          .activeResumeId
          .toString()
      )
        ? automation
            .activeResumeId
            .toString()
        : undefined;

    const skillProfile =
      await buildCareerSkillProfile({
        userId:
          userObjectId,

        resumeAnalysisId:
          activeResumeId,
      });

    if (
      skillProfile.totalSkills ===
      0
    ) {
      throw new Error(
        "No resume or career skill evidence was found. Analyze a resume first."
      );
    }

    /*
     * MongoDB ONLY. No Greenhouse/Lever/Ashby/SuccessFactors request is
     * made from this code path.
     */
    const storedJobs =
      await Job.find({
        isActive:
          true,

        source: {
          $not: {
            $regex:
              /adzuna/i,
          },
        },
      })
        .sort({
          postedAt:
            -1,

          createdAt:
            -1,
        })
        .limit(
          GENERAL_JOB_RAW_LIMIT
        )
        .lean<IJob[]>();

    const ranked:
      IGeneralScoredJob[] =
      storedJobs
        .map(
          (
            job
          ): IGeneralScoredJob => ({
            job,

            match:
              calculateJobMatch(
                skillProfile,
                job,
                {}
              ),
          })
        )
        .sort(
          (
            a,
            b
          ) => {
            const scoreDifference =
              b.match.matchScore -
              a.match.matchScore;

            if (
              scoreDifference !==
              0
            ) {
              return scoreDifference;
            }

            return (
              new Date(
                b.job.postedAt
              ).getTime() -
              new Date(
                a.job.postedAt
              ).getTime()
            );
          }
        );

    console.log(
      "[FAST GENERAL JOB MATCHING] MongoDB ranking completed:",
      {
        mongoCandidates:
          storedJobs.length,

        analyzed:
          ranked.length,

        returned:
          ranked.length,

        networkProviderRequests:
          0,

        adzunaAllowed:
          false,
      }
    );

    return {
      fetched:
        storedJobs.length,

      uniqueCandidates:
        storedJobs.length,

      stored:
        storedJobs.length,

      analyzed:
        ranked.length,

      returned:
        ranked.length,

      jobs:
        ranked.map(
          (
            item
          ) => ({
            job:
              item.job,

            matchScore:
              item.match.matchScore,

            matchedSkills:
              item.match.matchedSkills,

            missingSkills:
              item.match.missingSkills,
          })
        ),
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  refreshExternalJobsForUser,
  refreshGeneralExternalJobsForUser,
  refreshSharedJobCatalog,
};
