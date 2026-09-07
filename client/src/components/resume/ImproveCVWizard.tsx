import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiFileText,
  FiFolder,
  FiPlus,
  FiSearch,
  FiTarget,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiX,
  FiZap,
} from "react-icons/fi";

import apiClient from "../../api/apiClient";

import "./improveCVWizard.scss";

/* =========================================================
   PUBLIC TYPES
========================================================= */

export interface ImproveCVWizardJob {
  _id: string;

  title: string;

  company: string;

  location?: string;

  remoteType?: string;

  employmentType?: string;

  skills?: string[];
}

export interface CVContactForm {
  fullName: string;

  email: string;

  phone: string;

  location: string;

  linkedin: string;

  github: string;

  website: string;
}

export interface CVExperienceForm {
  title: string;

  company: string;

  employmentType: string;

  startDate: string;

  endDate: string;

  isCurrent: boolean;

  description: string;

  bullets: string;

  technologies: string;
}

export interface CVProjectForm {
  name: string;

  role: string;

  startDate: string;

  endDate: string;

  description: string;

  bullets: string;

  technologies: string;

  url: string;

  github: string;
}

export interface CVEducationForm {
  institution: string;

  degree: string;

  field: string;

  startDate: string;

  endDate: string;

  isCurrent: boolean;
}

export interface CVCertificationForm {
  name: string;

  issuer: string;

  issueDate: string;
}

export interface CVLanguageForm {
  language: string;

  level: string;
}

export interface CVVolunteeringForm {
  organization: string;

  role: string;

  startDate: string;

  endDate: string;

  isCurrent: boolean;

  description: string;
}

export interface ImproveCVFormProfile {
  contact: CVContactForm;

  targetRole: string;

  professionalSummary: string;

  technicalSkills: string;

  softSkills: string;

  experience: CVExperienceForm[];

  projects: CVProjectForm[];

  education: CVEducationForm[];

  certifications: CVCertificationForm[];

  languages: CVLanguageForm[];

  volunteering: CVVolunteeringForm[];

  achievements: string;
}

export interface ImproveCVNormalizedProfile {
  contact: {
    fullName: string;

    email: string;

    phone: string;

    location: string;

    linkedin: string;

    github: string;

    website: string;
  };

  professionalSummary: string;

  skills: string[];

  technicalSkills: string[];

  softSkills: string[];

  experience: Array<{
    title: string;

    company: string;

    employmentType: string;

    startDate: string;

    endDate: string;

    isCurrent: boolean;

    description: string;

    bullets: string[];

    technologies: string[];
  }>;

  projects: Array<{
    name: string;

    role: string;

    description: string;

    startDate: string;

    endDate: string;

    technologies: string[];

    bullets: string[];

    url: string;

    github: string;
  }>;

  education: Array<{
    institution: string;

    degree: string;

    field: string;

    startDate: string;

    endDate: string;

    isCurrent: boolean;
  }>;

  certifications: Array<{
    name: string;

    issuer: string;

    issueDate: string;
  }>;

  languages: Array<{
    language: string;

    level: string;
  }>;

  volunteering: Array<{
    organization: string;

    role: string;

    startDate: string;

    endDate: string;

    description: string;
  }>;

  achievements: string[];
}

export interface ImproveCVWizardData {
  jobId: string | null;

  sourceAnalysisId: string;

  sourceFileName: string;

  profile: ImproveCVNormalizedProfile;

  targetRole: string;

  /*
   * Temporary compatibility layer.
   * Remove after JobsPage is migrated to:
   *
   * sourceAnalysisId + profile
   */
  resumeFile: File;

  major: {
    targetTitle: string;

    yearsOfExperience: string;

    strongestSkills: string;

    currentOrRecentRole: string;

    currentOrRecentCompany: string;

    biggestAchievement: string;
  };

  optional: {
    linkedin: string;

    github: string;

    portfolio: string;

    certifications: string;

    languages: string;

    volunteering: string;

    additionalProjects: string;

    additionalEducation: string;
  };
}

interface ImproveCVWizardProps {
  open: boolean;

  job?: ImproveCVWizardJob | null;

  onClose: () => void;

  onReady: (
    data: ImproveCVWizardData
  ) => void;
}

/* =========================================================
   API TYPES
========================================================= */

interface ResumeHistoryAnalysis {
  _id?: string;

  analysisId?: string;

  fileName?: string;

  fileSize?: number;

  overallScore?: number;

  createdAt?: string;

  updatedAt?: string;
}

interface ResumeHistoryResponse {
  success?: boolean;

  message?: string;

  data?: {
    analyses?: ResumeHistoryAnalysis[];
  };
}

interface RawResumeContact {
  fullName?: string;

  email?: string;

  phone?: string;

  location?: string;

  linkedin?: string;

  github?: string;

  website?: string;
}

interface RawResumeExperience {
  title?: string;

  company?: string;

  location?: string;

  employmentType?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  description?: string;

  bullets?: string[];

  technologies?: string[];
}

interface RawResumeProject {
  name?: string;

  role?: string;

  description?: string;

  startDate?: string;

  endDate?: string;

  technologies?: string[];

  bullets?: string[];

  url?: string;

  github?: string;
}

interface RawResumeEducation {
  institution?: string;

  degree?: string;

  field?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  gpa?: string;

  coursework?: string[];

  achievements?: string[];
}

interface RawResumeCertification {
  name?: string;

  issuer?: string;

  issueDate?: string;

  expirationDate?: string;

  credentialId?: string;

  credentialUrl?: string;

  status?: string;
}

interface RawResumeLanguage {
  language?: string;

  level?: string;
}

interface RawResumeVolunteering {
  organization?: string;

  role?: string;

  startDate?: string;

  endDate?: string;

  description?: string;

  bullets?: string[];
}

interface RawResumeProfile {
  contact?: RawResumeContact;

  professionalSummary?: string;

  skills?: string[];

  technicalSkills?: string[];

  softSkills?: string[];

  experience?: RawResumeExperience[];

  projects?: RawResumeProject[];

  education?: RawResumeEducation[];

  certifications?: RawResumeCertification[];

  languages?: RawResumeLanguage[];

  volunteering?: RawResumeVolunteering[];

  achievements?: string[];

  interests?: string[];
}

interface ResumeAnalysisDetails {
  _id?: string;

  analysisId?: string;

  fileName?: string;
}

interface ResumeProfileResponse {
  success?: boolean;

  message?: string;

  data?: {
    analysis?: ResumeAnalysisDetails;

    profile?: RawResumeProfile;
  };
}

interface JobsResponse {
  success?: boolean;

  message?: string;

  data?: {
    jobs?: ImproveCVWizardJob[];
  };
}

/* =========================================================
   LOCAL TYPES
========================================================= */

type WizardStep =
  | 1
  | 2
  | 3;

type SourceMode =
  | "upload"
  | "saved"
  | null;

type ImprovementMode =
  | "general"
  | "vacancy";

interface SelectedSource {
  mode: Exclude<
    SourceMode,
    null
  >;

  analysisId?: string;

  fileName: string;

  file?: File;
}

interface ParsedExperienceHeader {
  title: string;

  company: string;

  startDate: string;
}

interface ParsedProjectHeader {
  name: string;

  technologies: string[];

  startDate: string;

  endDate: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_FILE_SIZE =
  10 *
  1024 *
  1024;

const MONTH_MAP: Record<
  string,
  string
> = {
  jan: "01",
  january: "01",

  feb: "02",
  february: "02",

  mar: "03",
  march: "03",

  apr: "04",
  april: "04",

  may: "05",

  jun: "06",
  june: "06",

  jul: "07",
  july: "07",

  aug: "08",
  august: "08",

  sep: "09",
  sept: "09",
  september: "09",

  oct: "10",
  october: "10",

  nov: "11",
  november: "11",

  dec: "12",
  december: "12",
};

const DATE_WORD_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{4}\b/gi;

const YEAR_RANGE_PATTERN =
  /\b(19|20)\d{2}\s*[–—-]\s*(?:(19|20)\d{2}|present|current|now)\b/i;

/* =========================================================
   FACTORIES
========================================================= */

const createEmptyExperience =
  (): CVExperienceForm => ({
    title: "",

    company: "",

    employmentType: "",

    startDate: "",

    endDate: "",

    isCurrent: false,

    description: "",

    bullets: "",

    technologies: "",
  });

const createEmptyProject =
  (): CVProjectForm => ({
    name: "",

    role: "",

    startDate: "",

    endDate: "",

    description: "",

    bullets: "",

    technologies: "",

    url: "",

    github: "",
  });

const createEmptyEducation =
  (): CVEducationForm => ({
    institution: "",

    degree: "",

    field: "",

    startDate: "",

    endDate: "",

    isCurrent: false,
  });

const createEmptyCertification =
  (): CVCertificationForm => ({
    name: "",

    issuer: "",

    issueDate: "",
  });

const createEmptyLanguage =
  (): CVLanguageForm => ({
    language: "",

    level: "",
  });

const createEmptyVolunteering =
  (): CVVolunteeringForm => ({
    organization: "",

    role: "",

    startDate: "",

    endDate: "",

    isCurrent: false,

    description: "",
  });

const createEmptyForm =
  (
    targetRole = ""
  ): ImproveCVFormProfile => ({
    contact: {
      fullName: "",

      email: "",

      phone: "",

      location: "",

      linkedin: "",

      github: "",

      website: "",
    },

    targetRole,

    professionalSummary: "",

    technicalSkills: "",

    softSkills: "",

    experience: [],

    projects: [],

    education: [],

    certifications: [],

    languages: [],

    volunteering: [],

    achievements: "",
  });

/* =========================================================
   GENERIC HELPERS
========================================================= */

const cleanText = (
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
      /\s+/g,
      " "
    )
    .trim();
};

const joinCommaList = (
  values:
    | string[]
    | undefined
): string => {
  return (
    values
      ?.map(
        cleanText
      )
      .filter(Boolean)
      .join(", ") ||
    ""
  );
};

const joinLineList = (
  values:
    | string[]
    | undefined
): string => {
  return (
    values
      ?.map(
        cleanText
      )
      .filter(Boolean)
      .join("\n") ||
    ""
  );
};

