import {
  env,
} from "../config/env";

import {
  type IJob,
  type JobEmploymentType,
  type JobExperienceLevel,
  type JobRemoteType,
  type JobSalaryPeriod,
} from "../models/Job";

import {
  calculateSearchQueryScore,
  matchesJobSearchQuery,
} from "./jobRoleMatcherService";

import {
  markATSCompanyFetchFailure,
  markATSCompanyFetchSuccess,
  selectATSCompaniesForSearch,
} from "./atsCompanyService";

import {
  discoverSuccessFactorsJobUrls,
} from "./jobs/providers/successFactorsJobProvider";

import {
  discoverAzercellJobUrls,
} from "./jobs/providers/azercellJobProvider";

import {
  discoverBirCareersJobs,
  type IBirCareersJob,
} from "./jobs/providers/birCareersJobProvider";

import {
  ALL_CAREER_SKILLS,
} from "./jobs/careerJobTaxonomy";

/* =========================================================
   TYPES
========================================================= */

export interface IExternalJobRecord
  extends Omit<
    IJob,
    "_id" |
    "createdAt" |
    "updatedAt"
  > {
  externalId:
    string;

  externalUrl:
    string;
}

interface IFetchExternalJobsParams {
  query:
    string;

  location?:
    string;

  countryCode?:
    string;

  limit?:
    number;
}

/*
 * Broad fetch used by the general Job Matching page.
 *
 * Unlike fetchExternalJobs(), it intentionally has no role
 * query and no hard location requirement. The user's CV and
 * skill profile rank the broad vacancy pool later.
 */
export interface IFetchGeneralExternalJobsParams {
  limit?:
    number;
}

/* =========================================================
   ATS SOURCE
========================================================= */

type AtsProvider =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "successfactors";

interface IAtsSource {
  provider:
    AtsProvider;

  slug:
    string;

  company:
    string;

  /*
   * Public career site URL from ATSCompany.
   * Required by SuccessFactors-style career sites.
   */
  careersUrl?:
    string;

  /*
   * Present for sources loaded from MongoDB atscompanies.
   * Environment-only fallback boards intentionally have no id.
   */
  companyId?:
    string;
}

/* =========================================================
   GREENHOUSE TYPES
========================================================= */

interface IGreenhouseJob {
  id?:
    number;

  title?:
    string;

  updated_at?:
    string;

  first_published?:
    string;

  absolute_url?:
    string;

  content?:
    string;

  company_name?:
    string;

  location?: {
    name?:
      string;
  };

  departments?:
    Array<{
      name?:
        string;
    }>;

  offices?:
    Array<{
      name?:
        string;
    }>;
}

interface IGreenhouseResponse {
  jobs?:
    IGreenhouseJob[];
}

/* =========================================================
   LEVER TYPES
========================================================= */

interface ILeverJob {
  id?:
    string;

  text?:
    string;

  hostedUrl?:
    string;

  applyUrl?:
    string;

  description?:
    string;

  descriptionPlain?:
    string;

  additionalPlain?:
    string;

  createdAt?:
    number;

  categories?: {
    commitment?:
      string;

    department?:
      string;

    location?:
      string;

    team?:
      string;

    allLocations?:
      string[];
  };

  lists?:
    Array<{
      text?:
        string;

      content?:
        string;
    }>;
}

/* =========================================================
   ASHBY TYPES
========================================================= */

interface IAshbyAddress {
  addressLocality?:
    string;

  addressRegion?:
    string;

  addressCountry?:
    string;
}

interface IAshbySecondaryLocation {
  location?:
    string;

  address?:
    IAshbyAddress;
}

interface IAshbySalaryComponent {
  compensationType?:
    string;

  interval?:
    string;

  currencyCode?:
    string | null;

  minValue?:
    number | null;

  maxValue?:
    number | null;
}

interface IAshbyCompensation {
  compensationTierSummary?:
    string;

  scrapeableCompensationSalarySummary?:
    string;

  summaryComponents?:
    IAshbySalaryComponent[];

  compensationTiers?:
    Array<{
      components?:
        IAshbySalaryComponent[];
    }>;
}

interface IAshbyJob {
  title?:
    string;

  location?:
    string;

  secondaryLocations?:
    IAshbySecondaryLocation[];

  department?:
    string;

  team?:
    string;

  isListed?:
    boolean;

  isRemote?:
    boolean;

  workplaceType?:
    string;

  descriptionHtml?:
    string;

  descriptionPlain?:
    string;

  publishedAt?:
    string;

  employmentType?:
    string;

  jobUrl?:
    string;

  applyUrl?:
    string;

  address?: {
    postalAddress?:
      IAshbyAddress;
  };

  compensation?:
    IAshbyCompensation;
}

interface IAshbyResponse {
  apiVersion?:
    string;

  jobs?:
    IAshbyJob[];
}

/* =========================================================
   PARSED TYPES
========================================================= */

interface IParsedExternalDescription {
  description:
    string;

  responsibilities:
    string[];

  requirements:
    string[];

  preferredQualifications:
    string[];
}

interface IParsedSalary {
  salary:
    number;

  salaryMin?:
    number;

  salaryMax?:
    number;

  salaryCurrency?:
    string;

  salaryPeriod?:
    JobSalaryPeriod;

  salaryIsPredicted?:
    boolean;
}

/* =========================================================
   CONSTANTS
========================================================= */

const REQUEST_TIMEOUT_MS =
  15_000;

const DEFAULT_LIMIT =
  30;

const MAX_DESCRIPTION_LENGTH =
  20_000;

/*
 * Cache prevents the same ATS board being downloaded
 * again for every related search query.
 */
const BOARD_CACHE_TTL_MS =
  5 *
  60 *
  1000;

/*
 * Career searches should evaluate a broad company pool.
 *
 * The MongoDB registry currently contains 100+ validated
 * boards. We select up to 60 boards for one search cycle.
 * The selected source set is cached for the same period as
 * the board data so related-role queries reuse the exact
 * same companies instead of randomly selecting another 60.
 */
const ATS_SOURCE_CACHE_TTL_MS =
  BOARD_CACHE_TTL_MS;

const ATS_SEARCH_MINIMUM_COMPANIES =
  30;

const ATS_SEARCH_MAXIMUM_COMPANIES =
  60;

const ATS_FETCH_CONCURRENCY =
  8;

/* =========================================================
   ATS SOURCE REGISTRY

   Source of truth:
   MongoDB -> atscompanies

   Hardcoded company lists are intentionally not kept here.
   Optional .env boards are still supported as emergency /
   local-development additions.
========================================================= */

/* =========================================================
   CAREER SKILLS

   Source of truth:
   services/jobs/careerJobTaxonomy.ts

   Covers all 18 InterviewIQ specializations:
   - 15 technology / IT roles
   - Digital Marketing Specialist
   - Financial Analyst
   - Logistics & Supply Chain Specialist
========================================================= */

const CAREER_SKILLS =
  ALL_CAREER_SKILLS;

/* =========================================================
   CACHE
========================================================= */

interface IBoardCacheEntry {
  expiresAt:
    number;

  jobs:
    IExternalJobRecord[];
}

const boardCache =
  new Map<
    string,
    IBoardCacheEntry
  >();

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace = (
  value:
    string |
    undefined |
    null
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

const uniqueStrings = (
  values:
    string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value of
    values
  ) {
    const cleaned =
      normalizeWhitespace(
        value
      );

    if (
      !cleaned
    ) {
      continue;
    }

    const key =
      cleaned
        .toLowerCase();

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
      cleaned
    );
  }

  return result;
};

