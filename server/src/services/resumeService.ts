import { env } from "../config/env";
import qwenService from "./qwenService";

/* =========================================================
   TYPES
========================================================= */

export interface IResumeAnalysis {
  overallScore: number;

  atsScore: number;

  contentScore: number;

  structureScore: number;

  skillsScore: number;

  experienceScore: number;

  summary: string;

  skillsDetected: string[];

  strengths: string[];

  weaknesses: string[];

  missingSkills: string[];

  atsSuggestions: string[];

  formattingFeedback: string[];

  recommendations: string[];
}

export interface IExtractedResumeContact {
  fullName?: string;

  email?: string;

  phone?: string;

  location?: string;

  linkedin?: string;

  github?: string;

  website?: string;
}

export interface IExtractedResumeExperience {
  title: string;

  company?: string;

  location?: string;

  employmentType?: string;

  startDate?: string;

  endDate?: string;

  isCurrent: boolean;

  description?: string;

  bullets: string[];

  technologies: string[];
}

export interface IExtractedResumeProject {
  name: string;

  role?: string;

  description?: string;

  startDate?: string;

  endDate?: string;

  technologies: string[];

  bullets: string[];

  url?: string;

  github?: string;
}

export interface IExtractedResumeEducation {
  institution: string;

  degree?: string;

  field?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent: boolean;

  gpa?: string;

  coursework: string[];

  achievements: string[];
}

export interface IExtractedResumeCertification {
  name: string;

  issuer?: string;

  issueDate?: string;

  expirationDate?: string;

  credentialId?: string;

  credentialUrl?: string;

  status:
    | "completed"
    | "in-progress"
    | "expired";
}

export interface IExtractedResumeLanguage {
  language: string;

  level?: string;
}

export interface IExtractedResumeVolunteer {
  organization: string;

  role?: string;

  startDate?: string;

  endDate?: string;

  bullets: string[];
}

export interface IExtractedResumeProfile {
  contact: IExtractedResumeContact;

  professionalSummary: string;

  skills: string[];

  technicalSkills: string[];

  softSkills: string[];

  experience: IExtractedResumeExperience[];

  projects: IExtractedResumeProject[];

  education: IExtractedResumeEducation[];

  certifications: IExtractedResumeCertification[];

  languages: IExtractedResumeLanguage[];

  volunteering: IExtractedResumeVolunteer[];

  achievements: string[];

  interests: string[];

  rawSections: Array<{
    title: string;

    content: string;
  }>;

  extractionStatus:
    | "completed"
    | "partial";

  extractionWarnings: string[];
}

export interface IResumeServiceResult {
  analysis: IResumeAnalysis;

  profile: IExtractedResumeProfile;
}

interface AnalyzeResumeParams {
  resumeText: string;
}

/* =========================================================
   INTERNAL RESPONSE
========================================================= */

interface ICombinedQwenResponse {
  analysis: any;

  profile: any;
}

/* =========================================================
   HELPERS
========================================================= */

const cleanString = (
  value: unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .replace(
      /\u00a0/g,
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
    .trim();
};

const cleanOptionalString = (
  value: unknown
): string | undefined => {
  const result =
    cleanString(
      value
    );

  return (
    result ||
    undefined
  );
};

const cleanArray = (
  value: unknown
): string[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    string[] = [];

  const seen =
    new Set<string>();

  for (
    const item
    of value
  ) {
    const cleaned =
      cleanString(
        item
      );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLowerCase();

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

const clampScore = (
  value: unknown
): number => {
  const numeric =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        numeric
      )
    )
  );
};

const normalizeStatus = (
  value: unknown
):
  | "completed"
  | "in-progress"
  | "expired" => {
  const status =
    cleanString(
      value
    ).toLowerCase();

  if (
    status ===
    "in-progress"
  ) {
    return "in-progress";
  }

  if (
    status ===
    "expired"
  ) {
    return "expired";
  }

  return "completed";
};

/* =========================================================
   NORMALIZE ANALYSIS
========================================================= */

const normalizeAnalysis = (
  value: unknown
): IResumeAnalysis => {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "Qwen returned invalid analysis data"
    );
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  return {
    overallScore:
      clampScore(
        data.overallScore
      ),

    atsScore:
      clampScore(
        data.atsScore
      ),

    contentScore:
      clampScore(
        data.contentScore
      ),

    structureScore:
      clampScore(
        data.structureScore
      ),

    skillsScore:
      clampScore(
        data.skillsScore
      ),

    experienceScore:
      clampScore(
        data.experienceScore
      ),

    summary:
      cleanString(
        data.summary
      ),

    skillsDetected:
      cleanArray(
        data.skillsDetected
      ),

    strengths:
      cleanArray(
        data.strengths
      ),

    weaknesses:
      cleanArray(
        data.weaknesses
      ),

    missingSkills:
      cleanArray(
        data.missingSkills
      ),

    atsSuggestions:
      cleanArray(
        data.atsSuggestions
      ),

    formattingFeedback:
      cleanArray(
        data.formattingFeedback
      ),

    recommendations:
      cleanArray(
        data.recommendations
      ),
  };
};

/* =========================================================
   NORMALIZE PROFILE
========================================================= */