const splitCommaList = (
  value: string
): string[] => {
  const seen =
    new Set<string>();

  return value
    .split(
      /[,;|]+/
    )
    .map(
      cleanText
    )
    .filter(
      (item) => {
        if (!item) {
          return false;
        }

        const key =
          item.toLowerCase();

        if (
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);

        return true;
      }
    );
};

const splitLineList = (
  value: string
): string[] => {
  return value
    .split("\n")
    .map(
      cleanText
    )
    .filter(Boolean);
};

const uniqueStrings = (
  values: string[]
): string[] => {
  const result:
    string[] = [];

  const seen =
    new Set<string>();

  for (
    const value
    of values
  ) {
    const cleaned =
      cleanText(
        value
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

/* =========================================================
   DATE HELPERS
========================================================= */

const isCurrentValue = (
  value: unknown
): boolean => {
  return (
    typeof value ===
      "string" &&
    /^(present|current|now)$/i.test(
      value.trim()
    )
  );
};

const looksLikeDate = (
  value: unknown
): boolean => {
  if (
    typeof value !==
      "string"
  ) {
    return false;
  }

  const cleaned =
    value.trim();

  if (!cleaned) {
    return false;
  }

  if (
    isCurrentValue(
      cleaned
    )
  ) {
    return true;
  }

  if (
    /^\d{4}$/.test(
      cleaned
    )
  ) {
    return true;
  }

  if (
    /^\d{4}-\d{1,2}/.test(
      cleaned
    )
  ) {
    return true;
  }

  if (
    DATE_WORD_PATTERN.test(
      cleaned
    )
  ) {
    DATE_WORD_PATTERN.lastIndex =
      0;

    return true;
  }

  DATE_WORD_PATTERN.lastIndex =
    0;

  return false;
};

const parseMonthString = (
  value: unknown
): string => {
  if (
    typeof value !==
      "string"
  ) {
    return "";
  }

  let cleaned =
    value
      .trim()
      .replace(
        /\.$/,
        ""
      );

  if (!cleaned) {
    return "";
  }

  if (
    isCurrentValue(
      cleaned
    )
  ) {
    return "";
  }

  const directMatch =
    cleaned.match(
      /^((?:19|20)\d{2})-(\d{1,2})/
    );

  if (
    directMatch?.[1] &&
    directMatch?.[2]
  ) {
    const month =
      Number(
        directMatch[2]
      );

    if (
      month >= 1 &&
      month <= 12
    ) {
      return `${directMatch[1]}-${String(
        month
      ).padStart(
        2,
        "0"
      )}`;
    }
  }

  const monthYearMatch =
    cleaned.match(
      /\b([A-Za-z]+)\.?\s+((?:19|20)\d{2})\b/
    );

  if (
    monthYearMatch?.[1] &&
    monthYearMatch?.[2]
  ) {
    const month =
      MONTH_MAP[
        monthYearMatch[1]
          .toLowerCase()
      ];

    if (month) {
      return `${monthYearMatch[2]}-${month}`;
    }
  }

  const yearMatch =
    cleaned.match(
      /\b((?:19|20)\d{2})\b/
    );

  if (
    yearMatch?.[1]
  ) {
    /*
     * input type="month" cannot represent only a year.
     *
     * Do NOT invent January.
     *
     * Returning empty is safer than turning "2024"
     * into a false "January 2024".
     */
    return "";
  }

  return "";
};

const extractDateStrings = (
  value: string
): string[] => {
  const results:
    string[] = [];

  const monthMatches =
    value.match(
      DATE_WORD_PATTERN
    ) || [];

  DATE_WORD_PATTERN.lastIndex =
    0;

  results.push(
    ...monthMatches
  );

  const yearRange =
    value.match(
      /\b((?:19|20)\d{2})\s*[–—-]\s*((?:19|20)\d{2}|Present|Current|Now)\b/i
    );

  if (
    results.length ===
      0 &&
    yearRange?.[1]
  ) {
    results.push(
      yearRange[1]
    );

    if (
      yearRange[2]
    ) {
      results.push(
        yearRange[2]
      );
    }
  }

  return results;
};

const removeDateText = (
  value: string
): string => {
  DATE_WORD_PATTERN.lastIndex =
    0;

  const result =
    value
      .replace(
        DATE_WORD_PATTERN,
        " "
      )
      .replace(
        /\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|Present|Current|Now)\b/gi,
        " "
      )
      .replace(
        /\b(?:Present|Current|Now)\b/gi,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  DATE_WORD_PATTERN.lastIndex =
    0;

  return result;
};

/* =========================================================
   SANITY CHECKS
========================================================= */

const looksLikeSentence = (
  value: string
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  const words =
    cleaned.split(
      /\s+/
    );

  return (
    cleaned.length >
      85 ||
    words.length >
      12 ||
    /[.!?]\s*$/.test(
      cleaned
    )
  );
};

const sanitizeName = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    cleaned.length >
      80 ||
    cleaned.includes(
      "@"
    ) ||
    /https?:\/\//i.test(
      cleaned
    ) ||
    looksLikeDate(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeEmail = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleaned
    )
  ) {
    return cleaned;
  }

  return "";
};

const sanitizePhone = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return "";
  }

  const digitCount =
    (
      cleaned.match(
        /\d/g
      ) || []
    ).length;

  if (
    digitCount <
      7 ||
    digitCount >
      16 ||
    cleaned.length >
      30
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeLocation = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return "";
  }

  if (
    cleaned.length >
      60 ||
    looksLikeSentence(
      cleaned
    ) ||
    /https?:\/\/|@/i.test(
      cleaned
    ) ||
    /\b(?:developed|development|implemented|built|designed|maintained|collaborated|managed|created|engineered|responsible|experience|project|skills)\b/i.test(
      cleaned
    )
  ) {
    return "";
  }

  /*
   * Common location shapes:
   * Boston, MA
   * Miami, FL
   * Baku, Azerbaijan
   * Ganja, Azerbaijan
   * Boston
   */
  const words =
    cleaned.split(
      /\s+/
    );

  if (
    words.length >
      6
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeLinkedIn = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    !/linkedin\.com\//i.test(
      cleaned
    )
  ) {
    return "";
  }

  /*
   * linkedin.com/in/ without a username is not useful.
   */
  if (
    /linkedin\.com\/in\/?$/i.test(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeGitHub = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    !/github\.com\//i.test(
      cleaned
    )
  ) {
    return "";
  }

  if (
    /github\.com\/?$/i.test(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeWebsite = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned
  ) {
    return "";
  }

  if (
    !/^https?:\/\//i.test(
      cleaned
    )
  ) {
    return "";
  }

  if (
    /linkedin\.com|github\.com/i.test(
      cleaned
    )
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeCompany = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    looksLikeDate(
      cleaned
    ) ||
    isCurrentValue(
      cleaned
    ) ||
    looksLikeSentence(
      cleaned
    ) ||
    cleaned.length >
      90
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeTitle = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    looksLikeSentence(
      cleaned
    ) ||
    cleaned.length >
      100
  ) {
    return "";
  }

  return cleaned;
};

const sanitizeInstitution = (
  value: unknown
): string => {
  const cleaned =
    cleanText(
      value
    );

  if (
    !cleaned ||
    looksLikeDate(
      cleaned
    ) ||
    looksLikeSentence(
      cleaned
    ) ||
    cleaned.length >
      120
  ) {
    return "";
  }

  return cleaned;
};

/* =========================================================
   EXPERIENCE REPAIR
========================================================= */

const parseExperienceHeader =
  (
    rawTitle:
      unknown
  ): ParsedExperienceHeader => {
    let text =
      cleanText(
        rawTitle
      );

    if (!text) {
      return {
        title: "",

        company: "",

        startDate: "",
      };
    }

    const dates =
      extractDateStrings(
        text
      );

    const startDate =
      parseMonthString(
        dates[0]
      );

    text =
      removeDateText(
        text
      );

    /*
     * Common broken extraction:
     *
     * Front-End Developer, DigitCodex Nov. 2023
     *
     * We can safely split it at the first comma.
     */
    const commaParts =
      text
        .split(",")
        .map(
          cleanText
        )
        .filter(Boolean);

    if (
      commaParts.length >=
        2
    ) {
      return {
        title:
          sanitizeTitle(
            commaParts[0]
          ),

        company:
          sanitizeCompany(
            commaParts
              .slice(1)
              .join(", ")
          ),

        startDate,
      };
    }

    /*
     * Support:
     * Front-End Developer — DigitCodex
     * Front-End Developer | DigitCodex
     */
    const separatorParts =
      text
        .split(
          /\s+[|—–]\s+/
        )
        .map(
          cleanText
        )
        .filter(Boolean);

    if (
      separatorParts.length >=
        2
    ) {
      return {
        title:
          sanitizeTitle(
            separatorParts[0]
          ),

        company:
          sanitizeCompany(
            separatorParts
              .slice(1)
              .join(" ")
          ),

        startDate,
      };
    }

    return {
      title:
        sanitizeTitle(
          text
        ),

      company: "",

      startDate,
    };
  };

const looksLikeVolunteer =
  (
    item:
      RawResumeExperience
  ): boolean => {
    const text =
      [
        item.title,
        item.company,
        item.description,
      ]
        .map(
          cleanText
        )
        .join(
          " "
        );

    return /\bvolunteer(?:ing)?\b/i.test(
      text
    );
  };

const experienceToVolunteer =
  (
    item:
      RawResumeExperience
  ): CVVolunteeringForm => {
    const parsed =
      parseExperienceHeader(
        item.title
      );

    const rawCompany =
      sanitizeCompany(
        item.company
      );

    const organization =
      parsed.company ||
      rawCompany;

    const rawEnd =
      cleanText(
        item.endDate ||
        item.company
      );

    const isCurrent =
      Boolean(
        item.isCurrent
      ) ||
      isCurrentValue(
        rawEnd
      );

    return {
      organization,

      role:
        parsed.title
          .replace(
            /^volunteer(?:ing)?\s*/i,
            "Volunteer"
          )
          .trim() ||
        "Volunteer",

      startDate:
        parseMonthString(
          item.startDate
        ) ||
        parsed.startDate,

      endDate:
        isCurrent
          ? ""
          : parseMonthString(
              item.endDate
            ),

      isCurrent,

      description:
        cleanText(
          item.description
        ) ||
        joinLineList(
          item.bullets
        ),
    };
  };