const escapeRegExp = (
  value:
    string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const parseCommaSeparated = (
  value:
    string | undefined
): string[] => {
  if (
    !value
  ) {
    return [];
  }

  return uniqueStrings(
    value
      .split(
        ","
      )
  );
};

/* =========================================================
   ATS SOURCES
========================================================= */

interface IAtsSourceCacheEntry {
  expiresAt:
    number;

  sources:
    IAtsSource[];
}

const atsSourceCache =
  new Map<
    string,
    IAtsSourceCacheEntry
  >();

const getAtsSourceCacheKey = (
  providers:
    AtsProvider[]
): string => {
  return [
    ...providers,
  ]
    .sort()
    .join(
      "|"
    );
};

const getCachedAtsSources = (
  providers:
    AtsProvider[]
): IAtsSource[] | null => {
  const key =
    getAtsSourceCacheKey(
      providers
    );

  const cached =
    atsSourceCache.get(
      key
    );

  if (
    !cached
  ) {
    return null;
  }

  if (
    cached.expiresAt <
    Date.now()
  ) {
    atsSourceCache.delete(
      key
    );

    return null;
  }

  return cached.sources;
};

const setCachedAtsSources = (
  providers:
    AtsProvider[],
  sources:
    IAtsSource[]
): void => {
  const key =
    getAtsSourceCacheKey(
      providers
    );

  atsSourceCache.set(
    key,
    {
      expiresAt:
        Date.now() +
        ATS_SOURCE_CACHE_TTL_MS,

      sources,
    }
  );
};

const buildEnvironmentAtsSources = (
  providers:
    AtsProvider[]
): IAtsSource[] => {
  const result:
    IAtsSource[] =
    [];

  const enabled =
    new Set<
      AtsProvider
    >(
      providers
    );

  if (
    enabled.has(
      "greenhouse"
    )
  ) {
    for (
      const slug of
      parseCommaSeparated(
        env.GREENHOUSE_BOARDS
      )
    ) {
      result.push({
        provider:
          "greenhouse",

        slug,

        company:
          slug,
      });
    }
  }

  if (
    enabled.has(
      "lever"
    )
  ) {
    for (
      const slug of
      parseCommaSeparated(
        env.LEVER_BOARDS
      )
    ) {
      result.push({
        provider:
          "lever",

        slug,

        company:
          slug,
      });
    }
  }

  if (
    enabled.has(
      "ashby"
    )
  ) {
    for (
      const slug of
      parseCommaSeparated(
        env.ASHBY_BOARDS
      )
    ) {
      result.push({
        provider:
          "ashby",

        slug,

        company:
          slug,
      });
    }
  }

  return result;
};

const deduplicateAtsSources = (
  sources:
    IAtsSource[]
): IAtsSource[] => {
  const seen =
    new Set<string>();

  return sources.filter(
    (
      source
    ) => {
      const key =
        `${source.provider}:${source.slug.toLowerCase()}`;

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

const buildAtsSources =
  async (
    providers:
      AtsProvider[] = [
        "greenhouse",
        "lever",
        "ashby",
        "successfactors",
      ],
    options?: {
      minimumCompanies?:
        number;

      maximumCompanies?:
        number;

      forceReselect?:
        boolean;
    }
  ): Promise<IAtsSource[]> => {
    const normalizedProviders =
      Array.from(
        new Set(
          providers
        )
      );

    if (
      !options
        ?.forceReselect
    ) {
      const cached =
        getCachedAtsSources(
          normalizedProviders
        );

      if (
        cached
      ) {
        return cached;
      }
    }

    const selection =
      await selectATSCompaniesForSearch({
        minimumCompanies:
          options?.minimumCompanies ??
          ATS_SEARCH_MINIMUM_COMPANIES,

        maximumCompanies:
          options?.maximumCompanies ??
          ATS_SEARCH_MAXIMUM_COMPANIES,

        providers:
          normalizedProviders,

        includePreviouslyFailing:
          false,
      });

    const mongoSources:
      IAtsSource[] =
      selection.companies.map(
        (
          company
        ) => ({
          provider:
            company.ats,

          slug:
            company.boardSlug,

          company:
            company.companyName,

          careersUrl:
            company.careersUrl,

          companyId:
            company.id,
        })
      );

    /*
     * Environment boards remain supported for development or
     * emergency additions. MongoDB is still the primary source
     * of truth.
     */
    const environmentSources =
      buildEnvironmentAtsSources(
        normalizedProviders
      );

    const sources =
      deduplicateAtsSources([
        ...mongoSources,
        ...environmentSources,
      ]);

    setCachedAtsSources(
      normalizedProviders,
      sources
    );

    console.log(
      "[ATS JOBS] MongoDB source registry:",
      {
        requestedProviders:
          normalizedProviders,

        mongoCompanies:
          mongoSources.length,

        environmentCompanies:
          environmentSources.length,

        totalSources:
          sources.length,

        providerCounts:
          sources.reduce(
            (
              accumulator,
              source
            ) => {
              accumulator[
                source.provider
              ] +=
                1;

              return accumulator;
            },
            {
              greenhouse:
                0,

              lever:
                0,

              ashby:
                0,

              successfactors:
                0,
            } as Record<
              AtsProvider,
              number
            >
          ),
      }
    );

    return sources;
  };

/* =========================================================
   HTML HELPERS
========================================================= */

const decodeBasicHtmlEntities = (
  value:
    string
): string => {
  return value
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
};

const stripHtml = (
  value:
    string |
    undefined |
    null
): string => {
  let decoded =
    value ||
    "";

  /*
   * Greenhouse content may be HTML-entity encoded.
   * Decode more than once safely.
   */
  for (
    let index =
      0;
    index <
      2;
    index +=
      1
  ) {
    decoded =
      decodeBasicHtmlEntities(
        decoded
      );
  }

  return decoded
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/p>/gi,
      "\n"
    )
    .replace(
      /<\/li>/gi,
      "\n"
    )
    .replace(
      /<li[^>]*>/gi,
      "• "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim()
    .slice(
      0,
      MAX_DESCRIPTION_LENGTH
    );
};

/* =========================================================
   DESCRIPTION PARSER
========================================================= */

const splitIntoReadableItems = (
  value:
    string
): string[] => {
  if (
    !value
  ) {
    return [];
  }

  return uniqueStrings(
    value
      .replace(
        /\s*[•▪●]\s*/g,
        "\n"
      )
      .replace(
        /;\s+/g,
        "\n"
      )
      .split(
        /\n+|(?<=[.!?])\s+(?=[A-Z])/g
      )
      .map(
        normalizeWhitespace
      )
      .filter(
        (
          item
        ) =>
          item.length >=
          8
      )
  )
    .slice(
      0,
      30
    );
};

const parseExternalDescription = (
  rawDescription:
    string
): IParsedExternalDescription => {
  const description =
    stripHtml(
      rawDescription
    );

  const items =
    splitIntoReadableItems(
      description
    );

  const responsibilities =
    items
      .filter(
        (
          sentence
        ) =>
          /\b(responsib|you will|you'll|develop|build|maintain|design|implement|collaborat|partner|support|contribute|deliver|create|manage|lead|work with|own|debug)\b/i.test(
            sentence
          )
      )
      .slice(
        0,
        12
      );

  const requirements =
    items
      .filter(
        (
          sentence
        ) =>
          /\b(require|required|must|minimum|qualification|proficien|knowledge of|familiarity with|experience with|years? of experience|degree|certification|ability to)\b/i.test(
            sentence
          )
      )
      .slice(
        0,
        12
      );

  const preferredQualifications =
    items
      .filter(
        (
          sentence
        ) =>
          /\b(preferred|nice to have|nice-to-have|bonus|desired|ideally|a plus)\b/i.test(
            sentence
          )
      )
      .slice(
        0,
        10
      );

  return {
    description,

    responsibilities,

    requirements,

    preferredQualifications,
  };
};

/* =========================================================
   SKILLS
========================================================= */

const hasSkillMention = (
  text:
    string,
  skill:
    string
): boolean => {
  const aliases:
    Record<
      string,
      RegExp[]
    > = {
      javascript: [
        /\bjavascript\b/i,
        /\bjs\b/i,
      ],

      typescript: [
        /\btypescript\b/i,
        /\bts\b/i,
      ],

      react: [
        /\breact(?:\.js)?\b/i,
      ],

      "next.js": [
        /\bnext(?:\.js|\s+js)\b/i,
      ],

      "node.js": [
        /\bnode(?:\.js|\s+js)\b/i,
      ],

      "rest api": [
        /\brest(?:ful)?\s+api(?:s)?\b/i,
        /\brest\b/i,
      ],

      "tailwind css": [
        /\btailwind(?:\s+css)?\b/i,
      ],

      "c++": [
        /(?:^|[^a-z0-9])c\+\+(?:[^a-z0-9]|$)/i,
      ],

      "c#": [
        /(?:^|[^a-z0-9])c#(?:[^a-z0-9]|$)/i,
      ],

      "machine learning": [
        /\bmachine learning\b/i,
        /\bml\b/i,
      ],

      nlp: [
        /\bnlp\b/i,
        /\bnatural language processing\b/i,
      ],

      llm: [
        /\bllm(?:s)?\b/i,
        /\blarge language model(?:s)?\b/i,
      ],

      mlops: [
        /\bmlops\b/i,
        /\bml ops\b/i,
      ],

      "scikit-learn": [
        /\bscikit[- ]?learn\b/i,
        /\bsklearn\b/i,
      ],

      pytorch: [
        /\bpytorch\b/i,
        /\btorch\b/i,
      ],

      tensorflow: [
        /\btensorflow\b/i,
      ],

      pandas: [
        /\bpandas\b/i,
      ],

      etl: [
        /\betl\b/i,
        /\bextract[, ]+transform[, ]+load\b/i,
      ],

      elt: [
        /\belt\b/i,
        /\bextract[, ]+load[, ]+transform\b/i,
      ],

      "apache spark": [
        /\bapache spark\b/i,
        /\bspark\b/i,
      ],

      kafka: [
        /\bapache kafka\b/i,
        /\bkafka\b/i,
      ],

      airflow: [
        /\bapache airflow\b/i,
        /\bairflow\b/i,
      ],

      "power bi": [
        /\bpower\s*bi\b/i,
      ],

      tableau: [
        /\btableau\b/i,
      ],

      "a/b testing": [
        /\ba\/b testing\b/i,
        /\bab testing\b/i,
        /\bsplit testing\b/i,
      ],

      "ci/cd": [
        /\bci\/cd\b/i,
        /\bcontinuous integration\b/i,
        /\bcontinuous delivery\b/i,
        /\bcontinuous deployment\b/i,
      ],

      iam: [
        /\biam\b/i,
        /\bidentity and access management\b/i,
      ],

      "infrastructure as code": [
        /\binfrastructure as code\b/i,
        /\biac\b/i,
      ],

      "google ads": [
        /\bgoogle ads\b/i,
        /\badwords\b/i,
      ],

      "meta ads": [
        /\bmeta ads\b/i,
        /\bfacebook ads\b/i,
        /\binstagram ads\b/i,
      ],

      "google analytics": [
        /\bgoogle analytics\b/i,
        /\bga4\b/i,
      ],

      seo: [
        /\bseo\b/i,
        /\bsearch engine optimization\b/i,
      ],

      sem: [
        /\bsem\b/i,
        /\bsearch engine marketing\b/i,
      ],

      ppc: [
        /\bppc\b/i,
        /\bpay per click\b/i,
        /\bpay-per-click\b/i,
      ],

      roas: [
        /\broas\b/i,
        /\breturn on ad spend\b/i,
      ],

      roi: [
        /\broi\b/i,
        /\breturn on investment\b/i,
      ],

      cpa: [
        /\bcpa\b/i,
        /\bcost per acquisition\b/i,
        /\bcost per action\b/i,
      ],

      cpc: [
        /\bcpc\b/i,
        /\bcost per click\b/i,
      ],

      ctr: [
        /\bctr\b/i,
        /\bclick through rate\b/i,
        /\bclick-through rate\b/i,
      ],

      "financial modeling": [
        /\bfinancial model(?:ing|ling)?\b/i,
      ],

      "financial statements": [
        /\bfinancial statements?\b/i,
        /\bincome statement\b/i,
        /\bbalance sheet\b/i,
      ],

      "cash flow": [
        /\bcash flow\b/i,
        /\bcashflow\b/i,
      ],

      "fp&a": [
        /\bfp&a\b/i,
        /\bfinancial planning and analysis\b/i,
      ],

      dcf: [
        /\bdcf\b/i,
        /\bdiscounted cash flow\b/i,
      ],

      wacc: [
        /\bwacc\b/i,
        /\bweighted average cost of capital\b/i,
      ],

      npv: [
        /\bnpv\b/i,
        /\bnet present value\b/i,
      ],

      irr: [
        /\birr\b/i,
        /\binternal rate of return\b/i,
      ],

      "inventory management": [
        /\binventory management\b/i,
        /\binventory control\b/i,
      ],

      procurement: [
        /\bprocurement\b/i,
        /\bpurchasing\b/i,
      ],

      warehousing: [
        /\bwarehouse\b/i,
        /\bwarehousing\b/i,
      ],

      "supply chain optimization": [
        /\bsupply chain optimization\b/i,
        /\bsupply chain optimisation\b/i,
      ],

      incoterms: [
        /\bincoterms?\b/i,
      ],

      eoq: [
        /\beoq\b/i,
        /\beconomic order quantity\b/i,
      ],

      erp: [
        /\berp\b/i,
        /\benterprise resource planning\b/i,
      ],

      "sap mm": [
        /\bsap\s+mm\b/i,
        /\bmaterials management\b/i,
      ],

      "sap sd": [
        /\bsap\s+sd\b/i,
        /\bsales and distribution\b/i,
      ],

      "sap pm": [
        /\bsap\s+pm\b/i,
        /\bplant maintenance\b/i,
      ],
    };

  const special =
    aliases[
      skill.toLowerCase()
    ];

  if (
    special
  ) {
    return special.some(
      (
        pattern
      ) =>
        pattern.test(
          text
        )
    );
  }

  return new RegExp(
    `(^|[^a-z0-9+#.&/])${escapeRegExp(
      skill
    )}([^a-z0-9+#.&/]|$)`,
    "i"
  )
    .test(
      text
    );
};

const detectSkills = (
  text:
    string
): string[] => {
  return CAREER_SKILLS.filter(
    (
      skill
    ) =>
      hasSkillMention(
        text,
        skill
      )
  );
};

/* =========================================================
   WORK MODE
========================================================= */

const inferRemoteType = (
  title:
    string,
  description:
    string,
  location:
    string,
  explicitWorkplaceType?:
    string,
  explicitRemote?:
    boolean
): JobRemoteType => {
  const workplace =
    normalizeWhitespace(
      explicitWorkplaceType
    )
      .toLowerCase();

  if (
    workplace ===
      "remote" ||
    explicitRemote ===
      true
  ) {
    return "remote";
  }

  if (
    workplace ===
    "hybrid"
  ) {
    return "hybrid";
  }

  if (
    workplace ===
      "onsite" ||
    workplace ===
      "on-site"
  ) {
    return "onsite";
  }

  const text =
    `${title} ${description} ${location}`
      .toLowerCase();

  if (
    /\bhybrid\b/.test(
      text
    )
  ) {
    return "hybrid";
  }

  if (
    /\bremote\b|\bwork from home\b|\btelecommut/.test(
      text
    )
  ) {
    return "remote";
  }

  return "onsite";
};

/* =========================================================
   EMPLOYMENT TYPE
========================================================= */

const inferEmploymentType = (
  value:
    string | undefined,
  text:
    string
): JobEmploymentType => {
  const combined =
    `${value || ""} ${text}`
      .toLowerCase();

  if (
    /\bintern(ship)?\b/.test(
      combined
    )
  ) {
    return "internship";
  }

  if (
    /\bpart[-_ ]?time\b/.test(
      combined
    )
  ) {
    return "part-time";
  }

  if (
    /\bcontract\b|\bfreelance\b|\btemporary\b|\btemp\b/.test(
      combined
    )
  ) {
    return "contract";
  }

  return "full-time";
};

/* =========================================================
   EXPERIENCE
========================================================= */

const inferExperienceLevel = (
  title:
    string,
  description:
    string
): JobExperienceLevel => {
  const titleText =
    title.toLowerCase();

  if (
    /\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b|\blead\b/.test(
      titleText
    )
  ) {
    return "senior";
  }

  if (
    /\bmid[- ]?level\b|\bmid\b|\bintermediate\b/.test(
      titleText
    )
  ) {
    return "mid";
  }

  if (
    /\bjunior\b|\bjr\.?\b|\bentry[- ]?level\b|\bgraduate\b|\bnew grad\b|\bassociate\b/.test(
      titleText
    )
  ) {
    return "junior";
  }

  const years =
    description.match(
      /(\d+)\s*(?:\+|plus)?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+)?experience/i
    );

  if (
    years
  ) {
    const value =
      Number(
        years[1]
      );

    if (
      value >=
      5
    ) {
      return "senior";
    }

    if (
      value >=
      3
    ) {
      return "mid";
    }

    if (
      value >=
      1
    ) {
      return "junior";
    }
  }

  return "entry";
};

const inferExperienceRange = (
  description:
    string,
  level:
    JobExperienceLevel
): {
  min:
    number;

  max:
    number | null;
} => {
  const range =
    description.match(
      /(\d+)\s*[-–—]\s*(\d+)\s*(?:years?|yrs?)/i
    );

  if (
    range
  ) {
    return {
      min:
        Number(
          range[1]
        ),

      max:
        Number(
          range[2]
        ),
    };
  }

  const minimum =
    description.match(
      /(\d+)\s*(?:\+|plus)?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+)?experience/i
    );

  if (
    minimum
  ) {
    return {
      min:
        Number(
          minimum[1]
        ),

      max:
        null,
    };
  }

  switch (
    level
  ) {
    case "junior":
      return {
        min:
          1,

        max:
          2,
      };

    case "mid":
      return {
        min:
          3,

        max:
          4,
      };

    case "senior":
      return {
        min:
          5,

        max:
          null,
      };

    case "entry":
    default:
      return {
        min:
          0,

        max:
          1,
      };
  }
};

/* =========================================================
   EDUCATION
========================================================= */

const inferEducation = (
  description:
    string
): string[] => {
  const result:
    string[] = [];

  if (
    /\bbachelor(?:'s)?\b/i.test(
      description
    )
  ) {
    result.push(
      "Bachelor's degree"
    );
  }

  if (
    /\bmaster(?:'s)?\b/i.test(
      description
    )
  ) {
    result.push(
      "Master's degree"
    );
  }

  if (
    /\bcomputer science\b/i.test(
      description
    )
  ) {
    result.push(
      "Computer Science"
    );
  }

  if (
    /\bsoftware engineering\b/i.test(
      description
    )
  ) {
    result.push(
      "Software Engineering"
    );
  }

  if (
    /\binformation technology\b/i.test(
      description
    )
  ) {
    result.push(
      "Information Technology"
    );
  }

  return uniqueStrings(
    result
  );
};

/* =========================================================
   SALARY
========================================================= */

const normalizeSalaryPeriod = (
  interval:
    string | undefined
): JobSalaryPeriod => {
  const normalized =
    normalizeWhitespace(
      interval
    )
      .toLowerCase();

  if (
    normalized.includes(
      "hour"
    )
  ) {
    return "hour";
  }

  if (
    normalized.includes(
      "day"
    )
  ) {
    return "day";
  }

  if (
    normalized.includes(
      "week"
    )
  ) {
    return "week";
  }

  if (
    normalized.includes(
      "month"
    )
  ) {
    return "month";
  }

  if (
    normalized.includes(
      "year"
    ) ||
    normalized.includes(
      "annual"
    )
  ) {
    return "year";
  }

  return "unknown";
};

const parseSalaryText = (
  value:
    string | undefined
): IParsedSalary => {
  if (
    !value
  ) {
    return {
      salary:
        0,
    };
  }

  const matches =
    [
      ...value.matchAll(
        /(?:[$£€]\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g
      ),
    ];

  const numbers =
    matches
      .map(
        (
          match
        ) => {
          const raw =
            Number(
              match[1]
                .replace(
                  /,/g,
                  ""
                )
            );

          if (
            !Number.isFinite(
              raw
            )
          ) {
            return null;
          }

          return match[2]
            ?.toLowerCase() ===
            "k"
            ? raw *
              1000
            : raw;
        }
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
          "number"
      );

  if (
    numbers.length ===
    0
  ) {
    return {
      salary:
        0,
    };
  }

  const salaryMin =
    Math.min(
      ...numbers
    );

  const salaryMax =
    Math.max(
      ...numbers
    );

  let currency:
    string | undefined;

  if (
    value.includes(
      "$"
    )
  ) {
    currency =
      "USD";
  } else if (
    value.includes(
      "£"
    )
  ) {
    currency =
      "GBP";
  } else if (
    value.includes(
      "€"
    )
  ) {
    currency =
      "EUR";
  }

  return {
    salary:
      Math.round(
        salaryMax
      ),

    salaryMin:
      Math.round(
        salaryMin
      ),

    salaryMax:
      Math.round(
        salaryMax
      ),

    salaryCurrency:
      currency,

    salaryPeriod:
      normalizeSalaryPeriod(
        value
      ),

    salaryIsPredicted:
      false,
  };
};

const parseAshbySalary = (
  compensation:
    IAshbyCompensation |
    undefined
): IParsedSalary => {
  if (
    !compensation
  ) {
    return {
      salary:
        0,
    };
  }

  const components =
    [
      ...(
        compensation.summaryComponents ||
        []
      ),

      ...(
        compensation
          .compensationTiers ||
        []
      )
        .flatMap(
          (
            tier
          ) =>
            tier.components ||
            []
        ),
    ];

  const salaryComponents =
    components.filter(
      (
        component
      ) =>
        component
          .compensationType
          ?.toLowerCase() ===
        "salary"
    );

  if (
    salaryComponents.length >
    0
  ) {
    const mins =
      salaryComponents
        .map(
          (
            component
          ) =>
            component.minValue
        )
        .filter(
          (
            value
          ): value is number =>
            typeof value ===
              "number" &&
            Number.isFinite(
              value
            )
        );

    const maxs =
      salaryComponents
        .map(
          (
            component
          ) =>
            component.maxValue
        )
        .filter(
          (
            value
          ): value is number =>
            typeof value ===
              "number" &&
            Number.isFinite(
              value
            )
        );

    if (
      mins.length >
        0 ||
      maxs.length >
        0
    ) {
      const salaryMin =
        mins.length >
        0
          ? Math.min(
              ...mins
            )
          : Math.min(
              ...maxs
            );

      const salaryMax =
        maxs.length >
        0
          ? Math.max(
              ...maxs
            )
          : Math.max(
              ...mins
            );

      const first =
        salaryComponents[0];

      return {
        salary:
          Math.round(
            salaryMax
          ),

        salaryMin:
          Math.round(
            salaryMin
          ),

        salaryMax:
          Math.round(
            salaryMax
          ),

        salaryCurrency:
          first
            ?.currencyCode ||
          undefined,

        salaryPeriod:
          normalizeSalaryPeriod(
            first
              ?.interval
          ),

        salaryIsPredicted:
          false,
      };
    }
  }

  return parseSalaryText(
    compensation
      .scrapeableCompensationSalarySummary ||
    compensation
      .compensationTierSummary
  );
};

/* =========================================================
   KEYWORDS
========================================================= */

const buildKeywords = (
  title:
    string,
  skills:
    string[],
  extras:
    string[] = []
): string[] => {
  return uniqueStrings([
    ...title
      .split(
        /[\s/|,-]+/
      )
      .filter(
        (
          token
        ) =>
          token.length >=
          3
      ),

    ...skills,

    ...extras,
  ])
    .slice(
      0,
      40
    );
};

/* =========================================================
   HTTP
========================================================= */

const fetchJsonWithTimeout =
  async <T>(
    url:
      string
  ): Promise<T> => {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS
      );

    try {
      const response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "InterviewIQ/1.0",
            },

            signal:
              controller.signal,
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `ATS source responded with HTTP ${response.status}.`
        );
      }

      return (
        await response.json()
      ) as T;
    } finally {
      clearTimeout(
        timeout
      );
    }
  };

