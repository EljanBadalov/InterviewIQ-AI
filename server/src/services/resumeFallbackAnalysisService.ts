import {
  type IExtractedResumeContact,
  type IExtractedResumeEducation,
  type IExtractedResumeExperience,
  type IExtractedResumeProfile,
  type IExtractedResumeProject,
  type IResumeAnalysis,
  type IResumeServiceResult,
} from "./resumeService";

import {
  buildDetailedResumeAnalysis,
} from "./resumeDetailedAnalysisService";

export interface IResumeDocumentSignals {
  layout?:
    | "single-column"
    | "two-column"
    | "three-column"
    | "mixed";

  pageCount?: number;

  columnCounts?: number[];

  extractionWarnings?: string[];
}

interface AnalyzeResumeLocallyParams {
  resumeText: string;

  /*
   * When Resume Analysis already produced the canonical structured
   * profile, use it instead of parsing the text a second time.
   */
  profileOverride?:
    IExtractedResumeProfile;

  /*
   * PDF/layout evidence used for ATS scoring.
   * This is critical: ATS compatibility cannot be scored honestly
   * from plain text alone.
   */
  documentSignals?:
    IResumeDocumentSignals;
}

interface ParsedSection {
  title: string;
  key: string;
  lines: string[];
  content: string;
}

const SECTION_ALIASES: Record<string, string[]> = {
  summary: [
    "summary",
    "professional summary",
    "profile",
    "professional profile",
    "career summary",
    "objective",
  ],
  skills: [
    "skills",
    "technical skills",
    "core skills",
    "core competencies",
    "technologies",
    "tools",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
  ],
  projects: [
    "projects",
    "project experience",
    "personal projects",
    "academic projects",
    "selected projects",
  ],
  education: [
    "education",
    "academic background",
    "education and training",
  ],
  certifications: [
    "certifications",
    "certificates",
    "licenses and certifications",
  ],
  languages: [
    "languages",
    "language skills",
  ],
  volunteering: [
    "volunteering",
    "volunteer experience",
    "volunteer work",
    "community involvement",
    "community service",
  ],
  achievements: [
    "achievements",
    "awards",
    "honors",
    "honours",
  ],
  interests: [
    "interests",
    "hobbies",
  ],
};

const TECH_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "Go",
  "Rust",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "SQL",
  "HTML",
  "CSS",
  "Sass",
  "SCSS",
  "React",
  "Next.js",
  "Vue",
  "Angular",
  "Node.js",
  "Express",
  "NestJS",
  "MongoDB",
  "Mongoose",
  "MySQL",
  "PostgreSQL",
  "SQLite",
  "Oracle",
  "Redis",
  "Firebase",
  "Supabase",
  "AWS",
  "Azure",
  "GCP",
  "Google Cloud",
  "Docker",
  "Kubernetes",
  "Git",
  "GitHub",
  "GitLab",
  "Linux",
  "Bash",
  "PowerShell",
  "REST",
  "REST API",
  "GraphQL",
  "JWT",
  "OAuth",
  "bcrypt",
  "Vite",
  "Webpack",
  "Jest",
  "Vitest",
  "Cypress",
  "Playwright",
  "Selenium",
  "Postman",
  "Figma",
  "Tailwind",
  "Tailwind CSS",
  "Bootstrap",
  "Material UI",
  "Redux",
  "Redux Toolkit",
  "Zustand",
  "Socket.IO",
  "WebSocket",
  "Machine Learning",
  "Artificial Intelligence",
  "Data Analysis",
  "Pandas",
  "NumPy",
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "Power BI",
  "Tableau",
  "Excel",
  "Jira",
  "Agile",
  "Scrum",
];

const SOFT_SKILLS = [
  "Communication",
  "Teamwork",
  "Leadership",
  "Problem Solving",
  "Time Management",
  "Adaptability",
  "Critical Thinking",
  "Collaboration",
  "Attention to Detail",
  "Organization",
];

const ACTION_VERBS = [
  "built",
  "developed",
  "implemented",
  "created",
  "designed",
  "improved",
  "optimized",
  "led",
  "managed",
  "delivered",
  "launched",
  "integrated",
  "automated",
  "reduced",
  "increased",
  "supported",
  "maintained",
  "configured",
  "tested",
  "deployed",
  "collaborated",
  "analyzed",
  "engineered",
];