/* =========================================================
   PROJECT REPAIR
========================================================= */

const parseProjectHeader =
  (
    rawName:
      unknown,
    rawTechnologies:
      string[] |
      undefined
  ): ParsedProjectHeader => {
    const original =
      cleanText(
        rawName
      );

    if (!original) {
      return {
        name: "",

        technologies:
          uniqueStrings(
            rawTechnologies ||
              []
          ),

        startDate: "",

        endDate: "",
      };
    }

    const dates =
      extractDateStrings(
        original
      );

    let startDate =
      parseMonthString(
        dates[0]
      );

    let endDate =
      parseMonthString(
        dates[1]
      );

    /*
     * Year-only ranges cannot be represented faithfully
     * by input[type=month].
     *
     * Therefore we leave them blank instead of inventing
     * January.
     */
    if (
      YEAR_RANGE_PATTERN.test(
        original
      ) &&
      dates.every(
        (date) =>
          /^\d{4}$/.test(
            date
          )
      )
    ) {
      startDate =
        "";

      endDate =
        "";
    }

    const withoutDates =
      removeDateText(
        original
      );

    const pipeParts =
      withoutDates
        .split("|")
        .map(
          cleanText
        )
        .filter(Boolean);

    let projectName =
      pipeParts[0] ||
      withoutDates;

    const technologyCandidates =
      pipeParts
        .slice(1)
        .flatMap(
          (part) =>
            part.split(
              /[,;]+/
            )
        )
        .map(
          cleanText
        )
        .filter(Boolean);

    /*
     * Avoid a project name accidentally containing a huge
     * technology list.
     */
    projectName =
      projectName
        .replace(
          /\s{2,}/g,
          " "
        )
        .trim();

    if (
      projectName.length >
      120
    ) {
      projectName =
        projectName.slice(
          0,
          120
        );
    }

    return {
      name:
        projectName,

      technologies:
        uniqueStrings([
          ...(
            rawTechnologies ||
            []
          ),

          ...technologyCandidates,
        ]),

      startDate,

      endDate,
    };
  };

/* =========================================================
   LANGUAGE REPAIR
========================================================= */

const parseLanguage =
  (
    item:
      RawResumeLanguage
  ): CVLanguageForm => {
    const rawLanguage =
      cleanText(
        item.language
      );

    const rawLevel =
      cleanText(
        item.level
      );

    if (!rawLanguage) {
      return {
        language: "",

        level:
          rawLevel,
      };
    }

    if (rawLevel) {
      return {
        language:
          rawLanguage,

        level:
          rawLevel,
      };
    }

    /*
     * Fix:
     * Azerbaijani: Native
     * Turkish: Professional Working Proficiency
     * English: Intermediate (B2)
     */
    const colonParts =
      rawLanguage
        .split(
          /\s*[:|–—-]\s*/
        )
        .map(
          cleanText
        )
        .filter(Boolean);

    if (
      colonParts.length >=
        2
    ) {
      return {
        language:
          colonParts[0],

        level:
          colonParts
            .slice(1)
            .join(" "),
      };
    }

    return {
      language:
        rawLanguage,

      level: "",
    };
  };

/* =========================================================
   PROFILE NORMALIZATION
========================================================= */

const normalizeProfileToForm =
  (
    profile:
      RawResumeProfile,
    targetRole:
      string
  ): ImproveCVFormProfile => {
    const experiences:
      CVExperienceForm[] =
      [];

    const volunteering:
      CVVolunteeringForm[] =
      (
        profile.volunteering ||
        []
      ).map(
        (
          item
        ): CVVolunteeringForm => {
          const rawEnd =
            cleanText(
              item.endDate
            );

          const isCurrent =
            isCurrentValue(
              rawEnd
            );

          return {
            organization:
              sanitizeCompany(
                item.organization
              ),

            role:
              sanitizeTitle(
                item.role
              ),

            startDate:
              parseMonthString(
                item.startDate
              ),

            endDate:
              isCurrent
                ? ""
                : parseMonthString(
                    item.endDate
                  ),

            isCurrent,

            description:
              cleanText(
                item.description
              ) ||
              joinLineList(
                item.bullets
              ),
          };
        }
      );

    for (
      const item
      of profile.experience ||
      []
    ) {
      if (
        looksLikeVolunteer(
          item
        )
      ) {
        volunteering.push(
          experienceToVolunteer(
            item
          )
        );

        continue;
      }

      const parsed =
        parseExperienceHeader(
          item.title
        );

      const rawCompany =
        cleanText(
          item.company
        );

      /*
       * Important repair:
       *
       * If backend returned:
       *
       * title = "Front-End Developer, DigitCodex Nov. 2023"
       * company = "Sep. 2024"
       *
       * then:
       *
       * title = Front-End Developer
       * company = DigitCodex
       * start = Nov 2023
       * end = Sep 2024
       */
      const company =
        parsed.company ||
        sanitizeCompany(
          rawCompany
        );

      const companyIsDate =
        looksLikeDate(
          rawCompany
        );

      const rawEnd =
        cleanText(
          item.endDate
        );

      const isCurrent =
        Boolean(
          item.isCurrent
        ) ||
        isCurrentValue(
          rawEnd
        ) ||
        isCurrentValue(
          rawCompany
        );

      const startDate =
        parseMonthString(
          item.startDate
        ) ||
        parsed.startDate;

      const endDate =
        isCurrent
          ? ""
          : parseMonthString(
              item.endDate
            ) ||
            (
              companyIsDate
                ? parseMonthString(
                    rawCompany
                  )
                : ""
            );

      experiences.push({
        title:
          parsed.title ||
          sanitizeTitle(
            item.title
          ),

        company,

        employmentType:
          cleanText(
            item.employmentType
          ),

        startDate,

        endDate,

        isCurrent,

        description:
          cleanText(
            item.description
          ),

        bullets:
          joinLineList(
            item.bullets
          ),

        technologies:
          joinCommaList(
            item.technologies
          ),
      });
    }

    const projects =
      (
        profile.projects ||
        []
      ).map(
        (
          item
        ): CVProjectForm => {
          const parsed =
            parseProjectHeader(
              item.name,
              item.technologies
            );

          return {
            name:
              parsed.name,

            role:
              sanitizeTitle(
                item.role
              ),

            startDate:
              parseMonthString(
                item.startDate
              ) ||
              parsed.startDate,

            endDate:
              parseMonthString(
                item.endDate
              ) ||
              parsed.endDate,

            description:
              cleanText(
                item.description
              ),

            bullets:
              joinLineList(
                item.bullets
              ),

            technologies:
              parsed.technologies
                .join(", "),

            url:
              sanitizeWebsite(
                item.url
              ),

            github:
              sanitizeGitHub(
                item.github
              ),
          };
        }
      )
      .filter(
        (item) =>
          Boolean(
            item.name ||
            item.description ||
            item.bullets
          )
      );

    const education =
      (
        profile.education ||
        []
      )
        .map(
          (
            item
          ): CVEducationForm => {
            const rawEnd =
              cleanText(
                item.endDate
              );

            const isCurrent =
              Boolean(
                item.isCurrent
              ) ||
              isCurrentValue(
                rawEnd
              );

            return {
              institution:
                sanitizeInstitution(
                  item.institution
                ),

              degree:
                sanitizeTitle(
                  item.degree
                ),

              field:
                sanitizeTitle(
                  item.field
                ),

              startDate:
                parseMonthString(
                  item.startDate
                ),

              endDate:
                isCurrent
                  ? ""
                  : parseMonthString(
                      item.endDate
                    ),

              isCurrent,
            };
          }
        )
        .filter(
          (item) =>
            Boolean(
              item.institution
            )
        );

    const certifications =
      (
        profile.certifications ||
        []
      )
        .map(
          (
            item
          ): CVCertificationForm => ({
            name:
              sanitizeTitle(
                item.name
              ),

            issuer:
              sanitizeCompany(
                item.issuer
              ),

            issueDate:
              parseMonthString(
                item.issueDate
              ),
          })
        )
        .filter(
          (item) =>
            Boolean(
              item.name ||
              item.issuer
            )
        );

    const languages =
      (
        profile.languages ||
        []
      )
        .map(
          parseLanguage
        )
        .filter(
          (item) =>
            Boolean(
              item.language
            )
        );

    return {
      contact: {
        fullName:
          sanitizeName(
            profile.contact
              ?.fullName
          ),

        email:
          sanitizeEmail(
            profile.contact
              ?.email
          ),

        phone:
          sanitizePhone(
            profile.contact
              ?.phone
          ),

        location:
          sanitizeLocation(
            profile.contact
              ?.location
          ),

        linkedin:
          sanitizeLinkedIn(
            profile.contact
              ?.linkedin
          ),

        github:
          sanitizeGitHub(
            profile.contact
              ?.github
          ),

        website:
          sanitizeWebsite(
            profile.contact
              ?.website
          ),
      },

      targetRole,

      professionalSummary:
        cleanText(
          profile
            .professionalSummary
        ),

      technicalSkills:
        joinCommaList(
          profile
            .technicalSkills
            ?.length
            ? profile
                .technicalSkills
            : profile.skills
        ),

      softSkills:
        joinCommaList(
          profile.softSkills
        ),

      experience:
        experiences,

      projects,

      education,

      certifications,

      languages,

      volunteering,

      achievements:
        joinLineList(
          profile.achievements
        ),
    };
  };

/* =========================================================
   FORM -> NORMALIZED PROFILE
========================================================= */