const fetchTextWithTimeout =
  async (
    url:
      string
  ): Promise<string> => {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REQUEST_TIMEOUT_MS
      );

    try {
      const response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                "text/html,application/xhtml+xml",

              "User-Agent":
                "Mozilla/5.0 (compatible; InterviewIQ/1.0; +https://interviewiq.app)",
            },

            signal:
              controller.signal,

            redirect:
              "follow",
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `ATS source responded with HTTP ${response.status}.`
        );
      }

      return await response.text();
    } finally {
      clearTimeout(
        timeout
      );
    }
  };

/* =========================================================
   SUCCESSFACTORS HTML HELPERS
========================================================= */

const decodeHtmlAttribute =
  (
    value:
      string
  ): string => {
    return decodeBasicHtmlEntities(
      value
    )
      .replace(
        /&#x2F;/gi,
        "/"
      )
      .replace(
        /&#47;/gi,
        "/"
      )
      .trim();
  };

const getSuccessFactorsBaseUrl =
  (
    source:
      IAtsSource
  ): string => {
    const candidate =
      normalizeWhitespace(
        source.careersUrl
      ) ||
      normalizeWhitespace(
        source.slug
      );

    if (
      !candidate
    ) {
      throw new Error(
        `SuccessFactors source "${source.company}" has no careers URL.`
      );
    }

    const withProtocol =
      /^https?:\/\//i.test(
        candidate
      )
        ? candidate
        : `https://${candidate}`;

    const parsed =
      new URL(
        withProtocol
      );

    return parsed.origin;
  };

const toAbsoluteUrl =
  (
    href:
      string,
    baseUrl:
      string
  ): string => {
    try {
      return new URL(
        decodeHtmlAttribute(
          href
        ),
        baseUrl
      ).toString();
    } catch {
      return "";
    }
  };

const extractSuccessFactorsJobLinks =
  (
    html:
      string,
    baseUrl:
      string
  ): string[] => {
    const links =
      new Set<string>();

    /*
     * SuccessFactors Recruiting Marketing (RMK) boards usually
     * expose jobs from the public, no-auth tile fragment:
     *
     *   /tile-search-results/?startrow=N
     *
     * Depending on tenant/theme/version, the returned fragment
     * may contain:
     *
     *   href="/job/Baku-Backend-Developer/.../1369567757/"
     *   href="job/Baku-Backend-Developer/.../1369567757/"
     *   escaped / entity-encoded values
     *
     * Keep the parser intentionally tolerant while still only
     * accepting paths that clearly belong to /job/.
     */
    const decodedHtml =
      decodeHtmlAttribute(
        html
      )
        .replace(
          /\\u002F/gi,
          "/"
        )
        .replace(
          /\\\//g,
          "/"
        );

    const candidates:
      string[] =
      [];

    /*
     * Standard href/src-style attributes.
     */
    const attributeRegex =
      /(?:href|data-url|data-href)=["']([^"']*\/?job\/[^"']+)["']/gi;

    let attributeMatch:
      RegExpExecArray |
      null;

    while (
      (
        attributeMatch =
          attributeRegex.exec(
            decodedHtml
          )
      ) !==
      null
    ) {
      candidates.push(
        attributeMatch[
          1
        ] ||
        ""
      );
    }

    /*
     * Fallback for fragments where the URL is embedded in JS /
     * JSON rather than directly in href.
     */
    const looseRegex =
      /(?:https?:\/\/[^"'<>\\\s]+)?\/job\/[^"'<>\\\s]+\/\d+\/?(?:\?[^"'<>\\\s]*)?/gi;

    const looseMatches =
      decodedHtml.match(
        looseRegex
      ) ||
      [];

    candidates.push(
      ...looseMatches
    );

    for (
      const candidate
      of candidates
    ) {
      const cleaned =
        decodeHtmlAttribute(
          candidate
        )
          .replace(
            /&amp;/gi,
            "&"
          )
          .trim();

      if (
        !cleaned ||
        !/\/job\//i.test(
          cleaned
        )
      ) {
        continue;
      }

      const absolute =
        toAbsoluteUrl(
          cleaned,
          baseUrl
        );

      if (
        !absolute
      ) {
        continue;
      }

      /*
       * Only keep links from the same SuccessFactors tenant.
       */
      try {
        const expectedHost =
          new URL(
            baseUrl
          ).host;

        const actualUrl =
          new URL(
            absolute
          );

        if (
          actualUrl.host !==
          expectedHost
        ) {
          continue;
        }
      } catch {
        continue;
      }

      links.add(
        absolute
      );
    }

    return [
      ...links,
    ];
  };

