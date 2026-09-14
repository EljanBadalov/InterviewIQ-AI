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
      string |
      null |
      undefined
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
      string |
      null |
      undefined
  ): string => {
    if (
      !value
    ) {
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
        (
          line
        ) =>
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

      if (
        !normalized
      ) {
        continue;
      }

      const key =
        normalized
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
        normalized
      );
    }

    return result;
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
          )?.[
            1
          ] ||
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

const safeAllTexts =
  async (
    locator:
      Locator
  ): Promise<string[]> => {
    const values:
      string[] =
      [];

    try {
      const count =
        await locator.count();

      for (
        let index =
          0;
        index <
          count;
        index +=
          1
      ) {
        const value =
          normalizeWhitespace(
            await locator
              .nth(
                index
              )
              .textContent()
          );

        if (
          value
        ) {
          values.push(
            value
          );
        }
      }
    } catch {
      // Keep successfully collected items.
    }

    return uniqueStrings(
      values
    );
  };

/* =========================================================
   SKILLS
========================================================= */

const detectSkills =
  (
    text:
      string
  ): string[] => {
    const normalized =
      text
        .toLowerCase();

    return ALL_CAREER_SKILLS
      .filter(
        (
          skill
        ) => {
          const value =
            skill
              .toLowerCase();

          if (
            value ===
            "c++"
          ) {
            return /(?:^|[^a-z0-9])c\+\+(?:[^a-z0-9]|$)/i.test(
              text
            );
          }

          if (
            value ===
            "c#"
          ) {
            return /(?:^|[^a-z0-9])c#(?:[^a-z0-9]|$)/i.test(
              text
            );
          }

          if (
            value ===
            "node.js"
          ) {
            return /\bnode(?:\.js|\s+js)\b/i.test(
              text
            );
          }

          if (
            value ===
            "next.js"
          ) {
            return /\bnext(?:\.js|\s+js)\b/i.test(
              text
            );
          }

          if (
            value ===
            "rest api"
          ) {
            return /\brest(?:ful)?\s+api(?:s)?\b/i.test(
              text
            );
          }

          return normalized.includes(
            value
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
   DETAIL SECTION HELPERS
========================================================= */

const getSectionItemsByHeading =
  async (
    page:
      Page,
    headingPatterns:
      RegExp[]
  ): Promise<string[]> => {
    /*
     * ABB detail page structure is currently:
     *
     * <article class="populated-content">
     *   <p><strong>Görəcəyiniz işlər:</strong></p>
     *   <ul>...</ul>
     *
     *   <p><strong>Bizim üçün uyğun namizəd:</strong></p>
     *   <ul>...</ul>
     * </article>
     *
     * So we must move from the heading's parent <p> to its next
     * sibling <ul>/<ol>. Looking at heading.nextElementSibling
     * itself returns null because <strong> is nested inside <p>.
     */
    const data =
      await page.evaluate(
        (
          patternSources
        ) => {
          const article =
            document.querySelector<HTMLElement>(
              "article.populated-content"
            ) ||
            document.querySelector<HTMLElement>(
              "article"
            );

          if (
            !article
          ) {
            return [];
          }

          const headings =
            Array.from(
              article.querySelectorAll<HTMLElement>(
                "strong, h1, h2, h3, h4, h5, h6"
              )
            );

          for (
            const heading of
            headings
          ) {
            const headingText =
              (
                heading.innerText ||
                heading.textContent ||
                ""
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();

            let matches =
              false;

            for (
              const source of
              patternSources
            ) {
              if (
                new RegExp(
                  source,
                  "i"
                ).test(
                  headingText
                )
              ) {
                matches =
                  true;

                break;
              }
            }

            if (
              !matches
            ) {
              continue;
            }

            let current:
              Element |
              null =
              heading.parentElement
                ?.nextElementSibling ||
              null;

            let steps =
              0;

            while (
              current &&
              steps <
                12
            ) {
              if (
                current.tagName ===
                  "UL" ||
                current.tagName ===
                  "OL"
              ) {
                return Array.from(
                  current.querySelectorAll<HTMLElement>(
                    ":scope > li"
                  )
                )
                  .map(
                    (
                      li
                    ) =>
                      (
                        li.innerText ||
                        li.textContent ||
                        ""
                      )
                        .replace(
                          /\s+/g,
                          " "
                        )
                        .trim()
                  )
                  .filter(
                    Boolean
                  );
              }

              /*
               * Stop if the next section heading appears before a list.
               */
              const nestedHeading =
                current.querySelector<HTMLElement>(
                  "strong, h1, h2, h3, h4, h5, h6"
                );

              if (
                nestedHeading
              ) {
                const nestedText =
                  (
                    nestedHeading.innerText ||
                    nestedHeading.textContent ||
                    ""
                  )
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim();

                if (
                  /görəcəyiniz işlər|bizim üçün uyğun namizəd|iş haqqında|müraciət et|what you will do|responsibilities|requirements?|qualifications?|what we offer|benefits?/i.test(
                    nestedText
                  )
                ) {
                  break;
                }
              }

              current =
                current.nextElementSibling;

              steps +=
                1;
            }
          }

          return [];
        },
        headingPatterns.map(
          (
            pattern
          ) =>
            pattern.source
        )
      );

    return uniqueStrings(
      data
    )
      .filter(
        (
          item
        ) =>
          item.length >=
          3
      )
      .slice(
        0,
        50
      );
  };

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
        .toLowerCase();

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

    return null;
  };

const inferExperienceLevel =
  (
    title:
      string,
    requirements:
      string[]
  ): string | null => {
    const combined =
      `${title} ${requirements.join(" ")}`
        .toLowerCase();

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
    /*
     * Do not scan the full body blindly: ABB pages may contain
     * navigation/footer text with city names unrelated to the vacancy.
     *
     * Prefer the vacancy title first (many regional roles include
     * "- Naxçıvan", "- İsmayıllı", etc.). Only use body text when
     * a location-like label is present.
     */
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
            location.toLocaleLowerCase(
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
        locationLabelMatch?.[
          1
        ]
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

      const responsibilities =
        await getSectionItemsByHeading(
          page,
          [
            /^görəcəyiniz işlər\s*:?\s*$/i,
            /^what you will do\s*:?\s*$/i,
            /^responsibilities\s*:?\s*$/i,
          ]
        );

      const requirements =
        await getSectionItemsByHeading(
          page,
          [
            /^bizim üçün uyğun namizəd\s*:?\s*$/i,
            /^requirements?\s*:?\s*$/i,
            /^qualifications?\s*:?\s*$/i,
          ]
        );

      const benefits =
        await getSectionItemsByHeading(
          page,
          [
            /^biz nə təklif edirik\s*:?\s*$/i,
            /^üstünlüklər\s*:?\s*$/i,
            /^benefits?\s*:?\s*$/i,
            /^what we offer\s*:?\s*$/i,
          ]
        );

      const structuredText =
        uniqueStrings([
          ...responsibilities,
          ...requirements,
          ...benefits,
        ])
          .join(
            "\n"
          );

      const description =
        (
          structuredText ||
          bodyText
        )
          .slice(
            0,
            12_000
          );

      const skills =
        detectSkills(
          `${title}\n${description}`
        );

      const summary =
        (
          responsibilities[
            0
          ] ||
          requirements[
            0
          ] ||
          description
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
            bodyText
          ),

        summary,

        description,

        requirements,

        responsibilities,

        benefits,

        skills,

        employmentType:
          inferEmploymentType(
            bodyText
          ),

        experienceLevel:
          inferExperienceLevel(
            title,
            requirements
          ),

        workMode:
          inferWorkMode(
            bodyText
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
            diagnostics.detailPagesFetched,

          listingFallbacks:
            diagnostics.listingFallbacks,

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

                  requirements:
                    job.requirements.length,

                  responsibilities:
                    job.responsibilities.length,

                  skills:
                    job.skills.length,

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
