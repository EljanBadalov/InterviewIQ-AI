import {
  type JobSalaryPeriod,
} from "../models/Job";

/* =========================================================
   TYPES
========================================================= */

export interface IEmployerJobDetails {
  sourceUrl: string;

  description: string;

  responsibilities: string[];

  requirements: string[];

  preferredQualifications: string[];

  skills: string[];

  salary: number;

  salaryMin?: number;

  salaryMax?: number;

  salaryCurrency?: string;

  salaryPeriod?: JobSalaryPeriod;

  salaryIsPredicted?: boolean;
}

interface IStructuredSalary {
  salary: number;

  salaryMin?: number;

  salaryMax?: number;

  salaryCurrency?: string;

  salaryPeriod?: JobSalaryPeriod;
}

/* =========================================================
   CONSTANTS
========================================================= */

const REQUEST_TIMEOUT_MS =
  12_000;

const MAX_HTML_LENGTH =
  2_000_000;

const MAX_DESCRIPTION_LENGTH =
  20_000;

const TECH_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Redux",
  "HTML",
  "CSS",
  "SASS",
  "SCSS",
  "Tailwind CSS",
  "Git",
  "GitHub",
  "GitHub Copilot",
  "Node.js",
  "Express",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "SQL",
  "REST API",
  "GraphQL",
  "Jest",
  "Cypress",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Python",
  "Java",
  "C++",
  "C#",
  "PHP",
  "WordPress",
  "Figma",
];

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

/* =========================================================
   HTML DECODING
========================================================= */

const decodeHtmlEntities = (
  value:
    string
): string => {
  const named:
    Record<
      string,
      string
    > = {
      nbsp:
        " ",

      amp:
        "&",

      quot:
        '"',

      apos:
        "'",

      lt:
        "<",

      gt:
        ">",

      ndash:
        "–",

      mdash:
        "—",

      bull:
        "•",

      middot:
        "·",

      rsquo:
        "’",

      lsquo:
        "‘",

      rdquo:
        "”",

      ldquo:
        "“",
    };

  return value
    .replace(
      /&#(\d+);/g,
      (
        _match,
        decimal:
          string
      ) => {
        const code =
          Number(
            decimal
          );

        return Number.isFinite(
          code
        )
          ? String.fromCodePoint(
              code
            )
          : "";
      }
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (
        _match,
        hex:
          string
      ) => {
        const code =
          Number.parseInt(
            hex,
            16
          );

        return Number.isFinite(
          code
        )
          ? String.fromCodePoint(
              code
            )
          : "";
      }
    )
    .replace(
      /&([a-z]+);/gi,
      (
        match,
        entity:
          string
      ) =>
        named[
          entity
            .toLowerCase()
        ] ??
        match
    );
};

/* =========================================================
   HTML -> READABLE TEXT
========================================================= */

const htmlToReadableText = (
  html:
    string
): string => {
  let value =
    html;

  value =
    value.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ""
    );

  value =
    value.replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      ""
    );

  value =
    value.replace(
      /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
      ""
    );

  value =
    value.replace(
      /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
      ""
    );

  value =
    value.replace(
      /<(h[1-6])\b[^>]*>/gi,
      "\n\n"
    );

  value =
    value.replace(
      /<\/h[1-6]>/gi,
      "\n"
    );

  value =
    value.replace(
      /<br\s*\/?>/gi,
      "\n"
    );

  value =
    value.replace(
      /<li\b[^>]*>/gi,
      "\n• "
    );

  value =
    value.replace(
      /<\/li>/gi,
      "\n"
    );

  value =
    value.replace(
      /<\/p>/gi,
      "\n\n"
    );

  value =
    value.replace(
      /<\/div>/gi,
      "\n"
    );

  value =
    value.replace(
      /<\/section>/gi,
      "\n"
    );

  value =
    value.replace(
      /<[^>]+>/g,
      " "
    );

  value =
    decodeHtmlEntities(
      value
    );

  return value
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
};

/* =========================================================
   JSON-LD
========================================================= */

