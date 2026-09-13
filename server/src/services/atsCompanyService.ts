import ATSCompany, {
  type ATSProvider,
  type IATSCompany,
} from "../models/ATSCompany";

/* =========================================================
   TYPES
========================================================= */

export interface IATSCompanySummary {
  id: string;

  companyName: string;

  ats: ATSProvider;

  boardSlug: string;

  careersUrl?: string;

  isActive: boolean;

  priority: number;

  jobCount: number;

  failureCount: number;

  lastSuccessfulFetchAt?: Date;

  lastFailedFetchAt?: Date;

  lastCheckedAt?: Date;
}

export interface IATSCompanySelectionOptions {
  minimumCompanies?: number;

  maximumCompanies?: number;

  providers?: ATSProvider[];

  includePreviouslyFailing?: boolean;
}

export interface IATSCompanySelectionResult {
  companies: IATSCompanySummary[];

  total: number;

  providerCounts: Record<
    ATSProvider,
    number
  >;
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_MINIMUM_COMPANIES =
  30;

const DEFAULT_MAXIMUM_COMPANIES =
  60;

const DEFAULT_PROVIDERS:
  ATSProvider[] = [
    "greenhouse",
    "lever",
    "ashby",
    "successfactors",
  ];

const MAX_FAILURE_COUNT =
  5;

/* =========================================================
   HELPERS
========================================================= */

const mapCompany = (
  company:
    IATSCompany
): IATSCompanySummary => {
  return {
    id:
      String(
        company._id
      ),

    companyName:
      company.companyName,

    ats:
      company.ats,

    boardSlug:
      company.boardSlug,

    careersUrl:
      company.careersUrl ||
      undefined,

    isActive:
      company.isActive,

    priority:
      company.priority,

    jobCount:
      company.jobCount,

    failureCount:
      company.failureCount,

    lastSuccessfulFetchAt:
      company.lastSuccessfulFetchAt,

    lastFailedFetchAt:
      company.lastFailedFetchAt,

    lastCheckedAt:
      company.lastCheckedAt,
  };
};

const shuffle = <
  T
>(
  values:
    T[]
): T[] => {
  const result =
    [
      ...values,
    ];

  for (
    let index =
      result.length - 1;
    index >
      0;
    index -=
      1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (
          index +
          1
        )
      );

    [
      result[index],
      result[randomIndex],
    ] = [
      result[randomIndex],
      result[index],
    ];
  }

  return result;
};

/* =========================================================
   GET ALL ACTIVE COMPANIES
========================================================= */

export const getAllActiveATSCompanies =
  async (): Promise<IATSCompanySummary[]> => {
    const companies =
      await ATSCompany.find({
        isActive:
          true,
      })
        .sort({
          priority:
            -1,

          companyName:
            1,
        })
        .lean<IATSCompany[]>();

    return companies.map(
      mapCompany
    );
  };

/* =========================================================
   GET COMPANIES BY PROVIDER
========================================================= */

export const getATSCompaniesByProvider =
  async (
    provider:
      ATSProvider
  ): Promise<IATSCompanySummary[]> => {
    const companies =
      await ATSCompany.find({
        ats:
          provider,

        isActive:
          true,
      })
        .sort({
          priority:
            -1,

          companyName:
            1,
        })
        .lean<IATSCompany[]>();

    return companies.map(
      mapCompany
    );
  };

/* =========================================================
   SELECT COMPANIES FOR SEARCH

   Goal:
   - minimum ~30 companies
   - balanced across providers
   - prioritize healthy companies
   - still rotate companies so every search does not hit only
     the same popular employers
========================================================= */

