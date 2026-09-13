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

export interface IBirCareersJob {
  externalId: string;
  title: string;
  company: string;
  brand: string;
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

  source: "Bir Careers";
}

export interface IBirCareersDiscoveryInput {
  careersUrl?: string;
  requestTimeoutMs?: number;
  maxJobs?: number;
  headless?: boolean;
  detailConcurrency?: number;
}

export interface IBirCareersDiscoveryResult {
  baseUrl: string;
  urls: string[];
  jobs: IBirCareersJob[];

  diagnostics: {
    fetchedPages: number;
    discoveredLinks: number;
    detailPagesFetched: number;
    acceptedJobs: number;
    rejectedJobs: number;
    errors: string[];
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_CAREERS_URL =
  "https://careers.bir.az/vacancies";

const DEFAULT_TIMEOUT_MS =
  30_000;

const DEFAULT_MAX_JOBS =
  150;

const DEFAULT_DETAIL_CONCURRENCY =
  4;

const DEFAULT_COMPANY_NAME =
  "Kapital Bank / Bir";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/152.0.0.0 Safari/537.36";

const REAL_VACANCY_PATH_REGEX =
  /^\/vacancies\/(\d+)\/?$/i;

const KNOWN_BRANDS = [
  "Birbank",
  "Birmarket",
  "m10",
  "Milliön",
  "Bir",
] as const;

const EXPERIENCE_LABELS = [
  "Təcrübəçi",
  "Kiçik mütəxəssis",
  "Mütəxəssis",
  "Aparıcı mütəxəssis",
  "Baş mütəxəssis",
  "Ekspert",
  "Orta rəhbərlik",
  "Yuxarı rəhbərlik",
  "L4 Baş mütəxəssis",
] as const;

const WORK_MODE_LABELS = [
  "Ofisdən işləmək",
  "Hibrid",
  "Hibrid işləmək",
  "Məsafədən işləmək",
  "Remote",
  "Hybrid",
  "Onsite",
] as const;

const KNOWN_LOCATIONS = [
  "Bakı",
  "Baku",
  "Ağcabədi",
  "Agjabadi",
  "Quba",
  "Xaçmaz",
  "Khachmaz",
  "Qəbələ",
  "Gabala",
  "Gəncə",
  "Ganja",
  "Naxçıvan",
  "Nakhchivan",
  "Sumqayıt",
  "Sumgait",
  "Şəki",
  "Shaki",
  "Şirvan",
  "Shirvan",
  "Salyan",
  "Lənkəran",
  "Mingəçevir",
  "Masallı",
  "Bərdə",
  "Saatlı",
  "Sabirabad",
  "Tərtər",
  "Biləsuvar",
  "Beyləqan",
  "İmişli",
  "Şəmkir",
] as const;

/* =========================================================
   BASIC HELPERS
========================================================= */

const normalizeWhitespace = (
  value: string | null | undefined
): string => {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim() ||
    ""
  );
};

const normalizeMultilineText = (
  value: string | null | undefined
): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(/\r/g, "")
    .split("\n")
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join("\n");
};

const uniqueStrings = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] =
    [];

  for (const value of values) {
    const normalized =
      normalizeWhitespace(value);

    if (!normalized) {
      continue;
    }

    const key =
      normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push(normalized);
  }

  return result;
};

const normalizeBaseUrl = (
  value?: string
): string => {
  const raw =
    normalizeWhitespace(value) ||
    DEFAULT_CAREERS_URL;

  const withProtocol =
    /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  return new URL(
    withProtocol
  ).toString();
};

const isRealVacancyUrl = (
  value: string,
  baseUrl: string
): boolean => {
  try {
    const parsed =
      new URL(
        value,
        baseUrl
      );

    return (
      parsed.hostname ===
        "careers.bir.az" &&
      REAL_VACANCY_PATH_REGEX.test(
        parsed.pathname
      )
    );
  } catch {
    return false;
  }
};