const normalizeProfile = (
  value: unknown,
  resumeText: string
): IExtractedResumeProfile => {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(
      value
    )
  ) {
    throw new Error(
      "Qwen returned invalid ResumeProfile data"
    );
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const contactData =
    typeof data.contact ===
      "object" &&
      data.contact !==
        null &&
      !Array.isArray(
        data.contact
      )
      ? (
          data.contact as Record<
            string,
            unknown
          >
        )
      : {};

  const contact:
    IExtractedResumeContact = {
    fullName:
      cleanOptionalString(
        contactData.fullName
      ),

    email:
      cleanOptionalString(
        contactData.email
      ),

    phone:
      cleanOptionalString(
        contactData.phone
      ),

    location:
      cleanOptionalString(
        contactData.location
      ),

    linkedin:
      cleanOptionalString(
        contactData.linkedin
      ),

    github:
      cleanOptionalString(
        contactData.github
      ),

    website:
      cleanOptionalString(
        contactData.website
      ),
  };

  const experience:
    IExtractedResumeExperience[] =
    Array.isArray(
      data.experience
    )
      ? data.experience
          .map(
            (
              raw
            ): IExtractedResumeExperience | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const title =
                cleanString(
                  item.title
                );

              if (!title) {
                return null;
              }

              return {
                title,

                company:
                  cleanOptionalString(
                    item.company
                  ),

                location:
                  undefined,

                employmentType:
                  cleanOptionalString(
                    item.employmentType
                  ),

                startDate:
                  cleanOptionalString(
                    item.startDate
                  ),

                endDate:
                  cleanOptionalString(
                    item.endDate
                  ),

                isCurrent:
                  item.isCurrent ===
                  true,

                description:
                  cleanOptionalString(
                    item.description
                  ),

                bullets:
                  cleanArray(
                    item.bullets
                  ),

                technologies:
                  cleanArray(
                    item.technologies
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeExperience =>
              item !==
              null
          )
      : [];

  const projects:
    IExtractedResumeProject[] =
    Array.isArray(
      data.projects
    )
      ? data.projects
          .map(
            (
              raw
            ): IExtractedResumeProject | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const name =
                cleanString(
                  item.name
                );

              if (!name) {
                return null;
              }

              return {
                name,

                role:
                  cleanOptionalString(
                    item.role
                  ),

                description:
                  cleanOptionalString(
                    item.description
                  ),

                startDate:
                  cleanOptionalString(
                    item.startDate
                  ),

                endDate:
                  cleanOptionalString(
                    item.endDate
                  ),

                technologies:
                  cleanArray(
                    item.technologies
                  ),

                bullets:
                  cleanArray(
                    item.bullets
                  ),

                url:
                  cleanOptionalString(
                    item.url
                  ),

                github:
                  cleanOptionalString(
                    item.github
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeProject =>
              item !==
              null
          )
      : [];

  const education:
    IExtractedResumeEducation[] =
    Array.isArray(
      data.education
    )
      ? data.education
          .map(
            (
              raw
            ): IExtractedResumeEducation | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const institution =
                cleanString(
                  item.institution
                );

              if (
                !institution
              ) {
                return null;
              }

              return {
                institution,

                degree:
                  cleanOptionalString(
                    item.degree
                  ),

                field:
                  cleanOptionalString(
                    item.field
                  ),

                location:
                  undefined,

                startDate:
                  cleanOptionalString(
                    item.startDate
                  ),

                endDate:
                  cleanOptionalString(
                    item.endDate
                  ),

                isCurrent:
                  item.isCurrent ===
                  true,

                gpa:
                  undefined,

                coursework:
                  [],

                achievements:
                  [],
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeEducation =>
              item !==
              null
          )
      : [];

  const certifications:
    IExtractedResumeCertification[] =
    Array.isArray(
      data.certifications
    )
      ? data.certifications
          .map(
            (
              raw
            ): IExtractedResumeCertification | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const name =
                cleanString(
                  item.name
                );

              if (!name) {
                return null;
              }

              return {
                name,

                issuer:
                  cleanOptionalString(
                    item.issuer
                  ),

                issueDate:
                  cleanOptionalString(
                    item.issueDate
                  ),

                expirationDate:
                  undefined,

                credentialId:
                  undefined,

                credentialUrl:
                  undefined,

                status:
                  normalizeStatus(
                    item.status
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeCertification =>
              item !==
              null
          )
      : [];

  const languages:
    IExtractedResumeLanguage[] =
    Array.isArray(
      data.languages
    )
      ? data.languages
          .map(
            (
              raw
            ): IExtractedResumeLanguage | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const language =
                cleanString(
                  item.language
                );

              if (
                !language
              ) {
                return null;
              }

              return {
                language,

                level:
                  cleanOptionalString(
                    item.level
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeLanguage =>
              item !==
              null
          )
      : [];

  const volunteering:
    IExtractedResumeVolunteer[] =
    Array.isArray(
      data.volunteering
    )
      ? data.volunteering
          .map(
            (
              raw
            ): IExtractedResumeVolunteer | null => {
              if (
                typeof raw !==
                  "object" ||
                raw ===
                  null ||
                Array.isArray(
                  raw
                )
              ) {
                return null;
              }

              const item =
                raw as Record<
                  string,
                  unknown
                >;

              const organization =
                cleanString(
                  item.organization
                );

              if (
                !organization
              ) {
                return null;
              }

              return {
                organization,

                role:
                  cleanOptionalString(
                    item.role
                  ),

                startDate:
                  cleanOptionalString(
                    item.startDate
                  ),

                endDate:
                  cleanOptionalString(
                    item.endDate
                  ),

                bullets:
                  cleanArray(
                    item.bullets
                  ),
              };
            }
          )
          .filter(
            (
              item
            ): item is IExtractedResumeVolunteer =>
              item !==
              null
          )
      : [];

  const warnings:
    string[] = [];

  if (
    !contact.fullName
  ) {
    warnings.push(
      "Full name could not be confidently extracted."
    );
  }

  if (
    !contact.email
  ) {
    warnings.push(
      "Email could not be confidently extracted."
    );
  }

  return {
    contact,

    professionalSummary:
      cleanString(
        data.professionalSummary
      ),

    skills:
      cleanArray(
        data.skills
      ),

    technicalSkills:
      cleanArray(
        data.technicalSkills
      ),

    softSkills:
      cleanArray(
        data.softSkills
      ),

    experience,

    projects,

    education,

    certifications,

    languages,

    volunteering,

    achievements:
      cleanArray(
        data.achievements
      ),

    interests:
      [],

    rawSections: [
      {
        title:
          "Original Resume Text",

        content:
          resumeText,
      },
    ],

    extractionStatus:
      warnings.length >
      0
        ? "partial"
        : "completed",

    extractionWarnings:
      warnings,
  };
};

/* =========================================================
   SYSTEM INSTRUCTION
========================================================= */

const SYSTEM_INSTRUCTION = `
You are InterviewIQ's lightweight professional resume analysis engine.

Your ONLY task is to evaluate resume quality.

Do NOT extract structured experience objects.
Do NOT extract structured projects.
Do NOT extract structured education.
Do NOT reproduce long resume bullet points.

Return a compact JSON analysis.

Never invent candidate information.

All scores must be between 0 and 100.

IMPORTANT:

weaknesses = Areas to Improve.
Return at least 4 useful and constructive items.

recommendations = AI Recommendations / Next Steps.
Return at least 4 concrete and actionable items.

missingSkills = Recommended Skills.

Rules for missingSkills:
- Recommend ONLY skills genuinely relevant to the candidate's demonstrated professional direction.
- Base each recommendation on evidence from the resume's current skills, experience, projects, education, or certifications.
- Never add generic filler skills just to populate the array.
- Never recommend a skill already clearly present in the resume.
- Do not assume a target occupation that the resume does not support.
- If there is not enough evidence to identify a meaningful skill gap, return fewer items or an empty array.
`.trim();

/* =========================================================
   LOCAL EXTRACTION HELPERS
========================================================= */

const SECTION_ALIASES: Record<string, string[]> = {
  summary: [
    "summary",
    "professional summary",
    "profile",
    "professional profile",
    "objective",
    "career objective",
    "about me",
  ],

  skills: [
    "skills",
    "technical skills",
    "core skills",
    "technologies",
    "technical proficiencies",
    "competencies",
    "core competencies",
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
    "personal projects",
    "academic projects",
    "project experience",
    "selected projects",
  ],

  education: [
    "education",
    "academic background",
    "academic history",
  ],

  certifications: [
    "certifications",
    "certificates",
    "licenses",
    "licenses & certifications",
  ],

  languages: [
    "languages",
    "language",
  ],

  volunteering: [
    "volunteering",
    "volunteer experience",
    "community involvement",
  ],

  achievements: [
    "achievements",
    "awards",
    "honors",
    "awards & honors",
  ],
};

const normalizeHeading = (
  value: string
): string => {
  return value
    .toLowerCase()
    .replace(
      /[:|]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const detectSectionName = (
  line: string
): string | null => {
  const normalized =
    normalizeHeading(
      line
    );

  for (
    const [
      sectionName,
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
      return sectionName;
    }
  }

  return null;
};

const splitResumeIntoSections = (
  resumeText: string
): Record<string, string[]> => {
  const result: Record<
    string,
    string[]
  > = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    languages: [],
    volunteering: [],
    achievements: [],
  };

  const lines =
    resumeText
      .split(
        "\n"
      )
      .map(
        (
          line
        ) =>
          line.trim()
      );

  let currentSection =
    "header";

  for (
    const line
    of lines
  ) {
    if (
      !line
    ) {
      if (
        result[
          currentSection
        ] &&
        result[
          currentSection
        ].length >
          0
      ) {
        result[
          currentSection
        ].push(
          ""
        );
      }

      continue;
    }

    const detected =
      detectSectionName(
        line
      );

    if (
      detected
    ) {
      currentSection =
        detected;

      continue;
    }

    result[
      currentSection
    ].push(
      line
    );
  }

  return result;
};

const extractEmail = (
  text: string
): string => {
  const match =
    text.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
    );

  return (
    match?.[0] ||
    ""
  );
};

const extractPhone = (
  text: string
): string => {
  const match =
    text.match(
      /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
    );

  return (
    match?.[0] ||
    ""
  );
};

const extractLinkedIn = (
  text: string
): string => {
  const match =
    text.match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)>,]+/i
    );

  return (
    match?.[0] ||
    ""
  );
};

const extractGitHub = (
  text: string
): string => {
  const match =
    text.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)>,]+/i
    );

  return (
    match?.[0] ||
    ""
  );
};

const extractWebsite = (
  text: string
): string => {
  const matches =
    text.match(
      /(?:https?:\/\/|www\.)[^\s)>,]+/gi
    ) ||
    [];

  const website =
    matches.find(
      (
        url
      ) =>
        !/linkedin\.com/i.test(
          url
        ) &&
        !/github\.com/i.test(
          url
        )
    );

  return (
    website ||
    ""
  );
};

const extractFullName = (
  headerLines: string[]
): string => {
  const candidate =
    headerLines.find(
      (
        line
      ) => {
        if (
          !line
        ) {
          return false;
        }

        if (
          line.includes(
            "@"
          )
        ) {
          return false;
        }

        if (
          /linkedin|github|https?:\/\/|www\./i.test(
            line
          )
        ) {
          return false;
        }

        if (
          /\d{3}.*\d{3}.*\d{4}/.test(
            line
          )
        ) {
          return false;
        }

        const words =
          line
            .split(
              /\s+/
            )
            .filter(
              Boolean
            );

        return (
          words.length >=
            2 &&
          words.length <=
            5 &&
          line.length <=
            60
        );
      }
    );

  return (
    candidate ||
    ""
  );
};

const extractLocation = (
  headerLines: string[]
): string => {
  const candidate =
    headerLines.find(
      (
        line
      ) => {
        if (
          !line
        ) {
          return false;
        }

        if (
          line.includes(
            "@"
          )
        ) {
          return false;
        }

        if (
          /linkedin|github|https?:\/\/|www\./i.test(
            line
          )
        ) {
          return false;
        }

        if (
          /\d{3}.*\d{3}.*\d{4}/.test(
            line
          )
        ) {
          return false;
        }

        return (
          /,\s*[A-Z]{2}\b/.test(
            line
          ) ||
          /\b[A-Za-z .'-]+,\s*[A-Za-z .'-]+\b/.test(
            line
          )
        );
      }
    );

  return (
    candidate ||
    ""
  );
};

const extractDateRange = (
  value: string
): {
  startDate: string;
  endDate: string;
  isCurrent: boolean;
} => {
  const normalized =
    value
      .replace(
        /–|—/g,
        "-"
      )
      .trim();

  const monthPattern =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

  const datePattern =
    `(?:${monthPattern}\\s+)?\\d{4}`;

  const rangeRegex =
    new RegExp(
      `(${datePattern})\\s*(?:-|to)\\s*(Present|Current|Now|${datePattern})`,
      "i"
    );

  const range =
    normalized.match(
      rangeRegex
    );

  if (
    range
  ) {
    const end =
      cleanString(
        range[2]
      );

    return {
      startDate:
        cleanString(
          range[1]
        ),

      endDate:
        /present|current|now/i.test(
          end
        )
          ? ""
          : end,

      isCurrent:
        /present|current|now/i.test(
          end
        ),
    };
  }

  const years =
    normalized.match(
      /\b(?:19|20)\d{2}\b/g
    );

  if (
    years &&
    years.length >=
      2
  ) {
    return {
      startDate:
        years[0],

      endDate:
        years[1],

      isCurrent:
        false,
    };
  }

  if (
    years &&
    years.length ===
      1
  ) {
    return {
      startDate:
        years[0],

      endDate:
        "",

      isCurrent:
        /present|current|now/i.test(
          normalized
        ),
    };
  }

  return {
    startDate:
      "",

    endDate:
      "",

    isCurrent:
      false,
  };
};

const isBulletLine = (
  line: string
): boolean => {
  return /^[-•●▪◦*]\s*/.test(
    line
  );
};

const cleanBullet = (
  line: string
): string => {
  return line
    .replace(
      /^[-•●▪◦*]\s*/,
      ""
    )
    .trim();
};

const parseSkills = (
  lines: string[]
): string[] => {
  const joined =
    lines
      .filter(
        Boolean
      )
      .join(
        ", "
      );

  return cleanArray(
    joined
      .split(
        /[,;|•●▪◦]+/
      )
      .map(
        (
          item
        ) =>
          item.trim()
      )
  );
};

const TECH_KEYWORDS =
  new Set(
    [
      "javascript",
      "typescript",
      "node.js",
      "nodejs",
      "react",
      "react.js",
      "next.js",
      "vue",
      "angular",
      "express",
      "mongodb",
      "mysql",
      "postgresql",
      "sql",
      "oracle",
      "python",
      "java",
      "c",
      "c++",
      "c#",
      ".net",
      "html",
      "css",
      "tailwind",
      "bootstrap",
      "git",
      "github",
      "docker",
      "kubernetes",
      "aws",
      "azure",
      "gcp",
      "linux",
      "windows",
      "rest",
      "rest api",
      "rest apis",
      "graphql",
      "mongoose",
      "jwt",
      "bcrypt",
      "figma",
      "postman",
      "selenium",
      "cypress",
      "playwright",
      "jira",
      "agile",
      "scrum",
      "machine learning",
      "artificial intelligence",
      "ai",
    ].map(
      (
        item
      ) =>
        item.toLowerCase()
    )
  );

const SOFT_SKILL_KEYWORDS =
  new Set(
    [
      "communication",
      "teamwork",
      "leadership",
      "problem solving",
      "problem-solving",
      "critical thinking",
      "time management",
      "adaptability",
      "organization",
      "collaboration",
      "attention to detail",
      "creativity",
      "decision making",
      "interpersonal skills",
    ].map(
      (
        item
      ) =>
        item.toLowerCase()
    )
  );

const classifyTechnicalSkills = (
  skills: string[]
): string[] => {
  return skills.filter(
    (
      skill
    ) =>
      TECH_KEYWORDS.has(
        skill.toLowerCase()
      )
  );
};

const classifySoftSkills = (
  skills: string[]
): string[] => {
  return skills.filter(
    (
      skill
    ) =>
      SOFT_SKILL_KEYWORDS.has(
        skill.toLowerCase()
      )
  );
};

const parseEntryBlocks = (
  lines: string[]
): string[][] => {
  const blocks:
    string[][] = [];

  let current:
    string[] = [];

  for (
    const line
    of lines
  ) {
    if (
      !line.trim()
    ) {
      if (
        current.length >
        0
      ) {
        blocks.push(
          current
        );

        current =
          [];
      }

      continue;
    }

    const looksLikeNewEntry =
      current.length >
        0 &&
      !isBulletLine(
        line
      ) &&
      (
        /\b(?:19|20)\d{2}\b/.test(
          line
        ) ||
        /\b(?:Present|Current|Now)\b/i.test(
          line
        )
      ) &&
      current.some(
        (
          existing
        ) =>
          isBulletLine(
            existing
          )
      );

    if (
      looksLikeNewEntry
    ) {
      blocks.push(
        current
      );

      current =
        [];
    }

    current.push(
      line
    );
  }

  if (
    current.length >
    0
  ) {
    blocks.push(
      current
    );
  }

  return blocks;
};

const parseExperience = (
  lines: string[]
): any[] => {
  if (
    lines.length ===
    0
  ) {
    return [];
  }

  const blocks =
    parseEntryBlocks(
      lines
    );

  const results:
    any[] = [];

  for (
    const block
    of blocks
  ) {
    const nonBullets =
      block.filter(
        (
          line
        ) =>
          !isBulletLine(
            line
          )
      );

    const bullets =
      block
        .filter(
          isBulletLine
        )
        .map(
          cleanBullet
        );

    if (
      nonBullets.length ===
        0 &&
      bullets.length ===
        0
    ) {
      continue;
    }

    const dateLine =
      nonBullets.find(
        (
          line
        ) =>
          /\b(?:19|20)\d{2}\b/.test(
            line
          ) ||
          /\b(?:Present|Current|Now)\b/i.test(
            line
          )
      ) ||
      "";

    const dateRange =
      extractDateRange(
        dateLine
      );

    const infoLines =
      nonBullets.filter(
        (
          line
        ) =>
          line !==
          dateLine
      );

    let title =
      "";

    let company =
      "";

    if (
      infoLines.length >=
      2
    ) {
      title =
        infoLines[0];

      company =
        infoLines[1];
    } else if (
      infoLines.length ===
      1
    ) {
      const parts =
        infoLines[0]
          .split(
            /\s+[|@–—-]\s+/
          )
          .map(
            (
              part
            ) =>
              part.trim()
          )
          .filter(
            Boolean
          );

      title =
        parts[0] ||
        infoLines[0];

      company =
        parts[1] ||
        "";
    }

    if (
      !title
    ) {
      continue;
    }

    results.push(
      {
        title,

        company,

        employmentType:
          "",

        startDate:
          dateRange.startDate,

        endDate:
          dateRange.endDate,

        isCurrent:
          dateRange.isCurrent,

        description:
          "",

        bullets,

        technologies:
          [],
      }
    );
  }

  return results;
};

const parseProjects = (
  lines: string[]
): any[] => {
  if (
    lines.length ===
    0
  ) {
    return [];
  }

  const blocks =
    parseEntryBlocks(
      lines
    );

  const results:
    any[] = [];

  for (
    const block
    of blocks
  ) {
    const bullets =
      block
        .filter(
          isBulletLine
        )
        .map(
          cleanBullet
        );

    const nonBullets =
      block.filter(
        (
          line
        ) =>
          !isBulletLine(
            line
          )
      );

    if (
      nonBullets.length ===
      0
    ) {
      continue;
    }

    const dateLine =
      nonBullets.find(
        (
          line
        ) =>
          /\b(?:19|20)\d{2}\b/.test(
            line
          ) ||
          /\b(?:Present|Current|Now)\b/i.test(
            line
          )
      ) ||
      "";

    const dateRange =
      extractDateRange(
        dateLine
      );

    const name =
      nonBullets.find(
        (
          line
        ) =>
          line !==
          dateLine
      ) ||
      "";

    if (
      !name
    ) {
      continue;
    }

    const github =
      block
        .join(
          " "
        )
        .match(
          /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)>,]+/i
        )?.[0] ||
      "";

    const url =
      block
        .join(
          " "
        )
        .match(
          /(?:https?:\/\/|www\.)[^\s)>,]+/i
        )?.[0] ||
      "";

    results.push(
      {
        name,

        role:
          "",

        description:
          "",

        startDate:
          dateRange.startDate,

        endDate:
          dateRange.endDate,

        technologies:
          [],

        bullets,

        url,

        github,
      }
    );
  }

  return results;
};