const normalizeText = (
  value: string
): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeLine = (
  value: string
): string => {
  const cleaned =
    value
      .replace(/[•●▪◦■►▶]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (
    /^[-–—]*\s*\d+\s+of\s+\d+\s*[-–—]*$/i.test(
      cleaned
    ) ||
    /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned;
};

const normalizeKey = (
  value: string
): string => {
  return normalizeLine(value)
    .toLowerCase()
    .replace(/[:|]+$/g, "")
    .trim();
};

const unique = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (const value of values) {
    const cleaned =
      normalizeLine(value);

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
};

const clamp = (
  value: number
): number => {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value)
    )
  );
};

const escapeRegex = (
  value: string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const containsSkill = (
  text: string,
  skill: string
): boolean => {
  const pattern =
    new RegExp(
      `(^|[^a-z0-9+#.])${escapeRegex(
        skill.toLowerCase()
      )}([^a-z0-9+#.]|$)`,
      "i"
    );

  return pattern.test(
    text.toLowerCase()
  );
};

const getSectionKey = (
  line: string
): string | null => {
  const normalized =
    normalizeKey(line);

  if (
    !normalized ||
    normalized.length > 60
  ) {
    return null;
  }

  for (
    const [
      key,
      aliases,
    ] of Object.entries(
      SECTION_ALIASES
    )
  ) {
    if (
      aliases.includes(
        normalized
      )
    ) {
      return key;
    }
  }

  return null;
};

const parseSections = (
  text: string
): ParsedSection[] => {
  const lines =
    text
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

  const sections:
    ParsedSection[] = [];

  let current:
    ParsedSection | null =
      null;

  for (const line of lines) {
    const key =
      getSectionKey(line);

    if (key) {
      if (current) {
        current.content =
          current.lines.join("\n");
        sections.push(current);
      }

      current = {
        title: line,
        key,
        lines: [],
        content: "",
      };

      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    current.content =
      current.lines.join("\n");
    sections.push(current);
  }

  return sections;
};

const getSection = (
  sections: ParsedSection[],
  key: string
): ParsedSection | null => {
  return (
    sections.find(
      (section) =>
        section.key === key
    ) ??
    null
  );
};

const extractContact = (
  text: string
): IExtractedResumeContact => {
  const lines =
    text
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);

  const top =
    lines
      .slice(0, 12)
      .join("\n");

  const email =
    top.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    )?.[0];

  const phone =
    top.match(
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?/
    )?.[0];

  const linkedin =
    top.match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i
    )?.[0];

  const github =
    top.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|]+/i
    )?.[0];

  const website =
    top.match(
      /https?:\/\/(?!www\.linkedin\.com|linkedin\.com|www\.github\.com|github\.com)[^\s|]+/i
    )?.[0];

  let fullName:
    string | undefined;

  for (
    const line
    of lines.slice(0, 6)
  ) {
    if (
      line.includes("@") ||
      /https?:\/\//i.test(line) ||
      /\d{5,}/.test(line) ||
      line.length > 60
    ) {
      continue;
    }

    const tokens =
      line.split(/\s+/);

    if (
      tokens.length >= 2 &&
      tokens.length <= 5 &&
      tokens.every(
        (token) =>
          /^[A-Za-zÀ-ÖØ-öø-ÿ'’-]+$/.test(
            token
          )
      )
    ) {
      fullName = line;
      break;
    }
  }

  let location:
    string | undefined;

  for (
    const line
    of lines.slice(0, 12)
  ) {
    if (
      line === fullName ||
      line === email ||
      line === phone ||
      /linkedin|github|https?:\/\//i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+,\s*[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(
        line
      )
    ) {
      location = line;
      break;
    }
  }

  return {
    fullName,
    email,
    phone:
      phone
        ? normalizeLine(phone)
        : undefined,
    location,
    linkedin,
    github,
    website,
  };
};

const extractSkills = (
  text: string,
  section:
    ParsedSection | null
): {
  skills: string[];
  technicalSkills: string[];
  softSkills: string[];
} => {
  const searchable =
    `${section?.content ?? ""}\n${text}`;

  const technicalSkills =
    unique(
      TECH_SKILLS.filter(
        (skill) =>
          containsSkill(
            searchable,
            skill
          )
      )
    );

  const softSkills =
    unique(
      SOFT_SKILLS.filter(
        (skill) =>
          searchable
            .toLowerCase()
            .includes(
              skill.toLowerCase()
            )
      )
    );

  const listedSkills =
    section
      ? unique(
          section.content
            .split(
              /[,;|\n]+/
            )
            .map(normalizeLine)
            .filter(
              (value) =>
                value.length >= 2 &&
                value.length <= 40
            )
        )
      : [];

  return {
    skills:
      unique([
        ...listedSkills,
        ...technicalSkills,
        ...softSkills,
      ]),
    technicalSkills,
    softSkills,
  };
};