const canonicalizeVacancyUrl = (
  value: string,
  baseUrl: string
): string => {
  try {
    const parsed =
      new URL(
        value,
        baseUrl
      );

    if (
      !isRealVacancyUrl(
        parsed.toString(),
        baseUrl
      )
    ) {
      return "";
    }

    parsed.search = "";
    parsed.hash = "";

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

const extractExternalId = (
  url: string
): string => {
  try {
    const parsed =
      new URL(url);

    const match =
      parsed.pathname.match(
        REAL_VACANCY_PATH_REGEX
      );

    return match?.[1] || "";
  } catch {
    return "";
  }
};

/* =========================================================
   CONTENT CLEANUP
========================================================= */

const isLegalFooterText = (
  value: string
): boolean => {
  const normalized =
    normalizeWhitespace(value);

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("©") ||
    /kapital bank"? asc/i.test(
      normalized
    ) ||
    /bank lisenziyası/i.test(
      normalized
    ) ||
    /neftçilər pr\./i.test(
      normalized
    ) ||
    /əmtəə nişanıdır/i.test(
      normalized
    )
  );
};

const isNavigationNoise = (
  value: string
): boolean => {
  const normalized =
    normalizeWhitespace(value)
      .toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    /^(ana səhifə|vakansiyalar|haqqımızda|profil|filter|search|müraciət et|apply)$/i.test(
      normalized
    ) ||
    normalized.includes(
      "cookie"
    )
  );
};

const cleanContentLines = (
  values: string[]
): string[] => {
  return uniqueStrings(
    values
      .map(normalizeWhitespace)
      .filter(Boolean)
      .filter(
        (value) =>
          !isLegalFooterText(value)
      )
      .filter(
        (value) =>
          !isNavigationNoise(value)
      )
  );
};

/* =========================================================
   SAFE PLAYWRIGHT HELPERS
========================================================= */

const safeText = async (
  locator: Locator
): Promise<string> => {
  try {
    if (
      (await locator.count()) ===
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
  locator: Locator
): Promise<string> => {
  try {
    if (
      (await locator.count()) ===
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

const safeAllTexts = async (
  locator: Locator
): Promise<string[]> => {
  const values:
    string[] =
    [];

  try {
    const count =
      await locator.count();

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const text =
        normalizeWhitespace(
          await locator
            .nth(index)
            .textContent()
        );

      if (text) {
        values.push(text);
      }
    }
  } catch {
    // Return collected values.
  }

  return uniqueStrings(values);
};

const waitForPageToSettle =
  async (
    page: Page
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
            7_000,
        }
      );
    } catch {
      // SPA may keep connections open.
    }

    if (
      !page.isClosed()
    ) {
      await page.waitForTimeout(
        750
      );
    }
  };

/* =========================================================
   LISTING DISCOVERY
========================================================= */

const getCurrentVacancyUrls =
  async (
    page: Page,
    baseUrl: string
  ): Promise<string[]> => {
    const anchors =
      page.locator(
        'a[href*="/vacancies/"]'
      );

    const count =
      await anchors.count();

    const urls:
      string[] =
      [];

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      try {
        const href =
          await anchors
            .nth(index)
            .getAttribute("href");

        if (!href) {
          continue;
        }

        const normalized =
          canonicalizeVacancyUrl(
            href,
            baseUrl
          );

        if (normalized) {
          urls.push(normalized);
        }
      } catch {
        // Continue.
      }
    }

    return uniqueStrings(urls);
  };