const parseEducation = (
  lines: string[]
): any[] => {
  if (
    lines.length ===
    0
  ) {
    return [];
  }

  const blocks =
    parseEntryBlocks(
      lines
    );

  const results:
    any[] = [];

  const institutionRegex =
    /\b(university|college|institute|school|academy|polytechnic)\b/i;

  for (
    const block
    of blocks
  ) {
    const dateLine =
      block.find(
        (
          line
        ) =>
          /\b(?:19|20)\d{2}\b/.test(
            line
          ) ||
          /\b(?:Present|Current|Expected)\b/i.test(
            line
          )
      ) ||
      "";

    const dateRange =
      extractDateRange(
        dateLine
      );

    const institution =
      block.find(
        (
          line
        ) =>
          institutionRegex.test(
            line
          )
      ) ||
      block[0] ||
      "";

    const degree =
      block.find(
        (
          line
        ) =>
          line !==
            institution &&
          /\b(bachelor|master|associate|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|phd|doctor|diploma|degree)\b/i.test(
            line
          )
      ) ||
      "";

    let field =
      "";

    const fieldMatch =
      degree.match(
        /\bin\s+(.+)$/i
      );

    if (
      fieldMatch?.[1]
    ) {
      field =
        fieldMatch[1].trim();
    }

    if (
      !institution
    ) {
      continue;
    }

    results.push(
      {
        institution,

        degree,

        field,

        startDate:
          dateRange.startDate,

        endDate:
          dateRange.endDate,

        isCurrent:
          dateRange.isCurrent ||
          /\bexpected\b/i.test(
            block.join(
              " "
            )
          ),
      }
    );
  }

  return results;
};

