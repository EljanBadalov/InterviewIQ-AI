import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";

import {
  ALL_CAREER_SKILLS,
} from "../careerJobTaxonomy";

/* =========================================================
   TYPES
========================================================= */

export interface IGlorriJob {
  externalId: string;

  title: string;

  company: string;

  location: string;

  summary: string;

  description: string;

  requirements: string[];

  responsibilities: string[];

  benefits: string[];

  skills: string[];

  employmentType: string | null;

  experienceLevel: string | null;

  workMode: string | null;

  salaryMin: number | null;

  salaryMax: number | null;

  salaryCurrency: string | null;

  deadline: string | null;

  postedAt: string | null;

  url: string;

  applyUrl: string;

  source: "Glorri";
}

export interface IGlorriCompany {
  slug: string;

  name: string;

  url: string;
}

export interface IGlorriDiscoveryInput {
  companies?: IGlorriCompany[];

  requestTimeoutMs?: number;

  maxJobs?: number;

  headless?: boolean;

  detailConcurrency?: number;
}

export interface IGlorriDiscoveryResult {
  baseUrl: string;

  urls: string[];

  jobs: IGlorriJob[];

  diagnostics: {
    companiesRequested: number;

    companiesFetched: number;

    companiesFailed: number;

    fetchedPages: number;

    discoveredLinks: number;

    detailPagesFetched: number;

    acceptedJobs: number;

    rejectedJobs: number;

    errors: string[];

    companyResults: Array<{
      slug: string;

      name: string;

      discovered: number;

      accepted: number;

      error?: string;
    }>;
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const GLORRI_BASE_URL =
  "https://jobs.glorri.az";

const DEFAULT_TIMEOUT_MS =
  60_000;

const DEFAULT_MAX_JOBS =
  500;

const DEFAULT_DETAIL_CONCURRENCY =
  4;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36";

export const DEFAULT_GLORRI_COMPANIES:
  IGlorriCompany[] = [
    {
      slug: "unibank",
      name: "Unibank Kommersiya Bankı",
      url:
        "https://jobs.glorri.az/companies/unibank",
    },

    {
      slug: "idda",
      name: "IDDA",
      url:
        "https://jobs.glorri.az/companies/idda",
    },

    {
      slug: "pashabank",
      name: "PASHA Bank",
      url:
        "https://jobs.glorri.az/companies/pashabank",
    },

    {
      slug: "azal",
      name: "AZAL",
      url:
        "https://jobs.glorri.az/companies/azal",
    },

    {
      slug: "expressbank",
      name: "Expressbank",
      url:
        "https://jobs.glorri.az/companies/expressbank",
    },

    {
      slug: "rabitabank",
      name: "Rabitabank",
      url:
        "https://jobs.glorri.az/companies/rabitabank",
    },

    {
      slug: "atb",
      name: "Azər Türk Bank",
      url:
        "https://jobs.glorri.az/companies/atb",
    },

    {
      slug: "bankrespublika",
      name: "Bank Respublika",
      url:
        "https://jobs.glorri.az/companies/bankrespublika",
    },

    {
      slug: "yelo",
      name: "Yelo Bank",
      url:
        "https://jobs.glorri.az/companies/yelo",
    },

    {
      slug: "ateshgah",
      name: "Atəşgah",
      url:
        "https://jobs.glorri.az/companies/ateshgah",
    },

    {
      slug: "azintelecom",
      name: "AzInTelecom",
      url:
        "https://jobs.glorri.az/companies/azintelecom",
    },

    {
      slug: "abc-telecom",
      name: "ABC Telecom",
      url:
        "https://jobs.glorri.az/companies/abc-telecom",
    },
  ];

/*
 * Example:
 *
 * /vacancies/unibank/unibank-kob-kreditleri-uzre-tecrubeci-gence-88359012
 *
 * Query params such as ?isLocal=true are removed during canonicalization.
 */
const VACANCY_PATH_REGEX =
  /^\/vacancies\/([^/]+)\/([^/?#]+)\/?$/i;

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace = (
  value:
    | string
    | null
    | undefined
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

const normalizeMultilineText = (
  value:
    | string
    | null
    | undefined
): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /\r/g,
      ""
    )
    .split(
      "\n"
    )
    .map(
      normalizeWhitespace
    )
    .filter(
      Boolean
    )
    .join(
      "\n"
    );
};

const uniqueStrings = (
  values:
    string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] =
    [];

  for (
    const value of
    values
  ) {
    const normalized =
      normalizeWhitespace(
        value
      );

    if (!normalized) {
      continue;
    }

    const key =
      normalized.toLocaleLowerCase(
        "az"
      );

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
      normalized
    );
  }

  return result;
};

const escapeRegex = (
  value:
    string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

/* =========================================================
   URL HELPERS
========================================================= */

const canonicalizeVacancyUrl = (
  value:
    string,
  baseUrl:
    string = GLORRI_BASE_URL
): string => {
  try {
    const parsed =
      new URL(
        value,
        baseUrl
      );

    if (
      parsed.hostname !==
      "jobs.glorri.az"
    ) {
      return "";
    }

    if (
      !VACANCY_PATH_REGEX.test(
        parsed.pathname
      )
    ) {
      return "";
    }

    parsed.protocol =
      "https:";

    parsed.search =
      "";

    parsed.hash =
      "";

    parsed.pathname =
      parsed.pathname.replace(
        /\/+$/,
        ""
      );

    return parsed.toString();
  } catch {
    return "";
  }
};

const extractVacancyPathParts = (
  url:
    string
): {
  companySlug: string;
  vacancySlug: string;
} | null => {
  try {
    const parsed =
      new URL(
        url
      );

    const match =
      parsed.pathname.match(
        VACANCY_PATH_REGEX
      );

    if (
      !match
    ) {
      return null;
    }

    return {
      companySlug:
        match[1],

      vacancySlug:
        match[2],
    };
  } catch {
    return null;
  }
};

const extractExternalId = (
  url:
    string
): string => {
  const parts =
    extractVacancyPathParts(
      url
    );

  if (!parts) {
    return "";
  }

  const numericId =
    parts.vacancySlug.match(
      /-(\d+)$/
    )?.[1];

  /*
   * Include company slug to avoid collisions between companies.
   */
  if (numericId) {
    return `${parts.companySlug}:${numericId}`;
  }

  return `${parts.companySlug}:${parts.vacancySlug}`;
};

/* =========================================================
   SAFE PLAYWRIGHT HELPERS
========================================================= */

const safeText = async (
  locator:
    Locator
): Promise<string> => {
  try {
    if (
      (
        await locator.count()
      ) ===
      0
    ) {
      return "";
    }

    return normalizeWhitespace(
      await locator
        .first()
        .textContent()
    );
  } catch {
    return "";
  }
};

const safeInnerText = async (
  locator:
    Locator
): Promise<string> => {
  try {
    if (
      (
        await locator.count()
      ) ===
      0
    ) {
      return "";
    }

    return normalizeMultilineText(
      await locator
        .first()
        .innerText()
    );
  } catch {
    return "";
  }
};

const waitForPageToSettle =
  async (
    page:
      Page
  ): Promise<void> => {
    try {
      await page.waitForLoadState(
        "domcontentloaded",
        {
          timeout:
            15_000,
        }
      );
    } catch {
      // Ignore.
    }

    try {
      await page.waitForLoadState(
        "networkidle",
        {
          timeout:
            8_000,
        }
      );
    } catch {
      // SPA may keep connections open.
    }

    if (
      !page.isClosed()
    ) {
      await page.waitForTimeout(
        1000
      );
    }
  };

/* =========================================================
   SKILL DETECTION
========================================================= */

const detectSkills = (
  text:
    string
): string[] => {
  const normalizedText =
    text.toLocaleLowerCase(
      "az"
    );

  return ALL_CAREER_SKILLS
    .filter(
      (
        skill
      ) => {
        const normalizedSkill =
          skill
            .trim()
            .toLocaleLowerCase(
              "az"
            );

        if (
          !normalizedSkill
        ) {
          return false;
        }

        if (
          normalizedSkill ===
          "c++"
        ) {
          return /(?:^|[^a-z0-9])c\+\+(?:[^a-z0-9]|$)/i.test(
            text
          );
        }

        if (
          normalizedSkill ===
          "c#"
        ) {
          return /(?:^|[^a-z0-9])c#(?:[^a-z0-9]|$)/i.test(
            text
          );
        }

        if (
          normalizedSkill ===
          ".net"
        ) {
          return /(?:^|[^a-z0-9])\.net(?:[^a-z0-9]|$)/i.test(
            text
          );
        }

        if (
          normalizedSkill ===
          "node.js"
        ) {
          return /\bnode(?:\.js|\s+js)\b/i.test(
            text
          );
        }

        if (
          normalizedSkill ===
          "next.js"
        ) {
          return /\bnext(?:\.js|\s+js)\b/i.test(
            text
          );
        }

        if (
          normalizedSkill ===
          "rest api"
        ) {
          return /\brest(?:ful)?\s+api(?:s)?\b/i.test(
            text
          );
        }

        if (
          /^[a-z0-9]+$/i.test(
            normalizedSkill
          ) &&
          normalizedSkill.length <=
            4
        ) {
          const regex =
            new RegExp(
              `(?:^|[^a-z0-9])${escapeRegex(
                normalizedSkill
              )}(?:[^a-z0-9]|$)`,
              "i"
            );

          return regex.test(
            normalizedText
          );
        }

        return normalizedText.includes(
          normalizedSkill
        );
      }
    )
    .slice(
      0,
      40
    );
};

/* =========================================================
   CONTENT CLEANING
========================================================= */

const NOISE_PATTERN =
  /^(?:ana səhifə|vakansiyalar|şirkətlər|kateqoriyalar|şirkət haqqında|müraciət et|axtar|remote iş|aze|eng|rus|təsvir|tələblər|tələb|namizədə tələblər|namizəd üçün tələblər|əsas tələblər|öhdəliklər|vəzifə öhdəlikləri|əsas öhdəliklər|əsas vəzifələr|vəzifələr|iş öhdəlikləri|funksional vəzifələr|görəcəyiniz işlər|qeyd|iş şəraiti|iş şərtləri|vakansiya haqqında|kateqoriya|biz nə təklif edirik|nə təklif edirik|sizə nə təklif edirik|üstünlüklər|imkanlar|benefits?|requirements?|qualifications?|responsibilities|duties)$/i;

const normalizeSectionHeading = (
  value: string
): string => {
  return normalizeWhitespace(value)
    .replace(/[\s:：;,.!?–—-]+$/g, "")
    .trim();
};

const isNoiseItem = (
  value: string
): boolean => {
  return NOISE_PATTERN.test(
    normalizeSectionHeading(value)
  );
};

const cleanItems = (
  values:
    string[]
): string[] => {
  return uniqueStrings(
    values
      .map(
        normalizeWhitespace
      )
      .filter(
        (
          value
        ) =>
          value.length >=
            2 &&
          !isNoiseItem(
            value
          )
      )
  ).slice(
    0,
    80
  );
};

/* =========================================================
   LISTING DISCOVERY
========================================================= */

const getCurrentVacancyUrls =
  async (
    page:
      Page
  ): Promise<string[]> => {
    try {
      const hrefs =
        await page.evaluate(
          () => {
            return Array.from(
              document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/vacancies/"]'
              )
            )
              .map(
                (
                  anchor
                ) =>
                  anchor.getAttribute(
                    "href"
                  ) ||
                  ""
              )
              .filter(
                Boolean
              );
          }
        );

      return uniqueStrings(
        hrefs
          .map(
            (
              href
            ) =>
              canonicalizeVacancyUrl(
                href
              )
          )
          .filter(
            Boolean
          )
      );
    } catch (
      error
    ) {
      console.warn(
        "[GLORRI PROVIDER] Failed to read vacancy URLs:",
        error instanceof Error
          ? error.message
          : String(
              error
            )
      );

      return [];
    }
  };