const tryClickLoadMore =
  async (
    page: Page
  ): Promise<boolean> => {
    const candidates = [
      page.getByRole(
        "button",
        {
          name:
            /daha çox|daha çox göstər|show more|load more|more/i,
        }
      ),

      page.getByRole(
        "link",
        {
          name:
            /daha çox|daha çox göstər|show more|load more|more/i,
        }
      ),

      page.locator(
        'button:has-text("Daha çox"), button:has-text("Show more"), button:has-text("Load more")'
      ),
    ];

    for (
      const candidate of candidates
    ) {
      try {
        const count =
          await candidate.count();

        for (
          let index = 0;
          index < count;
          index += 1
        ) {
          const item =
            candidate.nth(index);

          if (
            !(
              await item.isVisible()
            )
          ) {
            continue;
          }

          await item.click({
            timeout:
              2_500,
          });

          if (
            !page.isClosed()
          ) {
            await page.waitForTimeout(
              900
            );
          }

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
    page: Page,
    baseUrl: string
  ): Promise<string[]> => {
    const discovered =
      new Set<string>();

    let stableRounds =
      0;

    let previousSize =
      0;

    for (
      let round = 0;
      round < 40;
      round += 1
    ) {
      const currentUrls =
        await getCurrentVacancyUrls(
          page,
          baseUrl
        );

      for (
        const url of currentUrls
      ) {
        discovered.add(url);
      }

      const clicked =
        await tryClickLoadMore(
          page
        );

      try {
        await page.mouse.wheel(
          0,
          6000
        );
      } catch {
        // Ignore.
      }

      if (
        !page.isClosed()
      ) {
        await page.waitForTimeout(
          clicked
            ? 1_000
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
        stableRounds >=
        5
      ) {
        break;
      }
    }

    const finalUrls =
      await getCurrentVacancyUrls(
        page,
        baseUrl
      );

    for (
      const url of finalUrls
    ) {
      discovered.add(url);
    }

    return [
      ...discovered,
    ];
  };

/* =========================================================
   SECTION EXTRACTION
========================================================= */

const getSectionContent =
  async (
    page: Page,
    headingPatterns: RegExp[]
  ): Promise<{
    text: string;
    items: string[];
  }> => {
    const headings =
      page.locator(
        "h1, h2, h3, h4, h5, h6, strong, b"
      );

    const count =
      await headings.count();

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const heading =
        headings.nth(index);

      const headingText =
        normalizeWhitespace(
          await heading.textContent()
        );

      if (!headingText) {
        continue;
      }

      const matches =
        headingPatterns.some(
          (pattern) =>
            pattern.test(
              headingText
            )
        );

      if (!matches) {
        continue;
      }

      const containers = [
        heading.locator(
          "xpath=parent::*"
        ),

        heading.locator(
          "xpath=ancestor::section[1]"
        ),

        heading.locator(
          "xpath=ancestor::div[1]"
        ),

        heading.locator(
          "xpath=ancestor::div[2]"
        ),
      ];

      for (
        const container of containers
      ) {
        try {
          if (
            (await container.count()) ===
            0
          ) {
            continue;
          }

          const first =
            container.first();

          const listItems =
            cleanContentLines(
              await safeAllTexts(
                first.locator("li")
              )
            );

          const rawText =
            await safeInnerText(
              first
            );

          const lines =
            cleanContentLines(
              rawText
                .split("\n")
                .map(
                  normalizeWhitespace
                )
                .filter(
                  (line) =>
                    line &&
                    line.toLowerCase() !==
                      headingText.toLowerCase()
                )
            );

          if (
            listItems.length >
              0 ||
            lines.length >
              0
          ) {
            return {
              text:
                normalizeMultilineText(
                  lines.join("\n")
                ),

              items:
                listItems.length >
                0
                  ? listItems
                  : lines,
            };
          }
        } catch {
          // Try next container.
        }
      }
    }

    return {
      text:
        "",

      items:
        [],
    };
  };

/* =========================================================
   METADATA CARD EXTRACTION
========================================================= */

const getMetadataCardText =
  async (
    page: Page
  ): Promise<string> => {
    const deadlineLocators = [
      page.getByText(
        /son müraciət tarixi/i,
        {
          exact:
            false,
        }
      ),

      page.getByText(
        /son tarix/i,
        {
          exact:
            false,
        }
      ),
    ];

    for (
      const locator of
        deadlineLocators
    ) {
      const count =
        await locator.count();

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        const deadline =
          locator.nth(index);

        try {
          if (
            !(
              await deadline.isVisible()
            )
          ) {
            continue;
          }

          const ancestors = [
            deadline.locator(
              "xpath=ancestor::div[1]"
            ),

            deadline.locator(
              "xpath=ancestor::div[2]"
            ),

            deadline.locator(
              "xpath=ancestor::div[3]"
            ),

            deadline.locator(
              "xpath=ancestor::section[1]"
            ),
          ];

          let best =
            "";

          for (
            const ancestor of
              ancestors
          ) {
            if (
              (await ancestor.count()) ===
              0
            ) {
              continue;
            }

            const text =
              await safeInnerText(
                ancestor.first()
              );

            if (
              !text
            ) {
              continue;
            }

            /*
             * The metadata block should contain the deadline,
             * but should stay relatively compact.
             */
            if (
              !/son müraciət tarixi|son tarix/i.test(
                text
              )
            ) {
              continue;
            }

            if (
              text.length >
              900
            ) {
              continue;
            }

            if (
              !best ||
              text.length >
                best.length
            ) {
              best =
                text;
            }
          }

          if (best) {
            return best;
          }
        } catch {
          // Continue.
        }
      }
    }

    return "";
  };

const parseMetadataLines = (
  metadataText: string
): string[] => {
  return cleanContentLines(
    metadataText
      .split("\n")
      .map(
        normalizeWhitespace
      )
  );
};

const detectBrand = (
  metadataLines: string[]
): string => {
  for (
    const line of metadataLines
  ) {
    for (
      const brand of
        KNOWN_BRANDS
    ) {
      if (
        line.toLowerCase() ===
        brand.toLowerCase()
      ) {
        return brand;
      }
    }
  }

  return "Bir";
};

const detectWorkMode = (
  metadataLines: string[]
): string | null => {
  for (
    const line of metadataLines
  ) {
    const normalized =
      line.toLowerCase();

    if (
      /hibrid|hybrid/i.test(
        normalized
      )
    ) {
      return "hybrid";
    }

    if (
      /məsafədən|remote/i.test(
        normalized
      )
    ) {
      return "remote";
    }

    if (
      /ofisdən işləmək|onsite|office/i.test(
        normalized
      )
    ) {
      return "onsite";
    }
  }

  return null;
};

const detectExperienceLevel = (
  metadataLines: string[]
): string | null => {
  for (
    const line of metadataLines
  ) {
    const normalized =
      line.toLowerCase();

    if (
      normalized ===
      "təcrübəçi"
    ) {
      return "intern";
    }

    if (
      normalized.includes(
        "kiçik mütəxəssis"
      )
    ) {
      return "junior";
    }

    if (
      normalized.includes(
        "orta rəhbərlik"
      ) ||
      normalized.includes(
        "yuxarı rəhbərlik"
      )
    ) {
      return "manager";
    }

    if (
      normalized.includes(
        "baş mütəxəssis"
      ) ||
      normalized.includes(
        "aparıcı mütəxəssis"
      ) ||
      normalized.includes(
        "l4"
      ) ||
      normalized.includes(
        "ekspert"
      )
    ) {
      return "senior";
    }

    if (
      normalized ===
      "mütəxəssis"
    ) {
      return "mid";
    }
  }

  return null;
};

const extractDeadline = (
  metadataText: string,
  fullText: string
): string | null => {
  const combined =
    `${metadataText}\n${fullText}`;

  const patterns = [
    /son müraciət tarixi:\s*(\d{2}\.\d{2}\.\d{4})/i,

    /son tarix:\s*(\d{2}\.\d{2}\.\d{4})/i,

    /deadline:\s*(\d{2}\.\d{2}\.\d{4})/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      combined.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      return match[1];
    }
  }

  return null;
};

const detectLocationFromMetadata = (
  metadataLines: string[],
  title: string
): string => {
  /*
   * IMPORTANT:
   *
   * For branch vacancies the real location is often explicitly
   * encoded in the title:
   *
   *   Ağcabədi Filialının ...
   *   Quba filialının ...
   *   Xaçmaz Filialının ...
   *
   * The metadata card can contain a generic/office location such as
   * Bakı or another nearby value. Therefore title-based branch
   * detection MUST have priority over metadata.
   */
  for (
    const location of
      KNOWN_LOCATIONS
  ) {
    const escaped =
      location.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const branchPattern =
      new RegExp(
        `(^|[^A-Za-zƏəÖöÜüĞğŞşÇçİı])${escaped}(?:\\s+(?:filialının|filialı|regional|regionu|region üzrə))?([^A-Za-zƏəÖöÜüĞğŞşÇçİı]|$)`,
        "i"
      );

    if (
      branchPattern.test(
        title
      )
    ) {
      return location;
    }
  }

  /*
   * If the title does not carry a branch/city signal, use the
   * structured metadata card.
   */
  for (
    const line of metadataLines
  ) {
    const exact =
      KNOWN_LOCATIONS.find(
        (location) =>
          line.toLowerCase() ===
          location.toLowerCase()
      );

    if (
      exact
    ) {
      return exact;
    }
  }

  return "Azerbaijan";
};

/* =========================================================
   SALARY
========================================================= */

const parseSalary = (
  text: string
): {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
} => {
  const normalized =
    text.replace(
      /,/g,
      ""
    );

  const range1 =
    normalized.match(
      /(\d{3,6})\s*[-–—]\s*(\d{3,6})\s*(AZN|₼|USD|EUR)/i
    );

  if (range1) {
    return {
      salaryMin:
        Number(
          range1[1]
        ),

      salaryMax:
        Number(
          range1[2]
        ),

      salaryCurrency:
        range1[3] ===
        "₼"
          ? "AZN"
          : range1[3].toUpperCase(),
    };
  }

  const range2 =
    normalized.match(
      /(AZN|₼|USD|EUR)\s*(\d{3,6})\s*[-–—]\s*(\d{3,6})/i
    );

  if (range2) {
    return {
      salaryMin:
        Number(
          range2[2]
        ),

      salaryMax:
        Number(
          range2[3]
        ),

      salaryCurrency:
        range2[1] ===
        "₼"
          ? "AZN"
          : range2[1].toUpperCase(),
    };
  }

  const single =
    normalized.match(
      /(?:maaş|salary)[:\s]*(\d{3,6})\s*(AZN|₼|USD|EUR)/i
    );

  if (single) {
    const amount =
      Number(
        single[1]
      );

    return {
      salaryMin:
        amount,

      salaryMax:
        amount,

      salaryCurrency:
        single[2] ===
        "₼"
          ? "AZN"
          : single[2].toUpperCase(),
    };
  }

  return {
    salaryMin:
      null,

    salaryMax:
      null,

    salaryCurrency:
      null,
  };
};

/* =========================================================
   SKILLS
========================================================= */

const detectSkills = (
  text: string
): string[] => {
  const lower =
    text.toLowerCase();

  const detected:
    string[] =
    [];

  for (
    const rawSkill of
      ALL_CAREER_SKILLS
  ) {
    const skill =
      normalizeWhitespace(
        String(rawSkill)
      );

    if (!skill) {
      continue;
    }

    const normalizedSkill =
      skill.toLowerCase();

    const escaped =
      normalizedSkill.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const boundaryRegex =
      new RegExp(
        `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
        "i"
      );

    if (
      boundaryRegex.test(
        lower
      )
    ) {
      detected.push(skill);
    }
  }

  return uniqueStrings(
    detected
  );
};

/* =========================================================
   APPLY URL
========================================================= */

const extractApplyUrl =
  async (
    page: Page,
    detailUrl: string
  ): Promise<string> => {
    const candidates = [
      page.getByRole(
        "link",
        {
          name:
            /müraciət et|apply/i,
        }
      ),

      page.getByRole(
        "button",
        {
          name:
            /müraciət et|apply/i,
        }
      ),

      page.locator(
        'a[href*="#attachFile"]'
      ),
    ];

    for (
      const candidate of candidates
    ) {
      try {
        const count =
          await candidate.count();

        for (
          let index = 0;
          index < count;
          index += 1
        ) {
          const item =
            candidate.nth(index);

          if (
            !(
              await item.isVisible()
            )
          ) {
            continue;
          }

          const href =
            await item.getAttribute(
              "href"
            );

          if (href) {
            return new URL(
              href,
              detailUrl
            ).toString();
          }

          const anchor =
            item.locator(
              "xpath=ancestor-or-self::a[1]"
            );

          if (
            (await anchor.count()) >
            0
          ) {
            const anchorHref =
              await anchor.getAttribute(
                "href"
              );

            if (
              anchorHref
            ) {
              return new URL(
                anchorHref,
                detailUrl
              ).toString();
            }
          }
        }
      } catch {
        // Try next candidate.
      }
    }

    return detailUrl;
  };

/* =========================================================
   SUMMARY / DESCRIPTION
========================================================= */

const extractIntroParagraphs =
  async (
    page: Page,
    title: string,
    excludedItems: string[]
  ): Promise<string[]> => {
    const paragraphs =
      await safeAllTexts(
        page.locator("p")
      );

    const excluded =
      new Set(
        excludedItems.map(
          (value) =>
            normalizeWhitespace(value)
              .toLowerCase()
        )
      );

    return cleanContentLines(
      paragraphs
    ).filter(
      (value) => {
        if (
          value.toLowerCase() ===
          title.toLowerCase()
        ) {
          return false;
        }

        if (
          excluded.has(
            value.toLowerCase()
          )
        ) {
          return false;
        }

        return (
          value.length >=
            60 &&
          value.length <=
            1800
        );
      }
    );
  };

/* =========================================================
   DETAIL PARSER
========================================================= */

const parseBirVacancyDetail =
  async (
    context: BrowserContext,
    url: string,
    timeoutMs: number
  ): Promise<IBirCareersJob> => {
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

      await waitForPageToSettle(
        page
      );

      const finalUrl =
        canonicalizeVacancyUrl(
          page.url(),
          url
        );

      if (!finalUrl) {
        throw new Error(
          `Unexpected vacancy detail URL: ${page.url()}`
        );
      }

      const externalId =
        extractExternalId(
          finalUrl
        );

      if (!externalId) {
        throw new Error(
          `Vacancy ID not found: ${finalUrl}`
        );
      }

      const title =
        (
          await safeText(
            page.locator("h1")
          )
        ) ||
        (
          await safeText(
            page.locator("h2")
          )
        );

      if (!title) {
        throw new Error(
          `Vacancy title not found: ${finalUrl}`
        );
      }

      const fullText =
        await safeInnerText(
          page.locator("body")
        );

      const metadataText =
        await getMetadataCardText(
          page
        );

      const metadataLines =
        parseMetadataLines(
          metadataText
        );

      const about =
        await getSectionContent(
          page,
          [
            /^about the role$/i,
            /^rol haqqında$/i,
            /^vəzifə haqqında$/i,
            /^iş haqqında$/i,
          ]
        );

      const requirementsSection =
        await getSectionContent(
          page,
          [
            /^requirements$/i,
            /^tələblər$/i,
            /^tələblər və bacarıqlar$/i,
            /^namizədə tələblər$/i,
          ]
        );

      const responsibilitiesSection =
        await getSectionContent(
          page,
          [
            /^obligations$/i,
            /^responsibilities$/i,
            /^öhdəliklər$/i,
            /^vəzifə öhdəlikləri$/i,
          ]
        );

      const benefitsSection =
        await getSectionContent(
          page,
          [
            /^benefits$/i,
            /^üstünlüklər$/i,
            /^biz nə təklif edirik$/i,
            /^təklif edirik$/i,
          ]
        );

      const excludedSectionItems =
        [
          ...requirementsSection.items,
          ...responsibilitiesSection.items,
          ...benefitsSection.items,
        ];

      const introParagraphs =
        await extractIntroParagraphs(
          page,
          title,
          excludedSectionItems
        );

      /*
       * Prefer explicit About the role.
       * Otherwise use the first clean intro paragraphs.
       */
      const cleanedAboutLines =
        cleanContentLines(
          about.text
            .split("\n")
        );

      let description =
        normalizeMultilineText(
          cleanedAboutLines.join("\n")
        );

      if (!description) {
        description =
          normalizeMultilineText(
            introParagraphs
              .slice(0, 2)
              .join("\n")
          );
      }

      if (!description) {
        description =
          normalizeMultilineText(
            [
              ...requirementsSection.items.slice(
                0,
                3
              ),

              ...responsibilitiesSection.items.slice(
                0,
                3
              ),
            ].join("\n")
          );
      }

      const summary =
        normalizeMultilineText(
          introParagraphs
            .slice(0, 2)
            .join("\n")
        ) ||
        description;

      const brand =
        detectBrand(
          metadataLines
        );

      const location =
        detectLocationFromMetadata(
          metadataLines,
          title
        );

      const experienceLevel =
        detectExperienceLevel(
          metadataLines
        );

      const workMode =
        detectWorkMode(
          metadataLines
        );

      const deadline =
        extractDeadline(
          metadataText,
          fullText
        );

      const salary =
        parseSalary(
          fullText
        );

      const applyUrl =
        await extractApplyUrl(
          page,
          finalUrl
        );

      const skills =
        detectSkills(
          [
            title,
            summary,
            description,
            requirementsSection.items.join(
              " "
            ),
            responsibilitiesSection.items.join(
              " "
            ),
            benefitsSection.items.join(
              " "
            ),
          ].join(" ")
        );

      return {
        externalId,

        title,

        company:
          DEFAULT_COMPANY_NAME,

        brand,

        location,

        summary,

        description,

        requirements:
          requirementsSection.items,

        responsibilities:
          responsibilitiesSection.items,

        benefits:
          benefitsSection.items,

        skills,

        employmentType:
          "full-time",

        experienceLevel,

        workMode,

        salaryMin:
          salary.salaryMin,

        salaryMax:
          salary.salaryMax,

        salaryCurrency:
          salary.salaryCurrency,

        deadline,

        postedAt:
          null,

        url:
          finalUrl,

        applyUrl,

        source:
          "Bir Careers",
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
  async <T, TResult>(
    items: T[],
    worker: (
      item: T,
      index: number
    ) => Promise<TResult>,
    concurrency: number
  ): Promise<TResult[]> => {
    const results =
      new Array<TResult>(
        items.length
      );

    let cursor =
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
      Array.from({
        length:
          workerCount,
      }).map(
        async () => {
          while (true) {
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
                items[index],
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
   MAIN DISCOVERY
========================================================= */

export const discoverBirCareersJobs =
  async (
    input:
      IBirCareersDiscoveryInput = {}
  ): Promise<IBirCareersDiscoveryResult> => {
    const careersUrl =
      normalizeBaseUrl(
        input.careersUrl
      );

    const baseUrl =
      new URL(
        careersUrl
      ).origin;

    const timeoutMs =
      Math.max(
        5_000,
        input.requestTimeoutMs ??
          DEFAULT_TIMEOUT_MS
      );

    const maxJobs =
      Math.max(
        1,
        Math.min(
          500,
          Math.floor(
            input.maxJobs ??
              DEFAULT_MAX_JOBS
          )
        )
      );

    const detailConcurrency =
      Math.max(
        1,
        Math.min(
          8,
          Math.floor(
            input.detailConcurrency ??
              DEFAULT_DETAIL_CONCURRENCY
          )
        )
      );

    const diagnostics:
      IBirCareersDiscoveryResult[
        "diagnostics"
      ] = {
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
      };

    let browser:
      Browser | null =
      null;

    try {
      console.log(
        "[BIR CAREERS PROVIDER] Opening vacancies page:",
        careersUrl
      );

      browser =
        await chromium.launch({
          headless:
            input.headless ??
            true,

          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ],
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

      await waitForPageToSettle(
        listingPage
      );

      if (
        new URL(
          listingPage.url()
        ).hostname !==
        "careers.bir.az"
      ) {
        throw new Error(
          `Unexpected careers redirect: ${listingPage.url()}`
        );
      }

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

      console.log(
        "[BIR CAREERS PROVIDER] Vacancy links discovered:",
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

      const detailResults =
        await runWithConcurrency(
          limitedUrls,

          async (
            vacancyUrl
          ) => {
            try {
              const job =
                await parseBirVacancyDetail(
                  context,
                  vacancyUrl,
                  timeoutMs
                );

              return {
                job,
                error:
                  "",
              };
            } catch (error) {
              return {
                job:
                  null,

                error:
                  error instanceof
                  Error
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
        IBirCareersJob[] =
        [];

      for (
        let index = 0;
        index <
        detailResults.length;
        index += 1
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

          continue;
        }

        diagnostics.rejectedJobs +=
          1;

        diagnostics.errors.push(
          `${limitedUrls[index]}: ${result.error}`
        );
      }

      if (
        !listingPage.isClosed()
      ) {
        await listingPage.close();
      }

      console.log(
        "[BIR CAREERS PROVIDER] Browser discovery complete:",
        {
          careersUrl,

          jobs:
            jobs.length,

          sampleJobs:
            jobs
              .slice(0, 5)
              .map(
                (job) => ({
                  externalId:
                    job.externalId,

                  title:
                    job.title,

                  brand:
                    job.brand,

                  location:
                    job.location,

                  experienceLevel:
                    job.experienceLevel,

                  workMode:
                    job.workMode,

                  deadline:
                    job.deadline,

                  salary:
                    job.salaryMin ||
                    job.salaryMax
                      ? {
                          min:
                            job.salaryMin,

                          max:
                            job.salaryMax,

                          currency:
                            job.salaryCurrency,
                        }
                      : null,

                  skills:
                    job.skills,

                  applyUrl:
                    job.applyUrl,
                })
              ),

          diagnostics,
        }
      );

      return {
        baseUrl,

        urls:
          jobs.map(
            (job) =>
              job.url
          ),

        jobs,

        diagnostics,
      };
    } catch (error) {
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
        "[BIR CAREERS PROVIDER] Browser discovery failed:",
        {
          careersUrl,

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
      if (browser) {
        await browser.close();
      }
    }
  };

/* =========================================================
   URL-ONLY COMPATIBILITY
========================================================= */

export const discoverBirCareersJobUrls =
  async (
    input:
      IBirCareersDiscoveryInput = {}
  ): Promise<{
    baseUrl: string;
    urls: string[];
    diagnostics:
      IBirCareersDiscoveryResult[
        "diagnostics"
      ];
  }> => {
    const result =
      await discoverBirCareersJobs(
        input
      );

    return {
      baseUrl:
        result.baseUrl,

      urls:
        result.urls,

      diagnostics:
        result.diagnostics,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  discoverBirCareersJobs,
  discoverBirCareersJobUrls,
};