const parseCertifications = (
  lines: string[]
): any[] => {
  return lines
    .filter(
      Boolean
    )
    .map(
      (
        line
      ) => ({
        name:
          cleanBullet(
            line
          ),

        issuer:
          "",

        issueDate:
          "",

        status:
          /expired/i.test(
            line
          )
            ? "expired"
            : /in[\s-]?progress/i.test(
                  line
                )
              ? "in-progress"
              : "completed",
      })
    );
};

const parseLanguages = (
  lines: string[]
): any[] => {
  const result:
    any[] = [];

  for (
    const line
    of lines
  ) {
    if (
      !line
    ) {
      continue;
    }

    const parts =
      line
        .split(
          /[,;|•]+/
        )
        .map(
          (
            item
          ) =>
            item.trim()
        )
        .filter(
          Boolean
        );

    for (
      const part
      of parts
    ) {
      const pair =
        part
          .split(
            /[-–—:()]/
          )
          .map(
            (
              value
            ) =>
              value.trim()
          )
          .filter(
            Boolean
          );

      result.push(
        {
          language:
            pair[0] ||
            part,

          level:
            pair[1] ||
            "",
        }
      );
    }
  }

  return result;
};

const parseVolunteering = (
  lines: string[]
): any[] => {
  const blocks =
    parseEntryBlocks(
      lines
    );

  return blocks
    .map(
      (
        block
      ) => {
        const bullets =
          block
            .filter(
              isBulletLine
            )
            .map(
              cleanBullet
            );

        const nonBullets =
          block.filter(
            (
              line
            ) =>
              !isBulletLine(
                line
              )
          );

        return {
          organization:
            nonBullets[0] ||
            "",

          role:
            nonBullets[1] ||
            "",

          startDate:
            "",

          endDate:
            "",

          bullets,
        };
      }
    )
    .filter(
      (
        item
      ) =>
        item.organization
    );
};