const extractSummary = (
  section:
    ParsedSection | null
): string => {
  if (!section) {
    return "";
  }

  return section.content
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
};

const extractDates = (
  text: string
): {
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
} => {
  const matches =
    text.match(
      /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{4}|Present|Current|Now/gi
    ) ?? [];

  const values =
    matches.map(
      normalizeLine
    );

  return {
    startDate:
      values[0],
    endDate:
      values[1],
    isCurrent:
      values.some(
        (value) =>
          /present|current|now/i.test(
            value
          )
      ),
  };
};

const hasDateRange = (
  value: string
): boolean => {
  return /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\.?\s*\d{4}\s*(?:-|–|—|to)\s*(?:Present|Current|Now|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\.?\s*\d{4})/i.test(
    value
  );
};

const isActionLikeLine = (
  value: string
): boolean => {
  const first =
    normalizeLine(
      value
    )
      .split(/\s+/)[0]
      ?.toLowerCase();

  return Boolean(
    first &&
    ACTION_VERBS.includes(
      first
    )
  );
};

const splitEntries = (
  section:
    ParsedSection | null
): string[][] => {
  if (!section) {
    return [];
  }

  const groups:
    string[][] = [];

  let current:
    string[] = [];

  for (
    const rawLine
    of section.lines
  ) {
    const line =
      normalizeLine(
        rawLine
      );

    if (!line) {
      continue;
    }

    const roleHeader =
      /(?:developer|engineer|manager|analyst|specialist|intern|assistant|technician|consultant|designer|administrator|coordinator|volunteer|founder|officer|associate|student)/i.test(
        line
      ) &&
      !isActionLikeLine(
        line
      );

    const dateHeader =
      hasDateRange(
        line
      ) &&
      !isActionLikeLine(
        line
      );

    const shouldStartNew =
      current.length >
        0 &&
      (
        roleHeader ||
        dateHeader
      );

    if (
      shouldStartNew
    ) {
      groups.push(
        current
      );

      current = [];
    }

    current.push(
      line
    );
  }

  if (
    current.length >
    0
  ) {
    groups.push(
      current
    );
  }

  return groups;
};