const extractSuccessFactorsExternalId =
  (
    url:
      string
  ): string => {
    const match =
      url.match(
        /\/(\d+)\/?(?:\?|$)/
      );

    return (
      match?.[
        1
      ] ||
      url
    );
  };

const extractSuccessFactorsTitle =
  (
    html:
      string,
    fallbackUrl:
      string
  ): string => {
    const candidates = [
      /<h1[^>]*class=["'][^"']*(?:jobTitle|job-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ];

    for (
      const pattern
      of candidates
    ) {
      const match =
        html.match(
          pattern
        );

      const value =
        normalizeWhitespace(
          stripHtml(
            match?.[
              1
            ] ||
            ""
          )
        )
          .replace(
            /\s*\|\s*.*$/i,
            ""
          )
          .replace(
            /\s*Job Details.*$/i,
            ""
          );

      if (
        value
      ) {
        return value;
      }
    }

    try {
      const pathname =
        new URL(
          fallbackUrl
        ).pathname;

      const slug =
        pathname
          .split(
            "/"
          )
          .filter(
            Boolean
          )[
            1
          ] ||
        "";

      return normalizeWhitespace(
        decodeURIComponent(
          slug
        )
          .replace(
            /-/g,
            " "
          )
      );
    } catch {
      return "";
    }
  };

const extractSuccessFactorsField =
  (
    plainText:
      string,
    label:
      string
  ): string => {
    const escaped =
      escapeRegExp(
        label
      );

    const match =
      plainText.match(
        new RegExp(
          `(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`,
          "i"
        )
      );

    return normalizeWhitespace(
      match?.[
        1
      ] ||
      ""
    );
  };

const extractSuccessFactorsJobHtml =
  (
    html:
      string
  ): string => {
    const classPatterns = [
      /<div[^>]*class=["'][^"']*jobdescription[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
      /<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
      /<div[^>]*id=["']jobDescriptionText["'][^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (
      const pattern
      of classPatterns
    ) {
      const match =
        html.match(
          pattern
        );

      if (
        match?.[
          1
        ]
      ) {
        return match[
          1
        ];
      }
    }

    /*
     * Fallback: parse the whole page. Existing section parsing
     * will still isolate Responsibilities / Requirements where
     * those headings are present.
     */
    return html;
  };

const parseSuccessFactorsDate =
  (
    value:
      string
  ): Date => {
    const parsed =
      new Date(
        value
      );

    return Number.isNaN(
      parsed.getTime()
    )
      ? new Date()
      : parsed;
  };

/* =========================================================
   LOCATION / QUERY FILTERING
========================================================= */

const normalizeSearchText = (
  value:
    string
): string => {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9+#.]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const matchesLocation = (
  job:
    IExternalJobRecord,
  location:
    string | undefined
): boolean => {
  const requestedRaw =
    normalizeWhitespace(
      location
    );

  const requested =
    normalizeSearchText(
      requestedRaw
    );

  if (
    !requested ||
    requested ===
      "remote" ||
    requested ===
      "any" ||
    requested ===
      "anywhere"
  ) {
    return true;
  }

  const jobLocation =
    normalizeSearchText(
      job.location ||
      ""
    );

  const isRequestedBoston =
    /\bboston\b/.test(
      requested
    );

  const isBostonOrMassachusetts =
    /\bboston\b/.test(
      jobLocation
    ) ||
    /\bmassachusetts\b/.test(
      jobLocation
    ) ||
    /\bma\b/.test(
      jobLocation
    );

  const isUsWide =
    /\bunited states\b/.test(
      jobLocation
    ) ||
    /\busa\b/.test(
      jobLocation
    ) ||
    /\bu s\b/.test(
      jobLocation
    ) ||
    /\bus remote\b/.test(
      jobLocation
    ) ||
    /\bremote us\b/.test(
      jobLocation
    ) ||
    /\bremote united states\b/.test(
      jobLocation
    );

  const isGlobalRemote =
    job.remoteType ===
      "remote" &&
    (
      !jobLocation ||
      jobLocation ===
        "remote" ||
      /\bworldwide\b/.test(
        jobLocation
      ) ||
      /\bglobal\b/.test(
        jobLocation
      ) ||
      /\banywhere\b/.test(
        jobLocation
      )
    );

  if (
    isRequestedBoston
  ) {
    if (
      isBostonOrMassachusetts
    ) {
      return true;
    }

    if (
      job.remoteType ===
        "remote" &&
      (
        isUsWide ||
        isGlobalRemote
      )
    ) {
      return true;
    }

    return false;
  }

  const requestedParts =
    requested
      .split(
        " "
      )
      .filter(
        (
          part
        ) =>
          part.length >=
          2
      );

  if (
    requestedParts.some(
      (
        part
      ) =>
        jobLocation.includes(
          part
        )
    )
  ) {
    return true;
  }

  if (
    job.remoteType ===
      "remote" &&
    (
      isUsWide ||
      isGlobalRemote
    )
  ) {
    return true;
  }

  return false;
};

/* =========================================================
   CACHE
========================================================= */

const getCachedBoard = (
  key:
    string
): IExternalJobRecord[] | null => {
  const cached =
    boardCache.get(
      key
    );

  if (
    !cached
  ) {
    return null;
  }

  if (
    cached.expiresAt <
    Date.now()
  ) {
    boardCache.delete(
      key
    );

    return null;
  }

  return cached.jobs;
};

const setCachedBoard = (
  key:
    string,
  jobs:
    IExternalJobRecord[]
): void => {
  boardCache.set(
    key,
    {
      expiresAt:
        Date.now() +
        BOARD_CACHE_TTL_MS,

      jobs,
    }
  );
};

/* =========================================================
   GREENHOUSE
========================================================= */

const fetchGreenhouseBoard =
  async (
    source:
      IAtsSource
  ): Promise<IExternalJobRecord[]> => {
    const cacheKey =
      `greenhouse:${source.slug}`;

    const cached =
      getCachedBoard(
        cacheKey
      );

    if (
      cached
    ) {
      return cached;
    }

    const url =
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
        source.slug
      )}/jobs?content=true`;

    const data =
      await fetchJsonWithTimeout<IGreenhouseResponse>(
        url
      );

    const jobs =
      (
        data.jobs ||
        []
      )
        .map(
          (
            raw
          ): IExternalJobRecord | null => {
            const externalId =
              String(
                raw.id ||
                ""
              );

            const title =
              normalizeWhitespace(
                raw.title
              );

            const externalUrl =
              normalizeWhitespace(
                raw.absolute_url
              );

            if (
              !externalId ||
              !title ||
              !externalUrl
            ) {
              return null;
            }

            const parsed =
              parseExternalDescription(
                raw.content ||
                ""
              );

            const description =
              parsed.description ||
              `${title} at ${source.company}.`;

            const location =
              normalizeWhitespace(
                raw.location
                  ?.name
              ) ||
              "Not specified";

            const skills =
              detectSkills(
                [
                  title,
                  description,
                  ...parsed.responsibilities,
                  ...parsed.requirements,
                ]
                  .join(
                    " "
                  )
              );

            const level =
              inferExperienceLevel(
                title,
                description
              );

            const experience =
              inferExperienceRange(
                description,
                level
              );

            const postedAtRaw =
              raw.first_published ||
              raw.updated_at;

            return {
              title,

              company:
                normalizeWhitespace(
                  raw.company_name
                ) ||
                source.company,

              location,

              remoteType:
                inferRemoteType(
                  title,
                  description,
                  location
                ),

              employmentType:
                inferEmploymentType(
                  undefined,
                  `${title} ${description}`
                ),

              experienceLevel:
                level,

              experienceMin:
                experience.min,

              experienceMax:
                experience.max,

              description,

              responsibilities:
                parsed.responsibilities,

              requirements:
                parsed.requirements,

              preferredQualifications:
                parsed.preferredQualifications,

              skills,

              keywords:
                buildKeywords(
                  title,
                  skills,
                  [
                    ...(
                      raw.departments ||
                      []
                    )
                      .map(
                        (
                          item
                        ) =>
                          item.name ||
                          ""
                      ),

                    ...(
                      raw.offices ||
                      []
                    )
                      .map(
                        (
                          item
                        ) =>
                          item.name ||
                          ""
                      ),
                  ]
                ),

              education:
                inferEducation(
                  description
                ),

              salary:
                0,

              salaryMin:
                undefined,

              salaryMax:
                undefined,

              salaryCurrency:
                undefined,

              salaryPeriod:
                "unknown",

              salaryIsPredicted:
                false,

              source:
                "Greenhouse",

              externalId,

              externalUrl,

              /*
               * Greenhouse absolute_url is the company's
               * actual hosted job page.
               */
              applyUrl:
                externalUrl,

              isActive:
                true,

              postedAt:
                postedAtRaw &&
                !Number.isNaN(
                  new Date(
                    postedAtRaw
                  ).getTime()
                )
                  ? new Date(
                      postedAtRaw
                    )
                  : new Date(),
            };
          }
        )
        .filter(
          (
            item
          ): item is IExternalJobRecord =>
            item !==
            null
        );

    setCachedBoard(
      cacheKey,
      jobs
    );

    return jobs;
  };

/* =========================================================
   LEVER
========================================================= */

const fetchLeverBoard =
  async (
    source:
      IAtsSource
  ): Promise<IExternalJobRecord[]> => {
    const cacheKey =
      `lever:${source.slug}`;

    const cached =
      getCachedBoard(
        cacheKey
      );

    if (
      cached
    ) {
      return cached;
    }

    const url =
      `https://api.lever.co/v0/postings/${encodeURIComponent(
        source.slug
      )}?mode=json`;

    const data =
      await fetchJsonWithTimeout<ILeverJob[]>(
        url
      );

    const jobs =
      (
        Array.isArray(
          data
        )
          ? data
          : []
      )
        .map(
          (
            raw
          ): IExternalJobRecord | null => {
            const externalId =
              normalizeWhitespace(
                raw.id
              );

            const title =
              normalizeWhitespace(
                raw.text
              );

            const externalUrl =
              normalizeWhitespace(
                raw.hostedUrl
              );

            const applyUrl =
              normalizeWhitespace(
                raw.applyUrl
              ) ||
              externalUrl;

            if (
              !externalId ||
              !title ||
              !externalUrl
            ) {
              return null;
            }

            const listText =
              (
                raw.lists ||
                []
              )
                .map(
                  (
                    list
                  ) =>
                    `${list.text || ""}\n${stripHtml(
                      list.content ||
                      ""
                    )}`
                )
                .join(
                  "\n"
                );

            const rawDescription =
              [
                raw.descriptionPlain,
                stripHtml(
                  raw.description ||
                  ""
                ),
                raw.additionalPlain,
                listText,
              ]
                .filter(
                  Boolean
                )
                .join(
                  "\n"
                );

            const parsed =
              parseExternalDescription(
                rawDescription
              );

            const description =
              parsed.description ||
              `${title} at ${source.company}.`;

            const location =
              normalizeWhitespace(
                raw.categories
                  ?.location
              ) ||
              normalizeWhitespace(
                raw.categories
                  ?.allLocations
                  ?.join(
                    ", "
                  )
              ) ||
              "Not specified";

            const skills =
              detectSkills(
                `${title} ${description}`
              );

            const level =
              inferExperienceLevel(
                title,
                description
              );

            const experience =
              inferExperienceRange(
                description,
                level
              );

            return {
              title,

              company:
                source.company,

              location,

              remoteType:
                inferRemoteType(
                  title,
                  description,
                  location
                ),

              employmentType:
                inferEmploymentType(
                  raw.categories
                    ?.commitment,
                  `${title} ${description}`
                ),

              experienceLevel:
                level,

              experienceMin:
                experience.min,

              experienceMax:
                experience.max,

              description,

              responsibilities:
                parsed.responsibilities,

              requirements:
                parsed.requirements,

              preferredQualifications:
                parsed.preferredQualifications,

              skills,

              keywords:
                buildKeywords(
                  title,
                  skills,
                  [
                    raw.categories
                      ?.department ||
                    "",

                    raw.categories
                      ?.team ||
                    "",

                    raw.categories
                      ?.commitment ||
                    "",
                  ]
                ),

              education:
                inferEducation(
                  description
                ),

              salary:
                0,

              salaryMin:
                undefined,

              salaryMax:
                undefined,

              salaryCurrency:
                undefined,

              salaryPeriod:
                "unknown",

              salaryIsPredicted:
                false,

              source:
                "Lever",

              externalId,

              externalUrl,

              /*
               * Lever gives an actual hosted apply URL.
               */
              applyUrl,

              isActive:
                true,

              postedAt:
                typeof raw.createdAt ===
                  "number" &&
                Number.isFinite(
                  raw.createdAt
                )
                  ? new Date(
                      raw.createdAt
                    )
                  : new Date(),
            };
          }
        )
        .filter(
          (
            item
          ): item is IExternalJobRecord =>
            item !==
            null
        );

    setCachedBoard(
      cacheKey,
      jobs
    );

    return jobs;
  };

/* =========================================================
   ASHBY
========================================================= */

const fetchAshbyBoard =
  async (
    source:
      IAtsSource
  ): Promise<IExternalJobRecord[]> => {
    const cacheKey =
      `ashby:${source.slug}`;

    const cached =
      getCachedBoard(
        cacheKey
      );

    if (
      cached
    ) {
      return cached;
    }

    const url =
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
        source.slug
      )}?includeCompensation=true`;

    const data =
      await fetchJsonWithTimeout<IAshbyResponse>(
        url
      );

    const jobs =
      (
        data.jobs ||
        []
      )
        .filter(
          (
            raw
          ) =>
            raw.isListed !==
            false
        )
        .map(
          (
            raw,
            index
          ): IExternalJobRecord | null => {
            const title =
              normalizeWhitespace(
                raw.title
              );

            const externalUrl =
              normalizeWhitespace(
                raw.jobUrl
              );

            const applyUrl =
              normalizeWhitespace(
                raw.applyUrl
              ) ||
              externalUrl;

            if (
              !title ||
              !externalUrl
            ) {
              return null;
            }

            const externalId =
              `${source.slug}-${index}-${title}`
                .toLowerCase()
                .replace(
                  /[^a-z0-9]+/g,
                  "-"
                )
                .replace(
                  /^-+|-+$/g,
                  ""
                );

            const description =
              normalizeWhitespace(
                raw.descriptionPlain
              ) ||
              stripHtml(
                raw.descriptionHtml ||
                ""
              ) ||
              `${title} at ${source.company}.`;

            const parsed =
              parseExternalDescription(
                description
              );

            const secondaryLocations =
              (
                raw.secondaryLocations ||
                []
              )
                .map(
                  (
                    item
                  ) =>
                    item.location ||
                    ""
                );

            const location =
              uniqueStrings([
                raw.location ||
                  "",
                ...secondaryLocations,
              ])
                .join(
                  " / "
                ) ||
              "Not specified";

            const skills =
              detectSkills(
                [
                  title,
                  parsed.description,
                  ...parsed.responsibilities,
                  ...parsed.requirements,
                ]
                  .join(
                    " "
                  )
              );

            const level =
              inferExperienceLevel(
                title,
                parsed.description
              );

            const experience =
              inferExperienceRange(
                parsed.description,
                level
              );

            const salaryData =
              parseAshbySalary(
                raw.compensation
              );

            return {
              title,

              company:
                source.company,

              location,

              remoteType:
                inferRemoteType(
                  title,
                  parsed.description,
                  location,
                  raw.workplaceType,
                  raw.isRemote
                ),

              employmentType:
                inferEmploymentType(
                  raw.employmentType,
                  `${title} ${parsed.description}`
                ),

              experienceLevel:
                level,

              experienceMin:
                experience.min,

              experienceMax:
                experience.max,

              description:
                parsed.description,

              responsibilities:
                parsed.responsibilities,

              requirements:
                parsed.requirements,

              preferredQualifications:
                parsed.preferredQualifications,

              skills,

              keywords:
                buildKeywords(
                  title,
                  skills,
                  [
                    raw.department ||
                    "",

                    raw.team ||
                    "",

                    raw.workplaceType ||
                    "",
                  ]
                ),

              education:
                inferEducation(
                  parsed.description
                ),

              salary:
                salaryData.salary,

              salaryMin:
                salaryData.salaryMin,

              salaryMax:
                salaryData.salaryMax,

              salaryCurrency:
                salaryData.salaryCurrency,

              salaryPeriod:
                salaryData.salaryPeriod,

              salaryIsPredicted:
                false,

              source:
                "Ashby",

              externalId,

              externalUrl,

              /*
               * Ashby exposes a dedicated application URL.
               */
              applyUrl,

              isActive:
                true,

              postedAt:
                raw.publishedAt &&
                !Number.isNaN(
                  new Date(
                    raw.publishedAt
                  ).getTime()
                )
                  ? new Date(
                      raw.publishedAt
                    )
                  : new Date(),
            };
          }
        )
        .filter(
          (
            item
          ): item is IExternalJobRecord =>
            item !==
            null
        );

    setCachedBoard(
      cacheKey,
      jobs
    );

    return jobs;
  };