const buildLocalProfile = (
  resumeText: string
): Record<string, unknown> => {
  const sections =
    splitResumeIntoSections(
      resumeText
    );

  const allSkills =
    parseSkills(
      sections.skills
    );

  const technicalSkills =
    classifyTechnicalSkills(
      allSkills
    );

  const softSkills =
    classifySoftSkills(
      allSkills
    );

  const inferredTechnicalSkills =
    Array.from(
      TECH_KEYWORDS
    ).filter(
      (
        skill
      ) => {
        const escaped =
          skill.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

        return new RegExp(
          `(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`,
          "i"
        ).test(
          resumeText
        );
      }
    );

  const mergedTechnicalSkills =
    cleanArray(
      [
        ...technicalSkills,
        ...inferredTechnicalSkills,
      ]
    );

  const mergedSkills =
    cleanArray(
      [
        ...allSkills,
        ...mergedTechnicalSkills,
      ]
    );

  return {
    contact: {
      fullName:
        extractFullName(
          sections.header
        ),

      email:
        extractEmail(
          resumeText
        ),

      phone:
        extractPhone(
          resumeText
        ),

      location:
        extractLocation(
          sections.header
        ),

      linkedin:
        extractLinkedIn(
          resumeText
        ),

      github:
        extractGitHub(
          resumeText
        ),

      website:
        extractWebsite(
          resumeText
        ),
    },

    professionalSummary:
      sections.summary
        .filter(
          Boolean
        )
        .join(
          " "
        ),

    skills:
      mergedSkills,

    technicalSkills:
      mergedTechnicalSkills,

    softSkills,

    experience:
      parseExperience(
        sections.experience
      ),

    projects:
      parseProjects(
        sections.projects
      ),

    education:
      parseEducation(
        sections.education
      ),

    certifications:
      parseCertifications(
        sections.certifications
      ),

    languages:
      parseLanguages(
        sections.languages
      ),

    volunteering:
      parseVolunteering(
        sections.volunteering
      ),

    achievements:
      sections.achievements
        .filter(
          Boolean
        )
        .map(
          cleanBullet
        )
        .filter(
          Boolean
        ),
  };
};

/* =========================================================
   ANALYSIS SIGNALS
========================================================= */

const containsMetric = (
  value: string
): boolean => {
  return (
    /\b\d+(?:\.\d+)?%/.test(
      value
    ) ||
    /\$\s?\d/.test(
      value
    ) ||
    /\b\d+\+?\s*(?:users|customers|clients|projects|tickets|requests|applications|systems|employees|members|hours|days|weeks|months|years|features|tests|cases|sales|revenue|records|transactions|tasks|issues)\b/i.test(
      value
    )
  );
};

const startsWithStrongActionVerb = (
  value: string
): boolean => {
  return /^(achieved|administered|analyzed|automated|built|collaborated|configured|created|delivered|designed|developed|directed|implemented|improved|increased|launched|led|managed|maintained|optimized|organized|performed|planned|reduced|resolved|supported|tested|trained|troubleshot|updated|utilized|coordinated|engineered|integrated|deployed|monitored|streamlined|executed)\b/i.test(
    value.trim()
  );
};

const getAllExperienceBullets = (
  profile: IExtractedResumeProfile
): string[] => {
  return profile.experience.flatMap(
    (
      item
    ) =>
      item.bullets
  );
};

const getAllProjectBullets = (
  profile: IExtractedResumeProfile
): string[] => {
  return profile.projects.flatMap(
    (
      item
    ) =>
      item.bullets
  );
};

/* =========================================================
   PROFILE DIRECTION DETECTION
========================================================= */

const getProfileEvidenceText = (
  profile: IExtractedResumeProfile
): string => {
  return [
    profile.professionalSummary,

    ...profile.skills,

    ...profile.technicalSkills,

    ...profile.experience.map(
      (
        item
      ) =>
        [
          item.title,
          item.company,
          item.description,
          ...item.bullets,
          ...item.technologies,
        ].join(
          " "
        )
    ),

    ...profile.projects.map(
      (
        item
      ) =>
        [
          item.name,
          item.role,
          item.description,
          ...item.bullets,
          ...item.technologies,
        ].join(
          " "
        )
    ),

    ...profile.education.map(
      (
        item
      ) =>
        [
          item.degree,
          item.field,
          item.institution,
        ].join(
          " "
        )
    ),
  ]
    .join(
      " "
    )
    .toLowerCase();
};

const hasEvidence = (
  evidenceText: string,
  terms: string[]
): boolean => {
  return terms.some(
    (
      term
    ) =>
      evidenceText.includes(
        term.toLowerCase()
      )
  );
};

/* =========================================================
   HIGH-CONFIDENCE RECOMMENDED SKILLS
========================================================= */

const buildRecommendedSkills = (
  profile: IExtractedResumeProfile
): string[] => {
  const existingSkills =
    new Set(
      [
        ...profile.skills,
        ...profile.technicalSkills,
        ...profile.softSkills,
      ].map(
        (
          item
        ) =>
          item
            .toLowerCase()
            .trim()
      )
    );

  const evidenceText =
    getProfileEvidenceText(
      profile
    );

  const recommendations:
    string[] = [];

  const addSkill = (
    skill: string
  ) => {
    const key =
      skill
        .toLowerCase()
        .trim();

    if (
      existingSkills.has(
        key
      )
    ) {
      return;
    }

    if (
      recommendations.some(
        (
          item
        ) =>
          item.toLowerCase() ===
          key
      )
    ) {
      return;
    }

    recommendations.push(
      skill
    );
  };

  /* =========================================================
     FRONTEND PROFILE
  ========================================================= */

  const frontendEvidence =
    hasEvidence(
      evidenceText,
      [
        "front-end",
        "frontend",
        "html",
        "css",
        "javascript",
        "react",
        "web application",
        "responsive",
      ]
    );

  if (
    frontendEvidence
  ) {
    if (
      existingSkills.has(
        "javascript"
      ) &&
      !existingSkills.has(
        "typescript"
      )
    ) {
      addSkill(
        "TypeScript"
      );
    }

    if (
      existingSkills.has(
        "javascript"
      ) &&
      !existingSkills.has(
        "react"
      ) &&
      !existingSkills.has(
        "react.js"
      ) &&
      !existingSkills.has(
        "vue"
      ) &&
      !existingSkills.has(
        "angular"
      )
    ) {
      addSkill(
        "React"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "api",
          "fetch",
          "axios",
          "backend",
          "server",
        ]
      ) &&
      !existingSkills.has(
        "rest api"
      ) &&
      !existingSkills.has(
        "rest apis"
      )
    ) {
      addSkill(
        "REST API Integration"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "javascript",
          "typescript",
          "react",
          "web application",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "jest",
          "vitest",
          "unit testing",
          "testing library",
          "cypress",
          "playwright",
        ]
      )
    ) {
      addSkill(
        "Frontend Testing"
      );
    }
  }

  /* =========================================================
     BACKEND PROFILE
  ========================================================= */

  const backendEvidence =
    hasEvidence(
      evidenceText,
      [
        "node.js",
        "nodejs",
        "express",
        "backend",
        "server",
        "api",
        "mongodb",
        "mongoose",
      ]
    );

  if (
    backendEvidence
  ) {
    if (
      hasEvidence(
        evidenceText,
        [
          "node.js",
          "nodejs",
          "express",
          "api",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "authentication",
          "authorization",
          "jwt",
          "oauth",
        ]
      )
    ) {
      addSkill(
        "Authentication & Authorization"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "mongodb",
          "mongoose",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "postgresql",
          "mysql",
          "sql",
          "relational database",
        ]
      )
    ) {
      addSkill(
        "Relational Databases"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "api",
          "rest",
          "express",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "postman",
          "api testing",
          "integration testing",
        ]
      )
    ) {
      addSkill(
        "API Testing"
      );
    }
  }

  /* =========================================================
     QA PROFILE
  ========================================================= */

  const qaEvidence =
    hasEvidence(
      evidenceText,
      [
        "qa",
        "quality assurance",
        "selenium",
        "cypress",
        "playwright",
        "testing",
        "test cases",
        "regression",
      ]
    );

  if (
    qaEvidence
  ) {
    if (
      hasEvidence(
        evidenceText,
        [
          "manual testing",
          "test cases",
          "qa",
          "quality assurance",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "selenium",
          "cypress",
          "playwright",
          "automation testing",
          "test automation",
        ]
      )
    ) {
      addSkill(
        "Test Automation"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "testing",
          "qa",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "api testing",
          "postman",
        ]
      )
    ) {
      addSkill(
        "API Testing"
      );
    }
  }

  /* =========================================================
     DATA / PYTHON PROFILE
  ========================================================= */

  const dataEvidence =
    hasEvidence(
      evidenceText,
      [
        "python",
        "data analysis",
        "machine learning",
        "artificial intelligence",
        "data science",
      ]
    );

  if (
    dataEvidence
  ) {
    if (
      existingSkills.has(
        "python"
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "pandas",
        ]
      )
    ) {
      addSkill(
        "Pandas"
      );
    }

    if (
      hasEvidence(
        evidenceText,
        [
          "data analysis",
          "data science",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "sql",
          "postgresql",
          "mysql",
        ]
      )
    ) {
      addSkill(
        "SQL"
      );
    }
  }

  /* =========================================================
     DEVOPS / DEPLOYMENT PROFILE
  ========================================================= */

  const deploymentEvidence =
    hasEvidence(
      evidenceText,
      [
        "docker",
        "aws",
        "azure",
        "gcp",
        "deployment",
        "devops",
        "linux",
        "kubernetes",
      ]
    );

  if (
    deploymentEvidence
  ) {
    if (
      hasEvidence(
        evidenceText,
        [
          "docker",
          "deployment",
          "devops",
        ]
      ) &&
      !hasEvidence(
        evidenceText,
        [
          "ci/cd",
          "github actions",
          "jenkins",
          "gitlab ci",
        ]
      )
    ) {
      addSkill(
        "CI/CD"
      );
    }
  }

  /*
   * IMPORTANT:
   * No generic fallback here.
   *
   * If we cannot identify a meaningful skill gap
   * from resume evidence, return fewer skills.
   */

  return cleanArray(
    recommendations
  ).slice(
    0,
    6
  );
};