const extractExperience = (
  section:
    ParsedSection | null,
  technicalSkills:
    string[]
): IExtractedResumeExperience[] => {
  return splitEntries(section)
    .map(
      (
        group
      ): IExtractedResumeExperience | null => {
        const header =
          normalizeLine(
            group[0] ?? ""
          );

        if (
          !header ||
          header.length > 120
        ) {
          return null;
        }

        const parts =
          header
            .split(
              /\s+[—–|-]\s+/
            )
            .map(normalizeLine)
            .filter(Boolean);

        const title =
          parts[0];

        if (!title) {
          return null;
        }

        let company =
          parts[1];

        const dateLine =
          group.find(
            (line) =>
              /\d{4}|present|current|now/i.test(
                line
              )
          );

        const dates =
          extractDates(
            dateLine ?? ""
          );

        let bullets =
          unique(
            group
              .slice(1)
              .filter(
                (line) =>
                  line !== dateLine &&
                  line.length >= 12
              )
          );

        if (
          !company &&
          bullets[0] &&
          bullets[0].length <= 80
        ) {
          company =
            bullets[0];
          bullets =
            bullets.slice(1);
        }

        const searchable =
          group.join(" ");

        return {
          title,
          company,
          startDate:
            dates.startDate,
          endDate:
            dates.endDate,
          isCurrent:
            dates.isCurrent,
          description:
            bullets[0],
          bullets:
            bullets.slice(0, 8),
          technologies:
            unique(
              technicalSkills.filter(
                (skill) =>
                  containsSkill(
                    searchable,
                    skill
                  )
              )
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is IExtractedResumeExperience =>
        item !== null
    )
    .slice(0, 12);
};

const extractProjects = (
  section:
    ParsedSection | null,
  technicalSkills:
    string[]
): IExtractedResumeProject[] => {
  return splitEntries(section)
    .map(
      (
        group
      ): IExtractedResumeProject | null => {
        const name =
          normalizeLine(
            group[0] ?? ""
          );

        if (!name) {
          return null;
        }

        const searchable =
          group.join(" ");

        const bullets =
          unique(
            group
              .slice(1)
              .filter(
                (line) =>
                  line.length >= 12
              )
          );

        return {
          name,
          description:
            bullets[0],
          technologies:
            unique(
              technicalSkills.filter(
                (skill) =>
                  containsSkill(
                    searchable,
                    skill
                  )
              )
            ),
          bullets:
            bullets.slice(0, 8),
          url:
            searchable.match(
              /https?:\/\/[^\s|]+/i
            )?.[0],
          github:
            searchable.match(
              /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|]+/i
            )?.[0],
        };
      }
    )
    .filter(
      (
        item
      ): item is IExtractedResumeProject =>
        item !== null
    )
    .slice(0, 12);
};

const extractEducation = (
  section:
    ParsedSection | null
): IExtractedResumeEducation[] => {
  if (!section) {
    return [];
  }

  return splitEntries(section)
    .map(
      (
        group
      ): IExtractedResumeEducation | null => {
        const institution =
          normalizeLine(
            group[0] ?? ""
          );

        if (!institution) {
          return null;
        }

        const joined =
          group.join(" ");

        const dates =
          extractDates(joined);

        const degree =
          group.find(
            (line) =>
              /bachelor|master|associate|phd|doctor|diploma|certificate|degree|computer science|information technology|engineering|business|science|arts/i.test(
                line
              )
          );

        const gpa =
          joined.match(
            /GPA\s*[:\-]?\s*([0-4](?:\.\d{1,2})?)/i
          )?.[1];

        return {
          institution,
          degree,
          startDate:
            dates.startDate,
          endDate:
            dates.endDate,
          isCurrent:
            dates.isCurrent,
          gpa,
          coursework: [],
          achievements: [],
        };
      }
    )
    .filter(
      (
        item
      ): item is IExtractedResumeEducation =>
        item !== null
    )
    .slice(0, 8);
};

const extractVolunteering = (
  section:
    ParsedSection | null
): IExtractedResumeProfile["volunteering"] => {
  return splitEntries(
    section
  )
    .map(
      (
        group
      ) => {
        const heading =
          normalizeLine(
            group[0] ?? ""
          );

        if (!heading) {
          return null;
        }

        const dateInfo =
          extractDates(
            group.join(" ")
          );

        const headingWithoutDate =
          heading
            .replace(
              /\(?\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\.?\s*\d{4}\s*(?:-|–|—|to)\s*(?:Present|Current|Now|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\.?\s*\d{4})\s*\)?/ig,
              ""
            )
            .trim();

        const parts =
          headingWithoutDate
            .split(
              /\s+[—–|-]\s+/
            )
            .map(
              normalizeLine
            )
            .filter(
              Boolean
            );

        const role =
          parts.length >
            1
            ? parts[0]
            : undefined;

        const organization =
          parts.length >
            1
            ? parts
                .slice(1)
                .join(" - ")
            : parts[0];

        if (!organization) {
          return null;
        }

        return {
          organization,

          role,

          startDate:
            dateInfo.startDate,

          endDate:
            dateInfo.endDate,

          bullets:
            unique(
              group
                .slice(1)
                .filter(
                  (line) =>
                    !hasDateRange(
                      line
                    ) &&
                    line.length >=
                      8
                )
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is NonNullable<
        typeof item
      > =>
        item !==
        null
    );
};

const extractSimpleLines = (
  section:
    ParsedSection | null
): string[] => {
  if (!section) {
    return [];
  }

  return unique(
    section.content
      .split(
        /[\n;,|]+/
      )
      .map(normalizeLine)
      .filter(
        (value) =>
          value.length >= 2
      )
  );
};

const buildAnalysis = ({
  text,
  profile,
  sections,
  documentSignals,
}: {
  text: string;

  profile:
    IExtractedResumeProfile;

  sections:
    ParsedSection[];

  documentSignals?:
    IResumeDocumentSignals;
}): IResumeAnalysis => {
  const metricCount =
    (
      text.match(
        /\b\d+(?:\.\d+)?%|\$\s?\d+|\b\d+\+?\s*(?:users|clients|projects|features|tickets|requests|hours|days|weeks|months|years)\b/gi
      ) ??
      []
    ).length;

  const actionVerbCount =
    ACTION_VERBS.filter(
      (
        verb
      ) =>
        new RegExp(
          `\\b${verb}\\b`,
          "i"
        ).test(
          text
        )
    ).length;

  const hasSummary =
    profile
      .professionalSummary
      .trim()
      .length >=
    40;

  const hasExperience =
    profile
      .experience
      .length >
    0;

  const hasProjects =
    profile
      .projects
      .length >
    0;

  const hasEducation =
    profile
      .education
      .length >
    0;

  const hasSkills =
    profile
      .technicalSkills
      .length >
    0;

  const hasCertifications =
    profile
      .certifications
      .length >
    0;

  const hasLanguages =
    profile
      .languages
      .length >
    0;

  const hasVolunteering =
    profile
      .volunteering
      .length >
    0;

  const hasEmail =
    Boolean(
      profile
        .contact
        .email
    );

  const hasPhone =
    Boolean(
      profile
        .contact
        .phone
    );

  const hasName =
    Boolean(
      profile
        .contact
        .fullName
    );

  /*
   * IMPORTANT:
   * Do NOT score ATS structure from parseSections(text) alone.
   *
   * That parser recognizes only a limited set of heading words and
   * can under-score perfectly valid Azerbaijani/Turkish/non-English CVs.
   *
   * The canonical structured profile is the source of truth.
   */
  const canonicalSectionPresence = [
    hasSummary,
    hasSkills,
    hasExperience,
    hasProjects,
    hasEducation,
    hasCertifications,
    hasLanguages,
    hasVolunteering,
  ];

  const canonicalSectionCount =
    canonicalSectionPresence.filter(
      Boolean
    ).length;

  const coreSectionCount =
    [
      hasSummary,
      hasSkills,
      hasExperience,
      hasEducation,
    ].filter(
      Boolean
    ).length;

  const totalExperienceBullets =
    profile
      .experience
      .reduce(
        (
          total,
          item
        ) =>
          total +
          item
            .bullets
            .length,
        0
      );

  const totalProjectBullets =
    profile
      .projects
      .reduce(
        (
          total,
          item
        ) =>
          total +
          item
            .bullets
            .length,
        0
      );

  const totalBullets =
    totalExperienceBullets +
    totalProjectBullets;

  const extractionWarnings =
    [
      ...(
        profile
          .extractionWarnings ||
        []
      ),

      ...(
        documentSignals
          ?.extractionWarnings ||
        []
      ),
    ];

  /*
   * Warnings matter, but one or two harmless extraction warnings must
   * never collapse a strong resume to 0.
   */
  const warningPenalty =
    Math.min(
      extractionWarnings
        .length *
        2,
      10
    );

  const layout =
    documentSignals
      ?.layout ||
    "single-column";

  /*
   * Layout risk is a modifier, NOT the foundation of the ATS score.
   *
   * A two-column CV can be less predictable for some ATS systems, but
   * it should not lose 20-30 points automatically when parsing is clean.
   */
  const layoutPenalty =
    layout ===
      "two-column"
      ? 8
      : layout ===
          "three-column"
        ? 15
        : layout ===
            "mixed"
          ? 12
          : 0;

  const extractionPenalty =
    profile
      .extractionStatus ===
      "partial"
      ? 10
      : 0;

  const contactScore =
    (
      hasName
        ? 4
        : 0
    ) +
    (
      hasEmail
        ? 5
        : 0
    ) +
    (
      hasPhone
        ? 3
        : 0
    );

  const coreStructureScore =
    coreSectionCount *
    11;

  const supportingStructureScore =
    Math.min(
      Math.max(
        0,
        canonicalSectionCount -
        coreSectionCount
      ) *
      3,
      12
    );

  const parseReliabilityScore =
    profile
      .extractionStatus ===
      "completed"
      ? 20
      : 8;

  /*
   * ATS SCORE
   * -------------------------------------------------------
   * 0 is now possible only for genuinely unreadable/empty resumes.
   *
   * A complete, single-column resume with contact + summary + skills +
   * experience + education should naturally land in a strong range.
   */
  const atsScore =
    clamp(
      contactScore +
      coreStructureScore +
      supportingStructureScore +
      parseReliabilityScore +
      (
        hasProjects
          ? 5
          : 0
      ) +
      (
        profile
          .technicalSkills
          .length >=
        5
          ? 7
          : profile
              .technicalSkills
              .length >=
            2
            ? 4
            : 0
      ) -
      layoutPenalty -
      extractionPenalty -
      warningPenalty
    );

  /*
   * CONTENT SCORE
   */
  const contentScore =
    clamp(
      25 +
      (
        hasSummary
          ? 15
          : 0
      ) +
      Math.min(
        actionVerbCount *
        3,
        18
      ) +
      Math.min(
        totalBullets *
        2,
        20
      ) +
      Math.min(
        metricCount *
        4,
        16
      ) +
      (
        hasExperience
          ? 6
          : 0
      )
    );

  /*
   * STRUCTURE SCORE
   * -------------------------------------------------------
   * Derived from the canonical profile rather than English heading
   * recognition. This makes the score language-independent.
   */
  const structureScore =
    clamp(
      28 +
      coreSectionCount *
        13 +
      Math.min(
        Math.max(
          0,
          canonicalSectionCount -
          coreSectionCount
        ) *
        4,
        16
      ) +
      (
        profile
          .extractionStatus ===
          "completed"
          ? 8
          : 0
      ) -
      Math.round(
        layoutPenalty *
        0.75
      ) -
      extractionPenalty -
      warningPenalty
    );

  /*
   * SKILLS SCORE
   */
  const skillsScore =
    clamp(
      28 +
      Math.min(
        profile
          .technicalSkills
          .length *
          3,
        36
      ) +
      Math.min(
        profile
          .softSkills
          .length *
          2,
        10
      ) +
      (
        hasExperience ||
        hasProjects
          ? 8
          : 0
      )
    );

  const experienceEntryQuality =
    profile
      .experience
      .reduce(
        (
          total,
          item
        ) => {
          let points =
            0;

          if (
            item
              .title
              ?.trim()
          ) {
            points +=
              5;
          }

          if (
            item
              .company
              ?.trim()
          ) {
            points +=
              5;
          }

          if (
            item
              .startDate
              ?.trim() ||
            item
              .endDate
              ?.trim()
          ) {
            points +=
              4;
          }

          if (
            (
              item
                .description
                ?.trim()
                .length ??
              0
            ) >=
            30
          ) {
            points +=
              4;
          }

          if (
            item
              .bullets
              .length >
            0
          ) {
            points +=
              7;
          }

          return (
            total +
            points
          );
        },
        0
      );

  const experienceScore =
    clamp(
      (
        hasExperience
          ? 22
          : 8
      ) +
      Math.min(
        experienceEntryQuality,
        42
      ) +
      Math.min(
        totalExperienceBullets *
        3,
        24
      ) +
      Math.min(
        metricCount *
        3,
        12
      )
    );

  /*
   * OVERALL SCORE
   * -------------------------------------------------------
   * Weighted, but no hard cap solely because ATS is below an arbitrary
   * threshold. A strong resume can have one weaker dimension without
   * its overall score collapsing.
   */
  const overallScore =
    clamp(
      atsScore *
        0.27 +
      contentScore *
        0.24 +
      structureScore *
        0.20 +
      skillsScore *
        0.14 +
      experienceScore *
        0.15
    );

  const strengths:
    string[] = [];

  const weaknesses:
    string[] = [];

  const atsSuggestions:
    string[] = [];

  const formattingFeedback:
    string[] = [];

  const recommendations:
    string[] = [];

  if (
    layout !==
    "single-column"
  ) {
    weaknesses.push(
      `The PDF uses a ${layout} layout. Some ATS platforms parse complex columns less reliably than simple single-column documents.`
    );

    atsSuggestions.push(
      "For maximum ATS compatibility, consider a simpler single-column version for automated application portals."
    );

    formattingFeedback.push(
      `Detected document layout: ${layout}. A modest ATS layout-risk penalty was applied, not an automatic failure.`
    );
  }

  if (
    extractionWarnings
      .length >
    0
  ) {
    weaknesses.push(
      "Some resume content could not be classified with full confidence during PDF extraction."
    );

    atsSuggestions.push(
      "Review the generated text structure and keep contact, experience, education, skills and languages in clearly separated standard sections."
    );
  }

  if (
    profile.technicalSkills
      .length >= 6
  ) {
    strengths.push(
      "The resume contains a solid set of identifiable technical skills."
    );
  }

  if (
    hasExperience
  ) {
    strengths.push(
      "The resume contains identifiable professional experience."
    );
  }

  if (
    hasProjects
  ) {
    strengths.push(
      "Projects provide additional evidence of practical experience."
    );
  }

  if (
    metricCount > 0
  ) {
    strengths.push(
      "The resume includes measurable details that strengthen impact."
    );
  }

  if (
    strengths.length === 0
  ) {
    strengths.push(
      "The resume contains enough readable content for a basic local analysis."
    );
  }

  if (!hasSummary) {
    weaknesses.push(
      "A clear professional summary is missing or too brief."
    );

    recommendations.push(
      "Add a concise professional summary tailored to the target role."
    );
  }

  if (
    profile.technicalSkills
      .length < 5
  ) {
    weaknesses.push(
      "The technical skills section is limited or difficult to identify."
    );

    atsSuggestions.push(
      "Use a dedicated Technical Skills section with standard industry terminology."
    );
  }

  if (
    !hasExperience &&
    !hasProjects
  ) {
    weaknesses.push(
      "The resume provides limited evidence of experience or projects."
    );
  }

  if (
    metricCount === 0 &&
    (
      hasExperience ||
      hasProjects
    )
  ) {
    weaknesses.push(
      "Experience and project descriptions contain few measurable outcomes."
    );

    recommendations.push(
      "Where truthful, add measurable outcomes to experience and project bullet points."
    );
  }

  if (
    sections.length < 3
  ) {
    formattingFeedback.push(
      "Use clear standard section headings so ATS systems can parse the resume more reliably."
    );
  } else {
    formattingFeedback.push(
      "The extracted resume text contains recognizable standard sections."
    );
  }

  if (
    profile.experience.some(
      (item) =>
        item.bullets.length ===
        0
    )
  ) {
    atsSuggestions.push(
      "Add concise bullet points under experience entries."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "Keep the resume concise and tailor keywords to each target role."
    );
  }

  return {
    overallScore,
    atsScore,
    contentScore,
    structureScore,
    skillsScore,
    experienceScore,

    summary:
      `Local resume analysis completed. The document contains ${profile.technicalSkills.length} identifiable technical skill${profile.technicalSkills.length === 1 ? "" : "s"}, ${profile.experience.length} experience entr${profile.experience.length === 1 ? "y" : "ies"}, ${profile.projects.length} project${profile.projects.length === 1 ? "" : "s"}, and ${profile.education.length} education entr${profile.education.length === 1 ? "y" : "ies"}.`,

    skillsDetected:
      profile.skills,

    strengths:
      unique(strengths),

    weaknesses:
      unique(weaknesses),

    missingSkills: [],

    atsSuggestions:
      unique(atsSuggestions),

    formattingFeedback:
      unique(
        formattingFeedback
      ),

    recommendations:
      unique(recommendations),
  };
};

export const analyzeResumeLocally =
  ({
    resumeText,
    profileOverride,
    documentSignals,
  }: AnalyzeResumeLocallyParams): IResumeServiceResult => {
    const text =
      normalizeText(
        resumeText
      );

    if (
      text.length < 20
    ) {
      throw new Error(
        "Resume text is empty or too short to analyze"
      );
    }

    const sections =
      parseSections(text);

    const skillData =
      extractSkills(
        text,
        getSection(
          sections,
          "skills"
        )
      );

    const parsedProfile:
      IExtractedResumeProfile = {
        contact:
          extractContact(text),

        professionalSummary:
          extractSummary(
            getSection(
              sections,
              "summary"
            )
          ),

        skills:
          skillData.skills,

        technicalSkills:
          skillData
            .technicalSkills,

        softSkills:
          skillData
            .softSkills,

        experience:
          extractExperience(
            getSection(
              sections,
              "experience"
            ),
            skillData
              .technicalSkills
          ),

        projects:
          extractProjects(
            getSection(
              sections,
              "projects"
            ),
            skillData
              .technicalSkills
          ),

        education:
          extractEducation(
            getSection(
              sections,
              "education"
            )
          ),

        certifications:
          extractSimpleLines(
            getSection(
              sections,
              "certifications"
            )
          ).map(
            (name) => ({
              name,
              status:
                "completed" as const,
            })
          ),

        languages:
          extractSimpleLines(
            getSection(
              sections,
              "languages"
            )
          ).map(
            (language) => ({
              language,
            })
          ),

        volunteering:
          extractVolunteering(
            getSection(
              sections,
              "volunteering"
            )
          ),

        achievements:
          extractSimpleLines(
            getSection(
              sections,
              "achievements"
            )
          ),

        interests:
          extractSimpleLines(
            getSection(
              sections,
              "interests"
            )
          ),

        rawSections:
          sections.map(
            (section) => ({
              title:
                section.title,
              content:
                section.content,
            })
          ),

        extractionStatus:
          sections.length >= 3
            ? "completed"
            : "partial",

        extractionWarnings:
          sections.length >= 3
            ? []
            : [
                "Some resume sections could not be identified reliably from the extracted PDF text.",
              ],
      };

    const profile:
      IExtractedResumeProfile =
        profileOverride ||
        parsedProfile;

    const analysis =
      buildAnalysis({
        text,
        profile,
        sections,
        documentSignals,
      });

    /*
     * Build a deeper evidence-based analysis from the parsed
     * profile. This layer is fully deterministic and dynamic:
     * it evaluates bullet quality, measurable impact, skill
     * evidence, inferred career direction, and score context.
     */
    const detailed =
      buildDetailedResumeAnalysis({
        analysis,
        profile,
      });

    const detailedSummaryParts =
      [
        `Local resume analysis completed for an inferred ${detailed.inferredRole} profile.`,

        `The document contains ${detailed.metrics.technicalSkillCount} detected technical skill${
          detailed.metrics.technicalSkillCount === 1
            ? ""
            : "s"
        }, with ${detailed.metrics.evidencedSkillCount} supported by identifiable experience or project evidence.`,

        `It includes ${detailed.metrics.experienceEntries} experience entr${
          detailed.metrics.experienceEntries === 1
            ? "y"
            : "ies"
        }, ${detailed.metrics.projectEntries} project${
          detailed.metrics.projectEntries === 1
            ? ""
            : "s"
        }, and ${detailed.metrics.totalBullets} analyzed bullet point${
          detailed.metrics.totalBullets === 1
            ? ""
            : "s"
        }.`,

        detailed.metrics.totalBullets > 0
          ? `${detailed.metrics.bulletsWithMetrics} of those bullets contain measurable outcomes and ${detailed.metrics.bulletsWithActionVerbs} begin with a recognized action verb.`
          : "No structured experience or project bullet points were detected.",
      ];

    const enrichedAnalysis:
      IResumeAnalysis = {
        ...analysis,

        summary:
          detailedSummaryParts
            .join(
              " "
            ),

        strengths:
          detailed.strengths.length > 0
            ? detailed.strengths
            : analysis.strengths,

        weaknesses:
          detailed.weaknesses.length > 0
            ? detailed.weaknesses
            : analysis.weaknesses,

        missingSkills:
          detailed.recommendedSkills,

        atsSuggestions:
          unique([
            ...analysis.atsSuggestions,

            detailed
              .scoreExplanations
              .ats,

            detailed
              .scoreExplanations
              .structure,
          ]),

        formattingFeedback:
          unique([
            ...analysis.formattingFeedback,

            detailed
              .scoreExplanations
              .content,
          ]),

        recommendations:
          unique([
            ...detailed.recommendations,

            detailed
              .scoreExplanations
              .skills,

            detailed
              .scoreExplanations
              .experience,

            detailed
              .scoreExplanations
              .overall,
          ]),
      };

    console.log(
      "[Resume Local] Detailed analysis completed",
      {
        inferredRole:
          detailed.inferredRole,

        overallScore:
          enrichedAnalysis
            .overallScore,

        technicalSkills:
          detailed.metrics
            .technicalSkillCount,

        evidencedSkills:
          detailed.metrics
            .evidencedSkillCount,

        weakSkills:
          detailed.metrics
            .weakSkillCount,

        experienceItems:
          detailed.metrics
            .experienceEntries,

        projectItems:
          detailed.metrics
            .projectEntries,

        educationItems:
          detailed.metrics
            .educationEntries,

        totalBullets:
          detailed.metrics
            .totalBullets,

        bulletsWithMetrics:
          detailed.metrics
            .bulletsWithMetrics,

        bulletsWithActionVerbs:
          detailed.metrics
            .bulletsWithActionVerbs,

        recommendedSkills:
          enrichedAnalysis
            .missingSkills,

        extractionStatus:
          profile.extractionStatus,

        documentLayout:
          documentSignals
            ?.layout ||
          "single-column",

        documentColumns:
          documentSignals
            ?.columnCounts ||
          [],

        atsScore:
          enrichedAnalysis
            .atsScore,

        structureScore:
          enrichedAnalysis
            .structureScore,
      }
    );

    return {
      analysis:
        enrichedAnalysis,

      profile,
    };
  };

export default {
  analyzeResumeLocally,
};