const extractJsonLdBlocks = (
  html:
    string
): unknown[] => {
  const blocks:
    unknown[] = [];

  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        regex.exec(
          html
        )
    )
  ) {
    const raw =
      decodeHtmlEntities(
        match[1]
          .trim()
      );

    if (
      !raw
    ) {
      continue;
    }

    try {
      blocks.push(
        JSON.parse(
          raw
        )
      );
    } catch {
      // Ignore malformed structured data.
    }
  }

  return blocks;
};

const isJobPostingType = (
  value:
    unknown
): boolean => {
  if (
    typeof value ===
    "string"
  ) {
    return value
      .toLowerCase() ===
      "jobposting";
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.some(
      isJobPostingType
    );
  }

  return false;
};

const findJobPosting = (
  value:
    unknown
): Record<
  string,
  any
> |
null => {
  if (
    !value
  ) {
    return null;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of
      value
    ) {
      const found =
        findJobPosting(
          item
        );

      if (
        found
      ) {
        return found;
      }
    }

    return null;
  }

  if (
    typeof value !==
    "object"
  ) {
    return null;
  }

  const record =
    value as
      Record<
        string,
        any
      >;

  if (
    isJobPostingType(
      record["@type"]
    )
  ) {
    return record;
  }

  if (
    record["@graph"]
  ) {
    const found =
      findJobPosting(
        record["@graph"]
      );

    if (
      found
    ) {
      return found;
    }
  }

  for (
    const nestedValue of
    Object.values(
      record
    )
  ) {
    if (
      typeof nestedValue !==
        "object" ||
      nestedValue ===
        null
    ) {
      continue;
    }

    const found =
      findJobPosting(
        nestedValue
      );

    if (
      found
    ) {
      return found;
    }
  }

  return null;
};

/* =========================================================
   TEXT ITEMS
========================================================= */

const splitIntoItems = (
  value:
    string
): string[] => {
  if (
    !value
  ) {
    return [];
  }

  const normalized =
    value
      .replace(
        /\s*[•▪●]\s*/g,
        "\n"
      )
      .replace(
        /^\s*[-*]\s+/gm,
        "\n"
      )
      .replace(
        /;\s+/g,
        "\n"
      );

  return uniqueStrings(
    normalized
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
  ).slice(
    0,
    25
  );
};

/* =========================================================
   SECTION HEADINGS
========================================================= */

const RESPONSIBILITY_HEADINGS = [
  "Responsibilities",
  "Key Responsibilities",
  "Core Responsibilities",
  "Primary Responsibilities",
  "Duties",
  "Job Duties",
  "What You'll Do",
  "What You Will Do",
  "What You’ll Do",
  "What You Will Be Doing",
];

const REQUIREMENT_HEADINGS = [
  "Experience Requirements",
  "Requirements",
  "Required Skills",
  "Required Experience",
  "Minimum Requirements",
  "Minimum Qualifications",
  "Required Qualifications",
  "Basic Qualifications",
  "Qualifications",
  "Technical Requirements",
  "Skills & Experience",
  "Skills and Experience",
  "What We're Looking For",
  "What We Are Looking For",
  "What You'll Need",
  "What You’ll Need",
];

const PREFERRED_HEADINGS = [
  "Preferred Qualifications",
  "Preferred Skills",
  "Preferred Experience",
  "Desired Qualifications",
  "Desired Skills",
  "Nice to Have",
  "Nice-to-Have",
  "Bonus",
  "Bonus Skills",
];

const NOISE_HEADINGS = [
  "Benefits",
  "Compensation",
  "Recruitment Transparency Notice",
  "About Eliassen Group",
  "About the Company",
  "About Us",
  "Equal Opportunity",
  "Equal Employment Opportunity",
  "Referral Program",
  "Privacy Notice",
];

const ALL_HEADINGS = [
  ...RESPONSIBILITY_HEADINGS,
  ...REQUIREMENT_HEADINGS,
  ...PREFERRED_HEADINGS,
  ...NOISE_HEADINGS,
];