export const selectATSCompaniesForSearch =
  async (
    options:
      IATSCompanySelectionOptions =
      {}
  ): Promise<IATSCompanySelectionResult> => {
    const minimumCompanies =
      Math.max(
        1,
        Math.min(
          500,
          options.minimumCompanies ??
            DEFAULT_MINIMUM_COMPANIES
        )
      );

    const maximumCompanies =
      Math.max(
        minimumCompanies,
        Math.min(
          500,
          options.maximumCompanies ??
            DEFAULT_MAXIMUM_COMPANIES
        )
      );

    const providers =
      options.providers?.length
        ? Array.from(
            new Set(
              options.providers
            )
          )
        : DEFAULT_PROVIDERS;

    const filter:
      Record<
        string,
        unknown
      > = {
        isActive:
          true,

        ats: {
          $in:
            providers,
        },
      };

    if (
      options.includePreviouslyFailing !==
      true
    ) {
      filter.failureCount = {
        $lt:
          MAX_FAILURE_COUNT,
      };
    }

    const companies =
      await ATSCompany.find(
        filter
      )
        .sort({
          priority:
            -1,

          lastCheckedAt:
            1,

          companyName:
            1,
        })
        .lean<IATSCompany[]>();

    const grouped =
      new Map<
        ATSProvider,
        IATSCompany[]
      >();

    for (
      const provider of
      providers
    ) {
      grouped.set(
        provider,
        []
      );
    }

    for (
      const company of
      companies
    ) {
      const bucket =
        grouped.get(
          company.ats
        );

      if (
        bucket
      ) {
        bucket.push(
          company
        );
      }
    }

    /* =====================================================
       BALANCED PROVIDER TARGET
    ===================================================== */

    const basePerProvider =
      Math.max(
        1,
        Math.floor(
          minimumCompanies /
          providers.length
        )
      );

    const selected:
      IATSCompany[] =
      [];

    const selectedIds =
      new Set<string>();

    const addCompany = (
      company:
        IATSCompany
    ): void => {
      const id =
        String(
          company._id
        );

      if (
        selectedIds.has(
          id
        )
      ) {
        return;
      }

      if (
        selected.length >=
        maximumCompanies
      ) {
        return;
      }

      selectedIds.add(
        id
      );

      selected.push(
        company
      );
    };

    /* =====================================================
       FIRST PASS

       Take a balanced amount from
       Greenhouse / Lever / Ashby / SuccessFactors.
    ===================================================== */

    for (
      const provider of
      providers
    ) {
      const providerCompanies =
        grouped.get(
          provider
        ) ||
        [];

      /*
       * Priority still matters, but shuffle within a wider
       * candidate pool so searches don't always hit the same
       * companies.
       */
      const highPriorityPool =
        providerCompanies
          .slice(
            0,
            Math.max(
              basePerProvider *
                3,
              30
            )
          );

      const randomizedPool =
        shuffle(
          highPriorityPool
        );

      const providerSelection =
        randomizedPool
          .slice(
            0,
            basePerProvider
          );

      for (
        const company of
        providerSelection
      ) {
        addCompany(
          company
        );
      }
    }

    /* =====================================================
       SECOND PASS

       If one ATS has fewer companies than expected, fill the
       remaining slots from every other active company.
    ===================================================== */

    if (
      selected.length <
      minimumCompanies
    ) {
      const remainingCompanies =
        companies.filter(
          (
            company
          ) =>
            !selectedIds.has(
              String(
                company._id
              )
            )
        );

      const healthy =
        remainingCompanies.filter(
          (
            company
          ) =>
            company.failureCount ===
            0
        );

      const previouslyFailing =
        remainingCompanies.filter(
          (
            company
          ) =>
            company.failureCount >
            0
        );

      const fallbackPool =
        [
          ...shuffle(
            healthy
          ),

          ...shuffle(
            previouslyFailing
          ),
        ];

      for (
        const company of
        fallbackPool
      ) {
        if (
          selected.length >=
          minimumCompanies
        ) {
          break;
        }

        addCompany(
          company
        );
      }
    }

    /* =====================================================
       THIRD PASS

       We may intentionally search more than the minimum when
       enough companies exist.

       This gives the job matcher a richer pool without making
       every search scan the entire company database.
    ===================================================== */

    if (
      selected.length <
      maximumCompanies
    ) {
      const remaining =
        companies.filter(
          (
            company
          ) =>
            !selectedIds.has(
              String(
                company._id
              )
            )
        );

      /*
       * Prefer companies that have historically exposed jobs,
       * then companies we have checked less recently.
       */
      remaining.sort(
        (
          a,
          b
        ) => {
          if (
            b.jobCount !==
            a.jobCount
          ) {
            return (
              b.jobCount -
              a.jobCount
            );
          }

          const aChecked =
            a.lastCheckedAt
              ? a.lastCheckedAt.getTime()
              : 0;

          const bChecked =
            b.lastCheckedAt
              ? b.lastCheckedAt.getTime()
              : 0;

          return (
            aChecked -
            bChecked
          );
        }
      );

      for (
        const company of
        remaining
      ) {
        if (
          selected.length >=
          maximumCompanies
        ) {
          break;
        }

        addCompany(
          company
        );
      }
    }

    const mapped =
      selected.map(
        mapCompany
      );

    const providerCounts:
      Record<
        ATSProvider,
        number
      > = {
        greenhouse:
          0,

        lever:
          0,

        ashby:
          0,

        successfactors:
          0,
      };

    for (
      const company of
      mapped
    ) {
      providerCounts[
        company.ats
      ] +=
        1;
    }

    console.log(
      "[ATS COMPANY SERVICE] Selected companies:",
      {
        total:
          mapped.length,

        providerCounts,

        companies:
          mapped.map(
            (
              company
            ) => ({
              company:
                company.companyName,

              ats:
                company.ats,

              boardSlug:
                company.boardSlug,

              priority:
                company.priority,
            })
          ),
      }
    );

    return {
      companies:
        mapped,

      total:
        mapped.length,

      providerCounts,
    };
  };