const formToProfile =
  (
    form:
      ImproveCVFormProfile
  ): ImproveCVNormalizedProfile => {
    const technicalSkills =
      splitCommaList(
        form.technicalSkills
      );

    return {
      contact: {
        fullName:
          form.contact
            .fullName
            .trim(),

        email:
          form.contact
            .email
            .trim(),

        phone:
          form.contact
            .phone
            .trim(),

        location:
          form.contact
            .location
            .trim(),

        linkedin:
          form.contact
            .linkedin
            .trim(),

        github:
          form.contact
            .github
            .trim(),

        website:
          form.contact
            .website
            .trim(),
      },

      professionalSummary:
        form
          .professionalSummary
          .trim(),

      skills:
        technicalSkills,

      technicalSkills,

      softSkills:
        splitCommaList(
          form.softSkills
        ),

      experience:
        form.experience.map(
          (item) => ({
            title:
              item.title.trim(),

            company:
              item.company.trim(),

            employmentType:
              item
                .employmentType
                .trim(),

            startDate:
              item.startDate,

            endDate:
              item.isCurrent
                ? ""
                : item.endDate,

            isCurrent:
              item.isCurrent,

            description:
              item.description
                .trim(),

            bullets:
              splitLineList(
                item.bullets
              ),

            technologies:
              splitCommaList(
                item
                  .technologies
              ),
          })
        ),

      projects:
        form.projects
          .map(
            (item) => ({
              name:
                item.name.trim(),

              role:
                item.role.trim(),

              startDate:
                item.startDate,

              endDate:
                item.endDate,

              description:
                item.description
                  .trim(),

              bullets:
                splitLineList(
                  item.bullets
                ),

              technologies:
                splitCommaList(
                  item
                    .technologies
                ),

              url:
                item.url.trim(),

              github:
                item.github
                  .trim(),
            })
          )
          .filter(
            (item) =>
              Boolean(
                item.name ||
                item.description ||
                item.bullets.length
              )
          ),

      education:
        form.education
          .map(
            (item) => ({
              institution:
                item.institution
                  .trim(),

              degree:
                item.degree
                  .trim(),

              field:
                item.field
                  .trim(),

              startDate:
                item.startDate,

              endDate:
                item.isCurrent
                  ? ""
                  : item.endDate,

              isCurrent:
                item.isCurrent,
            })
          )
          .filter(
            (item) =>
              Boolean(
                item.institution
              )
          ),

      certifications:
        form.certifications
          .map(
            (item) => ({
              name:
                item.name
                  .trim(),

              issuer:
                item.issuer
                  .trim(),

              issueDate:
                item.issueDate,
            })
          )
          .filter(
            (item) =>
              Boolean(
                item.name ||
                item.issuer
              )
          ),

      languages:
        form.languages
          .map(
            (item) => ({
              language:
                item.language
                  .trim(),

              level:
                item.level
                  .trim(),
            })
          )
          .filter(
            (item) =>
              Boolean(
                item.language
              )
          ),

      volunteering:
        form.volunteering
          .map(
            (item) => ({
              organization:
                item
                  .organization
                  .trim(),

              role:
                item.role
                  .trim(),

              startDate:
                item.startDate,

              endDate:
                item.isCurrent
                  ? ""
                  : item.endDate,

              description:
                item
                  .description
                  .trim(),
            })
          )
          .filter(
            (item) =>
              Boolean(
                item.organization ||
                item.role ||
                item.description
              )
          ),

      achievements:
        splitLineList(
          form.achievements
        ),
    };
  };

/* =========================================================
   API HELPERS
========================================================= */

const getAnalysisId = (
  analysis:
    ResumeAnalysisDetails |
    ResumeHistoryAnalysis |
    undefined
): string => {
  return (
    analysis
      ?.analysisId ||
    analysis?._id ||
    ""
  );
};

const formatDate = (
  value:
    | string
    | undefined
): string => {
  if (!value) {
    return "Saved CV";
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "Saved CV";
  }

  return parsed.toLocaleDateString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    }
  );
};