/* =========================================================
   SECTION EXTRACTION
========================================================= */

const findHeadingIndex = (
  text:
    string,
  headings:
    string[]
): {
  index: number;

  length: number;
} |
null => {
  let best:
    {
      index:
        number;

      length:
        number;
    } |
    null =
    null;

  for (
    const heading of
    headings
  ) {
    const regex =
      new RegExp(
        `(?:^|\\n)\\s*${escapeRegExp(
          heading
        )}\\s*:?\\s*(?:\\n|$)`,
        "im"
      );

    const match =
      regex.exec(
        text
      );

    if (
      !match
    ) {
      continue;
    }

    if (
      !best ||
      match.index <
        best.index
    ) {
      best = {
        index:
          match.index,

        length:
          match[0]
            .length,
      };
    }
  }

  return best;
};

const extractSection = (
  text:
    string,
  headings:
    string[]
): string[] => {
  const start =
    findHeadingIndex(
      text,
      headings
    );

  if (
    !start
  ) {
    return [];
  }

  const contentStart =
    start.index +
    start.length;

  const after =
    text.slice(
      contentStart
    );

  const stop =
    findHeadingIndex(
      after,
      ALL_HEADINGS
    );

  const section =
    stop
      ? after.slice(
          0,
          stop.index
        )
      : after;

  return splitIntoItems(
    section
  );
};

/* =========================================================
   INTRO DESCRIPTION
========================================================= */

const extractIntroDescription = (
  text:
    string
): string => {
  let end =
    text.length;

  for (
    const headings of [
      RESPONSIBILITY_HEADINGS,
      REQUIREMENT_HEADINGS,
      PREFERRED_HEADINGS,
      NOISE_HEADINGS,
    ]
  ) {
    const found =
      findHeadingIndex(
        text,
        headings
      );

    if (
      found &&
      found.index <
        end
    ) {
      end =
        found.index;
    }
  }

  let intro =
    text
      .slice(
        0,
        end
      )
      .trim();

  /*
   * Remove common webpage/title noise before Description.
   */
  const descriptionMarker =
    intro.match(
      /(?:^|\n)\s*Description\s*:\s*/i
    );

  if (
    descriptionMarker?.index !==
    undefined
  ) {
    intro =
      intro
        .slice(
          descriptionMarker.index +
          descriptionMarker[0]
            .length
        )
        .trim();
  }

  /*
   * Remove salary/reference lines from description body.
   */
  intro =
    intro
      .split(
        "\n"
      )
      .filter(
        (
          line
        ) => {
          const value =
            line.trim();

          if (
            !value
          ) {
            return true;
          }

          if (
            /^JN\s*[-–]/i.test(
              value
            )
          ) {
            return false;
          }

          if (
            /^Rate\s*:/i.test(
              value
            )
          ) {
            return false;
          }

          return true;
        }
      )
      .join(
        "\n"
      )
      .trim();

  return intro
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .slice(
      0,
      MAX_DESCRIPTION_LENGTH
    );
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
      ],

      react: [
        /\breact(?:\.js)?\b/i,
      ],

      "next.js": [
        /\bnext(?:\.js|\s*js)\b/i,
      ],

      "node.js": [
        /\bnode(?:\.js|\s*js)\b/i,
      ],

      express: [
        /\bexpress(?:\.js)?\b/i,
      ],

      git: [
        /\bgit\b/i,
      ],

      github: [
        /\bgithub\b/i,
      ],

      "github copilot": [
        /\bgithub\s+copilot\b/i,
      ],

      "rest api": [
        /\brest(?:ful)?\s+api(?:s)?\b/i,
      ],

      "tailwind css": [
        /\btailwind(?:\s*css)?\b/i,
      ],

      mongodb: [
        /\bmongodb\b/i,
        /\bmongo\s*db\b/i,
      ],

      postgresql: [
        /\bpostgres(?:ql)?\b/i,
      ],

      "c++": [
        /(?:^|[^a-z0-9])c\+\+(?:[^a-z0-9]|$)/i,
      ],

      "c#": [
        /(?:^|[^a-z0-9])c#(?:[^a-z0-9]|$)/i,
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

  const pattern =
    new RegExp(
      `(^|[^a-z0-9+#.])${escapeRegExp(
        skill
      )}([^a-z0-9+#.]|$)`,
      "i"
    );

  return pattern.test(
    text
  );
};