/* =========================================================
   SUCCESSFACTORS

   Initial supported source:
   - Azercell Telecom LLC
   - https://careers.azercell.com

   We intentionally use the public career pages instead of a
   private/internal SAP API. This keeps the integration simple
   and avoids depending on undocumented authentication flows.
========================================================= */

const fetchSuccessFactorsBoard =
  async (
    source:
      IAtsSource
  ): Promise<IExternalJobRecord[]> => {
    const cacheKey =
      `successfactors:${source.slug}`;

    const cached =
      getCachedBoard(
        cacheKey
      );

    if (
      cached
    ) {
      return cached;
    }

    const baseUrl =
      getSuccessFactorsBaseUrl(
        source
      );

    const discoveredLinks:
      string[] =
      [];

    const seenLinks =
      new Set<string>();

    /*
     * Legacy pagination constants are declared BEFORE provider
     * discovery so they can safely be reused by both the new
     * provider and the existing fallback logic.
     */
    const PAGE_STEP =
      10;

    const MAX_PAGES =
      30;

    /*
     * =======================================================
     * PROVIDER-SPECIFIC DISCOVERY
     * =======================================================
     *
     * Routing strategy:
     *
     * 1. Azercell Telecom LLC
     *    -> dedicated azercellJobProvider.ts
     *
     * 2. Other SuccessFactors companies
     *    -> generic successFactorsJobProvider.ts
     *
     * 3. If provider discovery still returns no links
     *    -> keep the existing legacy tile/search/home logic
     *       below as the final compatibility fallback.
     *
     * Nothing from the global Greenhouse / Lever / Ashby flow
     * is changed here.
     */
    const normalizedCompanyName =
      normalizeWhitespace(
        source.company
      )
        .toLowerCase();

    const normalizedCareersUrl =
      normalizeWhitespace(
        source.careersUrl
      )
        .toLowerCase();

    const isAzercellSource =
      normalizedCompanyName.includes(
        "azercell"
      ) ||
      normalizedCareersUrl.includes(
        "careers.azercell.com"
      );

    if (
      isAzercellSource
    ) {
      /*
       * -------------------------------------------------------
       * AZERCELL CUSTOM PROVIDER
       * -------------------------------------------------------
       *
       * Azercell's SuccessFactors search shell currently does
       * not expose vacancy URLs to our plain Node listing fetch.
       * The dedicated adapter starts from verified public job
       * pages and crawls same-domain /job/ links.
       */
      try {
        const azercellDiscovery =
          await discoverAzercellJobUrls({
            careersUrl:
              normalizeWhitespace(
                source.careersUrl
              ) ||
              baseUrl,

            requestTimeoutMs:
              REQUEST_TIMEOUT_MS,

            maxPages:
              80,
          });

        console.log(
          "[SUCCESSFACTORS] Azercell provider discovery:",
          {
            company:
              source.company,

            baseUrl,

            discovered:
              azercellDiscovery.urls.length,

            diagnostics:
              azercellDiscovery.diagnostics,
          }
        );

        for (
          const link
          of azercellDiscovery.urls
        ) {
          if (
            seenLinks.has(
              link
            )
          ) {
            continue;
          }

          seenLinks.add(
            link
          );

          discoveredLinks.push(
            link
          );
        }
      } catch (
        error
      ) {
        console.warn(
          "[SUCCESSFACTORS] Azercell provider failed:",
          {
            company:
              source.company,

            baseUrl,

            error:
              error instanceof
                Error
                ? error.message
                : error,
          }
        );
      }

      /*
       * If the Azercell-specific adapter found nothing, still
       * try the generic SuccessFactors provider before falling
       * through to the legacy discovery code below.
       */
      if (
        discoveredLinks.length ===
          0
      ) {
        try {
          const genericDiscovery =
            await discoverSuccessFactorsJobUrls({
              careersUrl:
                normalizeWhitespace(
                  source.careersUrl
                ) ||
                baseUrl,

              companyName:
                source.company,

              maxPages:
                MAX_PAGES,

              requestTimeoutMs:
                REQUEST_TIMEOUT_MS,
            });

          console.log(
            "[SUCCESSFACTORS] Generic fallback after Azercell provider:",
            {
              company:
                source.company,

              baseUrl,

              method:
                genericDiscovery.discoveryMethod,

              discovered:
                genericDiscovery.urls.length,

              diagnostics:
                genericDiscovery.diagnostics,
            }
          );

          for (
            const link
            of genericDiscovery.urls
          ) {
            if (
              seenLinks.has(
                link
              )
            ) {
              continue;
            }

            seenLinks.add(
              link
            );

            discoveredLinks.push(
              link
            );
          }
        } catch (
          error
        ) {
          console.warn(
            "[SUCCESSFACTORS] Generic fallback after Azercell provider failed:",
            {
              company:
                source.company,

              baseUrl,

              error:
                error instanceof
                  Error
                  ? error.message
                  : error,
            }
          );
        }
      }
    } else {
      /*
       * -------------------------------------------------------
       * GENERIC SUCCESSFACTORS PROVIDER
       * -------------------------------------------------------
       */
      try {
        const providerDiscovery =
          await discoverSuccessFactorsJobUrls({
            careersUrl:
              normalizeWhitespace(
                source.careersUrl
              ) ||
              baseUrl,

            companyName:
              source.company,

            maxPages:
              MAX_PAGES,

            requestTimeoutMs:
              REQUEST_TIMEOUT_MS,
          });

        console.log(
          "[SUCCESSFACTORS] Provider discovery:",
          {
            company:
              source.company,

            baseUrl,

            method:
              providerDiscovery.discoveryMethod,

            discovered:
              providerDiscovery.urls.length,

            diagnostics:
              providerDiscovery.diagnostics,
          }
        );

        for (
          const link
          of providerDiscovery.urls
        ) {
          if (
            seenLinks.has(
              link
            )
          ) {
            continue;
          }

          seenLinks.add(
            link
          );

          discoveredLinks.push(
            link
          );
        }
      } catch (
        error
      ) {
        /*
         * Provider failure must never break the existing legacy
         * SuccessFactors fallback logic below.
         */
        console.warn(
          "[SUCCESSFACTORS] Provider discovery failed; continuing with legacy discovery:",
          {
            company:
              source.company,

            baseUrl,

            error:
              error instanceof
                Error
                ? error.message
                : error,
          }
        );
      }
    }

    /*
     * SAP SuccessFactors Recruiting Marketing (RMK) career sites
     * expose their public search result cards through the
     * no-auth tile fragment:
     *
     *   /tile-search-results/?startrow=N
     *
     * The normal /search/ page may contain only the shell and
     * JavaScript, which is exactly why Azercell previously gave:
     *
     *   discovered: 0
     *   parsed: 0
     *
     * Use the tile endpoint first and keep /search/ + homepage
     * only as compatibility fallbacks.
     */
    let successfulListingRequests =
      0;

    let tileEndpointWorked =
      false;

    for (
      let pageIndex =
        0;
      pageIndex <
        MAX_PAGES;
      pageIndex +=
        1
    ) {
      const startRow =
        pageIndex *
        PAGE_STEP;

      const tileUrl =
        `${baseUrl}/tile-search-results/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${startRow}`;

      let listingHtml =
        "";

      try {
        listingHtml =
          await fetchTextWithTimeout(
            tileUrl
          );

        successfulListingRequests +=
          1;

        tileEndpointWorked =
          true;
      } catch (
        error
      ) {
        /*
         * If page 0 fails, we still try the older /search/
         * compatibility route below.
         *
         * If later pages fail, preserve already-discovered jobs.
         */
        console.warn(
          "[SUCCESSFACTORS] Tile page failed:",
          {
            company:
              source.company,

            pageIndex,

            startRow,

            url:
              tileUrl,

            error:
              error instanceof
                Error
                ? error.message
                : error,
          }
        );

        if (
          pageIndex ===
            0
        ) {
          break;
        }

        break;
      }

      const pageLinks =
        extractSuccessFactorsJobLinks(
          listingHtml,
          baseUrl
        );

      let newLinks =
        0;

      for (
        const link
        of pageLinks
      ) {
        if (
          seenLinks.has(
            link
          )
        ) {
          continue;
        }

        seenLinks.add(
          link
        );

        discoveredLinks.push(
          link
        );

        newLinks +=
          1;
      }

      console.log(
        "[SUCCESSFACTORS] Tile page:",
        {
          company:
            source.company,

          pageIndex,

          startRow,

          links:
            pageLinks.length,

          newLinks,

          discovered:
            discoveredLinks.length,
        }
      );

      /*
       * RMK returns an empty fragment after the last page.
       *
       * Some tenants repeat the last page for out-of-range
       * startrow values; newLinks === 0 protects us from that.
       */
      if (
        pageLinks.length ===
          0 ||
        (
          pageIndex >
            0 &&
          newLinks ===
            0
        )
      ) {
        break;
      }
    }

    /*
     * Compatibility fallback.
     *
     * Older/custom RMK themes can render actual result links in
     * /search/. Try this only if the preferred tile endpoint
     * produced no jobs.
     */
    if (
      discoveredLinks.length ===
        0
    ) {
      const fallbackUrls = [
        `${baseUrl}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=0`,
        `${baseUrl}/search/?q=`,
        baseUrl,
      ];

      for (
        const fallbackUrl
        of fallbackUrls
      ) {
        try {
          const html =
            await fetchTextWithTimeout(
              fallbackUrl
            );

          successfulListingRequests +=
            1;

          const links =
            extractSuccessFactorsJobLinks(
              html,
              baseUrl
            );

          for (
            const link
            of links
          ) {
            if (
              seenLinks.has(
                link
              )
            ) {
              continue;
            }

            seenLinks.add(
              link
            );

            discoveredLinks.push(
              link
            );
          }

          console.log(
            "[SUCCESSFACTORS] Fallback discovery:",
            {
              company:
                source.company,

              url:
                fallbackUrl,

              found:
                links.length,

              discovered:
                discoveredLinks.length,
            }
          );

          if (
            discoveredLinks.length >
              0
          ) {
            break;
          }
        } catch (
          error
        ) {
          console.warn(
            "[SUCCESSFACTORS] Fallback page failed:",
            {
              company:
                source.company,

              url:
                fallbackUrl,

              error:
                error instanceof
                  Error
                  ? error.message
                  : error,
            }
          );
        }
      }
    }

    /*
     * A listing endpoint answered successfully but still gave no
     * links. Do not throw here: this can legitimately mean zero
     * current vacancies.
     *
     * If every listing request failed, surface a real board
     * failure so the ATS registry can track it.
     */
    if (
      successfulListingRequests ===
        0
    ) {
      throw new Error(
        `SuccessFactors listing pages could not be loaded for ${source.company}.`
      );
    }

    const jobPages =
      await runWithConcurrency(
        discoveredLinks,
        async (
          externalUrl
        ): Promise<IExternalJobRecord | null> => {
          try {
            const html =
              await fetchTextWithTimeout(
                externalUrl
              );

            const title =
              extractSuccessFactorsTitle(
                html,
                externalUrl
              );

            const externalId =
              extractSuccessFactorsExternalId(
                externalUrl
              );

            if (
              !title ||
              !externalId
            ) {
              return null;
            }

            const jobHtml =
              extractSuccessFactorsJobHtml(
                html
              );

            const parsed =
              parseExternalDescription(
                jobHtml
              );

            const fullPlainText =
              stripHtml(
                html
              );

            const description =
              parsed.description ||
              normalizeWhitespace(
                stripHtml(
                  jobHtml
                )
              )
                .slice(
                  0,
                  MAX_DESCRIPTION_LENGTH
                ) ||
              `${title} at ${source.company}.`;

            const location =
              extractSuccessFactorsField(
                fullPlainText,
                "Location"
              ) ||
              (
                /\bBaku\b/i.test(
                  `${title} ${fullPlainText}`
                )
                  ? "Baku, AZ"
                  : "Azerbaijan"
              );

            const company =
              extractSuccessFactorsField(
                fullPlainText,
                "Company"
              ) ||
              source.company;

            const postedDate =
              extractSuccessFactorsField(
                fullPlainText,
                "Date"
              );

            const skills =
              detectSkills(
                [
                  title,
                  description,
                  ...parsed.responsibilities,
                  ...parsed.requirements,
                  ...parsed.preferredQualifications,
                ]
                  .join(
                    " "
                  )
              );

            const level =
              inferExperienceLevel(
                title,
                description
              );

            const experience =
              inferExperienceRange(
                description,
                level
              );

            return {
              title,

              company,

              location,

              remoteType:
                inferRemoteType(
                  title,
                  description,
                  location
                ),

              employmentType:
                inferEmploymentType(
                  undefined,
                  `${title} ${description}`
                ),

              experienceLevel:
                level,

              experienceMin:
                experience.min,

              experienceMax:
                experience.max,

              description,

              responsibilities:
                parsed.responsibilities,

              requirements:
                parsed.requirements,

              preferredQualifications:
                parsed.preferredQualifications,

              skills,

              keywords:
                buildKeywords(
                  title,
                  skills,
                  [
                    "Azerbaijan",
                    "Baku",
                    source.company,
                    "SuccessFactors",
                  ]
                ),

              education:
                inferEducation(
                  description
                ),

              salary:
                0,

              salaryMin:
                undefined,

              salaryMax:
                undefined,

              salaryCurrency:
                undefined,

              salaryPeriod:
                "unknown",

              salaryIsPredicted:
                false,

              source:
                "SuccessFactors",

              externalId,

              externalUrl,

              applyUrl:
                externalUrl,

              isActive:
                true,

              postedAt:
                parseSuccessFactorsDate(
                  postedDate
                ),
            };
          } catch (
            error
          ) {
            console.warn(
              "[SUCCESSFACTORS] Job page failed:",
              {
                company:
                  source.company,

                url:
                  externalUrl,

                error:
                  error instanceof
                    Error
                    ? error.message
                    : error,
              }
            );

            return null;
          }
        },
        Math.min(
          5,
          ATS_FETCH_CONCURRENCY
        )
      );

    const jobs =
      jobPages.filter(
        (
          item
        ): item is IExternalJobRecord =>
          item !==
          null
      );

    console.log(
      "[SUCCESSFACTORS] Board loaded:",
      {
        company:
          source.company,

        baseUrl,

        discoveryMode:
          tileEndpointWorked
            ? "tile-search-results"
            : "fallback",

        discovered:
          discoveredLinks.length,

        parsed:
          jobs.length,
      }
    );

    setCachedBoard(
      cacheKey,
      jobs
    );

    return jobs;
  };