const waitForInitialVacancyLinks =
  async (
    page:
      Page,
    timeoutMs:
      number = 20_000
  ): Promise<string[]> => {
    const startedAt =
      Date.now();

    let lastUrls:
      string[] =
      [];

    while (
      Date.now() -
        startedAt <
      timeoutMs
    ) {
      if (
        page.isClosed()
      ) {
        return [];
      }

      lastUrls =
        await getCurrentVacancyUrls(
          page
        );

      if (
        lastUrls.length >
        0
      ) {
        return lastUrls;
      }

      try {
        await page.mouse.wheel(
          0,
          1500
        );
      } catch {
        // Ignore.
      }

      await page.waitForTimeout(
        700
      );
    }

    return lastUrls;
  };

const tryClickLoadMore =
  async (
    page:
      Page
  ): Promise<boolean> => {
    const candidates = [
      page.getByRole(
        "button",
        {
          name:
            /daha çox|daha çox göstər|show more|load more/i,
        }
      ),

      page.getByRole(
        "link",
        {
          name:
            /daha çox|daha çox göstər|show more|load more/i,
        }
      ),
    ];

    for (
      const candidate of
      candidates
    ) {
      try {
        const count =
          Math.min(
            await candidate.count(),
            5
          );

        for (
          let index =
            0;
          index <
          count;
          index +=
            1
        ) {
          const item =
            candidate.nth(
              index
            );

          if (
            !(
              await item.isVisible()
            )
          ) {
            continue;
          }

          await item.click({
            timeout:
              3_000,
          });

          await page.waitForTimeout(
            800
          );

          return true;
        }
      } catch {
        // Try next candidate.
      }
    }

    return false;
  };

const loadAllVacancies =
  async (
    page:
      Page
  ): Promise<string[]> => {
    const discovered =
      new Set<string>();

    const initial =
      await waitForInitialVacancyLinks(
        page
      );

    for (
      const url of
      initial
    ) {
      discovered.add(
        url
      );
    }

    let previousSize =
      discovered.size;

    let stableRounds =
      0;

    const startedAt =
      Date.now();

    for (
      let round =
        0;
      round <
      20;
      round +=
        1
    ) {
      if (
        Date.now() -
          startedAt >
        35_000
      ) {
        break;
      }

      const urls =
        await getCurrentVacancyUrls(
          page
        );

      for (
        const url of
        urls
      ) {
        discovered.add(
          url
        );
      }

      const clicked =
        await tryClickLoadMore(
          page
        );

      try {
        await page.mouse.wheel(
          0,
          5000
        );
      } catch {
        // Ignore.
      }

      if (
        !page.isClosed()
      ) {
        await page.waitForTimeout(
          clicked
            ? 900
            : 650
        );
      }

      if (
        discovered.size ===
        previousSize
      ) {
        stableRounds +=
          1;
      } else {
        stableRounds =
          0;
      }

      previousSize =
        discovered.size;

      if (
        discovered.size >
          0 &&
        !clicked &&
        stableRounds >=
          3
      ) {
        break;
      }
    }

    const finalUrls =
      await getCurrentVacancyUrls(
        page
      );

    for (
      const url of
      finalUrls
    ) {
      discovered.add(
        url
      );
    }

    return [
      ...discovered,
    ];
  };

/* =========================================================
   DETAIL PAGE HELPERS
========================================================= */

const getPageBodyText =
  async (
    page:
      Page
  ): Promise<string> => {
    const candidates = [
      "main",
      "article",
      "[class*='vacancy']",
      "[class*='detail']",
      "body",
    ];

    for (
      const selector of
      candidates
    ) {
      try {
        const locator =
          page.locator(
            selector
          );

        if (
          (
            await locator.count()
          ) ===
          0
        ) {
          continue;
        }

        const text =
          await safeInnerText(
            locator
          );

        if (
          text.length >=
          100
        ) {
          return text;
        }
      } catch {
        // Try next selector.
      }
    }

    return "";
  };

const getTitle =
  async (
    page:
      Page
  ): Promise<string> => {
    const selectors = [
      "h1",
      "main h2",
      "[class*='vacancy'] h1",
      "[class*='vacancy'] h2",
      "[class*='title']",
    ];

    for (
      const selector of
      selectors
    ) {
      const text =
        await safeText(
          page.locator(
            selector
          )
        );

      if (
        text &&
        text.length >=
          3 &&
        !NOISE_PATTERN.test(
          text
        )
      ) {
        return text;
      }
    }

    return "";
  };

/* =========================================================
   SECTION EXTRACTION
========================================================= */

type SectionName =
  | "description"
  | "requirements"
  | "responsibilities"
  | "benefits"
  | null;

