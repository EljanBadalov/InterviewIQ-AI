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

export interface IAbbCareersJob {
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

  source: "ABB Careers";
}

export interface IAbbCareersDiscoveryInput {
  careersUrl?: string;

  requestTimeoutMs?: number;

  maxJobs?: number;

  headless?: boolean;

  detailConcurrency?: number;
}

export interface IAbbCareersDiscoveryResult {
  baseUrl: string;

  urls: string[];

  jobs: IAbbCareersJob[];

  diagnostics: {
    fetchedPages: number;

    discoveredLinks: number;

    detailPagesFetched: number;

    acceptedJobs: number;

    rejectedJobs: number;

    listingFallbacks: number;

    errors: string[];
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_CAREERS_URL =
  "https://careers.abb-bank.az/vakansiyalar";

const DEFAULT_TIMEOUT_MS =
  60_000;

const DEFAULT_MAX_JOBS =
  150;

const DEFAULT_DETAIL_CONCURRENCY =
  3;

const DETAIL_PATH_REGEX =
  /^\/vakansiyalar\/v2\/(\d+)\/?$/i;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36";

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace =
  (
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

const normalizeMultilineText =
  (
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
        (line) =>
          normalizeWhitespace(
            line
          )
      )
      .filter(
        Boolean
      )
      .join(
        "\n"
      );
  };

const uniqueStrings =
  (
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
        normalized
          .toLocaleLowerCase(
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

const escapeRegex =
  (
    value:
      string
  ): string => {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  };

const canonicalizeAbbUrl =
  (
    value:
      string,
    baseUrl:
      string
  ): string => {
    try {
      const parsed =
        new URL(
          value,
          baseUrl
        );

      if (
        parsed.hostname !==
        "careers.abb-bank.az"
      ) {
        return "";
      }

      if (
        !DETAIL_PATH_REGEX.test(
          parsed.pathname
        )
      ) {
        return "";
      }

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

const extractExternalId =
  (
    url:
      string
  ): string => {
    try {
      return (
        new URL(
          url
        )
          .pathname
          .match(
            DETAIL_PATH_REGEX
          )?.[1] ||
        ""
      );
    } catch {
      return "";
    }
  };

/* =========================================================
   SAFE PLAYWRIGHT HELPERS
========================================================= */

const safeText =
  async (
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

/* =========================================================
   SKILLS
========================================================= */

const detectSkills =
  (
    text:
      string
  ): string[] => {
    const normalizedText =
      text
        .toLocaleLowerCase(
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

          /*
           * Short skills such as Git, Go, R, SQL etc.
           * must be matched as complete tokens.
           *
           * normalized.includes("git") can produce false positives
           * inside unrelated Azerbaijani / English words.
           */
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

          /*
           * Multi-word / longer skills are safe enough to search
           * as normalized phrases.
           */
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
   LISTING DISCOVERY
========================================================= */

const getCurrentVacancyUrls =
  async (
    page:
      Page,
    baseUrl:
      string
  ): Promise<string[]> => {
    try {
      const hrefs =
        await page.evaluate(
          () => {
            return Array.from(
              document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/vakansiyalar/v2/"]'
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
              canonicalizeAbbUrl(
                href,
                baseUrl
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
        "[ABB CAREERS PROVIDER] Failed to read vacancy URLs:",
        error instanceof Error
          ? error.message
          : String(
              error
            )
      );

      return [];
    }
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
              5_000,
          });

          await page.waitForTimeout(
            800
          );

          return true;
        }
      } catch {
        // Try another candidate.
      }
    }

    return false;
  };

const loadAllVacancies =
  async (
    page:
      Page,
    baseUrl:
      string
  ): Promise<string[]> => {
    const discovered =
      new Set<string>();

    let stableRounds =
      0;

    let previousSize =
      0;

    const startedAt =
      Date.now();

    for (
      let round =
        0;
      round <
      30;
      round +=
        1
    ) {
      if (
        Date.now() -
          startedAt >
        45_000
      ) {
        break;
      }

      const urls =
        await getCurrentVacancyUrls(
          page,
          baseUrl
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
            : 600
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
        !clicked &&
        discovered.size >
          0 &&
        stableRounds >=
          3
      ) {
        break;
      }
    }

    return [
      ...discovered,
    ];
  };

/* =========================================================
   LISTING FALLBACK DATA
========================================================= */

interface IAbbListingItem {
  title: string;
  cardText: string;
}

const getListingItems =
  async (
    page:
      Page,
    baseUrl:
      string
  ): Promise<
    Map<
      string,
      IAbbListingItem
    >
  > => {
    const rawItems =
      await page.evaluate(
        () => {
          return Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              'a[href*="/vakansiyalar/v2/"]'
            )
          ).map(
            (
              anchor
            ) => {
              const href =
                anchor.getAttribute(
                  "href"
                ) ||
                "";

              const heading =
                anchor.querySelector<HTMLElement>(
                  "h1, h2, h3, h4, h5, h6, [class*='title'], [class*='name'], strong, b"
                );

              const title =
                (
                  heading?.innerText ||
                  heading?.textContent ||
                  anchor.innerText ||
                  anchor.textContent ||
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    220
                  );

              const card =
                anchor.closest<HTMLElement>(
                  "article, li, [class*='vacan'], [class*='card'], [class*='job']"
                ) ||
                anchor;

              const cardText =
                (
                  card.innerText ||
                  card.textContent ||
                  ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    2400
                  );

              return {
                href,
                title,
                cardText,
              };
            }
          );
        }
      );

    const result =
      new Map<
        string,
        IAbbListingItem
      >();

    for (
      const item of
      rawItems
    ) {
      const url =
        canonicalizeAbbUrl(
          item.href,
          baseUrl
        );

      if (
        !url ||
        result.has(
          url
        )
      ) {
        continue;
      }

      result.set(
        url,
        {
          title:
            normalizeWhitespace(
              item.title
            ),

          cardText:
            normalizeWhitespace(
              item.cardText
            ),
        }
      );
    }

    return result;
  };

/* =========================================================
   DETAIL TEXT HELPERS
========================================================= */

const SECTION_HEADING_PATTERN =
  /^(?:iş haqqında|görəcəyiniz işlər|bizim üçün uyğun namizəd|biz nə təklif edirik|üstünlüklər|what you will do|responsibilities|requirements?|qualifications?|what we offer|benefits?)\s*:?\s*$/i;

const NAVIGATION_LINE_PATTERN =
  /^(?:haqqımızda|vakansiyalar|təcrübə proqramları|f\.?\s*a\.?\s*q\.?|daxil ol|qeydiyyat|müraciət et)$/i;

const cleanSectionItems =
  (
    items:
      string[]
  ): string[] => {
    return uniqueStrings(
      items
        .map(
          (
            item
          ) =>
            normalizeWhitespace(
              item
            )
        )
        .filter(
          (
            item
          ) =>
            item.length >=
              3 &&
            !SECTION_HEADING_PATTERN.test(
              item
            ) &&
            !NAVIGATION_LINE_PATTERN.test(
              item
            )
        )
    )
      .slice(
        0,
        60
      );
  };

const getContentRootText =
  async (
    page:
      Page
  ): Promise<string> => {
    const selectors = [
      "article.populated-content",
      "article",
      "main",
      "[class*='vacancy-detail']",
      "[class*='vacancy']",
      "[class*='detail']",
    ];

    for (
      const selector of
      selectors
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
          normalizeMultilineText(
            await locator
              .first()
              .innerText()
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

    return normalizeMultilineText(
      await page
        .locator(
          "body"
        )
        .innerText()
    );
  };

/*
 * Robust DOM extraction:
 *
 * Instead of assuming:
 *   heading.parentElement.nextElementSibling === UL
 *
 * we inspect all relevant text/list elements in document order.
 * Once a recognized section heading is found, subsequent <li>
 * elements belong to that section until another heading appears.
 */
const getStructuredSectionsFromDom =
  async (
    page:
      Page
  ): Promise<{
    responsibilities: string[];
    requirements: string[];
    benefits: string[];
  }> => {
    const raw =
      await page.evaluate(
        () => {
          type Section =
            | "responsibilities"
            | "requirements"
            | "benefits"
            | null;

          const root =
            document.querySelector<HTMLElement>(
              "article.populated-content"
            ) ||
            document.querySelector<HTMLElement>(
              "article"
            ) ||
            document.querySelector<HTMLElement>(
              "main"
            ) ||
            document.body;

          const responsibilities:
            string[] =
            [];

          const requirements:
            string[] =
            [];

          const benefits:
            string[] =
            [];

          const nodes =
            Array.from(
              root.querySelectorAll<HTMLElement>(
                "h1, h2, h3, h4, h5, h6, p, strong, li"
              )
            );

          let currentSection:
            Section =
            null;

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
              !text
            ) {
              continue;
            }

            if (
              /^görəcəyiniz işlər\s*:?\s*$/i.test(
                text
              ) ||
              /^what you will do\s*:?\s*$/i.test(
                text
              ) ||
              /^responsibilities\s*:?\s*$/i.test(
                text
              )
            ) {
              currentSection =
                "responsibilities";

              continue;
            }

            if (
              /^bizim üçün uyğun namizəd\s*:?\s*$/i.test(
                text
              ) ||
              /^requirements?\s*:?\s*$/i.test(
                text
              ) ||
              /^qualifications?\s*:?\s*$/i.test(
                text
              )
            ) {
              currentSection =
                "requirements";

              continue;
            }

            if (
              /^biz nə təklif edirik\s*:?\s*$/i.test(
                text
              ) ||
              /^üstünlüklər\s*:?\s*$/i.test(
                text
              ) ||
              /^benefits?\s*:?\s*$/i.test(
                text
              ) ||
              /^what we offer\s*:?\s*$/i.test(
                text
              )
            ) {
              currentSection =
                "benefits";

              continue;
            }

            if (
              /^iş haqqında\s*:?\s*$/i.test(
                text
              )
            ) {
              currentSection =
                null;

              continue;
            }

            /*
             * Only LI elements are treated as actual section items.
             * This prevents parent <p>/<strong> duplication.
             */
            if (
              node.tagName !==
              "LI"
            ) {
              continue;
            }

            if (
              currentSection ===
              "responsibilities"
            ) {
              responsibilities.push(
                text
              );

              continue;
            }

            if (
              currentSection ===
              "requirements"
            ) {
              requirements.push(
                text
              );

              continue;
            }

            if (
              currentSection ===
              "benefits"
            ) {
              benefits.push(
                text
              );
            }
          }

          return {
            responsibilities,
            requirements,
            benefits,
          };
        }
      );

    return {
      responsibilities:
        cleanSectionItems(
          raw.responsibilities
        ),

      requirements:
        cleanSectionItems(
          raw.requirements
        ),

      benefits:
        cleanSectionItems(
          raw.benefits
        ),
    };
  };

/*
 * Body-text fallback.
 *
 * ABB sometimes changes wrappers/components while keeping the visible
 * headings and list text. This parser therefore uses the visible text
 * structure if DOM section extraction returned nothing.
 */
const extractTextSection =
  (
    multilineText:
      string,
    startPatterns:
      RegExp[],
    stopPatterns:
      RegExp[]
  ): string[] => {
    const lines =
      multilineText
        .split(
          "\n"
        )
        .map(
          (
            line
          ) =>
            normalizeWhitespace(
              line
            )
        )
        .filter(
          Boolean
        );

    let capturing =
      false;

    const collected:
      string[] =
      [];

    for (
      const line of
      lines
    ) {
      if (
        !capturing
      ) {
        const starts =
          startPatterns.some(
            (
              pattern
            ) =>
              pattern.test(
                line
              )
          );

        if (
          starts
        ) {
          capturing =
            true;
        }

        continue;
      }

      const shouldStop =
        stopPatterns.some(
          (
            pattern
          ) =>
            pattern.test(
              line
            )
        );

      if (
        shouldStop
      ) {
        break;
      }

      if (
        NAVIGATION_LINE_PATTERN.test(
          line
        )
      ) {
        continue;
      }

      /*
       * ABB list items normally appear as individual lines.
       * If the browser collapsed several semicolon-separated items
       * into one line, split them conservatively.
       */
      const pieces =
        line
          .split(
            /;\s+(?=[A-ZƏÖÜĞÇŞİ])/u
          )
          .map(
            (
              item
            ) =>
              normalizeWhitespace(
                item
            )
          )
          .filter(
            Boolean
          );

      collected.push(
        ...pieces
      );
    }

    return cleanSectionItems(
      collected
    );
  };

const buildCleanDescription =
  (
    contentText:
      string,
    title:
      string,
    responsibilities:
      string[],
    requirements:
      string[]
  ): string => {
    const lines =
      contentText
        .split(
          "\n"
        )
        .map(
          (
            line
          ) =>
            normalizeWhitespace(
              line
            )
        )
        .filter(
          Boolean
        );

    const cleaned:
      string[] =
      [];

    let afterAbout =
      false;

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
        NAVIGATION_LINE_PATTERN.test(
          line
        )
      ) {
        continue;
      }

      if (
        /^iş haqqında\s*:?\s*$/i.test(
          line
        )
      ) {
        afterAbout =
          true;

        continue;
      }

      if (
        /^görəcəyiniz işlər\s*:?\s*$/i.test(
          line
        ) ||
        /^bizim üçün uyğun namizəd\s*:?\s*$/i.test(
          line
        ) ||
        /^biz nə təklif edirik\s*:?\s*$/i.test(
          line
        ) ||
        /^responsibilities\s*:?\s*$/i.test(
          line
        ) ||
        /^requirements?\s*:?\s*$/i.test(
          line
        ) ||
        /^qualifications?\s*:?\s*$/i.test(
          line
        )
      ) {
        break;
      }

      /*
       * Before "İş haqqında" we only skip page metadata/navigation.
       */
      if (
        !afterAbout
      ) {
        if (
          /^(?:daimi|müqavilə|tam gün|yarım gün|full[- ]?time|part[- ]?time|contract)$/i.test(
            line
          )
        ) {
          continue;
        }

        continue;
      }

      cleaned.push(
        line
      );
    }

    const description =
      uniqueStrings(
        cleaned
      )
        .join(
          " "
        )
        .trim();

    if (
      description.length >=
      40
    ) {
      return description.slice(
        0,
        4_000
      );
    }

    /*
     * ABB often has no standalone paragraph under "İş haqqında".
     * In that case create a concise description from the real
     * structured data instead of dumping the entire web page.
     */
    const fallbackParts =
      [
        ...responsibilities.slice(
          0,
          2
        ),
        ...requirements.slice(
          0,
          1
        ),
      ];

    return fallbackParts
      .join(
        " "
      )
      .slice(
        0,
        2_000
      );
  };

/* =========================================================
   INFERENCE HELPERS
========================================================= */

const inferEmploymentType =
  (
    text:
      string
  ): string | null => {
    const normalized =
      text
        .toLocaleLowerCase(
          "az"
        );

    if (
      /\btəcrübəçi\b|\bintern(ship)?\b/i.test(
        normalized
      )
    ) {
      return "internship";
    }

    if (
      /\bmüqavilə\b|\bcontract\b/i.test(
        normalized
      )
    ) {
      return "contract";
    }

    if (
      /\byarım\s*gün\b|\bpart[- ]?time\b/i.test(
        normalized
      )
    ) {
      return "part-time";
    }

    if (
      /\bdaimi\b|\btam\s*gün\b|\bfull[- ]?time\b/i.test(
        normalized
      )
    ) {
      return "full-time";
    }

    return null;
  };

const inferWorkMode =
  (
    text:
      string
  ): string | null => {
    const normalized =
      text
        .toLocaleLowerCase(
          "az"
        );

    if (
      /hibrid|hybrid/.test(
        normalized
      )
    ) {
      return "hybrid";
    }

    if (
      /remote|məsafədən/.test(
        normalized
      )
    ) {
      return "remote";
    }

    if (
      /ofis|onsite|on-site/.test(
        normalized
      )
    ) {
      return "onsite";
    }

    /*
     * ABB vacancy pages are normally physical positions unless
     * explicitly marked remote/hybrid.
     */
    return "onsite";
  };

const inferExperienceLevel =
  (
    title:
      string,
    requirements:
      string[]
  ): string | null => {
    const combined =
      `${title} ${requirements.join(
        " "
      )}`
        .toLocaleLowerCase(
          "az"
        );

    if (
      /baş\s+mütəxəssis|senior|lead|principal|ekspert/.test(
        combined
      )
    ) {
      return "senior";
    }

    if (
      /aparıcı\s+mütəxəssis|mid|2[-–— ]?3 il|minimum 2 il|minimum 3 il/.test(
        combined
      )
    ) {
      return "mid";
    }

    if (
      /kiçik\s+mütəxəssis|junior|minimum 1 il|1 il/.test(
        combined
      )
    ) {
      return "junior";
    }

    if (
      /təcrübəçi|intern/.test(
        combined
      )
    ) {
      return "entry";
    }

    return null;
  };

const inferLocation =
  (
    title:
      string,
    bodyText:
      string
  ): string => {
    const locations = [
      "Bakı",
      "Naxçıvan",
      "İsmayıllı",
      "Gəncə",
      "Sumqayıt",
      "Şəki",
      "Quba",
      "Xaçmaz",
      "Lənkəran",
      "Mingəçevir",
      "Şirvan",
      "Salyan",
      "Masallı",
      "Bərdə",
      "Sabirabad",
      "Şəmkir",
      "Qəbələ",
      "Ağcabədi",
      "Biləsuvar",
      "Beyləqan",
      "İmişli",
      "Tərtər",
      "Saatlı",
    ];

    const normalizedTitle =
      title.toLocaleLowerCase(
        "az"
      );

    const titleLocation =
      locations.find(
        (
          location
        ) =>
          normalizedTitle.includes(
            location
              .toLocaleLowerCase(
                "az"
              )
          )
      );

    if (
      titleLocation
    ) {
      return titleLocation;
    }

    const locationLabelMatch =
      bodyText.match(
        /(?:iş yeri|yerləşmə|location|məkan)\s*:?\s*([^\n]+)/i
      );

    const labeledText =
      normalizeWhitespace(
        locationLabelMatch?.[1]
      );

    if (
      labeledText
    ) {
      const labeledLocation =
        locations.find(
          (
            location
          ) =>
            labeledText
              .toLocaleLowerCase(
                "az"
              )
              .includes(
                location
                  .toLocaleLowerCase(
                    "az"
                  )
              )
        );

      if (
        labeledLocation
      ) {
        return labeledLocation;
      }
    }

    return "Azerbaijan";
  };

/* =========================================================
   DETAIL PARSER
========================================================= */

const parseAbbVacancyDetail =
  async (
    context:
      BrowserContext,
    url:
      string,
    timeoutMs:
      number
  ): Promise<IAbbCareersJob> => {
    const page =
      await context.newPage();

    page.setDefaultTimeout(
      timeoutMs
    );

    try {
      await page.goto(
        url,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            timeoutMs,
        }
      );

      try {
        await page.waitForLoadState(
          "networkidle",
          {
            timeout:
              8_000,
          }
        );
      } catch {
        // SPA may keep requests open.
      }

      await page.waitForTimeout(
        500
      );

      const externalId =
        extractExternalId(
          url
        );

      if (
        !externalId
      ) {
        throw new Error(
          "ABB vacancy id not found."
        );
      }

      const title =
        normalizeWhitespace(
          await safeText(
            page.locator(
              "h1"
            )
          )
        ) ||
        normalizeWhitespace(
          await safeText(
            page.locator(
              "h2"
            )
          )
        ) ||
        `ABB vacancy ${externalId}`;

      const bodyText =
        normalizeMultilineText(
          await page
            .locator(
              "body"
            )
            .innerText()
        );

      const contentText =
        await getContentRootText(
          page
        );

      /*
       * Step 1 — DOM extraction.
       */
      const domSections =
        await getStructuredSectionsFromDom(
          page
        );

      /*
       * Step 2 — visible-text fallback.
       */
      const responsibilities =
        domSections
          .responsibilities
          .length >
        0
          ? domSections
              .responsibilities
          : extractTextSection(
              contentText,
              [
                /^görəcəyiniz işlər\s*:?\s*$/i,
                /^what you will do\s*:?\s*$/i,
                /^responsibilities\s*:?\s*$/i,
              ],
              [
                /^bizim üçün uyğun namizəd\s*:?\s*$/i,
                /^requirements?\s*:?\s*$/i,
                /^qualifications?\s*:?\s*$/i,
                /^biz nə təklif edirik\s*:?\s*$/i,
                /^üstünlüklər\s*:?\s*$/i,
                /^benefits?\s*:?\s*$/i,
                /^what we offer\s*:?\s*$/i,
                /^müraciət et\s*:?\s*$/i,
              ]
            );

      const requirements =
        domSections
          .requirements
          .length >
        0
          ? domSections
              .requirements
          : extractTextSection(
              contentText,
              [
                /^bizim üçün uyğun namizəd\s*:?\s*$/i,
                /^requirements?\s*:?\s*$/i,
                /^qualifications?\s*:?\s*$/i,
              ],
              [
                /^biz nə təklif edirik\s*:?\s*$/i,
                /^üstünlüklər\s*:?\s*$/i,
                /^benefits?\s*:?\s*$/i,
                /^what we offer\s*:?\s*$/i,
                /^müraciət et\s*:?\s*$/i,
              ]
            );

      const benefits =
        domSections
          .benefits
          .length >
        0
          ? domSections
              .benefits
          : extractTextSection(
              contentText,
              [
                /^biz nə təklif edirik\s*:?\s*$/i,
                /^üstünlüklər\s*:?\s*$/i,
                /^benefits?\s*:?\s*$/i,
                /^what we offer\s*:?\s*$/i,
              ],
              [
                /^müraciət et\s*:?\s*$/i,
              ]
            );

      const description =
        buildCleanDescription(
          contentText,
          title,
          responsibilities,
          requirements
        );

      /*
       * Skills should come from actual vacancy content,
       * not navigation/footer text.
       */
      const skillSourceText =
        [
          title,
          description,
          ...requirements,
          ...responsibilities,
        ]
          .join(
            "\n"
          );

      const skills =
        detectSkills(
          skillSourceText
        );

      const summary =
        (
          description ||
          responsibilities[0] ||
          requirements[0] ||
          title
        )
          .slice(
            0,
            700
          );

      return {
        externalId,

        title,

        company:
          "ABB",

        location:
          inferLocation(
            title,
            contentText
          ),

        summary,

        description,

        requirements,

        responsibilities,

        benefits,

        skills,

        employmentType:
          inferEmploymentType(
            contentText
          ),

        experienceLevel:
          inferExperienceLevel(
            title,
            requirements
          ),

        workMode:
          inferWorkMode(
            contentText
          ),

        salaryMin:
          null,

        salaryMax:
          null,

        salaryCurrency:
          null,

        deadline:
          null,

        postedAt:
          null,

        url,

        applyUrl:
          url,

        source:
          "ABB Careers",
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
    TResult
  >(
    items:
      T[],
    worker:
      (
        item:
          T,
        index:
          number
      ) => Promise<TResult>,
    concurrency:
      number
  ): Promise<TResult[]> => {
    const results =
      new Array<TResult>(
        items.length
      );

    let nextIndex =
      0;

    const workerCount =
      Math.max(
        1,
        Math.min(
          concurrency,
          items.length ||
            1
        )
      );

    const workers =
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
   MAIN
========================================================= */

export const discoverAbbCareersJobs =
  async (
    input:
      IAbbCareersDiscoveryInput =
      {}
  ): Promise<IAbbCareersDiscoveryResult> => {
    const careersUrl =
      input.careersUrl ||
      DEFAULT_CAREERS_URL;

    const timeoutMs =
      Math.max(
        10_000,
        input.requestTimeoutMs ??
          DEFAULT_TIMEOUT_MS
      );

    const maxJobs =
      Math.max(
        1,
        input.maxJobs ??
          DEFAULT_MAX_JOBS
      );

    const detailConcurrency =
      Math.max(
        1,
        input.detailConcurrency ??
          DEFAULT_DETAIL_CONCURRENCY
      );

    const baseUrl =
      new URL(
        careersUrl
      ).origin;

    let browser:
      Browser |
      null =
      null;

    const diagnostics = {
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

      listingFallbacks:
        0,

      errors:
        [] as string[],
    };

    try {
      console.log(
        "[ABB CAREERS PROVIDER] Opening vacancies page:",
        careersUrl
      );

      browser =
        await chromium.launch({
          headless:
            input.headless ??
            true,
        });

      const context =
        await browser.newContext({
          viewport: {
            width:
              1440,

            height:
              1000,
          },

          locale:
            "az-AZ",

          userAgent:
            USER_AGENT,
        });

      const listingPage =
        await context.newPage();

      listingPage.setDefaultTimeout(
        timeoutMs
      );

      await listingPage.goto(
        careersUrl,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            timeoutMs,
        }
      );

      diagnostics.fetchedPages +=
        1;

      try {
        await listingPage.waitForLoadState(
          "networkidle",
          {
            timeout:
              8_000,
          }
        );
      } catch {
        // Ignore.
      }

      await listingPage.waitForTimeout(
        700
      );

      const discoveredUrls =
        await loadAllVacancies(
          listingPage,
          baseUrl
        );

      diagnostics.discoveredLinks =
        discoveredUrls.length;

      const limitedUrls =
        discoveredUrls.slice(
          0,
          maxJobs
        );

      const listingItems =
        await getListingItems(
          listingPage,
          baseUrl
        );

      console.log(
        "[ABB CAREERS PROVIDER] Vacancy links discovered:",
        {
          discovered:
            discoveredUrls.length,

          processing:
            limitedUrls.length,

          sample:
            limitedUrls.slice(
              0,
              10
            ),
        }
      );

      if (
        !listingPage.isClosed()
      ) {
        await listingPage.close();
      }

      const buildFallback =
        (
          url:
            string
        ): IAbbCareersJob | null => {
          const externalId =
            extractExternalId(
              url
            );

          if (
            !externalId
          ) {
            return null;
          }

          const item =
            listingItems.get(
              url
            );

          const title =
            item?.title ||
            `ABB vacancy ${externalId}`;

          const description =
            (
              item?.cardText ||
              title
            )
              .slice(
                0,
                1800
              );

          return {
            externalId,

            title,

            company:
              "ABB",

            location:
              inferLocation(
                title,
                description
              ),

            summary:
              description.slice(
                0,
                600
              ),

            description,

            requirements:
              [],

            responsibilities:
              [],

            benefits:
              [],

            skills:
              detectSkills(
                `${title} ${description}`
              ),

            employmentType:
              inferEmploymentType(
                description
              ),

            experienceLevel:
              inferExperienceLevel(
                title,
                []
              ),

            workMode:
              inferWorkMode(
                description
              ),

            salaryMin:
              null,

            salaryMax:
              null,

            salaryCurrency:
              null,

            deadline:
              null,

            postedAt:
              null,

            url,

            applyUrl:
              url,

            source:
              "ABB Careers",
          };
        };

      console.log(
        "[ABB CAREERS PROVIDER] Starting detail scraping:",
        {
          vacancies:
            limitedUrls.length,

          concurrency:
            detailConcurrency,
        }
      );

      const detailResults =
        await runWithConcurrency(
          limitedUrls,

          async (
            vacancyUrl
          ) => {
            try {
              const job =
                await parseAbbVacancyDetail(
                  context,
                  vacancyUrl,
                  timeoutMs
                );

              return {
                job,

                usedFallback:
                  false,

                error:
                  "",
              };
            } catch (
              error
            ) {
              const fallback =
                buildFallback(
                  vacancyUrl
                );

              return {
                job:
                  fallback,

                usedFallback:
                  Boolean(
                    fallback
                  ),

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
        IAbbCareersJob[] =
        [];

      for (
        let index =
          0;
        index <
        detailResults.length;
        index +=
          1
      ) {
        diagnostics.detailPagesFetched +=
          1;

        const result =
          detailResults[
            index
          ];

        if (
          result.job
        ) {
          jobs.push(
            result.job
          );

          diagnostics.acceptedJobs +=
            1;

          if (
            result.usedFallback
          ) {
            diagnostics.listingFallbacks +=
              1;

            diagnostics.errors.push(
              `${limitedUrls[index]}: detail failed; listing fallback used: ${result.error}`
            );
          }

          continue;
        }

        diagnostics.rejectedJobs +=
          1;

        diagnostics.errors.push(
          `${limitedUrls[index]}: ${result.error}`
        );
      }

      console.log(
        "[ABB CAREERS PROVIDER] Listing + detail discovery complete:",
        {
          discovered:
            discoveredUrls.length,

          returned:
            jobs.length,

          detailPagesFetched:
            diagnostics
              .detailPagesFetched,

          listingFallbacks:
            diagnostics
              .listingFallbacks,

          sampleJobs:
            jobs
              .slice(
                0,
                5
              )
              .map(
                (
                  job
                ) => ({
                  externalId:
                    job.externalId,

                  title:
                    job.title,

                  location:
                    job.location,

                  descriptionLength:
                    job.description.length,

                  requirements:
                    job.requirements.length,

                  responsibilities:
                    job.responsibilities.length,

                  benefits:
                    job.benefits.length,

                  skills:
                    job.skills,

                  url:
                    job.url,
                })
              ),
        }
      );

      return {
        baseUrl,

        urls:
          limitedUrls,

        jobs,

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
        "[ABB CAREERS PROVIDER] Discovery failed:",
        {
          error:
            message,

          diagnostics,
        }
      );

      return {
        baseUrl,

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

export default {
  discoverAbbCareersJobs,
};