/* =========================================================
   ATS FETCH HELPERS
========================================================= */

const getBoardCacheKeyForSource = (
  source:
    IAtsSource
): string => {
  return `${source.provider}:${source.slug}`;
};

const runWithConcurrency =
  async <T, TResult>(
    items:
      T[],
    worker:
      (
        item: T,
        index: number
      ) => Promise<TResult>,
    concurrency:
      number
  ): Promise<TResult[]> => {
    const results =
      new Array<TResult>(
        items.length
      );

    let cursor =
      0;

    const workers =
      Array.from({
        length:
          Math.max(
            1,
            Math.min(
              concurrency,
              items.length
            )
          ),
      }).map(
        async () => {
          while (
            true
          ) {
            const index =
              cursor++;

            if (
              index >=
              items.length
            ) {
              return;
            }

            results[
              index
            ] =
              await worker(
                items[
                  index
                ],
                index
              );
          }
        }
      );

    await Promise.all(
      workers
    );

    return results;
  };

/* =========================================================
   BIR CAREERS / KAPITAL BANK

   This source is intentionally additive and independent from
   the MongoDB ATS registry because careers.bir.az is a custom
   careers site rather than Greenhouse / Lever / Ashby /
   SuccessFactors.

   The provider discovers the live vacancy list, opens each
   detail page, and returns structured vacancy data.
========================================================= */

const normalizeBirExperienceLevel = (
  job:
    IBirCareersJob
): JobExperienceLevel => {
  const explicit =
    normalizeWhitespace(
      job.experienceLevel
    )
      .toLowerCase();

  if (
    /\b(manager|lead|head|senior|principal|director)\b/i.test(
      explicit
    )
  ) {
    return "senior";
  }

  if (
    /\b(mid|middle|specialist|professional)\b/i.test(
      explicit
    )
  ) {
    return "mid";
  }

  if (
    /\b(junior|jr|entry|graduate|intern)\b/i.test(
      explicit
    )
  ) {
    return "junior";
  }

  return inferExperienceLevel(
    job.title,
    `${job.description} ${job.requirements.join(" ")}`
  );
};