const extractStructuredSections =
  async (
    page: Page
  ): Promise<{
    description: string;
    requirements: string[];
    responsibilities: string[];
    benefits: string[];
  }> => {
    const raw =
      await page.evaluate(
        () => {
          const root =
            document.querySelector<HTMLElement>(
              "main"
            ) ||
            document.body;

          const nodes =
            Array.from(
              root.querySelectorAll<HTMLElement>(
                "h1, h2, h3, h4, h5, h6, strong, b, p, li, div"
              )
            );

          let current:
            | "description"
            | "requirements"
            | "responsibilities"
            | "benefits"
            | null =
            null;

          const result = {
            description:
              [] as string[],
            requirements:
              [] as string[],
            responsibilities:
              [] as string[],
            benefits:
              [] as string[],
          };

          for (
            const node of
            nodes
          ) {
            const text =
              (
                node.innerText ||
                node.textContent ||
                ""
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();

            if (
              !text ||
              text.length >
                2500
            ) {
              continue;
            }

            const lower =
              text
                .toLocaleLowerCase(
                  "az"
                )
                .replace(
                  /[\s:：;,.!?–—-]+$/g,
                  ""
                )
                .trim();

            /*
             * Keep ALL logic inline here.
             * Do not declare/call helper functions inside page.evaluate(),
             * because tsx/esbuild may inject __name().
             */

            if (
              /^(təsvir|iş haqqında|vəzifə haqqında|vakansiyanın təsviri|işin təsviri|description)$/i.test(
                lower
              )
            ) {
              current =
                "description";
              continue;
            }

            if (
              /^(öhdəliklər|vəzifə öhdəlikləri|əsas öhdəliklər|əsas vəzifələr|vəzifələr|görəcəyiniz işlər|iş öhdəlikləri|funksional vəzifələr|responsibilities|duties)$/i.test(
                lower
              )
            ) {
              current =
                "responsibilities";
              continue;
            }

            if (
              /^(tələblər|namizədə tələblər|namizəd üçün tələblər|əsas tələblər|işə qəbul tələbləri|tələb olunan bilik və bacarıqlar|bilik və bacarıqlar|requirements?|qualifications?)$/i.test(
                lower
              )
            ) {
              current =
                "requirements";
              continue;
            }

            if (
              /^(biz nə təklif edirik\??|nə təklif edirik\??|sizə nə təklif edirik\??|təklif edirik|təkliflər|üstünlüklər|imkanlar|bizim təklifimiz|şirkət nə təklif edir\??|benefits?|what we offer\??|we offer)$/i.test(
                lower
              )
            ) {
              current =
                "benefits";
              continue;
            }

            if (
              /^(iş şəraiti|iş şərtləri|iş şəraiti və təminatlar|əmək şəraiti|qeyd|vakansiya haqqında|kateqoriya|son tarix|son müraciət tarixi|paylaşılıb|yerləşdirilib|iş rejimi|vakansiya növü|iş qrafiki|location|məkan)$/i.test(
                lower
              )
            ) {
              current =
                null;
              continue;
            }

            if (
              !current
            ) {
              continue;
            }

            const tag =
              node.tagName.toUpperCase();

            const isUsefulLeaf =
              tag === "LI" ||
              tag === "P" ||
              (
                (
                  tag === "DIV" ||
                  tag === "STRONG" ||
                  tag === "B"
                ) &&
                node.children.length ===
                  0
              );

            if (
              !isUsefulLeaf
            ) {
              continue;
            }

            result[
              current
            ].push(
              text
            );
          }

          return result;
        }
      );

    return {
      description:
        uniqueStrings(
          raw.description
        ).join(
          "\n"
        ),

      requirements:
        cleanItems(
          raw.requirements
        ),

      responsibilities:
        cleanItems(
          raw.responsibilities
        ),

      benefits:
        cleanItems(
          raw.benefits
        ),
    };
  };

/* =========================================================
   TEXT FALLBACK SECTION EXTRACTION
========================================================= */

const extractTextSection = (
  bodyText:
    string,
  startPatterns:
    RegExp[],
  stopPatterns:
    RegExp[]
): string[] => {
  const lines =
    bodyText
      .split(
        "\n"
      )
      .map(
        normalizeWhitespace
      )
      .filter(
        Boolean
      );

  const result:
    string[] =
    [];

  let capturing =
    false;

  for (
    const line of
    lines
  ) {
    const headingCandidate =
      normalizeSectionHeading(
        line
      );

    if (
      !capturing
    ) {
      const matchedStart =
        startPatterns.find(
          (
            pattern
          ) =>
            pattern.test(
              headingCandidate
            )
        );

      if (
        matchedStart
      ) {
        capturing =
          true;

        /*
         * Support headings such as:
         * "Vəzifə öhdəlikləri:" and also
         * "Vəzifə öhdəlikləri: müştəriləri qarşılamaq".
         */
        const headingPrefix =
          line.match(
            /^([^:：]{1,100})[:：]\s*(.*)$/
          );

        const inline =
          headingPrefix &&
          startPatterns.some(
            (pattern) =>
              pattern.test(
                normalizeSectionHeading(
                  headingPrefix[1]
                )
              )
          )
            ? normalizeWhitespace(
                headingPrefix[2]
              )
            : "";

        if (
          inline &&
          !isNoiseItem(
            inline
          )
        ) {
          result.push(
            inline
          );
        }
      }

      continue;
    }

    if (
      stopPatterns.some(
        (
          pattern
        ) =>
          pattern.test(
            headingCandidate
          )
      )
    ) {
      break;
    }

    if (
      isNoiseItem(
        line
      )
    ) {
      continue;
    }

    result.push(
      line
    );
  }

  return cleanItems(
    result
  );
};

/* =========================================================
   METADATA
========================================================= */

const extractValueAfterLabel = (
  bodyText:
    string,
  labels:
    RegExp[]
): string => {
  const lines =
    bodyText
      .split(
        "\n"
      )
      .map(
        normalizeWhitespace
      )
      .filter(
        Boolean
      );

  for (
    let index =
      0;
    index <
    lines.length;
    index +=
      1
  ) {
    const line =
      lines[index];

    for (
      const label of
      labels
    ) {
      if (
        label.test(
          line
        )
      ) {
        /*
         * "Son tarix October 22, 2026"
         */
        const inlineValue =
          line
            .replace(
              label,
              ""
            )
            .replace(
              /^[:\-\s]+/,
              ""
            )
            .trim();

        if (
          inlineValue
        ) {
          return inlineValue;
        }

        /*
         * Label and value may be separate DOM lines.
         */
        const next =
          lines[
            index + 1
          ];

        if (
          next
        ) {
          return next;
        }
      }
    }
  }

  return "";
};

const inferLocation = (
  bodyText: string,
  title = ""
): string => {
  const lines =
    bodyText
      .split(
        "\n"
      )
      .map(
        normalizeWhitespace
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        30
      );

  /*
   * Glorri frequently renders the location in the page header as:
   *   "Salyan, Azerbaijan"
   *   "Samux, Azərbaycan"
   * Do this generic check before the fixed city list so new regions do
   * not need to be manually added to knownLocations.
   */
  for (
    const line of
    lines
  ) {
    if (
      line ===
      title ||
      line.length >
        100
    ) {
      continue;
    }

    const genericLocationMatch =
      line.match(
        /^(.{1,70}?),\s*(Azərbaycan|Azerbaijan)$/i
      );

    if (
      genericLocationMatch
    ) {
      const place =
        normalizeWhitespace(
          genericLocationMatch[1]
        );

      if (
        place &&
        !/^(kontakt home|abc telecom|unibank|idda|paşa bank|pasha bank|azal|expressbank|rabitabank|atb|bank respublika|yelo|atəşgah|ateshgah|azintelecom)$/i.test(
          place
        )
      ) {
        return `${place}, Azərbaycan`;
      }
    }
  }

  const knownLocations = [
    "Bakı",
    "Baku",
    "Gəncə",
    "Ganja",
    "Sumqayıt",
    "Sumgait",
    "Mingəçevir",
    "Mingachevir",
    "Naxçıvan",
    "Nakhchivan",
    "Lənkəran",
    "Lankaran",
    "Quba",
    "Şəki",
    "Shaki",
    "Şəmkir",
    "Shamkir",
    "Sədərək",
    "Sabirabad",
    "Şamaxı",
    "Shamakhi",
    "Qəbələ",
    "Gabala",
    "Masallı",
    "Xaçmaz",
    "Khachmaz",
    "Bərdə",
    "Barda",
    "Ağcabədi",
    "Agjabadi",
    "Ağdaş",
    "Agdash",
    "Göyçay",
    "Goychay",
    "Şirvan",
    "Shirvan",
    "Abşeron",
    "Absheron",
  ];

  for (
    const line of
    lines
  ) {
    if (
      line ===
      title
    ) {
      continue;
    }

    if (
      line.length >
      120
    ) {
      continue;
    }

    const lower =
      line.toLocaleLowerCase(
        "az"
      );

    const containsLocation =
      knownLocations.some(
        (
          location
        ) =>
          lower.includes(
            location.toLocaleLowerCase(
              "az"
            )
          )
      );

    if (
      !containsLocation
    ) {
      continue;
    }

    const parts =
      line
        .split(
          /[·•|]/
        )
        .map(
          normalizeWhitespace
        )
        .filter(
          Boolean
        );

    const locationPart =
      parts.find(
        (
          part
        ) => {
          const partLower =
            part.toLocaleLowerCase(
              "az"
            );

          return knownLocations.some(
            (
              location
            ) =>
              partLower.includes(
                location.toLocaleLowerCase(
                  "az"
                )
              )
          );
        }
      );

    if (
      locationPart &&
      locationPart.length <=
        100
    ) {
      return locationPart;
    }

    if (
      /\b(azərbaycan|azerbaijan)\b/i.test(
        line
      )
    ) {
      return line;
    }

    if (
      line.length <=
      80
    ) {
      return line;
    }
  }

  const titleLower =
    title.toLocaleLowerCase(
      "az"
    );

  for (
    const location of
    knownLocations
  ) {
    if (
      titleLower.includes(
        location.toLocaleLowerCase(
          "az"
        )
      )
    ) {
      return `${location}, Azərbaycan`;
    }
  }

  return "";
};

const inferExperienceLevel = (
  title:
    string,
  bodyText:
    string
): string | null => {
  const explicit =
    extractValueAfterLabel(
      bodyText,
      [
        /^təcrübə səviyyəsi$/i,
        /^təcrübə dərəcəsi$/i,
        /^experience level$/i,
        /^seniority level$/i,
      ]
    );

  const explicitNormalized =
    normalizeWhitespace(
      explicit
    ).toLocaleLowerCase(
      "az"
    );

  if (
    explicitNormalized
  ) {
    if (
      /\b(könüllü|volunteer)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Volunteer";
    }

    if (
      /\b(intern|internship|təcrübəçi|təcrübə proqramı|trainee)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Internship";
    }

    if (
      /\b(junior|entry|başlanğıc)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Junior";
    }

    if (
      /\b(mid|middle|mid-level|orta)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Mid-level";
    }

    if (
      /\b(senior|baş mütəxəssis|baş proqramçı)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Senior";
    }

    if (
      /\b(team lead|tech lead|technical lead|engineering lead|manager|rəhbər|şöbə müdiri|qrup rəhbəri)\b/i.test(
        explicitNormalized
      )
    ) {
      return "Lead";
    }
  }

  const titleText =
    normalizeWhitespace(
      title
    );

  if (
    /\b(könüllü|volunteer)\b/i.test(
      titleText
    )
  ) {
    return "Volunteer";
  }

  if (
    /\b(intern|internship|təcrübəçi|təcrübə proqramı|trainee)\b/i.test(
      titleText
    )
  ) {
    return "Internship";
  }

  if (
    /\b(junior|kiçik mütəxəssis)\b/i.test(
      titleText
    )
  ) {
    return "Junior";
  }

  if (
    /\b(team lead|tech lead|technical lead|engineering lead|manager|rəhbər|şöbə müdiri|qrup rəhbəri)\b/i.test(
      titleText
    )
  ) {
    return "Lead";
  }

  if (
    /\b(senior|baş mütəxəssis|baş proqramçı)\b/i.test(
      titleText
    )
  ) {
    return "Senior";
  }

  const normalizedBody =
    normalizeWhitespace(
      bodyText
    );

  const rangeMatch =
    normalizedBody.match(
      /(?:minimum|ən azı|azı)?\s*(\d+)\s*[–—-]\s*(\d+)\s*(?:il|year)/i
    );

  if (
    rangeMatch
  ) {
    const minYears =
      Number(
        rangeMatch[1]
      );

    if (
      Number.isFinite(
        minYears
      )
    ) {
      if (
        minYears >= 5
      ) {
        return "Senior";
      }

      if (
        minYears >= 2
      ) {
        return "Mid-level";
      }

      return "Junior";
    }
  }

  const upToMatch =
    normalizedBody.match(
      /(\d+)\s*(?:il|year)(?:ə|a)?\s+qədər\s+(?:iş\s+)?təcrüb/i
    );

  if (
    upToMatch
  ) {
    const years =
      Number(
        upToMatch[1]
      );

    if (
      Number.isFinite(
        years
      )
    ) {
      if (
        years <= 1
      ) {
        return "Junior";
      }

      if (
        years <= 4
      ) {
        return "Mid-level";
      }

      return "Senior";
    }
  }

  const experienceMatch =
    normalizedBody.match(
      /(?:minimum|ən azı|azı)\s*(\d+)\s*(?:il|year)/i
    ) ||
    normalizedBody.match(
      /(\d+)\s*(?:il|year)(?:lıq)?\s+(?:iş\s+)?təcrüb/i
    );

  if (
    experienceMatch
  ) {
    const years =
      Number(
        experienceMatch[1]
      );

    if (
      Number.isFinite(
        years
      )
    ) {
      if (
        years >= 5
      ) {
        return "Senior";
      }

      if (
        years >= 2
      ) {
        return "Mid-level";
      }

      return "Junior";
    }
  }

  /*
   * "Aparıcı mütəxəssis" alone is not necessarily a team/engineering
   * lead role. If no years are available, treat it as mid-level.
   */
  if (
    /\baparıcı mütəxəssis\b/i.test(
      titleText
    )
  ) {
    return "Mid-level";
  }

  return null;
};

const inferEmploymentType = (
  bodyText:
    string
): string | null => {
  const explicit =
    extractValueAfterLabel(
      bodyText,
      [
        /^vakansiya növü$/i,
        /^məşğulluq növü$/i,
        /^employment type$/i,
      ]
    );

  const source =
    explicit ||
    bodyText;

  if (
    /\b(full[\s-]?time|tam iş günü|tam ştat)\b/i.test(
      source
    )
  ) {
    return "Full-time";
  }

  if (
    /\b(part[\s-]?time|yarım ştat)\b/i.test(
      source
    )
  ) {
    return "Part-time";
  }

  if (
    /\b(internship|təcrübə proqramı|təcrübəçi)\b/i.test(
      source
    )
  ) {
    return "Internship";
  }

  if (
    /\b(contract|müqavilə)\b/i.test(
      source
    )
  ) {
    return "Contract";
  }

  return null;
};

const inferWorkMode = (
  bodyText:
    string
): string | null => {
  if (
    /\b(remote|məsafədən|uzaqdan)\b/i.test(
      bodyText
    )
  ) {
    return "Remote";
  }

  if (
    /\b(hybrid|hibrid)\b/i.test(
      bodyText
    )
  ) {
    return "Hybrid";
  }

  if (
    /\b(on[\s-]?site|ofisdən|ofisdə)\b/i.test(
      bodyText
    )
  ) {
    return "Onsite";
  }

  return null;
};

/* =========================================================
   SALARY
========================================================= */

interface IParsedSalary {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

const normalizeSalaryNumber = (
  value: string
): number | null => {
  const compact =
    value
      .replace(/\s+/g, "")
      .replace(/,/g, ".");

  const parsed =
    Number(compact);

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const normalizeSalaryCurrency = (
  value: string
): string | null => {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (/^(AZN|₼|MANAT)$/i.test(normalized)) {
    return "AZN";
  }

  if (/^(USD|\$)$/i.test(normalized)) {
    return "USD";
  }

  if (/^(EUR|€)$/i.test(normalized)) {
    return "EUR";
  }

  return normalized || null;
};

const inferSalary = (
  bodyText: string
): IParsedSalary => {
  const normalized =
    normalizeWhitespace(bodyText)
      .replace(/\u00a0/g, " ");

  const currency =
    "(AZN|₼|manat|USD|\\$|EUR|€)";

  const rangePatterns = [
    new RegExp(
      `(?:maaş|əmək haqqı|salary)?\\s*[:\\-–—]?\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)\\s*(?:-|–|—|dən|dan)\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)\\s*${currency}`,
      "i"
    ),
    new RegExp(
      `${currency}\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)\\s*(?:-|–|—)\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)`,
      "i"
    ),
  ];

  for (const pattern of rangePatterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    const currencyFirst =
      /^(AZN|₼|manat|USD|\$|EUR|€)/i.test(
        match[1] || ""
      );

    const minRaw =
      currencyFirst ? match[2] : match[1];

    const maxRaw =
      currencyFirst ? match[3] : match[2];

    const currencyRaw =
      currencyFirst ? match[1] : match[3];

    const salaryMin =
      normalizeSalaryNumber(minRaw);

    const salaryMax =
      normalizeSalaryNumber(maxRaw);

    if (salaryMin !== null && salaryMax !== null) {
      return {
        salaryMin: Math.min(salaryMin, salaryMax),
        salaryMax: Math.max(salaryMin, salaryMax),
        salaryCurrency:
          normalizeSalaryCurrency(currencyRaw),
      };
    }
  }

  const singlePatterns = [
    new RegExp(
      `(?:maaş|əmək haqqı|salary)\\s*[:\\-–—]?\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)\\s*${currency}`,
      "i"
    ),
    new RegExp(
      `(\\d{2,6}(?:[.,]\\d{1,2})?)\\s*${currency}(?:\\s*(?:maaş|əmək haqqı))?`,
      "i"
    ),
    new RegExp(
      `${currency}\\s*(\\d{2,6}(?:[.,]\\d{1,2})?)`,
      "i"
    ),
  ];

  for (const pattern of singlePatterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    const currencyFirst =
      /^(AZN|₼|manat|USD|\$|EUR|€)/i.test(
        match[1] || ""
      );

    const amountRaw =
      currencyFirst ? match[2] : match[1];

    const currencyRaw =
      currencyFirst ? match[1] : match[2];

    const amount =
      normalizeSalaryNumber(amountRaw);

    if (amount !== null) {
      return {
        salaryMin: amount,
        salaryMax: amount,
        salaryCurrency:
          normalizeSalaryCurrency(currencyRaw),
      };
    }
  }

  return {
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };
};

/* =========================================================
   APPLY URL
========================================================= */

const getApplyUrl =
  async (
    page:
      Page,
    fallbackUrl:
      string
  ): Promise<string> => {
    const candidates = [
      page.getByRole(
        "link",
        {
          name:
            /müraciət et|apply/i,
        }
      ),

      page.locator(
        'a:has-text("Müraciət et")'
      ),

      page.locator(
        'a:has-text("Apply")'
      ),
    ];

    for (
      const candidate of
      candidates
    ) {
      try {
        if (
          (
            await candidate.count()
          ) ===
          0
        ) {
          continue;
        }

        const href =
          await candidate
            .first()
            .getAttribute(
              "href"
            );

        if (
          !href
        ) {
          continue;
        }

        return new URL(
          href,
          fallbackUrl
        ).toString();
      } catch {
        // Try next candidate.
      }
    }

    return fallbackUrl;
  };

/* =========================================================
   CLOUDFLARE / SECURITY PAGE DETECTION
========================================================= */

const isGlorriSecurityPage = (
  title: string,
  bodyText: string
): boolean => {
  const combined =
    `${title} ${bodyText}`
      .toLowerCase();

  return (
    title
      .trim()
      .toLowerCase() ===
      "jobs.glorri.az" ||
    combined.includes(
      "performing security verification"
    ) ||
    combined.includes(
      "verifies you are not a bot"
    ) ||
    combined.includes(
      "security service to protect against malicious bots"
    ) ||
    combined.includes(
      "ray id:"
    ) ||
    combined.includes(
      "performance and security by cloudflare"
    )
  );
};

const waitForRealGlorriPage =
  async (
    page: Page,
    maxWaitMs = 15_000
  ): Promise<boolean> => {
    const startedAt =
      Date.now();

    while (
      Date.now() -
        startedAt <
      maxWaitMs
    ) {
      if (
        page.isClosed()
      ) {
        return false;
      }

      const title =
        await getTitle(
          page
        );

      const bodyText =
        await getPageBodyText(
          page
        );

      if (
        title &&
        bodyText &&
        !isGlorriSecurityPage(
          title,
          bodyText
        )
      ) {
        return true;
      }

      await page.waitForTimeout(
        1500
      );
    }

    return false;
  };

/* =========================================================
   DETAIL PARSER
========================================================= */

const parseGlorriVacancyDetail =
  async (
    context:
      BrowserContext,
    url:
      string,
    timeoutMs:
      number,
    fallbackCompany:
      string
  ): Promise<IGlorriJob | null> => {
    const page =
      await context.newPage();

    try {
      console.log(
        "[GLORRI PROVIDER] Fetching detail:",
        url
      );

      await page.goto(
        url,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            timeoutMs,
        }
      );

      await waitForPageToSettle(
        page
      );

      let realPageReady =
        await waitForRealGlorriPage(
          page,
          12_000
        );

      if (
        !realPageReady
      ) {
        console.warn(
          "[GLORRI PROVIDER] Security page detected. Retrying:",
          url
        );

        await page.waitForTimeout(
          2500
        );

        await page.reload({
          waitUntil:
            "domcontentloaded",

          timeout:
            timeoutMs,
        });

        await waitForPageToSettle(
          page
        );

        realPageReady =
          await waitForRealGlorriPage(
            page,
            12_000
          );
      }

      if (
        !realPageReady
      ) {
        throw new Error(
          "Glorri security verification page remained after retry."
        );
      }

      const finalUrl =
        canonicalizeVacancyUrl(
          page.url()
        ) ||
        url;

      const externalId =
        extractExternalId(
          finalUrl
        );

      if (
        !externalId
      ) {
        throw new Error(
          "Could not extract vacancy external ID."
        );
      }

      const title =
        await getTitle(
          page
        );

      if (
        !title
      ) {
        throw new Error(
          "Vacancy title was not found."
        );
      }

      const bodyText =
        await getPageBodyText(
          page
        );

      if (
        isGlorriSecurityPage(
          title,
          bodyText
        )
      ) {
        throw new Error(
          "Glorri security verification page detected."
        );
      }

      if (
        bodyText.length <
        40
      ) {
        throw new Error(
          "Vacancy detail body is empty."
        );
      }

      const structured =
        await extractStructuredSections(
          page
        );

      let responsibilities =
        structured.responsibilities;

      let requirements =
        structured.requirements;

      let benefits =
        structured.benefits;

      let description =
        structured.description;

      /*
       * Text fallbacks.
       */
      if (
        responsibilities.length ===
        0
      ) {
        responsibilities =
          extractTextSection(
            bodyText,
            [
              /^öhdəliklər$/i,
              /^vəzifə öhdəlikləri$/i,
              /^əsas vəzifələr$/i,
              /^əsas öhdəliklər$/i,
              /^vəzifələr$/i,
              /^iş öhdəlikləri$/i,
              /^funksional vəzifələr$/i,
              /^görəcəyiniz işlər$/i,
              /^işin əsas vəzifələri$/i,
              /^əsas funksiyalar$/i,
              /^funksiyalar$/i,
              /^vəzifənin funksiyaları$/i,
              /^responsibilities$/i,
              /^duties$/i,
            ],
            [
              /^tələblər$/i,
              /^namizədə tələblər$/i,
              /^namizəd üçün tələblər$/i,
              /^biz nə təklif edirik\??$/i,
              /^nə təklif edirik\??$/i,
              /^üstünlüklər$/i,
              /^qeyd$/i,
              /^iş şəraiti$/i,
              /^iş şərtləri$/i,
              /^vakansiya haqqında$/i,
              /^kateqoriya$/i,
            ]
          );
      }

      if (
        requirements.length ===
        0
      ) {
        requirements =
          extractTextSection(
            bodyText,
            [
              /^tələblər$/i,
              /^namizədə tələblər$/i,
              /^namizəd üçün tələblər$/i,
              /^əsas tələblər$/i,
              /^tələb olunan bilik və bacarıqlar$/i,
              /^bilik və bacarıqlar$/i,
              /^requirements?$/i,
              /^qualifications?$/i,
            ],
            [
              /^biz nə təklif edirik\??$/i,
              /^üstünlüklər$/i,
              /^vakansiya haqqında$/i,
              /^kateqoriya$/i,
            ]
          );
      }

      if (
        benefits.length ===
        0
      ) {
        benefits =
          extractTextSection(
            bodyText,
            [
              /^biz nə təklif edirik\??$/i,
              /^nə təklif edirik\??$/i,
              /^sizə nə təklif edirik\??$/i,
              /^təklif edirik$/i,
              /^təkliflər$/i,
              /^üstünlüklər$/i,
              /^imkanlar$/i,
              /^bizim təklifimiz$/i,
              /^benefits?$/i,
              /^what we offer$/i,
            ],
            [
              /^vakansiya haqqında$/i,
              /^kateqoriya$/i,
            ]
          );
      }

      if (
        !description
      ) {
        const descriptionLines =
          extractTextSection(
            bodyText,
            [
              /^təsvir$/i,
              /^iş haqqında$/i,
              /^description$/i,
            ],
            [
              /^tələblər$/i,
              /^öhdəliklər$/i,
              /^vəzifə öhdəlikləri$/i,
              /^biz nə təklif edirik\??$/i,
              /^vakansiya haqqında$/i,
            ]
          );

        description =
          descriptionLines.join(
            "\n"
          );
      }

      /*
       * If the page has only a general description,
       * preserve useful text rather than returning an empty job.
       */
      if (
        !description
      ) {
        description =
          bodyText.slice(
            0,
            8000
          );
      }

      /*
       * Final section cleanup.
       * Keep the four content buckets independent and remove
       * accidental duplicates caused by nested Glorri DOM nodes.
       */
      responsibilities =
        cleanItems(
          responsibilities
        );

      requirements =
        cleanItems(
          requirements
        );

      benefits =
        cleanItems(
          benefits
        );

      /*
       * Remove standalone section labels that Glorri sometimes leaks
       * into arrays with a trailing colon, for example "Qeyd:" or
       * "İş şəraiti:". cleanItems already handles most of these, but
       * this second pass keeps the final output defensive.
       */
      responsibilities =
        responsibilities.filter(
          (value) =>
            !isNoiseItem(value)
        );

      requirements =
        requirements.filter(
          (value) =>
            !isNoiseItem(value)
        );

      benefits =
        benefits.filter(
          (value) =>
            !isNoiseItem(value)
        );

      /*
       * Glorri can place the "Biz nə təklif edirik?" heading and its
       * following list inside the same DOM container as requirements.
       * If that happens, split the contaminated requirements array at
       * the benefits heading and move the remaining items to benefits.
       */
      const benefitsHeadingIndex =
        requirements.findIndex(
          (
            value
          ) =>
            /^(biz nə təklif edirik|nə təklif edirik|sizə nə təklif edirik|təklif edirik|üstünlüklər|imkanlar|bizim təklifimiz)\??$/i.test(
              normalizeWhitespace(
                value
              )
            )
        );

      if (
        benefitsHeadingIndex >=
        0
      ) {
        const leakedBenefits =
          requirements.slice(
            benefitsHeadingIndex +
              1
          );

        requirements =
          requirements.slice(
            0,
            benefitsHeadingIndex
          );

        benefits =
          cleanItems([
            ...benefits,
            ...leakedBenefits,
          ]);
      }

      const responsibilityKeys =
        new Set(
          responsibilities.map(
            (
              value
            ) =>
              value.toLocaleLowerCase(
                "az"
              )
          )
        );

      const benefitKeys =
        new Set(
          benefits.map(
            (
              value
            ) =>
              value.toLocaleLowerCase(
                "az"
              )
          )
        );

      requirements =
        requirements.filter(
          (
            value
          ) => {
            const key =
              value.toLocaleLowerCase(
                "az"
              );

            return (
              !responsibilityKeys.has(
                key
              ) &&
              !benefitKeys.has(
                key
              )
            );
          }
        );

      const requirementKeys =
        new Set(
          requirements.map(
            (
              value
            ) =>
              value.toLocaleLowerCase(
                "az"
              )
          )
        );

      benefits =
        benefits.filter(
          (
            value
          ) => {
            const key =
              value.toLocaleLowerCase(
                "az"
              );

            return (
              !responsibilityKeys.has(
                key
              ) &&
              !requirementKeys.has(
                key
              )
            );
          }
        );

      /*
       * FINAL RESPONSIBILITIES NORMALIZATION
       *
       * Prefer the plain-text section because Glorri often renders
       * "İş şəraiti" inside the same DOM container as responsibilities.
       * The text extractor has explicit stop headings, so salary,
       * schedule, address and other work-condition lines cannot leak
       * into responsibilities.
       */
      const explicitResponsibilities =
        extractTextSection(
          bodyText,
          [
            /^öhdəliklər$/i,
            /^vəzifə öhdəlikləri$/i,
            /^əsas vəzifələr$/i,
            /^əsas öhdəliklər$/i,
            /^vəzifələr$/i,
            /^iş öhdəlikləri$/i,
            /^funksional vəzifələr$/i,
            /^görəcəyiniz işlər$/i,
            /^işin əsas vəzifələri$/i,
            /^əsas funksiyalar$/i,
            /^funksiyalar$/i,
            /^vəzifənin funksiyaları$/i,
            /^responsibilities$/i,
            /^duties$/i,
          ],
          [
            /^iş şəraiti$/i,
            /^iş şərtləri$/i,
            /^iş şəraiti və təminatlar$/i,
            /^əmək şəraiti$/i,
            /^qeyd$/i,
            /^tələblər$/i,
            /^namizədə tələblər$/i,
            /^namizəd üçün tələblər$/i,
            /^əsas tələblər$/i,
            /^biz nə təklif edirik\??$/i,
            /^nə təklif edirik\??$/i,
            /^sizə nə təklif edirik\??$/i,
            /^üstünlüklər$/i,
            /^imkanlar$/i,
            /^vakansiya haqqında$/i,
            /^kateqoriya$/i,
            /^son tarix$/i,
            /^paylaşılıb$/i,
          ]
        );

      if (
        explicitResponsibilities.length >
        0
      ) {
        responsibilities =
          explicitResponsibilities;
      }

      /*
       * Some Glorri vacancies do not render a visible responsibilities
       * heading at all. Their description starts directly with duties.
       * In that case take the leading description lines and STOP at the
       * first work-condition / requirements / benefits / metadata heading.
       * This catches noun-form Azerbaijani duties such as
       * "... boşaldılması", "... yerləşdirilməsi", "... aparılması".
       */
      if (
        responsibilities.length ===
          0 &&
        description
      ) {
        const lines =
          description
            .split(/\n+/)
            .map(normalizeWhitespace)
            .filter(Boolean);

        const implicit:
          string[] =
          [];

        const stopHeadingPattern =
          /^(?:iş şəraiti|iş şərtləri|iş şəraiti və təminatlar|əmək şəraiti|qeyd|tələblər|namizədə tələblər|namizəd üçün tələblər|əsas tələblər|biz nə təklif edirik\??|nə təklif edirik\??|sizə nə təklif edirik\??|üstünlüklər|imkanlar|vakansiya haqqında|kateqoriya|son tarix|paylaşılıb)$/i;

        const metadataLinePattern =
          /^(?:əmək haqqı|maaş|salary|iş qrafiki|iş rejimi|iş günləri|iş saatları|iş yeri|iş ünvanı|ünvan|location)\s*:/i;

        const likelyDutyPattern =
          /(?:ılması|ilməsi|ulması|ülməsi|ması|məsi|maq|mək|edilməsi|olunması|aparılması|verilməsi|yerinə yetirilməsi|nəzarət|məsuliyyət|idarə|təmin|təşkil|hazırlan|yoxlan|yerləşdir|daşın|qəbul|təqdim|məlumatlandır|əməl edilm)/i;

        for (
          const line of
          lines
        ) {
          const heading =
            normalizeSectionHeading(
              line
            );

          if (
            stopHeadingPattern.test(
              heading
            ) ||
            metadataLinePattern.test(
              line
            )
          ) {
            break;
          }

          if (
            isNoiseItem(
              line
            )
          ) {
            continue;
          }

          /*
           * Do not copy navigation / page chrome into implicit duties.
           */
          if (
            /^(?:tam ştat|yarım ştat|part[- ]?time|full[- ]?time|müraciət et)$/i.test(
              heading
            )
          ) {
            continue;
          }

          implicit.push(
            line
          );
        }

        const cleanedImplicit =
          cleanItems(
            implicit
          ).filter(
            (line) =>
              likelyDutyPattern.test(
                line
              )
          );

        if (
          cleanedImplicit.length >
          0
        ) {
          responsibilities =
            cleanedImplicit;
        }
      }

      /*
       * Last defensive pass: even if Glorri changes its DOM and a work
       * condition leaks into the array, cut the array at the first such
       * line instead of merely removing the heading and leaving salary /
       * schedule lines behind it.
       */
      const responsibilityStopIndex =
        responsibilities.findIndex(
          (value) => {
            const heading =
              normalizeSectionHeading(
                value
              );

            return (
              /^(?:iş şəraiti|iş şərtləri|iş şəraiti və təminatlar|əmək şəraiti|qeyd|tələblər|namizədə tələblər|namizəd üçün tələblər|əsas tələblər|biz nə təklif edirik\??|nə təklif edirik\??|sizə nə təklif edirik\??|üstünlüklər|imkanlar|vakansiya haqqında|kateqoriya)$/i.test(
                heading
              ) ||
              /^(?:əmək haqqı|maaş|salary|iş qrafiki|iş rejimi|iş günləri|iş saatları|iş yeri|iş ünvanı|ünvan|location)\s*:/i.test(
                value
              )
            );
          }
        );

      if (
        responsibilityStopIndex >=
        0
      ) {
        responsibilities =
          responsibilities.slice(
            0,
            responsibilityStopIndex
          );
      }

      /*
       * =====================================================
       * FINAL HARD CUT V4
       * =====================================================
       * Do not trust the DOM/text extractor at this point.
       * Once a work-condition / requirements / benefits /
       * metadata heading appears, everything after it belongs
       * to another section and MUST NOT remain in responsibilities.
       */
      const isResponsibilityBoundary = (
        rawValue: string
      ): boolean => {
        const value =
          normalizeWhitespace(
            rawValue
          )
            .toLocaleLowerCase(
              "az"
            )
            .replace(
              /^[•·▪◦*-]+\s*/,
              ""
            )
            .trim();

        const heading =
          normalizeSectionHeading(
            value
          ).toLocaleLowerCase(
            "az"
          );

        const boundaryHeadings = [
          "iş şəraiti",
          "iş şərtləri",
          "iş şəraiti və təminatlar",
          "əmək şəraiti",
          "qeyd",
          "tələblər",
          "tələb",
          "namizədə tələblər",
          "namizəd üçün tələblər",
          "əsas tələblər",
          "tələb olunan bilik və bacarıqlar",
          "bilik və bacarıqlar",
          "biz nə təklif edirik",
          "nə təklif edirik",
          "sizə nə təklif edirik",
          "təklif edirik",
          "təkliflər",
          "üstünlüklər",
          "imkanlar",
          "bizim təklifimiz",
          "vakansiya haqqında",
          "kateqoriya",
          "son tarix",
          "son müraciət tarixi",
          "paylaşılıb",
          "yerləşdirilib",
          "əmək haqqı",
          "maaş",
          "salary",
          "iş qrafiki",
          "iş rejimi",
          "iş günləri",
          "iş saatları",
          "iş yeri",
          "iş ünvanı",
          "ünvan",
          "location",
        ];

        return boundaryHeadings.some(
          (boundary) =>
            heading ===
              boundary ||
            value ===
              boundary ||
            value.startsWith(
              `${boundary}:`
            ) ||
            value.startsWith(
              `${boundary} :`
            ) ||
            value.startsWith(
              `${boundary}：`
            )
        );
      };

      const hardBoundaryIndex =
        responsibilities.findIndex(
          isResponsibilityBoundary
        );

      if (
        hardBoundaryIndex !==
        -1
      ) {
        responsibilities =
          responsibilities.slice(
            0,
            hardBoundaryIndex
          );
      }

      responsibilities =
        cleanItems(
          responsibilities
        );

      const location =
        inferLocation(
          bodyText,
          title
        );

      const deadline =
        extractValueAfterLabel(
          bodyText,
          [
            /^son tarix$/i,
            /^son müraciət tarixi$/i,
            /^deadline$/i,
          ]
        ) ||
        null;

      const postedAt =
        extractValueAfterLabel(
          bodyText,
          [
            /^paylaşılıb$/i,
            /^yerləşdirilib$/i,
            /^posted$/i,
            /^published$/i,
          ]
        ) ||
        null;

      const applyUrl =
        await getApplyUrl(
          page,
          finalUrl
        );

      const skillText = [
        title,
        description,
        ...responsibilities,
        ...requirements,
        ...benefits,
      ].join(
        " "
      );

      const summary =
        normalizeWhitespace(
          description
        ).slice(
          0,
          600
        );

      const salary =
        inferSalary(
          bodyText
        );

      return {
        externalId,

        title,

        company:
          fallbackCompany,

        location,

        summary,

        description,

        requirements,

        responsibilities,

        benefits,

        skills:
          detectSkills(
            skillText
          ),

        employmentType:
          inferEmploymentType(
            bodyText
          ),

        experienceLevel:
          inferExperienceLevel(
            title,
            bodyText
          ),

        workMode:
          inferWorkMode(
            bodyText
          ),

        salaryMin:
          salary.salaryMin,

        salaryMax:
          salary.salaryMax,

        salaryCurrency:
          salary.salaryCurrency,

        deadline,

        postedAt,

        url:
          finalUrl,

        applyUrl,

        source:
          "Glorri",
      };
    } finally {
      if (
        !page.isClosed()
      ) {
        await page.close();
      }
    }
  };

/* =========================================================
   CONCURRENCY
========================================================= */

const runWithConcurrency =
  async <
    T,
    R
  >(
    items:
      T[],
    worker:
      (
        item:
          T,
        index:
          number
      ) => Promise<R>,
    concurrency:
      number
  ): Promise<R[]> => {
    const results =
      new Array<R>(
        items.length
      );

    let nextIndex =
      0;

    const workerCount =
      Math.max(
        1,
        Math.min(
          concurrency,
          items.length
        )
      );

    const runners =
      Array.from(
        {
          length:
            workerCount,
        },
        async () => {
          while (
            true
          ) {
            const index =
              nextIndex;

            nextIndex +=
              1;

            if (
              index >=
              items.length
            ) {
              return;
            }

            results[index] =
              await worker(
                items[index],
                index
              );
          }
        }
      );

    await Promise.all(
      runners
    );

    return results;
  };

/* =========================================================
   COMPANY DISCOVERY
========================================================= */

interface IDiscoveredGlorriVacancy {
  url: string;

  company:
    IGlorriCompany;
}

const discoverCompanyVacancies =
  async (
    context:
      BrowserContext,
    company:
      IGlorriCompany,
    timeoutMs:
      number
  ): Promise<string[]> => {
    const page =
      await context.newPage();

    try {
      console.log(
        "\n[GLORRI PROVIDER] Opening company:",
        {
          company:
            company.name,

          url:
            company.url,
        }
      );

      await page.goto(
        company.url,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            timeoutMs,
        }
      );

      await waitForPageToSettle(
        page
      );

      const urls =
        await loadAllVacancies(
          page
        );

      /*
       * Important:
       * Keep only vacancies belonging to the requested company.
       * This protects us if Glorri renders recommended vacancies.
       */
      const companyUrls =
        urls.filter(
          (
            url
          ) => {
            const parts =
              extractVacancyPathParts(
                url
              );

            return (
              parts?.companySlug
                .toLocaleLowerCase(
                  "az"
                ) ===
              company.slug
                .toLocaleLowerCase(
                  "az"
                )
            );
          }
        );

      console.log(
        "[GLORRI PROVIDER] Company discovery finished:",
        {
          company:
            company.name,

          discovered:
            companyUrls.length,
        }
      );

      return companyUrls;
    } finally {
      if (
        !page.isClosed()
      ) {
        await page.close();
      }
    }
  };

/* =========================================================
   MAIN DISCOVERY
========================================================= */

export const discoverGlorriJobs =
  async (
    input:
      IGlorriDiscoveryInput =
      {}
  ): Promise<IGlorriDiscoveryResult> => {
    const companies =
      input.companies &&
      input.companies.length >
        0
        ? input.companies
        : DEFAULT_GLORRI_COMPANIES;

    const timeoutMs =
      input.requestTimeoutMs ??
      DEFAULT_TIMEOUT_MS;

    const maxJobs =
      Math.max(
        1,
        input.maxJobs ??
          DEFAULT_MAX_JOBS
      );

    const headless =
      input.headless ??
      true;

    const detailConcurrency =
      Math.max(
        1,
        input.detailConcurrency ??
          DEFAULT_DETAIL_CONCURRENCY
      );

    const diagnostics:
      IGlorriDiscoveryResult["diagnostics"] =
      {
        companiesRequested:
          companies.length,

        companiesFetched:
          0,

        companiesFailed:
          0,

        fetchedPages:
          0,

        discoveredLinks:
          0,

        detailPagesFetched:
          0,

        acceptedJobs:
          0,

        rejectedJobs:
          0,

        errors:
          [],

        companyResults:
          [],
      };

    let browser:
      Browser | null =
      null;

    try {
      console.log(
        "\n========================================================="
      );

      console.log(
        " InterviewIQ Glorri Provider"
      );

      console.log(
        "========================================================="
      );

      console.log(
        "[GLORRI PROVIDER] Starting discovery:",
        {
          companies:
            companies.length,

          maxJobs,

          headless,

          detailConcurrency,
        }
      );

      browser =
        await chromium.launch({
          headless,

          args: [
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        });

      const context =
        await browser.newContext({
          userAgent:
            USER_AGENT,

          locale:
            "az-AZ",

          viewport: {
            width:
              1440,

            height:
              1000,
          },

          ignoreHTTPSErrors:
            true,
        });

      const discoveredMap =
        new Map<
          string,
          IDiscoveredGlorriVacancy
        >();

      /*
       * Company listing pages are processed sequentially.
       *
       * This is intentionally conservative because Glorri is one
       * shared host and we do not want 12 listing pages hitting it
       * simultaneously.
       */
      for (
        const company of
        companies
      ) {
        let companyUrls:
          string[] =
          [];

        try {
          companyUrls =
            await discoverCompanyVacancies(
              context,
              company,
              timeoutMs
            );

          diagnostics.companiesFetched +=
            1;

          diagnostics.fetchedPages +=
            1;

          for (
            const url of
            companyUrls
          ) {
            if (
              discoveredMap.size >=
              maxJobs
            ) {
              break;
            }

            if (
              !discoveredMap.has(
                url
              )
            ) {
              discoveredMap.set(
                url,
                {
                  url,
                  company,
                }
              );
            }
          }

          diagnostics.companyResults.push({
            slug:
              company.slug,

            name:
              company.name,

            discovered:
              companyUrls.length,

            accepted:
              0,
          });
        } catch (
          error
        ) {
          const message =
            error instanceof Error
              ? error.message
              : String(
                  error
                );

          diagnostics.companiesFailed +=
            1;

          diagnostics.errors.push(
            `${company.name}: ${message}`
          );

          diagnostics.companyResults.push({
            slug:
              company.slug,

            name:
              company.name,

            discovered:
              0,

            accepted:
              0,

            error:
              message,
          });

          console.error(
            "[GLORRI PROVIDER] Company discovery failed:",
            {
              company:
                company.name,

              error:
                message,
            }
          );
        }

        if (
          discoveredMap.size >=
          maxJobs
        ) {
          console.log(
            "[GLORRI PROVIDER] maxJobs reached during company discovery:",
            maxJobs
          );

          break;
        }
      }

      const discovered =
        [
          ...discoveredMap.values(),
        ].slice(
          0,
          maxJobs
        );

      diagnostics.discoveredLinks =
        discovered.length;

      console.log(
        "\n[GLORRI PROVIDER] Listing discovery complete:",
        {
          companiesFetched:
            diagnostics.companiesFetched,

          companiesFailed:
            diagnostics.companiesFailed,

          vacancies:
            discovered.length,
        }
      );

      /*
       * Now detail pages can run with controlled concurrency.
       */
      const detailResults =
        await runWithConcurrency(
          discovered,

          async (
            item
          ) => {
            try {
              const job =
                await parseGlorriVacancyDetail(
                  context,
                  item.url,
                  timeoutMs,
                  item.company.name
                );

              return {
                item,

                job,

                error:
                  "",
              };
            } catch (
              error
            ) {
              return {
                item,

                job:
                  null,

                error:
                  error instanceof Error
                    ? error.message
                    : String(
                        error
                      ),
              };
            }
          },

          detailConcurrency
        );

      const jobs:
        IGlorriJob[] =
        [];

      for (
        const result of
        detailResults
      ) {
        diagnostics.detailPagesFetched +=
          1;

        diagnostics.fetchedPages +=
          1;

        if (
          result.job
        ) {
          jobs.push(
            result.job
          );

          diagnostics.acceptedJobs +=
            1;

          const companyDiagnostic =
            diagnostics.companyResults.find(
              (
                item
              ) =>
                item.slug ===
                result.item.company.slug
            );

          if (
            companyDiagnostic
          ) {
            companyDiagnostic.accepted +=
              1;
          }

          continue;
        }

        diagnostics.rejectedJobs +=
          1;

        diagnostics.errors.push(
          `${result.item.url}: ${result.error}`
        );

        console.warn(
          "[GLORRI PROVIDER] Vacancy rejected:",
          {
            url:
              result.item.url,

            error:
              result.error,
          }
        );
      }

      /*
       * externalId + URL de-duplication.
       */
      const uniqueJobs:
        IGlorriJob[] =
        [];

      const seenIds =
        new Set<string>();

      const seenUrls =
        new Set<string>();

      for (
        const job of
        jobs
      ) {
        if (
          seenIds.has(
            job.externalId
          ) ||
          seenUrls.has(
            job.url
          )
        ) {
          continue;
        }

        seenIds.add(
          job.externalId
        );

        seenUrls.add(
          job.url
        );

        uniqueJobs.push(
          job
        );
      }

      console.log(
        "\n[GLORRI PROVIDER] Discovery complete:",
        {
          companiesRequested:
            diagnostics.companiesRequested,

          companiesFetched:
            diagnostics.companiesFetched,

          companiesFailed:
            diagnostics.companiesFailed,

          discovered:
            diagnostics.discoveredLinks,

          accepted:
            diagnostics.acceptedJobs,

          rejected:
            diagnostics.rejectedJobs,

          returned:
            uniqueJobs.length,
        }
      );

      console.log(
        "[GLORRI PROVIDER] Company results:"
      );

      for (
        const result of
        diagnostics.companyResults
      ) {
        console.log(
          {
            company:
              result.name,

            discovered:
              result.discovered,

            accepted:
              result.accepted,

            error:
              result.error,
          }
        );
      }

      console.log(
        "[GLORRI PROVIDER] Sample jobs:",
        uniqueJobs
          .slice(
            0,
            10
          )
          .map(
            (
              job
            ) => ({
              externalId:
                job.externalId,

              title:
                job.title,

              company:
                job.company,

              location:
                job.location,

              requirements:
                job.requirements.length,

              responsibilities:
                job.responsibilities.length,

              benefits:
                job.benefits.length,

              skills:
                job.skills,

              deadline:
                job.deadline,

              postedAt:
                job.postedAt,

              url:
                job.url,
            })
          )
      );

      return {
        baseUrl:
          GLORRI_BASE_URL,

        urls:
          discovered.map(
            (
              item
            ) =>
              item.url
          ),

        jobs:
          uniqueJobs,

        diagnostics,
      };
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error
            );

      diagnostics.errors.push(
        message
      );

      console.error(
        "[GLORRI PROVIDER] Discovery failed:",
        {
          error:
            message,

          diagnostics,
        }
      );

      return {
        baseUrl:
          GLORRI_BASE_URL,

        urls:
          [],

        jobs:
          [],

        diagnostics,
      };
    } finally {
      if (
        browser
      ) {
        await browser.close();
      }
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  discoverGlorriJobs,

  DEFAULT_GLORRI_COMPANIES,
};