/* =========================================================
   AREAS TO IMPROVE
========================================================= */

const buildImprovementOpportunities = (
  profile: IExtractedResumeProfile
): string[] => {
  const opportunities:
    string[] = [];

  const experienceBullets =
    getAllExperienceBullets(
      profile
    );

  const projectBullets =
    getAllProjectBullets(
      profile
    );

  const allBullets = [
    ...experienceBullets,
    ...projectBullets,
  ];

  const metrics =
    allBullets.filter(
      containsMetric
    );

  const actionBullets =
    allBullets.filter(
      startsWithStrongActionVerb
    );

  if (
    !profile.professionalSummary
  ) {
    opportunities.push(
      "Add a concise professional summary that clearly communicates your target role, strongest skills, experience level, and the value you can bring to an employer."
    );
  } else if (
    profile.professionalSummary
      .length <
    120
  ) {
    opportunities.push(
      "Expand the professional summary slightly so it communicates your strongest qualifications, expertise, career direction, and professional value more clearly."
    );
  }

  if (
    profile.skills.length <
    6
  ) {
    opportunities.push(
      "Strengthen the skills section with additional role-relevant competencies that are genuinely supported by your actual experience, projects, or education."
    );
  }

  if (
    profile.experience.length ===
    0
  ) {
    opportunities.push(
      "The resume does not clearly present structured professional experience; add employment, internships, freelance work, volunteering, or substantial academic experience where relevant."
    );
  }

  if (
    profile.experience.length >
      0 &&
    experienceBullets.length ===
      0
  ) {
    opportunities.push(
      "Add accomplishment-focused bullet points beneath each experience entry instead of relying only on job titles and company names."
    );
  }

  if (
    allBullets.length >
      0 &&
    metrics.length /
      allBullets.length <
      0.25
  ) {
    opportunities.push(
      "Most bullet points lack measurable outcomes; strengthen them with accurate numbers, percentages, time savings, scale, users, workload, revenue, or other concrete results."
    );
  }

  if (
    allBullets.length >
      0 &&
    actionBullets.length /
      allBullets.length <
      0.5
  ) {
    opportunities.push(
      "Several bullet points could begin with stronger action verbs and focus more clearly on accomplishments rather than passive responsibility statements."
    );
  }

  if (
    profile.projects.length ===
      0 &&
    profile.technicalSkills
      .length >=
      4
  ) {
    opportunities.push(
      "Consider adding selected projects that demonstrate how your technical skills were applied in practical situations, especially for technology-focused positions."
    );
  }

  if (
    !profile.contact.linkedin
  ) {
    opportunities.push(
      "Consider adding a professional LinkedIn profile so recruiters can review additional career information and your broader professional presence."
    );
  }

  const fallbacks = [
    "Improve ATS keyword alignment by comparing the resume with relevant job descriptions and incorporating matching terminology only when it accurately reflects your background.",

    "Review each experience entry and prioritize achievements, contributions, and outcomes that best demonstrate your value to an employer.",

    "Use consistent section headings, date formats, job-title formatting, and bullet structure so recruiters and ATS systems can scan the resume reliably.",

    "Replace vague or repetitive wording with specific evidence of responsibilities, technical contributions, problem solving, or measurable professional impact.",
  ];

  for (
    const item
    of fallbacks
  ) {
    if (
      opportunities.length >=
      4
    ) {
      break;
    }

    opportunities.push(
      item
    );
  }

  return cleanArray(
    opportunities
  ).slice(
    0,
    7
  );
};

/* =========================================================
   AI RECOMMENDATIONS
========================================================= */

const buildActionableRecommendations = (
  profile: IExtractedResumeProfile
): string[] => {
  const recommendations:
    string[] = [];

  const allBullets = [
    ...getAllExperienceBullets(
      profile
    ),

    ...getAllProjectBullets(
      profile
    ),
  ];

  const metrics =
    allBullets.filter(
      containsMetric
    );

  if (
    allBullets.length ===
      0 ||
    metrics.length <
      Math.max(
        1,
        Math.ceil(
          allBullets.length *
            0.3
        )
      )
  ) {
    recommendations.push(
      "Quantify achievements wherever possible by adding accurate metrics such as percentages, users served, time saved, workload handled, revenue, or performance improvements."
    );
  }

  recommendations.push(
    "Tailor the resume for each target role by identifying important ATS keywords in the job description and matching them only to skills and experience you genuinely possess."
  );

  if (
    allBullets.length >
    0
  ) {
    recommendations.push(
      "Rewrite weaker experience bullets with strong action verbs and a clear action-impact structure so each point explains what you did and why the result mattered."
    );
  } else if (
    profile.experience.length >
    0
  ) {
    recommendations.push(
      "Add concise accomplishment-focused bullet points beneath each experience entry to show responsibilities, contributions, and outcomes more clearly."
    );
  }

  if (
    !profile.professionalSummary ||
    profile.professionalSummary
      .length <
      120
  ) {
    recommendations.push(
      "Create a focused professional summary that highlights your actual experience, strongest relevant skills, career direction, and the value you can offer an employer."
    );
  } else {
    recommendations.push(
      "Customize the professional summary for each application so the opening section reflects the employer's most important qualifications without overstating your background."
    );
  }

  if (
    profile.projects.length >
    0
  ) {
    recommendations.push(
      "Strengthen project entries by clearly explaining the problem, your contribution, technologies used, and the practical result or functionality delivered."
    );
  }

  if (
    profile.skills.length >
    0
  ) {
    recommendations.push(
      "Organize the skills section by relevance and category so recruiters can quickly identify the capabilities that best support your demonstrated professional direction."
    );
  }

  recommendations.push(
    "Perform a final ATS-focused review using standard section headings, consistent dates, clear text, and simple formatting that can be parsed reliably."
  );

  return cleanArray(
    recommendations
  ).slice(
    0,
    7
  );
};