const mapBirCareersJob =
  (
    job:
      IBirCareersJob
  ): IExternalJobRecord => {
    const description =
      normalizeWhitespace(
        job.description ||
        job.summary
      );

    const level =
      normalizeBirExperienceLevel(
        job
      );

    const experience =
      inferExperienceRange(
        `${description} ${job.requirements.join(" ")}`,
        level
      );

    const skills =
      uniqueStrings(
        job.skills.length >
          0
          ? job.skills
          : detectSkills(
              [
                job.title,
                description,
                ...job.requirements,
                ...job.responsibilities,
              ].join(" ")
            )
      );

    const location =
      normalizeWhitespace(
        job.location
      ) ||
      "Azerbaijan";

    const salaryMin =
      typeof job.salaryMin ===
        "number"
        ? job.salaryMin
        : undefined;

    const salaryMax =
      typeof job.salaryMax ===
        "number"
        ? job.salaryMax
        : undefined;

    const salary =
      salaryMax ??
      salaryMin ??
      0;

    const postedAt =
      job.postedAt &&
      !Number.isNaN(
        new Date(
          job.postedAt
        ).getTime()
      )
        ? new Date(
            job.postedAt
          )
        : new Date();

    const explicitWorkMode =
      normalizeWhitespace(
        job.workMode
      );

    const remoteType =
      inferRemoteType(
        job.title,
        description,
        location,
        explicitWorkMode ||
          undefined,
        explicitWorkMode
          .toLowerCase() ===
          "remote"
      );

    const company =
      normalizeWhitespace(
        job.company
      ) ||
      "Kapital Bank / Bir";

    const brand =
      normalizeWhitespace(
        job.brand
      );

    const deadlineText =
      normalizeWhitespace(
        job.deadline
      );

    const benefitsText =
      uniqueStrings(
        job.benefits
      );

    /*
     * IJob currently has no dedicated brand / deadline /
     * benefits fields. Preserve those useful details inside
     * keywords and preferredQualifications without changing
     * the Job model schema.
     */
    const preferredQualifications =
      uniqueStrings([
        ...benefitsText,
      ]);

    return {
      title:
        job.title,

      company,

      location,

      remoteType,

      employmentType:
        inferEmploymentType(
          job.employmentType ||
            undefined,
          `${job.title} ${description}`
        ),

      experienceLevel:
        level,

      experienceMin:
        experience.min,

      experienceMax:
        experience.max,

      description,

      responsibilities:
        uniqueStrings(
          job.responsibilities
        ),

      requirements:
        uniqueStrings(
          job.requirements
        ),

      preferredQualifications,

      skills,

      keywords:
        buildKeywords(
          job.title,
          skills,
          [
            "Azerbaijan",
            location,
            company,
            brand,
            "Bir Careers",
            deadlineText
              ? `Deadline ${deadlineText}`
              : "",
          ]
        ),

      education:
        inferEducation(
          `${description} ${job.requirements.join(" ")}`
        ),

      salary,

      salaryMin,

      salaryMax,

      salaryCurrency:
        job.salaryCurrency ||
        undefined,

      salaryPeriod:
        salary >
          0
          ? "unknown"
          : "unknown",

      salaryIsPredicted:
        false,

      source:
        "Bir Careers",

      externalId:
        `bir:${job.externalId}`,

      externalUrl:
        job.url,

      applyUrl:
        job.applyUrl ||
        job.url,

      isActive:
        true,

      postedAt,
    };
  };

const fetchBirCareersBoard =
  async (): Promise<IExternalJobRecord[]> => {
    const cacheKey =
      "bircareers:https://careers.bir.az/vacancies";

    const cached =
      getCachedBoard(
        cacheKey
      );

    if (
      cached
    ) {
      return cached;
    }

    try {
      const discovery =
        await discoverBirCareersJobs({
          careersUrl:
            "https://careers.bir.az/vacancies",

          requestTimeoutMs:
            30_000,

          maxJobs:
            150,

          headless:
            true,

          detailConcurrency:
            4,
        });

      const jobs =
        discovery.jobs.map(
          mapBirCareersJob
        );

      setCachedBoard(
        cacheKey,
        jobs
      );

      console.log(
        "[BIR CAREERS] Board loaded:",
        {
          discovered:
            discovery.urls.length,

          parsed:
            discovery.jobs.length,

          accepted:
            discovery.diagnostics
              .acceptedJobs,

          rejected:
            discovery.diagnostics
              .rejectedJobs,

          errors:
            discovery.diagnostics
              .errors.length,

          returned:
            jobs.length,
        }
      );

      return jobs;
    } catch (
      error
    ) {
      console.warn(
        "[BIR CAREERS] Board failed:",
        {
          error:
            error instanceof
              Error
              ? error.message
              : error,
        }
      );

      return [];
    }
  };

/* =========================================================
   FETCH ONE BOARD
========================================================= */

const fetchAtsBoard =
  async (
    source:
      IAtsSource
  ): Promise<IExternalJobRecord[]> => {
    switch (
      source.provider
    ) {
      case "greenhouse":
        return fetchGreenhouseBoard(
          source
        );

      case "lever":
        return fetchLeverBoard(
          source
        );

      case "ashby":
        return fetchAshbyBoard(
          source
        );

      case "successfactors":
        return fetchSuccessFactorsBoard(
          source
        );

      default:
        return [];
    }
  };

/* =========================================================
   ALL ATS JOBS

   MongoDB registry -> 30-60 company boards -> ATS APIs.

   Related-role queries share:
   - the same selected source set
   - the same board cache

   Therefore one Career Automation search cycle can evaluate
   a broad company pool without downloading every board again
   for React / JavaScript / TypeScript / etc. queries.
========================================================= */

const fetchRegisteredAtsJobs =
  async (
    providers:
      AtsProvider[] = [
        "greenhouse",
        "lever",
        "ashby",
        "successfactors",
      ]
  ): Promise<IExternalJobRecord[]> => {
    const sources =
      await buildAtsSources(
        providers
      );

    const providerStats:
      Record<
        AtsProvider,
        {
          boards: number;
          successfulBoards: number;
          failedBoards: number;
          cachedBoards: number;
          jobs: number;
        }
      > = {
        greenhouse: {
          boards: 0,
          successfulBoards: 0,
          failedBoards: 0,
          cachedBoards: 0,
          jobs: 0,
        },

        lever: {
          boards: 0,
          successfulBoards: 0,
          failedBoards: 0,
          cachedBoards: 0,
          jobs: 0,
        },

        ashby: {
          boards: 0,
          successfulBoards: 0,
          failedBoards: 0,
          cachedBoards: 0,
          jobs: 0,
        },

        successfactors: {
          boards: 0,
          successfulBoards: 0,
          failedBoards: 0,
          cachedBoards: 0,
          jobs: 0,
        },
      };

    for (
      const source of
      sources
    ) {
      providerStats[
        source.provider
      ].boards +=
        1;
    }

    const results =
      await runWithConcurrency(
        sources,
        async (
          source
        ): Promise<IExternalJobRecord[]> => {
          const cacheKey =
            getBoardCacheKeyForSource(
              source
            );

          const wasCached =
            getCachedBoard(
              cacheKey
            ) !==
            null;

          try {
            const jobs =
              await fetchAtsBoard(
                source
              );

            providerStats[
              source.provider
            ].successfulBoards +=
              1;

            providerStats[
              source.provider
            ].jobs +=
              jobs.length;

            if (
              wasCached
            ) {
              providerStats[
                source.provider
              ].cachedBoards +=
                1;
            }

            /*
             * Only update registry health when a real network
             * fetch happened. Related-role queries often reuse
             * cached boards and should not generate dozens of
             * redundant MongoDB writes.
             */
            if (
              source.companyId &&
              !wasCached
            ) {
              try {
                await markATSCompanyFetchSuccess({
                  companyId:
                    source.companyId,

                  jobCount:
                    jobs.length,
                });
              } catch (
                healthError
              ) {
                console.warn(
                  "[ATS JOBS] Could not update company success health:",
                  {
                    company:
                      source.company,

                    provider:
                      source.provider,

                    error:
                      healthError instanceof
                        Error
                        ? healthError.message
                        : healthError,
                  }
                );
              }
            }

            console.log(
              "[ATS JOBS] Board loaded:",
              {
                provider:
                  source.provider,

                company:
                  source.company,

                slug:
                  source.slug,

                count:
                  jobs.length,

                cached:
                  wasCached,
              }
            );

            return jobs;
          } catch (
            error
          ) {
            providerStats[
              source.provider
            ].failedBoards +=
              1;

            if (
              source.companyId &&
              !wasCached
            ) {
              try {
                await markATSCompanyFetchFailure(
                  source.companyId
                );
              } catch (
                healthError
              ) {
                console.warn(
                  "[ATS JOBS] Could not update company failure health:",
                  {
                    company:
                      source.company,

                    provider:
                      source.provider,

                    error:
                      healthError instanceof
                        Error
                        ? healthError.message
                        : healthError,
                  }
                );
              }
            }

            console.warn(
              "[ATS JOBS] Board failed:",
              {
                provider:
                  source.provider,

                company:
                  source.company,

                slug:
                  source.slug,

                cached:
                  wasCached,

                error:
                  error instanceof
                    Error
                    ? error.message
                    : error,
              }
            );

            return [];
          }
        },
        ATS_FETCH_CONCURRENCY
      );

    const jobs =
      results.flat();

    console.log(
      "[ATS JOBS] Provider summary:",
      {
        greenhouse:
          providerStats.greenhouse,

        lever:
          providerStats.lever,

        ashby:
          providerStats.ashby,

        successfactors:
          providerStats.successfactors,

        totalBoards:
          sources.length,

        totalJobs:
          jobs.length,

        registryMode:
          "mongodb",

        minimumCompanyTarget:
          ATS_SEARCH_MINIMUM_COMPANIES,

        maximumCompanyTarget:
          ATS_SEARCH_MAXIMUM_COMPANIES,
      }
    );

    return jobs;
  };

/*
 * Combined external vacancy pool.
 *
 * Registered ATS companies and Bir Careers are fetched in
 * parallel. A Bir Careers failure never removes or blocks the
 * Greenhouse / Lever / Ashby / SuccessFactors results.
 */
const fetchAllAtsJobs =
  async (
    providers:
      AtsProvider[] = [
        "greenhouse",
        "lever",
        "ashby",
        "successfactors",
      ]
  ): Promise<IExternalJobRecord[]> => {
    const [
      registeredJobs,
      birCareersJobs,
    ] =
      await Promise.all([
        fetchRegisteredAtsJobs(
          providers
        ),

        fetchBirCareersBoard(),
      ]);

    const jobs = [
      ...registeredJobs,
      ...birCareersJobs,
    ];

    console.log(
      "[EXTERNAL JOBS] Combined provider pool:",
      {
        registeredAtsJobs:
          registeredJobs.length,

        birCareersJobs:
          birCareersJobs.length,

        totalJobs:
          jobs.length,
      }
    );

    return jobs;
  };

/* =========================================================
   DEDUPLICATION
========================================================= */

const deduplicateJobs = (
  jobs:
    IExternalJobRecord[]
): IExternalJobRecord[] => {
  const seenExternal =
    new Set<string>();

  const seenSemantic =
    new Set<string>();

  const result:
    IExternalJobRecord[] =
    [];

  for (
    const job of
    jobs
  ) {
    const externalKey =
      `${job.source}:${job.externalId}`;

    if (
      seenExternal.has(
        externalKey
      )
    ) {
      continue;
    }

    const semanticKey =
      [
        normalizeSearchText(
          job.title
        ),

        normalizeSearchText(
          job.company
        ),

        normalizeSearchText(
          job.location
        ),
      ]
        .join(
          "|"
        );

    if (
      seenSemantic.has(
        semanticKey
      )
    ) {
      continue;
    }

    seenExternal.add(
      externalKey
    );

    seenSemantic.add(
      semanticKey
    );

    result.push(
      job
    );
  }

  return result;
};