const detectSkills = (
  text:
    string
): string[] => {
  return TECH_SKILLS.filter(
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
   SALARY TEXT PARSER
========================================================= */

const getCurrencyFromText = (
  value:
    string
): string | undefined => {
  if (
    /\bUSD\b/i.test(
      value
    ) ||
    value.includes(
      "$"
    )
  ) {
    return "USD";
  }

  if (
    /\bGBP\b/i.test(
      value
    ) ||
    value.includes(
      "£"
    )
  ) {
    return "GBP";
  }

  if (
    /\bEUR\b/i.test(
      value
    ) ||
    value.includes(
      "€"
    )
  ) {
    return "EUR";
  }

  if (
    /\bCAD\b/i.test(
      value
    )
  ) {
    return "CAD";
  }

  if (
    /\bAUD\b/i.test(
      value
    )
  ) {
    return "AUD";
  }

  return undefined;
};

const getSalaryPeriodFromText = (
  value:
    string
): JobSalaryPeriod => {
  if (
    /(?:\/\s*hr\b|\/\s*hour\b|\bper\s+hour\b|\bhourly\b)/i.test(
      value
    )
  ) {
    return "hour";
  }

  if (
    /(?:\/\s*day\b|\bper\s+day\b|\bdaily\b)/i.test(
      value
    )
  ) {
    return "day";
  }

  if (
    /(?:\/\s*week\b|\bper\s+week\b|\bweekly\b)/i.test(
      value
    )
  ) {
    return "week";
  }

  if (
    /(?:\/\s*month\b|\bper\s+month\b|\bmonthly\b)/i.test(
      value
    )
  ) {
    return "month";
  }

  if (
    /(?:\/\s*year\b|\/\s*yr\b|\bper\s+year\b|\bannual(?:ly)?\b|\byearly\b)/i.test(
      value
    )
  ) {
    return "year";
  }

  return "unknown";
};

const parseMoney = (
  value:
    string
): number | null => {
  const cleaned =
    value
      .replace(
        /[$£€,]/g,
        ""
      )
      .trim();

  const number =
    Number(
      cleaned
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
};

const parseSalaryFromText = (
  text:
    string
): IStructuredSalary | null => {
  /*
   * Examples:
   * $65.00 to $70.00/hr
   * $65 - $70 per hour
   * $120,000 - $150,000/year
   */

  const range =
    text.match(
      /([$£€]?\s*\d[\d,]*(?:\.\d+)?)\s*(?:-|–|—|to)\s*([$£€]?\s*\d[\d,]*(?:\.\d+)?)\s*(?:\/\s*(hr|hour|day|week|month|year|yr)|per\s+(hour|day|week|month|year))?/i
    );

  if (
    range
  ) {
    const min =
      parseMoney(
        range[1]
      );

    const max =
      parseMoney(
        range[2]
      );

    if (
      min !==
        null &&
      max !==
        null
    ) {
      const localText =
        range[0];

      let period =
        getSalaryPeriodFromText(
          localText
        );

      if (
        period ===
        "unknown"
      ) {
        const nearby =
          text.slice(
            Math.max(
              0,
              (range.index ?? 0) -
                40
            ),
            (range.index ?? 0) +
              range[0].length +
              50
          );

        period =
          getSalaryPeriodFromText(
            nearby
          );
      }

      return {
        salary:
          Math.max(
            min,
            max
          ),

        salaryMin:
          Math.min(
            min,
            max
          ),

        salaryMax:
          Math.max(
            min,
            max
          ),

        salaryCurrency:
          getCurrencyFromText(
            localText
          ) ||
          getCurrencyFromText(
            text
          ),

        salaryPeriod:
          period,
      };
    }
  }

  return null;
};

/* =========================================================
   JSON-LD SALARY
========================================================= */

const normalizeUnitText = (
  value:
    unknown
): JobSalaryPeriod => {
  const text =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "hour",
      "hourly",
      "h",
    ].includes(
      text
    )
  ) {
    return "hour";
  }

  if (
    [
      "day",
      "daily",
    ].includes(
      text
    )
  ) {
    return "day";
  }

  if (
    [
      "week",
      "weekly",
    ].includes(
      text
    )
  ) {
    return "week";
  }

  if (
    [
      "month",
      "monthly",
    ].includes(
      text
    )
  ) {
    return "month";
  }

  if (
    [
      "year",
      "yearly",
      "annual",
      "annually",
    ].includes(
      text
    )
  ) {
    return "year";
  }

  return "unknown";
};

const extractJsonLdSalary = (
  jobPosting:
    Record<
      string,
      any
    >
): IStructuredSalary | null => {
  const baseSalary =
    jobPosting.baseSalary;

  if (
    !baseSalary
  ) {
    return null;
  }

  const currency =
    normalizeWhitespace(
      baseSalary.currency ||
      jobPosting.salaryCurrency
    ) ||
    undefined;

  const value =
    baseSalary.value ??
    baseSalary;

  if (
    typeof value ===
    "number"
  ) {
    return {
      salary:
        value,

      salaryMin:
        value,

      salaryMax:
        value,

      salaryCurrency:
        currency,

      salaryPeriod:
        "unknown",
    };
  }

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const min =
    Number(
      value.minValue ??
      value.value ??
      0
    );

  const max =
    Number(
      value.maxValue ??
      value.value ??
      0
    );

  if (
    !Number.isFinite(
      min
    ) ||
    !Number.isFinite(
      max
    ) ||
    (
      min <=
        0 &&
      max <=
        0
    )
  ) {
    return null;
  }

  const safeMin =
    min >
      0
      ? min
      : max;

  const safeMax =
    max >
      0
      ? max
      : min;

  return {
    salary:
      Math.max(
        safeMin,
        safeMax
      ),

    salaryMin:
      Math.min(
        safeMin,
        safeMax
      ),

    salaryMax:
      Math.max(
        safeMin,
        safeMax
      ),

    salaryCurrency:
      currency,

    salaryPeriod:
      normalizeUnitText(
        value.unitText
      ),
  };
};

/* =========================================================
   JSON-LD TEXT EXTRACTION
========================================================= */

const cleanStructuredHtml = (
  value:
    unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return htmlToReadableText(
    value
  );
};

const arrayFromStructuredValue = (
  value:
    unknown
): string[] => {
  if (
    Array.isArray(
      value
    )
  ) {
    return uniqueStrings(
      value
        .map(
          (
            item
          ) =>
            normalizeWhitespace(
              String(
                item ??
                ""
              )
            )
        )
        .filter(
          Boolean
        )
    );
  }

  if (
    typeof value ===
    "string"
  ) {
    return splitIntoItems(
      cleanStructuredHtml(
        value
      )
    );
  }

  return [];
};

/* =========================================================
   PAGE FETCH
========================================================= */

const fetchEmployerHtml = async (
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
          redirect:
            "follow",

          headers: {
            Accept:
              "text/html,application/xhtml+xml",

            "User-Agent":
              "Mozilla/5.0 (compatible; InterviewIQ/1.0; Job enrichment)",
          },

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Employer page returned HTTP ${response.status}.`
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) ||
      "";

    if (
      !contentType
        .toLowerCase()
        .includes(
          "text/html"
        )
    ) {
      throw new Error(
        "Employer page did not return HTML."
      );
    }

    const html =
      await response.text();

    return html.slice(
      0,
      MAX_HTML_LENGTH
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
};

/* =========================================================
   MAIN
========================================================= */

export const fetchEmployerJobDetails =
  async (
    url:
      string
  ): Promise<IEmployerJobDetails | null> => {
    if (
      !url
    ) {
      return null;
    }

    let parsedUrl:
      URL;

    try {
      parsedUrl =
        new URL(
          url
        );
    } catch {
      return null;
    }

    if (
      ![
        "http:",
        "https:",
      ].includes(
        parsedUrl.protocol
      )
    ) {
      return null;
    }

    try {
      const html =
        await fetchEmployerHtml(
          url
        );

      const jsonLdBlocks =
        extractJsonLdBlocks(
          html
        );

      let jobPosting:
        Record<
          string,
          any
        > |
        null =
        null;

      for (
        const block of
        jsonLdBlocks
      ) {
        jobPosting =
          findJobPosting(
            block
          );

        if (
          jobPosting
        ) {
          break;
        }
      }

      /*
       * Prefer structured JobPosting description when present.
       */
      const structuredDescription =
        jobPosting
          ? cleanStructuredHtml(
              jobPosting.description
            )
          : "";

      const pageText =
        structuredDescription ||
        htmlToReadableText(
          html
        );

      if (
        !pageText ||
        pageText.length <
          50
      ) {
        return null;
      }

      const description =
        extractIntroDescription(
          pageText
        );

      let responsibilities =
        extractSection(
          pageText,
          RESPONSIBILITY_HEADINGS
        );

      let requirements =
        extractSection(
          pageText,
          REQUIREMENT_HEADINGS
        );

      let preferredQualifications =
        extractSection(
          pageText,
          PREFERRED_HEADINGS
        );

      /*
       * schema.org can expose these separately.
       */
      if (
        jobPosting
      ) {
        if (
          responsibilities.length ===
          0
        ) {
          responsibilities =
            arrayFromStructuredValue(
              jobPosting.responsibilities
            );
        }

        if (
          requirements.length ===
          0
        ) {
          requirements =
            uniqueStrings([
              ...arrayFromStructuredValue(
                jobPosting.qualifications
              ),

              ...arrayFromStructuredValue(
                jobPosting.experienceRequirements
              ),

              ...arrayFromStructuredValue(
                jobPosting.skills
              ),
            ]);
        }

        if (
          preferredQualifications.length ===
          0
        ) {
          preferredQualifications =
            arrayFromStructuredValue(
              jobPosting.preferredQualifications
            );
        }
      }

      const skillSearchText =
        [
          description,
          ...responsibilities,
          ...requirements,
          ...preferredQualifications,
        ]
          .join(
            " "
          );

      const skills =
        detectSkills(
          skillSearchText
        );

      const structuredSalary =
        jobPosting
          ? extractJsonLdSalary(
              jobPosting
            )
          : null;

      /*
       * Text salary takes priority because employer pages
       * sometimes contain a more precise current rate than
       * stale JSON-LD.
       */
      const textSalary =
        parseSalaryFromText(
          pageText
        );

      const salary =
        textSalary ||
        structuredSalary;

      return {
        sourceUrl:
          url,

        description:
          description ||
          pageText.slice(
            0,
            MAX_DESCRIPTION_LENGTH
          ),

        responsibilities:
          uniqueStrings(
            responsibilities
          ).slice(
            0,
            15
          ),

        requirements:
          uniqueStrings(
            requirements
          ).slice(
            0,
            15
          ),

        preferredQualifications:
          uniqueStrings(
            preferredQualifications
          ).slice(
            0,
            15
          ),

        skills,

        salary:
          salary?.salary ??
          0,

        salaryMin:
          salary?.salaryMin,

        salaryMax:
          salary?.salaryMax,

        salaryCurrency:
          salary?.salaryCurrency,

        salaryPeriod:
          salary?.salaryPeriod,

        salaryIsPredicted:
          salary
            ? false
            : undefined,
      };
    } catch (
      error
    ) {
      console.warn(
        "[Employer Job Page] Could not enrich:",
        {
          url,
          error,
        }
      );

      return null;
    }
  };

export default {
  fetchEmployerJobDetails,
};