const formatFileSize = (
  bytes:
    | number
    | undefined
): string => {
  if (
    typeof bytes !==
      "number" ||
    !Number.isFinite(
      bytes
    )
  ) {
    return "";
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(
    1
  )} MB`;
};

const getErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (
    axios.isAxiosError<{
      message?: string;
    }>(
      error
    )
  ) {
    return (
      error.response
        ?.data
        ?.message ||
      error.message ||
      fallback
    );
  }

  if (
    error instanceof
      Error
  ) {
    return (
      error.message ||
      fallback
    );
  }

  return fallback;
};

/* =========================================================
   COMPONENT
========================================================= */

const ImproveCVWizard:
  React.FC<
    ImproveCVWizardProps
  > = ({
    open,
    job,
    onClose,
    onReady,
  }) => {
    const inputRef =
      useRef<HTMLInputElement | null>(
        null
      );

    const [
      step,
      setStep,
    ] =
      useState<WizardStep>(
        1
      );

    const [
      sourceMode,
      setSourceMode,
    ] =
      useState<SourceMode>(
        null
      );

    const [
      selectedSource,
      setSelectedSource,
    ] =
      useState<SelectedSource | null>(
        null
      );

    const [
      sourceAnalysisId,
      setSourceAnalysisId,
    ] =
      useState("");

    const [
      sourceFileName,
      setSourceFileName,
    ] =
      useState("");

    const [
      history,
      setHistory,
    ] =
      useState<ResumeHistoryAnalysis[]>(
        []
      );

    const [
      loadingHistory,
      setLoadingHistory,
    ] =
      useState(
        false
      );

    const [
      processingSource,
      setProcessingSource,
    ] =
      useState(
        false
      );

    const [
      error,
      setError,
    ] =
      useState("");

    const [
      form,
      setForm,
    ] =
      useState<ImproveCVFormProfile>(
        () =>
          createEmptyForm(
            job?.title ||
              ""
          )
      );

    const [
      improvementMode,
      setImprovementMode,
    ] =
      useState<ImprovementMode>(
        job
          ? "vacancy"
          : "general"
      );

    const [
      jobs,
      setJobs,
    ] =
      useState<ImproveCVWizardJob[]>(
        []
      );

    const [
      loadingJobs,
      setLoadingJobs,
    ] =
      useState(
        false
      );

    const [
      jobSearch,
      setJobSearch,
    ] =
      useState("");

    const [
      selectedJob,
      setSelectedJob,
    ] =
      useState<ImproveCVWizardJob | null>(
        job ||
          null
      );

    const progress =
      useMemo(
        () =>
          (
            step /
            3
          ) *
          100,
        [
          step,
        ]
      );

    const filteredJobs =
      useMemo(
        () => {
          const term =
            jobSearch
              .trim()
              .toLowerCase();

          if (!term) {
            return jobs.slice(
              0,
              8
            );
          }

          return jobs
            .filter(
              (item) =>
                item.title
                  .toLowerCase()
                  .includes(
                    term
                  ) ||
                item.company
                  .toLowerCase()
                  .includes(
                    term
                  ) ||
                (
                  item.location ||
                  ""
                )
                  .toLowerCase()
                  .includes(
                    term
                  ) ||
                (
                  item.skills ||
                  []
                ).some(
                  (skill) =>
                    skill
                      .toLowerCase()
                      .includes(
                        term
                      )
                )
            )
            .slice(
              0,
              8
            );
        },
        [
          jobSearch,
          jobs,
        ]
      );

    /* =====================================================
       RESET + INITIAL LOAD
    ===================================================== */

    useEffect(
      () => {
        if (!open) {
          return;
        }

        setStep(
          1
        );

        setSourceMode(
          null
        );

        setSelectedSource(
          null
        );

        setSourceAnalysisId(
          ""
        );

        setSourceFileName(
          ""
        );

        setError(
          ""
        );

        setForm(
          createEmptyForm(
            job?.title ||
              ""
          )
        );

        setSelectedJob(
          job ||
            null
        );

        setImprovementMode(
          job
            ? "vacancy"
            : "general"
        );

        setJobSearch(
          ""
        );

        const loadHistory =
          async () => {
            try {
              setLoadingHistory(
                true
              );

              const response =
                await apiClient.get<ResumeHistoryResponse>(
                  "/resume/history"
                );

              setHistory(
                response.data
                  .data
                  ?.analyses ||
                  []
              );
            } catch (
              loadError:
                unknown
            ) {
              setHistory(
                []
              );

              setError(
                getErrorMessage(
                  loadError,
                  "Could not load your saved CVs."
                )
              );
            } finally {
              setLoadingHistory(
                false
              );
            }
          };

        const loadJobs =
          async () => {
            if (job) {
              return;
            }

            try {
              setLoadingJobs(
                true
              );

              const response =
                await apiClient.get<JobsResponse>(
                  "/jobs"
                );

              setJobs(
                response.data
                  .data
                  ?.jobs ||
                  []
              );
            } catch {
              setJobs(
                []
              );
            } finally {
              setLoadingJobs(
                false
              );
            }
          };

        void loadHistory();

        void loadJobs();
      },
      [
        open,
        job,
      ]
    );

    /* =====================================================
       SOURCE
    ===================================================== */

    const selectUploadFile =
      (
        file:
          File
      ) => {
        setError(
          ""
        );

        if (
          !file.name
            .toLowerCase()
            .endsWith(
              ".pdf"
            )
        ) {
          setError(
            "Please choose a PDF CV."
          );

          return;
        }

        if (
          file.size >
          MAX_FILE_SIZE
        ) {
          setError(
            "CV file must be smaller than 10 MB."
          );

          return;
        }

        setSourceMode(
          "upload"
        );

        setSelectedSource({
          mode:
            "upload",

          fileName:
            file.name,

          file,
        });

        setSourceAnalysisId(
          ""
        );

        setSourceFileName(
          file.name
        );
      };

    const selectSavedCV =
      (
        analysis:
          ResumeHistoryAnalysis
      ) => {
        const analysisId =
          getAnalysisId(
            analysis
          );

        if (!analysisId) {
          setError(
            "This saved CV does not contain a valid analysis ID."
          );

          return;
        }

        setError(
          ""
        );

        setSourceMode(
          "saved"
        );

        setSelectedSource({
          mode:
            "saved",

          analysisId,

          fileName:
            analysis.fileName ||
            "Saved CV",
        });

        setSourceAnalysisId(
          ""
        );

        setSourceFileName(
          analysis.fileName ||
            "Saved CV"
        );

        if (
          inputRef.current
        ) {
          inputRef.current.value =
            "";
        }
      };

    /* =====================================================
       LOAD PROFILE
    ===================================================== */

    const loadSelectedProfile =
      async (): Promise<boolean> => {
        if (
          !selectedSource
        ) {
          setError(
            "Choose a CV before continuing."
          );

          return false;
        }

        try {
          setProcessingSource(
            true
          );

          setError(
            ""
          );

          let response:
            ResumeProfileResponse;

          let analysisId =
            "";

          let fileName =
            selectedSource.fileName;

          if (
            selectedSource.mode ===
            "upload"
          ) {
            if (
              !selectedSource.file
            ) {
              throw new Error(
                "The selected PDF could not be found."
              );
            }

            const formData =
              new FormData();

            formData.append(
              "resume",
              selectedSource.file,
              selectedSource.file
                .name
            );

            const analyzeResponse =
              await apiClient.post<ResumeProfileResponse>(
                "/resume/analyze",
                formData
              );

            response =
              analyzeResponse.data;

            analysisId =
              getAnalysisId(
                response.data
                  ?.analysis
              );

            fileName =
              response.data
                ?.analysis
                ?.fileName ||
              selectedSource.file
                .name;
          } else {
            if (
              !selectedSource
                .analysisId
            ) {
              throw new Error(
                "The selected saved CV does not contain an analysis ID."
              );
            }

            const savedResponse =
              await apiClient.get<ResumeProfileResponse>(
                `/resume/${selectedSource.analysisId}`
              );

            response =
              savedResponse.data;

            analysisId =
              getAnalysisId(
                response.data
                  ?.analysis
              ) ||
              selectedSource
                .analysisId;

            fileName =
              response.data
                ?.analysis
                ?.fileName ||
              selectedSource.fileName;
          }

          if (!analysisId) {
            throw new Error(
              "The CV was loaded, but its analysis ID was not returned."
            );
          }

          const profile =
            response.data
              ?.profile;

          if (!profile) {
            throw new Error(
              "The selected CV does not have a structured ResumeProfile."
            );
          }

          const targetRole =
            selectedJob
              ?.title ||
            form.targetRole ||
            "";

          const normalized =
            normalizeProfileToForm(
              profile,
              targetRole
            );

          setSourceAnalysisId(
            analysisId
          );

          setSourceFileName(
            fileName
          );

          setForm(
            normalized
          );

          return true;
        } catch (
          loadError:
            unknown
        ) {
          setError(
            getErrorMessage(
              loadError,
              "Could not load the selected CV."
            )
          );

          return false;
        } finally {
          setProcessingSource(
            false
          );
        }
      };

    /* =====================================================
       FORM HELPERS
    ===================================================== */

    const updateContact =
      (
        key:
          keyof CVContactForm,
        value:
          string
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            contact: {
              ...current.contact,

              [key]:
                value,
            },
          })
        );
      };

    const updateExperience =
      (
        index:
          number,
        patch:
          Partial<CVExperienceForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            experience:
              current.experience.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    const updateProject =
      (
        index:
          number,
        patch:
          Partial<CVProjectForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            projects:
              current.projects.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    const updateEducation =
      (
        index:
          number,
        patch:
          Partial<CVEducationForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            education:
              current.education.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    const updateCertification =
      (
        index:
          number,
        patch:
          Partial<CVCertificationForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            certifications:
              current.certifications.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    const updateLanguage =
      (
        index:
          number,
        patch:
          Partial<CVLanguageForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            languages:
              current.languages.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    const updateVolunteering =
      (
        index:
          number,
        patch:
          Partial<CVVolunteeringForm>
      ) => {
        setForm(
          (
            current
          ) => ({
            ...current,

            volunteering:
              current.volunteering.map(
                (
                  item,
                  itemIndex
                ) =>
                  itemIndex ===
                  index
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item
              ),
          })
        );
      };

    /* =====================================================
       VALIDATION
    ===================================================== */

    const validateProfile =
      (): boolean => {
        if (
          !form.contact
            .fullName
            .trim()
        ) {
          setError(
            "Full name is required."
          );

          return false;
        }

        if (
          !form.contact
            .email
            .trim()
        ) {
          setError(
            "Email is required."
          );

          return false;
        }

        if (
          !form.targetRole
            .trim()
        ) {
          setError(
            "Target role is required."
          );

          return false;
        }

        if (
          !form
            .technicalSkills
            .trim()
        ) {
          setError(
            "Add at least one technical skill."
          );

          return false;
        }

        if (
          form.experience
            .length ===
            0 &&
          form.projects
            .length ===
            0
        ) {
          setError(
            "Add at least one Experience or one Project."
          );

          return false;
        }

        for (
          let index =
            0;
          index <
          form.experience
            .length;
          index += 1
        ) {
          const item =
            form.experience[
              index
            ];

          if (
            !item.title
              .trim()
          ) {
            setError(
              `Experience ${
                index +
                1
              }: job title is required.`
            );

            return false;
          }

          if (
            !item.company
              .trim()
          ) {
            setError(
              `Experience ${
                index +
                1
              }: company is required.`
            );

            return false;
          }

          /*
           * Dates are useful, but we do not force fake dates.
           *
           * If extraction could not confidently parse a date,
           * the user can fill it manually.
           */
          if (
            item.startDate &&
            !/^\d{4}-\d{2}$/.test(
              item.startDate
            )
          ) {
            setError(
              `Experience ${
                index +
                1
              }: start date is invalid.`
            );

            return false;
          }
        }

        for (
          let index =
            0;
          index <
          form.projects
            .length;
          index += 1
        ) {
          const item =
            form.projects[
              index
            ];

          const hasContent =
            Boolean(
              item.name.trim() ||
              item.role.trim() ||
              item.description
                .trim() ||
              item.bullets
                .trim() ||
              item.technologies
                .trim() ||
              item.url.trim() ||
              item.github
                .trim()
            );

          if (
            hasContent &&
            !item.name
              .trim()
          ) {
            setError(
              `Project ${
                index +
                1
              }: project name is required.`
            );

            return false;
          }
        }

        setError(
          ""
        );

        return true;
      };

    /* =====================================================
       NAVIGATION
    ===================================================== */

    const goNext =
      async () => {
        setError(
          ""
        );

        if (
          step ===
          1
        ) {
          if (
            improvementMode ===
              "vacancy" &&
            !selectedJob
          ) {
            setError(
              "Choose a target vacancy or switch to General CV improvement."
            );

            return;
          }

          const loaded =
            await loadSelectedProfile();

          if (!loaded) {
            return;
          }

          setStep(
            2
          );

          return;
        }

        if (
          step ===
          2
        ) {
          if (
            !validateProfile()
          ) {
            return;
          }

          setStep(
            3
          );
        }
      };

    const goBack =
      () => {
        setError(
          ""
        );

        setStep(
          (
            current
          ) =>
            Math.max(
              1,
              current -
                1
            ) as
              WizardStep
        );
      };

    /* =====================================================
       FINISH
    ===================================================== */

    const finish =
      () => {
        if (
          !sourceAnalysisId
        ) {
          setStep(
            1
          );

          setError(
            "Select and load a source CV first."
          );

          return;
        }

        if (
          !validateProfile()
        ) {
          setStep(
            2
          );

          return;
        }

        const normalizedProfile =
          formToProfile(
            form
          );

        const firstExperience =
          normalizedProfile
            .experience[0];

        const compatibilityFile =
          selectedSource
            ?.file ||
          new File(
            [],
            sourceFileName ||
              "Saved_CV.pdf",
            {
              type:
                "application/pdf",
            }
          );

        onReady({
          jobId:
            selectedJob?._id ||
            null,

          sourceAnalysisId,

          sourceFileName,

          profile:
            normalizedProfile,

          targetRole:
            form.targetRole
              .trim(),

          resumeFile:
            compatibilityFile,

          major: {
            targetTitle:
              form.targetRole
                .trim(),

            yearsOfExperience:
              "",

            strongestSkills:
              form
                .technicalSkills,

            currentOrRecentRole:
              firstExperience
                ?.title ||
              "",

            currentOrRecentCompany:
              firstExperience
                ?.company ||
              "",

            biggestAchievement:
              normalizedProfile
                .achievements[0] ||
              "",
          },

          optional: {
            linkedin:
              normalizedProfile
                .contact
                .linkedin,

            github:
              normalizedProfile
                .contact
                .github,

            portfolio:
              normalizedProfile
                .contact
                .website,

            certifications:
              normalizedProfile
                .certifications
                .map(
                  (item) =>
                    [
                      item.name,
                      item.issuer,
                      item.issueDate,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " — "
                      )
                )
                .join(
                  "\n"
                ),

            languages:
              normalizedProfile
                .languages
                .map(
                  (item) =>
                    `${item.language}${
                      item.level
                        ? ` — ${item.level}`
                        : ""
                    }`
                )
                .join(
                  "\n"
                ),

            volunteering:
              normalizedProfile
                .volunteering
                .map(
                  (item) =>
                    [
                      item.organization,
                      item.role,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " — "
                      )
                )
                .join(
                  "\n"
                ),

            additionalProjects:
              normalizedProfile
                .projects
                .map(
                  (item) =>
                    item.name
                )
                .filter(
                  Boolean
                )
                .join(
                  "\n"
                ),

            additionalEducation:
              normalizedProfile
                .education
                .map(
                  (item) =>
                    [
                      item.institution,
                      item.degree,
                      item.field,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " — "
                      )
                )
                .join(
                  "\n"
                ),
          },
        });
      };

    if (!open) {
      return null;
    }

    return (
      <div
        className="cv-wizard-backdrop"
        onMouseDown={(
          event
        ) => {
          if (
            event.target ===
              event.currentTarget &&
            !processingSource
          ) {
            onClose();
          }
        }}
      >
        <section className="cv-wizard">
          <button
            type="button"
            className="cv-wizard-close"
            onClick={
              onClose
            }
            disabled={
              processingSource
            }
            aria-label="Close CV wizard"
          >
            <FiX />
          </button>

          <header className="cv-wizard-header">
            <div className="cv-wizard-icon">
              <FiZap />
            </div>

            <div>
              <span>
                SMART CV BUILDER
              </span>

              <h2>
                Build your strongest CV
              </h2>

              <p>
                Choose the CV you want to improve. InterviewIQ will prefill only information it can safely identify. Anything uncertain stays empty so you can correct it yourself.
              </p>
            </div>
          </header>

          {selectedJob ? (
            <div className="cv-wizard-job">
              <div className="cv-wizard-job-icon">
                <FiTarget />
              </div>

              <div>
                <small>
                  TARGET VACANCY
                </small>

                <strong>
                  {selectedJob.title}
                </strong>

                <span>
                  {selectedJob.company}

                  {selectedJob.location
                    ? ` · ${selectedJob.location}`
                    : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="cv-wizard-job general">
              <div className="cv-wizard-job-icon">
                <FiBriefcase />
              </div>

              <div>
                <small>
                  IMPROVEMENT MODE
                </small>

                <strong>
                  General CV improvement
                </strong>

                <span>
                  No vacancy is currently selected.
                </span>
              </div>
            </div>
          )}

          <div className="cv-wizard-progress">
            <div>
              <span>
                Step {step} of 3
              </span>

              <strong>
                {step ===
                1
                  ? "Choose CV"
                  : step ===
                      2
                    ? "Review & Complete"
                    : "Final Review"}
              </strong>
            </div>

            <div className="cv-wizard-progress-track">
              <div
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>
          </div>

          <main className="cv-wizard-body">
            {/* =================================================
                STEP 1
            ================================================= */}

            {step ===
              1 && (
              <div className="cv-wizard-step">
                {!job && (
                  <section className="cv-wizard-section">
                    <div className="cv-wizard-section-heading">
                      <div className="cv-wizard-section-icon">
                        <FiTarget />
                      </div>

                      <div>
                        <span>
                          OPTIONAL
                        </span>

                        <h3>
                          What are you improving this CV for?
                        </h3>

                        <p>
                          Choose general improvement or tailor the CV toward one vacancy.
                        </p>
                      </div>
                    </div>

                    <div className="cv-wizard-mode-grid">
                      <button
                        type="button"
                        className={`cv-wizard-mode-card ${
                          improvementMode ===
                          "general"
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          setImprovementMode(
                            "general"
                          );

                          setSelectedJob(
                            null
                          );

                          setError(
                            ""
                          );
                        }}
                      >
                        <FiBriefcase />

                        <div>
                          <strong>
                            General CV improvement
                          </strong>

                          <span>
                            Improve your CV using your real professional background.
                          </span>
                        </div>

                        {improvementMode ===
                          "general" && (
                          <FiCheckCircle className="selection-check" />
                        )}
                      </button>

                      <button
                        type="button"
                        className={`cv-wizard-mode-card ${
                          improvementMode ===
                          "vacancy"
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          setImprovementMode(
                            "vacancy"
                          );

                          setError(
                            ""
                          );
                        }}
                      >
                        <FiTarget />

                        <div>
                          <strong>
                            Target a vacancy
                          </strong>

                          <span>
                            Tailor your CV toward one specific job.
                          </span>
                        </div>

                        {improvementMode ===
                          "vacancy" && (
                          <FiCheckCircle className="selection-check" />
                        )}
                      </button>
                    </div>

                    {improvementMode ===
                      "vacancy" && (
                      <div className="cv-wizard-vacancies">
                        <div className="cv-wizard-search">
                          <FiSearch />

                          <input
                            value={
                              jobSearch
                            }
                            onChange={(
                              event
                            ) =>
                              setJobSearch(
                                event.target.value
                              )
                            }
                            placeholder="Search vacancy by role, company, location or skill..."
                          />
                        </div>

                        <div className="cv-wizard-job-results">
                          {loadingJobs ? (
                            <div className="cv-wizard-inline-loading">
                              <span className="cv-wizard-spinner dark" />

                              Loading vacancies...
                            </div>
                          ) : filteredJobs.length ===
                            0 ? (
                            <div className="cv-wizard-empty-state small">
                              No vacancies found.
                            </div>
                          ) : (
                            filteredJobs.map(
                              (
                                item
                              ) => {
                                const selected =
                                  selectedJob
                                    ?._id ===
                                  item._id;

                                return (
                                  <button
                                    type="button"
                                    key={
                                      item._id
                                    }
                                    className={`cv-wizard-job-option ${
                                      selected
                                        ? "selected"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setSelectedJob(
                                        item
                                      );

                                      setError(
                                        ""
                                      );
                                    }}
                                  >
                                    <div>
                                      <strong>
                                        {item.title}
                                      </strong>

                                      <span>
                                        {item.company}

                                        {item.location
                                          ? ` · ${item.location}`
                                          : ""}
                                      </span>
                                    </div>

                                    {selected && (
                                      <FiCheckCircle />
                                    )}
                                  </button>
                                );
                              }
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="cv-wizard-section">
                  <div className="cv-wizard-section-heading">
                    <div className="cv-wizard-section-icon">
                      <FiFileText />
                    </div>

                    <div>
                      <span>
                        REQUIRED
                      </span>

                      <h3>
                        Choose the CV to use
                      </h3>

                      <p>
                        Upload a new PDF or choose one of your previously saved CVs.
                      </p>
                    </div>
                  </div>

                  <div className="cv-wizard-source-tabs">
                    <button
                      type="button"
                      className={
                        sourceMode ===
                        "upload"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setSourceMode(
                          "upload"
                        );

                        setSelectedSource(
                          null
                        );

                        setSourceAnalysisId(
                          ""
                        );

                        setError(
                          ""
                        );
                      }}
                    >
                      <FiUploadCloud />

                      Upload new CV
                    </button>

                    <button
                      type="button"
                      className={
                        sourceMode ===
                        "saved"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setSourceMode(
                          "saved"
                        );

                        setSelectedSource(
                          null
                        );

                        setSourceAnalysisId(
                          ""
                        );

                        setError(
                          ""
                        );
                      }}
                    >
                      <FiFolder />

                      Saved CVs
                    </button>
                  </div>

                  {sourceMode ===
                    null && (
                    <div className="cv-wizard-source-intro">
                      <FiFileText />

                      <strong>
                        Choose your source CV
                      </strong>

                      <span>
                        Nothing is selected automatically.
                      </span>
                    </div>
                  )}

                  {sourceMode ===
                    "upload" && (
                    <>
                      <input
                        ref={
                          inputRef
                        }
                        type="file"
                        accept=".pdf,application/pdf"
                        hidden
                        onChange={(
                          event
                        ) => {
                          const file =
                            event.target
                              .files?.[0];

                          if (file) {
                            selectUploadFile(
                              file
                            );
                          }
                        }}
                      />

                      {!selectedSource ||
                      selectedSource.mode !==
                        "upload" ? (
                        <button
                          type="button"
                          className="cv-wizard-upload"
                          onClick={() =>
                            inputRef.current?.click()
                          }
                        >
                          <FiUploadCloud />

                          <strong>
                            Choose PDF CV
                          </strong>

                          <span>
                            PDF only · maximum 10 MB
                          </span>
                        </button>
                      ) : (
                        <div className="cv-wizard-selected-file">
                          <FiFileText />

                          <div>
                            <strong>
                              {
                                selectedSource
                                  .fileName
                              }
                            </strong>

                            <span>
                              {selectedSource.file
                                ? `${(
                                    selectedSource
                                      .file
                                      .size /
                                    1024
                                  ).toFixed(
                                    1
                                  )} KB`
                                : "PDF selected"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSource(
                                null
                              );

                              setSourceAnalysisId(
                                ""
                              );

                              setSourceFileName(
                                ""
                              );

                              if (
                                inputRef.current
                              ) {
                                inputRef.current.value =
                                  "";
                              }
                            }}
                          >
                            <FiX />
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {sourceMode ===
                    "saved" && (
                    <div className="cv-wizard-history">
                      {loadingHistory ? (
                        <div className="cv-wizard-inline-loading">
                          <span className="cv-wizard-spinner dark" />

                          Loading saved CVs...
                        </div>
                      ) : history.length ===
                        0 ? (
                        <div className="cv-wizard-empty-state">
                          <FiFolder />

                          <strong>
                            No saved CVs found
                          </strong>

                          <span>
                            Upload a new PDF instead.
                          </span>
                        </div>
                      ) : (
                        history.map(
                          (
                            analysis
                          ) => {
                            const analysisId =
                              getAnalysisId(
                                analysis
                              );

                            const selected =
                              selectedSource
                                ?.mode ===
                                "saved" &&
                              selectedSource
                                .analysisId ===
                                analysisId;

                            return (
                              <button
                                type="button"
                                key={
                                  analysisId
                                }
                                className={`cv-wizard-history-card ${
                                  selected
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() =>
                                  selectSavedCV(
                                    analysis
                                  )
                                }
                              >
                                <div className="cv-wizard-history-icon">
                                  <FiFileText />
                                </div>

                                <div className="cv-wizard-history-main">
                                  <strong>
                                    {analysis.fileName ||
                                      "Saved CV"}
                                  </strong>

                                  <span>
                                    {formatDate(
                                      analysis.createdAt ||
                                        analysis.updatedAt
                                    )}

                                    {analysis.fileSize
                                      ? ` · ${formatFileSize(
                                          analysis.fileSize
                                        )}`
                                      : ""}
                                  </span>
                                </div>

                                {typeof analysis.overallScore ===
                                  "number" && (
                                  <div className="cv-wizard-history-score">
                                    <strong>
                                      {
                                        analysis.overallScore
                                      }
                                    </strong>

                                    <span>
                                      score
                                    </span>
                                  </div>
                                )}

                                <div className="cv-wizard-history-check">
                                  {selected && (
                                    <FiCheck />
                                  )}
                                </div>
                              </button>
                            );
                          }
                        )
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* =================================================
                STEP 2
            ================================================= */}

            {step ===
              2 && (
              <div className="cv-wizard-step">
                <div className="cv-wizard-step-copy">
                  <span>
                    PROFILE LOADED FROM CV
                  </span>

                  <h3>
                    Review & complete your information
                  </h3>

                  <p>
                    We filled only information that could be mapped safely. Empty fields simply mean you can enter that information yourself.
                  </p>
                </div>

                {/* CONTACT */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-form-section-title">
                    <FiUser />

                    <div>
                      <h4>
                        Contact & target role
                      </h4>

                      <p>
                        Core information used at the top of your CV.
                      </p>
                    </div>
                  </div>

                  <div className="cv-wizard-form-grid">
                    <label>
                      <span>
                        Full name *
                      </span>

                      <input
                        value={
                          form.contact
                            .fullName
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "fullName",
                            event.target.value
                          )
                        }
                        placeholder="Full name"
                      />
                    </label>

                    <label>
                      <span>
                        Email *
                      </span>

                      <input
                        type="email"
                        value={
                          form.contact
                            .email
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "email",
                            event.target.value
                          )
                        }
                        placeholder="name@example.com"
                      />
                    </label>

                    <label>
                      <span>
                        Phone
                      </span>

                      <input
                        value={
                          form.contact
                            .phone
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "phone",
                            event.target.value
                          )
                        }
                        placeholder="Phone number"
                      />
                    </label>

                    <label>
                      <span>
                        Location
                      </span>

                      <input
                        value={
                          form.contact
                            .location
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "location",
                            event.target.value
                          )
                        }
                        placeholder="Boston, MA"
                      />
                    </label>

                    <label>
                      <span>
                        Target role *
                      </span>

                      <input
                        value={
                          form.targetRole
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              targetRole:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Web Developer"
                      />
                    </label>

                    <label>
                      <span>
                        LinkedIn
                      </span>

                      <input
                        value={
                          form.contact
                            .linkedin
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "linkedin",
                            event.target.value
                          )
                        }
                        placeholder="https://linkedin.com/in/username"
                      />
                    </label>

                    <label>
                      <span>
                        GitHub
                      </span>

                      <input
                        value={
                          form.contact
                            .github
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "github",
                            event.target.value
                          )
                        }
                        placeholder="https://github.com/username"
                      />
                    </label>

                    <label>
                      <span>
                        Portfolio / website
                      </span>

                      <input
                        value={
                          form.contact
                            .website
                        }
                        onChange={(
                          event
                        ) =>
                          updateContact(
                            "website",
                            event.target.value
                          )
                        }
                        placeholder="https://..."
                      />
                    </label>

                    <label className="wide">
                      <span>
                        Technical skills *
                      </span>

                      <input
                        value={
                          form.technicalSkills
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              technicalSkills:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="React, TypeScript, Node.js, MongoDB"
                      />

                      <small>
                        Separate skills with commas.
                      </small>
                    </label>

                    <label className="wide">
                      <span>
                        Soft skills
                      </span>

                      <input
                        value={
                          form.softSkills
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              softSkills:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Communication, teamwork, problem solving"
                      />
                    </label>

                    <label className="wide">
                      <span>
                        Professional summary
                      </span>

                      <textarea
                        value={
                          form
                            .professionalSummary
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              professionalSummary:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Professional summary..."
                      />
                    </label>
                  </div>
                </section>

                {/* EXPERIENCE */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiBriefcase />

                      <div>
                        <h4>
                          Experience
                        </h4>

                        <p>
                          Add each professional position separately.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            experience: [
                              ...current.experience,

                              createEmptyExperience(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add experience
                    </button>
                  </div>

                  {form.experience
                    .length ===
                    0 && (
                    <div className="cv-wizard-empty-repeatable">
                      No professional experience was confidently detected. Add an experience manually if needed, or keep at least one real project.
                    </div>
                  )}

                  {form.experience.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-entry-card"
                        key={`experience-${index}`}
                      >
                        <div className="cv-wizard-entry-header">
                          <div>
                            <span>
                              EXPERIENCE
                            </span>

                            <strong>
                              {item.title ||
                                `Experience ${
                                  index +
                                  1
                                }`}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="cv-wizard-remove-button"
                            onClick={() =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  experience:
                                    current.experience.filter(
                                      (
                                        _entry,
                                        entryIndex
                                      ) =>
                                        entryIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        <div className="cv-wizard-form-grid">
                          <label>
                            <span>
                              Job title *
                            </span>

                            <input
                              value={
                                item.title
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    title:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Frontend Developer"
                            />
                          </label>

                          <label>
                            <span>
                              Company *
                            </span>

                            <input
                              value={
                                item.company
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    company:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Company name"
                            />
                          </label>

                          <label>
                            <span>
                              Employment type
                            </span>

                            <select
                              value={
                                item.employmentType
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    employmentType:
                                      event.target.value,
                                  }
                                )
                              }
                            >
                              <option value="">
                                Select type
                              </option>

                              <option value="full-time">
                                Full-time
                              </option>

                              <option value="part-time">
                                Part-time
                              </option>

                              <option value="contract">
                                Contract
                              </option>

                              <option value="internship">
                                Internship
                              </option>

                              <option value="freelance">
                                Freelance
                              </option>
                            </select>
                          </label>

                          <div />

                          <label>
                            <span>
                              Start date
                            </span>

                            <input
                              type="month"
                              value={
                                item.startDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    startDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              End date
                            </span>

                            <input
                              type="month"
                              value={
                                item.endDate
                              }
                              disabled={
                                item.isCurrent
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    endDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label className="wide cv-wizard-checkbox">
                            <input
                              type="checkbox"
                              checked={
                                item.isCurrent
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    isCurrent:
                                      event.target.checked,

                                    endDate:
                                      event.target.checked
                                        ? ""
                                        : item.endDate,
                                  }
                                )
                              }
                            />

                            <span>
                              I currently work here
                            </span>
                          </label>

                          <label className="wide">
                            <span>
                              Details / summary
                            </span>

                            <textarea
                              value={
                                item.description
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    description:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Describe your role and main responsibilities..."
                            />
                          </label>

                          <label className="wide">
                            <span>
                              Responsibilities / achievements
                            </span>

                            <textarea
                              value={
                                item.bullets
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    bullets:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder={"Built responsive React features\nImproved API integration\nCollaborated with backend developers"}
                            />

                            <small>
                              One item per line.
                            </small>
                          </label>

                          <label className="wide">
                            <span>
                              Technologies
                            </span>

                            <input
                              value={
                                item.technologies
                              }
                              onChange={(
                                event
                              ) =>
                                updateExperience(
                                  index,
                                  {
                                    technologies:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="React, TypeScript, Node.js"
                            />
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </section>

                {/* PROJECTS */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiZap />

                      <div>
                        <h4>
                          Projects
                        </h4>

                        <p>
                          Keep each project structured and separate.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            projects: [
                              ...current.projects,

                              createEmptyProject(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add project
                    </button>
                  </div>

                  {form.projects
                    .length ===
                    0 && (
                    <div className="cv-wizard-empty-repeatable">
                      No projects were confidently detected.
                    </div>
                  )}

                  {form.projects.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-entry-card"
                        key={`project-${index}`}
                      >
                        <div className="cv-wizard-entry-header">
                          <div>
                            <span>
                              PROJECT
                            </span>

                            <strong>
                              {item.name ||
                                `Project ${
                                  index +
                                  1
                                }`}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="cv-wizard-remove-button"
                            onClick={() =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  projects:
                                    current.projects.filter(
                                      (
                                        _entry,
                                        entryIndex
                                      ) =>
                                        entryIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        <div className="cv-wizard-form-grid">
                          <label>
                            <span>
                              Project name
                            </span>

                            <input
                              value={
                                item.name
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    name:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="InterviewIQ AI"
                            />
                          </label>

                          <label>
                            <span>
                              Role
                            </span>

                            <input
                              value={
                                item.role
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    role:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Only fill if your CV specifies a role"
                            />
                          </label>

                          <label>
                            <span>
                              Start date
                            </span>

                            <input
                              type="month"
                              value={
                                item.startDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    startDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              End date
                            </span>

                            <input
                              type="month"
                              value={
                                item.endDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    endDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label className="wide">
                            <span>
                              Project details
                            </span>

                            <textarea
                              value={
                                item.description
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    description:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Describe what the project does..."
                            />
                          </label>

                          <label className="wide">
                            <span>
                              Key contributions
                            </span>

                            <textarea
                              value={
                                item.bullets
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    bullets:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="One contribution per line"
                            />
                          </label>

                          <label className="wide">
                            <span>
                              Technologies
                            </span>

                            <input
                              value={
                                item.technologies
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    technologies:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="React, TypeScript, Express, MongoDB"
                            />
                          </label>

                          <label>
                            <span>
                              Project URL
                            </span>

                            <input
                              value={
                                item.url
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    url:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="https://..."
                            />
                          </label>

                          <label>
                            <span>
                              GitHub
                            </span>

                            <input
                              value={
                                item.github
                              }
                              onChange={(
                                event
                              ) =>
                                updateProject(
                                  index,
                                  {
                                    github:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="https://github.com/..."
                            />
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </section>

                {/* EDUCATION */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiFileText />

                      <div>
                        <h4>
                          Education
                        </h4>

                        <p>
                          Keep only useful education information. GPA and university location are intentionally excluded.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            education: [
                              ...current.education,

                              createEmptyEducation(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add education
                    </button>
                  </div>

                  {form.education
                    .length ===
                    0 && (
                    <div className="cv-wizard-empty-repeatable">
                      No education information was confidently detected.
                    </div>
                  )}

                  {form.education.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-entry-card"
                        key={`education-${index}`}
                      >
                        <div className="cv-wizard-entry-header">
                          <div>
                            <span>
                              EDUCATION
                            </span>

                            <strong>
                              {item.institution ||
                                `Education ${
                                  index +
                                  1
                                }`}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="cv-wizard-remove-button"
                            onClick={() =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  education:
                                    current.education.filter(
                                      (
                                        _entry,
                                        entryIndex
                                      ) =>
                                        entryIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        <div className="cv-wizard-form-grid">
                          <label className="wide">
                            <span>
                              University / Institution
                            </span>

                            <input
                              value={
                                item.institution
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    institution:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="University name"
                            />
                          </label>

                          <label>
                            <span>
                              Degree
                            </span>

                            <input
                              value={
                                item.degree
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    degree:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Bachelor's / Associate / Master..."
                            />
                          </label>

                          <label>
                            <span>
                              Field
                            </span>

                            <input
                              value={
                                item.field
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    field:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Information Technology"
                            />
                          </label>

                          <label>
                            <span>
                              Start date
                            </span>

                            <input
                              type="month"
                              value={
                                item.startDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    startDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              End date
                            </span>

                            <input
                              type="month"
                              disabled={
                                item.isCurrent
                              }
                              value={
                                item.endDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    endDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label className="wide cv-wizard-checkbox">
                            <input
                              type="checkbox"
                              checked={
                                item.isCurrent
                              }
                              onChange={(
                                event
                              ) =>
                                updateEducation(
                                  index,
                                  {
                                    isCurrent:
                                      event.target.checked,

                                    endDate:
                                      event.target.checked
                                        ? ""
                                        : item.endDate,
                                  }
                                )
                              }
                            />

                            <span>
                              Currently studying
                            </span>
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </section>

                {/* CERTIFICATIONS */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiCheckCircle />

                      <div>
                        <h4>
                          Certifications
                        </h4>

                        <p>
                          Only useful certification details.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            certifications: [
                              ...current.certifications,

                              createEmptyCertification(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add certification
                    </button>
                  </div>

                  {form.certifications.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-entry-card compact"
                        key={`certification-${index}`}
                      >
                        <div className="cv-wizard-entry-header">
                          <strong>
                            {item.name ||
                              `Certification ${
                                index +
                                1
                              }`}
                          </strong>

                          <button
                            type="button"
                            className="cv-wizard-remove-button"
                            onClick={() =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  certifications:
                                    current.certifications.filter(
                                      (
                                        _entry,
                                        entryIndex
                                      ) =>
                                        entryIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        <div className="cv-wizard-form-grid">
                          <label>
                            <span>
                              Certification name
                            </span>

                            <input
                              value={
                                item.name
                              }
                              onChange={(
                                event
                              ) =>
                                updateCertification(
                                  index,
                                  {
                                    name:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Issuer
                            </span>

                            <input
                              value={
                                item.issuer
                              }
                              onChange={(
                                event
                              ) =>
                                updateCertification(
                                  index,
                                  {
                                    issuer:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Issue date
                            </span>

                            <input
                              type="month"
                              value={
                                item.issueDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateCertification(
                                  index,
                                  {
                                    issueDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </section>

                {/* LANGUAGES */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiUser />

                      <div>
                        <h4>
                          Languages
                        </h4>

                        <p>
                          Language and proficiency level are kept separate.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            languages: [
                              ...current.languages,

                              createEmptyLanguage(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add language
                    </button>
                  </div>

                  {form.languages.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-inline-row"
                        key={`language-${index}`}
                      >
                        <input
                          value={
                            item.language
                          }
                          onChange={(
                            event
                          ) =>
                            updateLanguage(
                              index,
                              {
                                language:
                                  event.target.value,
                              }
                            )
                          }
                          placeholder="Language"
                        />

                        <input
                          value={
                            item.level
                          }
                          onChange={(
                            event
                          ) =>
                            updateLanguage(
                              index,
                              {
                                level:
                                  event.target.value,
                              }
                            )
                          }
                          placeholder="Native / C1 / B2..."
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setForm(
                              (
                                current
                              ) => ({
                                ...current,

                                languages:
                                  current.languages.filter(
                                    (
                                      _entry,
                                      entryIndex
                                    ) =>
                                      entryIndex !==
                                      index
                                  ),
                              })
                            )
                          }
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    )
                  )}
                </section>

                {/* VOLUNTEERING */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-repeatable-header">
                    <div className="cv-wizard-form-section-title">
                      <FiUser />

                      <div>
                        <h4>
                          Volunteering
                        </h4>

                        <p>
                          Volunteer work stays separate from professional employment.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="cv-wizard-add-button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            volunteering: [
                              ...current.volunteering,

                              createEmptyVolunteering(),
                            ],
                          })
                        )
                      }
                    >
                      <FiPlus />

                      Add volunteering
                    </button>
                  </div>

                  {form.volunteering.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="cv-wizard-entry-card"
                        key={`volunteering-${index}`}
                      >
                        <div className="cv-wizard-entry-header">
                          <div>
                            <span>
                              VOLUNTEERING
                            </span>

                            <strong>
                              {item.organization ||
                                `Volunteering ${
                                  index +
                                  1
                                }`}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="cv-wizard-remove-button"
                            onClick={() =>
                              setForm(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  volunteering:
                                    current.volunteering.filter(
                                      (
                                        _entry,
                                        entryIndex
                                      ) =>
                                        entryIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        <div className="cv-wizard-form-grid">
                          <label>
                            <span>
                              Organization
                            </span>

                            <input
                              value={
                                item.organization
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    organization:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Organization name"
                            />
                          </label>

                          <label>
                            <span>
                              Role
                            </span>

                            <input
                              value={
                                item.role
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    role:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Volunteer"
                            />
                          </label>

                          <label>
                            <span>
                              Start date
                            </span>

                            <input
                              type="month"
                              value={
                                item.startDate
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    startDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              End date
                            </span>

                            <input
                              type="month"
                              value={
                                item.endDate
                              }
                              disabled={
                                item.isCurrent
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    endDate:
                                      event.target.value,
                                  }
                                )
                              }
                            />
                          </label>

                          <label className="wide cv-wizard-checkbox">
                            <input
                              type="checkbox"
                              checked={
                                item.isCurrent
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    isCurrent:
                                      event.target.checked,

                                    endDate:
                                      event.target.checked
                                        ? ""
                                        : item.endDate,
                                  }
                                )
                              }
                            />

                            <span>
                              I currently volunteer here
                            </span>
                          </label>

                          <label className="wide">
                            <span>
                              Details
                            </span>

                            <textarea
                              value={
                                item.description
                              }
                              onChange={(
                                event
                              ) =>
                                updateVolunteering(
                                  index,
                                  {
                                    description:
                                      event.target.value,
                                  }
                                )
                              }
                              placeholder="Describe your contribution..."
                            />
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </section>

                {/* ACHIEVEMENTS */}

                <section className="cv-wizard-form-section">
                  <div className="cv-wizard-form-section-title">
                    <FiCheckCircle />

                    <div>
                      <h4>
                        Achievements
                      </h4>

                      <p>
                        Add only real achievements that you want included in the CV.
                      </p>
                    </div>
                  </div>

                  <div className="cv-wizard-form-grid">
                    <label className="wide">
                      <span>
                        Achievements
                      </span>

                      <textarea
                        value={
                          form.achievements
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              achievements:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="One achievement per line"
                      />

                      <small>
                        Optional.
                      </small>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {/* =================================================
                STEP 3
            ================================================= */}

            {step ===
              3 && (
              <div className="cv-wizard-step">
                <div className="cv-wizard-step-copy">
                  <span>
                    FINAL REVIEW
                  </span>

                  <h3>
                    Ready for CV generation
                  </h3>

                  <p>
                    Review the source and structured information before generation.
                  </p>
                </div>

                <div className="cv-wizard-review">
                  <div>
                    <span>
                      Source CV
                    </span>

                    <strong>
                      {sourceFileName}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Candidate
                    </span>

                    <strong>
                      {form.contact.fullName}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Target role
                    </span>

                    <strong>
                      {form.targetRole}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Improvement
                    </span>

                    <strong>
                      {selectedJob
                        ? `${selectedJob.title} · ${selectedJob.company}`
                        : "General CV improvement"}
                    </strong>
                  </div>

                  <div className="wide">
                    <span>
                      Technical skills
                    </span>

                    <strong>
                      {form.technicalSkills}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Experience
                    </span>

                    <strong>
                      {form.experience.length}{" "}
                      {form.experience.length ===
                      1
                        ? "entry"
                        : "entries"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Projects
                    </span>

                    <strong>
                      {form.projects.length}{" "}
                      {form.projects.length ===
                      1
                        ? "project"
                        : "projects"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Education
                    </span>

                    <strong>
                      {form.education.length}{" "}
                      {form.education.length ===
                      1
                        ? "entry"
                        : "entries"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Volunteering
                    </span>

                    <strong>
                      {form.volunteering.length}{" "}
                      {form.volunteering.length ===
                      1
                        ? "entry"
                        : "entries"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Certifications
                    </span>

                    <strong>
                      {form.certifications.length}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Languages
                    </span>

                    <strong>
                      {form.languages.length}
                    </strong>
                  </div>
                </div>

                <div className="cv-wizard-ready-note">
                  <FiCheckCircle />

                  <div>
                    <strong>
                      Your reviewed information is the source of truth
                    </strong>

                    <p>
                      The CV builder should use this exact structured profile and source analysis instead of guessing missing candidate information.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="cv-wizard-error">
                <FiAlertCircle />

                <span>
                  {error}
                </span>
              </div>
            )}
          </main>

          <footer className="cv-wizard-actions">
            <button
              type="button"
              className="secondary"
              onClick={
                step ===
                1
                  ? onClose
                  : goBack
              }
              disabled={
                processingSource
              }
            >
              {step ===
              1 ? (
                <FiX />
              ) : (
                <FiArrowLeft />
              )}

              {step ===
              1
                ? "Cancel"
                : "Back"}
            </button>

            {step <
            3 ? (
              <button
                type="button"
                className="primary"
                onClick={() =>
                  void goNext()
                }
                disabled={
                  processingSource
                }
              >
                {processingSource ? (
                  <>
                    <span className="cv-wizard-spinner" />

                    Reading CV...
                  </>
                ) : (
                  <>
                    Continue

                    <FiArrowRight />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={
                  finish
                }
              >
                <FiCheck />

                Use this information
              </button>
            )}
          </footer>
        </section>
      </div>
    );
  };

export default ImproveCVWizard;