/* =========================================================
   FILTER QWEN SKILL RECOMMENDATIONS
========================================================= */

const filterRecommendedSkills = (
  skills: string[],
  profile: IExtractedResumeProfile
): string[] => {
  const existing =
    new Set(
      [
        ...profile.skills,
        ...profile.technicalSkills,
        ...profile.softSkills,
      ].map(
        (
          item
        ) =>
          item
            .toLowerCase()
            .trim()
      )
    );

  return cleanArray(
    skills
  ).filter(
    (
      skill
    ) =>
      !existing.has(
        skill
          .toLowerCase()
          .trim()
      )
  );
};

/* =========================================================
   FEEDBACK ENRICHMENT
========================================================= */

const enrichAnalysisFeedback = (
  analysis: IResumeAnalysis,
  profile: IExtractedResumeProfile
): IResumeAnalysis => {
  const weaknesses =
    cleanArray(
      [
        ...analysis.weaknesses,
        ...buildImprovementOpportunities(
          profile
        ),
      ]
    );

  const recommendations =
    cleanArray(
      [
        ...analysis.recommendations,
        ...buildActionableRecommendations(
          profile
        ),
      ]
    );

  const qwenRecommendedSkills =
    filterRecommendedSkills(
      analysis.missingSkills,
      profile
    );

  const localRecommendedSkills =
    buildRecommendedSkills(
      profile
    );

  const missingSkills =
    cleanArray(
      [
        ...qwenRecommendedSkills,
        ...localRecommendedSkills,
      ]
    );

  const guaranteedWeaknesses = [
    "Improve the resume's alignment with relevant job descriptions by emphasizing qualifications and achievements that accurately match your background.",

    "Replace general responsibility statements with more specific accomplishments and evidence of professional impact wherever possible.",

    "Review ATS keyword coverage and include role-relevant terminology only when it accurately reflects your real experience and qualifications.",

    "Ensure every major resume section gives recruiters enough specific detail to quickly understand your professional value.",
  ];

  const guaranteedRecommendations = [
    "Quantify achievements where possible with accurate metrics, percentages, scale, time savings, users, workload, revenue, or other measurable results.",

    "Tailor resume terminology to each target job description while keeping every skill and experience claim factually accurate.",

    "Strengthen experience bullets with clear action verbs and emphasize accomplishments, outcomes, and professional impact rather than responsibilities alone.",

    "Review the final resume for ATS readability, consistent formatting, clear section headings, concise wording, and relevance to the target role.",
  ];

  for (
    const item
    of guaranteedWeaknesses
  ) {
    if (
      weaknesses.length >=
      4
    ) {
      break;
    }

    weaknesses.push(
      item
    );
  }

  for (
    const item
    of guaranteedRecommendations
  ) {
    if (
      recommendations.length >=
      4
    ) {
      break;
    }

    recommendations.push(
      item
    );
  }

  return {
    ...analysis,

    weaknesses:
      cleanArray(
        weaknesses
      ).slice(
        0,
        7
      ),

    /*
     * No minimum count is forced here.
     *
     * If only 2 real skill gaps are identified,
     * only those 2 are returned.
     *
     * No random filler.
     */
    missingSkills:
      cleanArray(
        missingSkills
      ).slice(
        0,
        6
      ),

    recommendations:
      cleanArray(
        recommendations
      ).slice(
        0,
        7
      ),
  };
};

/* =========================================================
   DEFAULT FALLBACK ANALYSIS
========================================================= */

const createDefaultAnalysis = (
  profile: IExtractedResumeProfile
): IResumeAnalysis => {
  const hasContact =
    Boolean(
      profile.contact.email ||
      profile.contact.phone
    );

  const hasSummary =
    Boolean(
      profile.professionalSummary
    );

  const hasSkills =
    profile.skills.length >
    0;

  const hasExperience =
    profile.experience.length >
    0;

  const hasEducation =
    profile.education.length >
    0;

  let structureScore =
    40;

  if (
    hasContact
  ) {
    structureScore +=
      10;
  }

  if (
    hasSummary
  ) {
    structureScore +=
      10;
  }

  if (
    hasSkills
  ) {
    structureScore +=
      15;
  }

  if (
    hasExperience
  ) {
    structureScore +=
      15;
  }

  if (
    hasEducation
  ) {
    structureScore +=
      10;
  }

  const skillsScore =
    Math.min(
      100,
      45 +
        profile.skills
          .length *
          4
    );

  const experienceScore =
    hasExperience
      ? Math.min(
          100,
          55 +
            profile.experience
              .length *
              8
        )
      : 35;

  const contentScore =
    Math.min(
      100,
      45 +
        (
          hasSummary
            ? 10
            : 0
        ) +
        (
          hasExperience
            ? 15
            : 0
        ) +
        (
          hasSkills
            ? 15
            : 0
        ) +
        (
          hasEducation
            ? 10
            : 0
        )
    );

  const atsScore =
    Math.round(
      (
        structureScore +
        skillsScore +
        contentScore
      ) /
        3
    );

  const overallScore =
    Math.round(
      (
        atsScore +
        contentScore +
        skillsScore +
        experienceScore
      ) /
        4
    );

  const strengths:
    string[] = [];

  if (
    hasSkills
  ) {
    strengths.push(
      `The resume contains ${profile.skills.length} identifiable skills, providing recruiters with a useful overview of the candidate's demonstrated capabilities.`
    );
  }

  if (
    hasExperience
  ) {
    strengths.push(
      `The resume contains ${profile.experience.length} structured experience ${profile.experience.length === 1 ? "entry" : "entries"}, which helps establish the candidate's professional background.`
    );
  }

  if (
    hasEducation
  ) {
    strengths.push(
      "Education information is clearly represented and provides useful qualification context."
    );
  }

  if (
    profile.projects.length >
    0
  ) {
    strengths.push(
      "Project experience provides additional evidence of practical skills and applied knowledge."
    );
  }

  const normalized =
    normalizeAnalysis(
      {
        overallScore,

        atsScore,

        contentScore,

        structureScore,

        skillsScore,

        experienceScore,

        summary:
          "The resume was evaluated using InterviewIQ's local fallback analysis based on structure, skills coverage, experience detail, measurable impact, ATS readability, and completeness.",

        skillsDetected:
          profile.skills,

        strengths,

        weaknesses:
          buildImprovementOpportunities(
            profile
          ),

        missingSkills:
          buildRecommendedSkills(
            profile
          ),

        atsSuggestions: [
          "Use standard ATS-friendly section headings such as Summary, Skills, Experience, Projects, Education, and Certifications.",

          "Match important terminology from relevant job descriptions only when those keywords accurately reflect your experience.",

          "Keep important information in normal selectable text and avoid placing critical content only inside graphics or complex tables.",

          "Use consistent job titles, dates, company names, and bullet formatting so ATS parsers can identify information reliably.",
        ],

        formattingFeedback: [
          "Keep the visual structure clean, professional, and easy to scan with consistent spacing and section hierarchy.",

          "Use a simple ATS-compatible layout and avoid excessive columns, graphics, progress bars, or decorative elements.",

          "Keep font sizes, date formats, capitalization, and bullet styles consistent throughout the document.",

          "Avoid overly dense paragraphs and use concise bullet points for professional experience and projects.",
        ],

        recommendations:
          buildActionableRecommendations(
            profile
          ),
      }
    );

  return enrichAnalysisFeedback(
    normalized,
    profile
  );
};