/* =========================================================
   MARK FETCH SUCCESS
========================================================= */

export const markATSCompanyFetchSuccess =
  async ({
    companyId,
    jobCount,
  }: {
    companyId:
      string;

    jobCount:
      number;
  }): Promise<void> => {
    await ATSCompany.updateOne(
      {
        _id:
          companyId,
      },
      {
        $set: {
          lastSuccessfulFetchAt:
            new Date(),

          lastCheckedAt:
            new Date(),

          jobCount:
            Math.max(
              0,
              Math.round(
                jobCount
              )
            ),

          failureCount:
            0,
        },
      }
    );
  };

/* =========================================================
   MARK FETCH FAILURE
========================================================= */

export const markATSCompanyFetchFailure =
  async (
    companyId:
      string
  ): Promise<void> => {
    await ATSCompany.updateOne(
      {
        _id:
          companyId,
      },
      {
        $set: {
          lastFailedFetchAt:
            new Date(),

          lastCheckedAt:
            new Date(),
        },

        $inc: {
          failureCount:
            1,
        },
      }
    );
  };

/* =========================================================
   DISABLE UNHEALTHY COMPANIES

   Optional maintenance helper.
========================================================= */

export const disableRepeatedlyFailingATSCompanies =
  async (
    minimumFailures =
      10
  ): Promise<number> => {
    const result =
      await ATSCompany.updateMany(
        {
          isActive:
            true,

          failureCount: {
            $gte:
              minimumFailures,
          },
        },
        {
          $set: {
            isActive:
              false,
          },
        }
      );

    return (
      result.modifiedCount ||
      0
    );
  };

/* =========================================================
   REACTIVATE COMPANY
========================================================= */

export const reactivateATSCompany =
  async (
    companyId:
      string
  ): Promise<void> => {
    await ATSCompany.updateOne(
      {
        _id:
          companyId,
      },
      {
        $set: {
          isActive:
            true,

          failureCount:
            0,
        },
      }
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getAllActiveATSCompanies,

  getATSCompaniesByProvider,

  selectATSCompaniesForSearch,

  markATSCompanyFetchSuccess,

  markATSCompanyFetchFailure,

  disableRepeatedlyFailingATSCompanies,

  reactivateATSCompany,
};