/* =========================================================
   EXPORTED SOURCE FUNCTIONS
========================================================= */

export const fetchGreenhouseJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    const sources =
      await buildAtsSources(
        [
          "greenhouse",
        ],
        {
          minimumCompanies:
            30,

          maximumCompanies:
            60,
        }
      );

    const jobs =
      (
        await runWithConcurrency(
          sources,
          async (
            source
          ) => {
            try {
              return await fetchGreenhouseBoard(
                source
              );
            } catch (
              error
            ) {
              console.warn(
                "[ATS JOBS] Provider-specific board failed:",
                {
                  provider:
                    source.provider,

                  company:
                    source.company,

                  slug:
                    source.slug,

                  error:
                    error instanceof
                      Error
                      ? error.message
                      : error,
                }
              );

              return [];
            }
          },
          ATS_FETCH_CONCURRENCY
        )
      ).flat();

    return deduplicateJobs(
      jobs
        .filter(
          (
            job
          ) =>
            matchesJobSearchQuery(
              job.title,
              params.query
            ) &&
            matchesLocation(
              job,
              params.location
            )
        )
    )
      .slice(
        0,
        params.limit ||
        DEFAULT_LIMIT
      );
  };

export const fetchLeverJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    const sources =
      await buildAtsSources(
        [
          "lever",
        ],
        {
          minimumCompanies:
            30,

          maximumCompanies:
            60,
        }
      );

    const jobs =
      (
        await runWithConcurrency(
          sources,
          async (
            source
          ) => {
            try {
              return await fetchLeverBoard(
                source
              );
            } catch (
              error
            ) {
              console.warn(
                "[ATS JOBS] Provider-specific board failed:",
                {
                  provider:
                    source.provider,

                  company:
                    source.company,

                  slug:
                    source.slug,

                  error:
                    error instanceof
                      Error
                      ? error.message
                      : error,
                }
              );

              return [];
            }
          },
          ATS_FETCH_CONCURRENCY
        )
      ).flat();

    return deduplicateJobs(
      jobs
        .filter(
          (
            job
          ) =>
            matchesJobSearchQuery(
              job.title,
              params.query
            ) &&
            matchesLocation(
              job,
              params.location
            )
        )
    )
      .slice(
        0,
        params.limit ||
        DEFAULT_LIMIT
      );
  };

export const fetchAshbyJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    const sources =
      await buildAtsSources(
        [
          "ashby",
        ],
        {
          minimumCompanies:
            30,

          maximumCompanies:
            60,
        }
      );

    const jobs =
      (
        await runWithConcurrency(
          sources,
          async (
            source
          ) => {
            try {
              return await fetchAshbyBoard(
                source
              );
            } catch (
              error
            ) {
              console.warn(
                "[ATS JOBS] Provider-specific board failed:",
                {
                  provider:
                    source.provider,

                  company:
                    source.company,

                  slug:
                    source.slug,

                  error:
                    error instanceof
                      Error
                      ? error.message
                      : error,
                }
              );

              return [];
            }
          },
          ATS_FETCH_CONCURRENCY
        )
      ).flat();

    return deduplicateJobs(
      jobs
        .filter(
          (
            job
          ) =>
            matchesJobSearchQuery(
              job.title,
              params.query
            ) &&
            matchesLocation(
              job,
              params.location
            )
        )
    )
      .slice(
        0,
        params.limit ||
        DEFAULT_LIMIT
      );
  };

const matchesOptionalJobSearchQuery =
  (
    jobTitle:
      string,
    query:
      string
  ): boolean => {
    const normalized =
      normalizeWhitespace(
        query
      )
        .toLowerCase();

    /*
     * Useful for diagnostics and broad provider fetches.
     * Empty / all / * means "return every vacancy from this
     * provider", regardless of specialization.
     */
    if (
      !normalized ||
      normalized ===
        "all" ||
      normalized ===
        "*" ||
      normalized ===
        "any"
    ) {
      return true;
    }

    return matchesJobSearchQuery(
      jobTitle,
      query
    );
  };

export const fetchBirCareersJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    const jobs =
      await fetchBirCareersBoard();

    return deduplicateJobs(
      jobs.filter(
        (
          job
        ) =>
          matchesOptionalJobSearchQuery(
            job.title,
            params.query
          ) &&
          matchesLocation(
            job,
            params.location
          )
      )
    )
      .slice(
        0,
        params.limit ||
        DEFAULT_LIMIT
      );
  };

export const fetchSuccessFactorsJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    /*
     * Local SuccessFactors registry will initially contain a
     * small number of companies, so do not require 30 boards.
     */
    const sources =
      await buildAtsSources(
        [
          "successfactors",
        ],
        {
          minimumCompanies:
            1,

          maximumCompanies:
            20,
        }
      );

    const jobs =
      (
        await runWithConcurrency(
          sources,
          async (
            source
          ) => {
            try {
              return await fetchSuccessFactorsBoard(
                source
              );
            } catch (
              error
            ) {
              console.warn(
                "[SUCCESSFACTORS] Board failed:",
                {
                  company:
                    source.company,

                  slug:
                    source.slug,

                  careersUrl:
                    source.careersUrl,

                  error:
                    error instanceof
                      Error
                      ? error.message
                      : error,
                }
              );

              return [];
            }
          },
          Math.min(
            4,
            ATS_FETCH_CONCURRENCY
          )
        )
      ).flat();

    return deduplicateJobs(
      jobs.filter(
        (
          job
        ) =>
          matchesOptionalJobSearchQuery(
            job.title,
            params.query
          ) &&
          matchesLocation(
            job,
            params.location
          )
      )
    )
      .slice(
        0,
        params.limit ||
        DEFAULT_LIMIT
      );
  };

/* =========================================================
   GENERAL EXTERNAL JOB SEARCH

   This powers the broad CV-based Job Matching flow.

   IMPORTANT:
   The pool includes all currently enabled ATS providers:
   - Greenhouse
   - Lever
   - Ashby
   - SuccessFactors / Azerbaijan local companies

   Local vacancies are ADDITIVE. Global vacancies are not
   deleted, replaced, or filtered out here.
========================================================= */

export const fetchGeneralExternalJobs =
  async (
    params:
      IFetchGeneralExternalJobsParams = {}
  ): Promise<IExternalJobRecord[]> => {
    const {
      limit =
        1_000,
    } =
      params;

    /*
     * fetchAllAtsJobs() already uses the shared MongoDB ATS
     * registry and the existing board cache.
     */
    const allJobs =
      await fetchAllAtsJobs();

    const deduplicated =
      deduplicateJobs(
        allJobs
      );

    /*
     * Deliberately do NOT call:
     *
     * matchesJobSearchQuery(...)
     * matchesLocation(...)
     *
     * The general matching page needs a broad pool first.
     * jobAggregationService performs the CV/skill ranking.
     */
    const sorted =
      [
        ...deduplicated,
      ]
        .sort(
          (
            a,
            b
          ) => {
            const postedDifference =
              new Date(
                b.postedAt
              ).getTime() -
              new Date(
                a.postedAt
              ).getTime();

            if (
              postedDifference !==
              0
            ) {
              return postedDifference;
            }

            const companyDifference =
              a.company.localeCompare(
                b.company
              );

            if (
              companyDifference !==
              0
            ) {
              return companyDifference;
            }

            return a.title.localeCompare(
              b.title
            );
          }
        );

    /*
     * General Job Matching must expose the complete provider pool.
     *
     * limit <= 0 means "no limit".
     * A positive limit is still supported for tests/debug tools.
     */
    const safeLimit =
      Number.isFinite(
        limit
      )
        ? Math.floor(
            Number(
              limit
            )
          )
        : 1_000;

    const returned =
      safeLimit >
        0
        ? sorted.slice(
            0,
            safeLimit
          )
        : sorted;

    const localAzerbaijanReturned =
      returned.filter(
        (
          job
        ) => {
          const source =
            normalizeSearchText(
              job.source ||
              ""
            );

          const location =
            normalizeSearchText(
              job.location ||
              ""
            );

          const company =
            normalizeSearchText(
              job.company ||
              ""
            );

          return (
            source.includes(
              "successfactors"
            ) ||
            source.includes(
              "bir careers"
            ) ||
            location.includes(
              "azerbaijan"
            ) ||
            location.includes(
              "baku"
            ) ||
            company.includes(
              "azercell"
            )
          );
        }
      ).length;

    console.log(
      "[ATS JOBS] General vacancy pool:",
      {
        totalAtsJobs:
          allJobs.length,

        uniqueJobs:
          deduplicated.length,

        requestedLimit:
          safeLimit,

        returned:
          returned.length,

        localAzerbaijanReturned,

        mode:
          "general-cv-ranking",
      }
    );

    return returned;
  };

/* =========================================================
   MAIN EXTERNAL JOB SEARCH
========================================================= */

export const fetchExternalJobs =
  async (
    params:
      IFetchExternalJobsParams
  ): Promise<IExternalJobRecord[]> => {
    const {
      query,
      location,
      limit =
        DEFAULT_LIMIT,
    } =
      params;

    /*
     * A broad MongoDB-selected ATS company pool is fetched
     * once per cache cycle.
     *
     * Related-role searches performed by jobAggregationService
     * reuse the same selected companies and cached board data,
     * instead of repeatedly hitting ATS APIs.
     */

    const allJobs =
      await fetchAllAtsJobs();

    const deduplicated =
      deduplicateJobs(
        allJobs
      );

    const queryFiltered =
      deduplicated.filter(
        (
          job
        ) =>
          matchesJobSearchQuery(
            job.title,
            query
          )
      );

    const locationFiltered =
      queryFiltered.filter(
        (
          job
        ) =>
          matchesLocation(
            job,
            location
          )
      );

    /*
     * Prefer recently posted vacancies.
     *
     * Final profile / role / CV ranking still happens later
     * inside jobAggregationService.
     */
    const sorted =
      [
        ...locationFiltered,
      ]
        .sort(
          (
            a,
            b
          ) => {
            const aQueryScore =
              calculateSearchQueryScore(
                a.title,
                query
              );

            const bQueryScore =
              calculateSearchQueryScore(
                b.title,
                query
              );

            /*
             * Query relevance always comes first.
             */
            if (
              bQueryScore !==
              aQueryScore
            ) {
              return (
                bQueryScore -
                aQueryScore
              );
            }

            /*
             * If relevance is equal,
             * prefer the newer vacancy.
             */
            return (
              new Date(
                b.postedAt
              ).getTime() -
              new Date(
                a.postedAt
              ).getTime()
            );
          }
        );

    const topQueryMatches =
      sorted
        .slice(
          0,
          10
        )
        .map(
          (
            job
          ) => ({
            title:
              job.title,

            company:
              job.company,

            queryScore:
              calculateSearchQueryScore(
                job.title,
                query
              ),

            location:
              job.location,

            source:
              job.source,
          })
        );

    console.log(
      "[ATS JOBS] Top query matches:",
      {
        query,

        matches:
          topQueryMatches,
      }
    );

    console.log(
      "[ATS JOBS] Search summary:",
      {
        query,

        location:
          location ||
          "Any",

        totalAtsJobs:
          allJobs.length,

        uniqueJobs:
          deduplicated.length,

        queryMatched:
          queryFiltered.length,

        locationMatched:
          locationFiltered.length,

        returned:
          Math.min(
            sorted.length,
            limit
          ),
      }
    );

    return sorted.slice(
      0,
      Math.max(
        1,
        limit
      )
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchAshbyJobs,
  fetchSuccessFactorsJobs,
  fetchBirCareersJobs,
  fetchGeneralExternalJobs,
  fetchExternalJobs,
};