/* =========================================================
   MAIN SERVICE
========================================================= */

export const analyzeResume =
  async ({
    resumeText,
  }: AnalyzeResumeParams): Promise<IResumeServiceResult> => {
    if (
      !resumeText ||
      resumeText.trim().length <
        20
    ) {
      throw new Error(
        "Resume text is empty or too short to analyze"
      );
    }

    const startedAt =
      Date.now();

    const cleanedResumeText =
      resumeText
        .replace(
          /\r/g,
          ""
        )
        .replace(
          /\u00a0/g,
          " "
        )
        .replace(
          /[ \t]+/g,
          " "
        )
        .trim();

    console.log(
      "===================================================="
    );

    console.log(
      "⚡ [Resume Service] Starting Hybrid Resume Analysis..."
    );

    console.log(
      "🧠 Profile extraction: LOCAL"
    );

    console.log(
      "🤖 ATS analysis: QWEN lightweight request"
    );

    console.log(
      "===================================================="
    );

    /* =========================================================
       LOCAL PROFILE EXTRACTION
    ========================================================= */

    const localStartedAt =
      Date.now();

    const rawLocalProfile =
      buildLocalProfile(
        cleanedResumeText
      );

    const profile =
      normalizeProfile(
        rawLocalProfile,
        cleanedResumeText
      );

    console.log(
      `✅ [Local Extraction] Completed in ${(
        (
          Date.now() -
          localStartedAt
        ) /
        1000
      ).toFixed(
        2
      )}s`
    );

    /* =========================================================
       DEFAULT ANALYSIS
    ========================================================= */

    let analysis =
      createDefaultAnalysis(
        profile
      );

    /* =========================================================
       LIGHTWEIGHT QWEN ANALYSIS
    ========================================================= */

    const lightweightResumeText =
      cleanedResumeText.length >
        9000
        ? cleanedResumeText.slice(
            0,
            9000
          )
        : cleanedResumeText;

    const analysisPrompt = `
Evaluate the following resume.

Return ONLY valid compact JSON.

Do NOT extract:
- experience objects
- project objects
- education objects
- contact objects

Return exactly:

{
  "overallScore": 0,
  "atsScore": 0,
  "contentScore": 0,
  "structureScore": 0,
  "skillsScore": 0,
  "experienceScore": 0,
  "summary": "",
  "skillsDetected": [],
  "strengths": [],
  "weaknesses": [],
  "missingSkills": [],
  "atsSuggestions": [],
  "formattingFeedback": [],
  "recommendations": []
}

Requirements:

strengths:
- identify genuine strengths supported by resume evidence

weaknesses:
- represents Areas to Improve
- return at least 4 useful and specific improvement points
- do not invent weaknesses unsupported by the resume

missingSkills:
- represents Recommended Skills
- recommend ONLY skills that logically complement the candidate's demonstrated career direction
- base recommendations on existing skills, projects, experience, education, or certifications
- do NOT use generic filler
- do NOT repeat skills already present
- if no high-confidence skill gap is visible, return fewer items or []

recommendations:
- represents AI Recommendations / Next Steps
- provide at least 4 concrete actions
- each recommendation must address a genuine improvement opportunity visible in the resume
- do not add random advice only to fill the array

Never invent candidate facts.
All scores must be between 0 and 100.

RESUME:

"""
${lightweightResumeText}
"""
    `.trim();

    console.log(
      "🤖 [Qwen Analysis] Sending lightweight scoring request..."
    );

    const qwenStartedAt =
      Date.now();

    let elapsedSeconds =
      0;

    const timer =
      setInterval(
        () => {
          elapsedSeconds +=
            5;

          console.log(
            `⏱️ [Qwen Analysis] Elapsed: ${elapsedSeconds}s`
          );
        },
        5000
      );

    try {
      const response =
        await qwenService.generateQwenJSON<any>(
          {
            messages: [
              {
                role:
                  "system",

                content:
                  SYSTEM_INSTRUCTION,
              },

              {
                role:
                  "user",

                content:
                  analysisPrompt,
              },
            ],

            temperature:
              0.1,

            maxCompletionTokens:
              900,

            timeoutMs:
              60_000,

            retries:
              0,
          }
        );

      if (
        response.success &&
        response.data
      ) {
        try {
          const qwenAnalysis =
            normalizeAnalysis(
              response.data
            );

          analysis =
            enrichAnalysisFeedback(
              qwenAnalysis,
              profile
            );

          console.log(
            `✅ [Qwen Analysis] Completed in ${(
              (
                Date.now() -
                qwenStartedAt
              ) /
              1000
            ).toFixed(
              2
            )}s`
          );
        } catch (
          normalizeError
        ) {
          console.warn(
            "⚠️ [Qwen Analysis] Invalid JSON structure. Using local fallback."
          );

          console.warn(
            normalizeError
          );
        }
      } else {
        console.warn(
          "⚠️ [Qwen Analysis] Empty or invalid response. Using local fallback."
        );

        if (
          response.error
        ) {
          console.warn(
            response.error
          );
        }
      }
    } catch (
      error
    ) {
      console.warn(
        "⚠️ [Qwen Analysis] Qwen failed or timed out. Using local fallback."
      );

      console.warn(
        error
      );
    } finally {
      clearInterval(
        timer
      );
    }

    /* =========================================================
       FINAL ENRICHMENT
    ========================================================= */

    analysis =
      enrichAnalysisFeedback(
        analysis,
        profile
      );

    /* =========================================================
       FINAL LOG
    ========================================================= */

    console.log(
      "===================================================="
    );

    console.log(
      "✅ [Resume Service] Hybrid resume processing completed."
    );

    console.log(
      `⏱️ Total processing time: ${(
        (
          Date.now() -
          startedAt
        ) /
        1000
      ).toFixed(
        2
      )}s`
    );

    console.log(
      JSON.stringify(
        {
          overallScore:
            analysis.overallScore,

          atsScore:
            analysis.atsScore,

          fullName:
            profile.contact
              .fullName ||
            null,

          experienceItems:
            profile.experience.length,

          projectItems:
            profile.projects.length,

          educationItems:
            profile.education.length,

          detectedSkills:
            profile.skills,

          recommendedSkills:
            analysis.missingSkills,

          areasToImprove:
            analysis.weaknesses.length,

          aiRecommendations:
            analysis.recommendations.length,

          extractionStatus:
            profile.extractionStatus,
        },
        null,
        2
      )
    );

    console.log(
      "===================================================="
    );

    return {
      analysis,

      profile,
    };
  };

export default {
  analyzeResume,
};