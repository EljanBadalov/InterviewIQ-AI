import {
  type ICVBuilderResumeProfile,
} from "./resumeProfileService";

/* =========================================================
   FIELD TYPES
========================================================= */

export type ResumeFieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "website"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages";

export interface ResumeMissingField {
  key: ResumeFieldKey;

  label: string;

  description: string;

  required: boolean;

  type:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "skills"
    | "experience"
    | "projects"
    | "education"
    | "certifications"
    | "languages";
}

/* =========================================================
   REVIEW ISSUE TYPES
========================================================= */

export type ResumeIssueSection =
  | "profile"
  | "contact"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages"
  | "volunteering"
  | "hackathons";

export type ResumeIssueSeverity =
  | "blocking"
  | "warning";

export type ResumeIssueReason =
  | "missing"
  | "suspicious"
  | "incomplete"
  | "source-review"
  | "extraction-warning"
  | "extraction-failed";

export interface ResumeProfileIssue {
  id: string;

  section: ResumeIssueSection;

  index?: number;

  field: string;

  label: string;

  message: string;

  severity: ResumeIssueSeverity;

  reason: ResumeIssueReason;

  currentValue?: string;

  requiresUserInput: boolean;
}

/* =========================================================
   COMPLETENESS RESULT
========================================================= */

export interface ResumeProfileCompletenessResult {
  /*
   * Existing contract.
   *
   * Keep these properties because existing backend/frontend
   * code may already depend on them.
   */
  isComplete: boolean;

  canGenerateCV: boolean;

  completionPercentage: number;

  missingRequiredFields: ResumeMissingField[];

  missingOptionalFields: ResumeMissingField[];

  allMissingFields: ResumeMissingField[];

  existingFields: ResumeFieldKey[];

  /*
   * New review / verification layer.
   */
  needsUserReview: boolean;

  issues: ResumeProfileIssue[];

  blockingIssues: ResumeProfileIssue[];

  reviewIssues: ResumeProfileIssue[];

  issueCount: number;

  blockingIssueCount: number;

  reviewIssueCount: number;
}

/* =========================================================
   HELPERS
========================================================= */

const hasText = (
  value:
    | string
    | undefined
    | null
): boolean => {
  return Boolean(
    value &&
      value.trim().length >
        0
  );
};

const cleanText = (
  value:
    | string
    | undefined
    | null
): string => {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const normalizeComparableText = (
  value:
    | string
    | undefined
    | null
): string => {
  return cleanText(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9+#./ ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};

const buildIssueId = (
  section: ResumeIssueSection,
  index: number | undefined,
  field: string,
  reason: ResumeIssueReason
): string => {
  const indexPart =
    index ===
    undefined
      ? "root"
      : String(
          index
        );

  return [
    section,
    indexPart,
    field,
    reason,
  ].join(
    ":"
  );
};

const pushIssue = (
  issues: ResumeProfileIssue[],
  issue: Omit<
    ResumeProfileIssue,
    "id"
  >
): void => {
  const id =
    buildIssueId(
      issue.section,
      issue.index,
      issue.field,
      issue.reason
    );

  if (
    issues.some(
      (existing) =>
        existing.id ===
        id
    )
  ) {
    return;
  }

  issues.push({
    id,

    ...issue,
  });
};

/* =========================================================
   SUSPICIOUS VALUE DETECTION
========================================================= */

const looksLikeSkillsList = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  const lower =
    cleaned
      .toLowerCase();

  if (
    lower.startsWith(
      "programming languages:"
    ) ||
    lower.startsWith(
      "technical skills:"
    ) ||
    lower.startsWith(
      "frameworks:"
    ) ||
    lower.startsWith(
      "frameworks & libraries:"
    ) ||
    lower.startsWith(
      "developer tools:"
    ) ||
    lower.startsWith(
      "skills:"
    ) ||
    lower.startsWith(
      "technologies:"
    )
  ) {
    return true;
  }

  const commaCount =
    (
      cleaned.match(
        /,/g
      ) || []
    ).length;

  if (
    commaCount <
    3
  ) {
    return false;
  }

  return /\b(?:javascript|typescript|react|html|css|scss|sass|tailwind|bootstrap|node|express|mongodb|sql|mysql|postgresql|python|java|git|github|docker|figma|postman|vue|angular|flask|django)\b/i.test(
    cleaned
  );
};

const looksLikeSectionHeading = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    normalizeComparableText(
      value
    );

  if (!cleaned) {
    return false;
  }

  const headings =
    new Set<string>([
      "experience",
      "work experience",
      "professional experience",

      "projects",
      "project",

      "education",
      "academic background",

      "skills",
      "technical skills",

      "certifications",
      "certifications training",
      "training",

      "volunteering",
      "volunteer experience",

      "languages",

      "hackathons",
      "hackathons competitions",

      "achievements",

      "interests",

      "professional summary",
      "summary",

      "developer tools",

      "programming languages",

      "frameworks libraries",
    ]);

  return headings.has(
    cleaned
  );
};

const looksLikeDateOnly = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  if (
    /^(?:19|20)\d{2}$/i.test(
      cleaned
    )
  ) {
    return true;
  }

  if (
    /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}$/i.test(
      cleaned
    )
  ) {
    return true;
  }

  if (
    /^(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|current|now)$/i.test(
      cleaned
    )
  ) {
    return true;
  }

  return false;
};

const looksLikeEmail = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    cleaned
  );
};

const looksLikeUrl = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    );

  if (!cleaned) {
    return false;
  }

  return /^(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(
    cleaned
  );
};


const isGroundingRemovalWarning = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const cleaned =
    cleanText(
      value
    )
      .toLowerCase();

  return (
    cleaned.includes(
      "was removed because the extracted value was not directly supported by the source resume text"
    ) ||
    cleaned.includes(
      "not directly supported by the source resume text"
    )
  );
};

/* =========================================================
   FIELD DEFINITIONS

   IMPORTANT:

   Professional Summary is NOT a user field.

   InterviewIQ will generate / improve it using:
   - ResumeProfile
   - Target job
   - Existing resume information
   - Verified platform skills
   - Experience
   - Projects
   - Education

   AI must only rewrite / organize supported facts.
   It must not invent unsupported information.
========================================================= */

const FIELD_DEFINITIONS: Record<
  ResumeFieldKey,
  ResumeMissingField
> = {
  /* =====================================================
     REQUIRED USER INFORMATION
  ===================================================== */

  fullName: {
    key:
      "fullName",

    label:
      "Full Name",

    description:
      "Enter your first and last name.",

    required:
      true,

    type:
      "text",
  },

  email: {
    key:
      "email",

    label:
      "Email",

    description:
      "Enter the email address you want displayed on your CV.",

    required:
      true,

    type:
      "email",
  },

  /* =====================================================
     OPTIONAL CONTACT INFORMATION
  ===================================================== */

  phone: {
    key:
      "phone",

    label:
      "Phone Number",

    description:
      "Add the phone number you want displayed on your CV.",

    required:
      false,

    type:
      "tel",
  },

  location: {
    key:
      "location",

    label:
      "Location",

    description:
      "Add your city, state, or country.",

    required:
      false,

    type:
      "text",
  },

  linkedin: {
    key:
      "linkedin",

    label:
      "LinkedIn",

    description:
      "Add your LinkedIn profile URL if you have one.",

    required:
      false,

    type:
      "url",
  },

  github: {
    key:
      "github",

    label:
      "GitHub",

    description:
      "Add your GitHub profile URL if it is relevant to your work.",

    required:
      false,

    type:
      "url",
  },

  website: {
    key:
      "website",

    label:
      "Portfolio / Website",

    description:
      "Add your portfolio or personal website if you have one.",

    required:
      false,

    type:
      "url",
  },

  /* =====================================================
     RESUME CONTENT

     These fields should normally come from:
     - uploaded resume
     - ResumeProfile
     - InterviewIQ verified information
     - CV onboarding

     Missing whole sections do NOT block generation.

     However, if an actual extracted record exists and one
     of its identity fields is missing, nested issue checks
     below can require user review.
  ===================================================== */

  skills: {
    key:
      "skills",

    label:
      "Skills",

    description:
      "Skills are extracted from your resume or collected during CV creation.",

    required:
      false,

    type:
      "skills",
  },

  experience: {
    key:
      "experience",

    label:
      "Experience",

    description:
      "Employment, internship, freelance, or other relevant professional experience.",

    required:
      false,

    type:
      "experience",
  },

  projects: {
    key:
      "projects",

    label:
      "Projects",

    description:
      "Real projects that demonstrate your practical skills.",

    required:
      false,

    type:
      "projects",
  },

  education: {
    key:
      "education",

    label:
      "Education",

    description:
      "School, university, bootcamp, training, or other relevant education.",

    required:
      false,

    type:
      "education",
  },

  certifications: {
    key:
      "certifications",

    label:
      "Certifications",

    description:
      "Relevant certifications or training if available.",

    required:
      false,

    type:
      "certifications",
  },

  languages: {
    key:
      "languages",

    label:
      "Languages",

    description:
      "Languages and proficiency information if available.",

    required:
      false,

    type:
      "languages",
  },
};

/* =========================================================
   FIELD STATE
========================================================= */

const getFieldState = (
  profile:
    ICVBuilderResumeProfile,
  key:
    ResumeFieldKey
): boolean => {
  switch (key) {
    case "fullName":
      return hasText(
        profile.contact
          .fullName
      );

    case "email":
      return hasText(
        profile.contact
          .email
      );

    case "phone":
      return hasText(
        profile.contact
          .phone
      );

    case "location":
      return hasText(
        profile.contact
          .location
      );

    case "linkedin":
      return hasText(
        profile.contact
          .linkedin
      );

    case "github":
      return hasText(
        profile.contact
          .github
      );

    case "website":
      return hasText(
        profile.contact
          .website
      );

    case "skills":
      return (
        profile.skills.length >
          0 ||
        profile.technicalSkills
          .length >
          0
      );

    case "experience":
      return (
        profile.experience
          .length >
        0
      );

    case "projects":
      return (
        profile.projects
          .length >
        0
      );

    case "education":
      return (
        profile.education
          .length >
        0
      );

    case "certifications":
      return (
        profile.certifications
          .length >
        0
      );

    case "languages":
      return (
        profile.languages
          .length >
        0
      );

    default:
      return false;
  }
};

/* =========================================================
   CONTACT ISSUES
========================================================= */

const buildContactIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  const email =
    cleanText(
      profile.contact
        .email
    );

  if (
    email &&
    !looksLikeEmail(
      email
    )
  ) {
    pushIssue(
      issues,
      {
        section:
          "contact",

        field:
          "email",

        label:
          "Email",

        message:
          "The email address extracted from the CV does not appear to be valid. Please confirm it.",

        severity:
          "blocking",

        reason:
          "suspicious",

        currentValue:
          email,

        requiresUserInput:
          true,
      }
    );
  }

  const linkedin =
    cleanText(
      profile.contact
        .linkedin
    );

  if (
    linkedin &&
    !looksLikeUrl(
      linkedin
    )
  ) {
    pushIssue(
      issues,
      {
        section:
          "contact",

        field:
          "linkedin",

        label:
          "LinkedIn",

        message:
          "The LinkedIn value could not be confidently recognized as a profile URL. Please review it.",

        severity:
          "warning",

        reason:
          "suspicious",

        currentValue:
          linkedin,

        requiresUserInput:
          true,
      }
    );
  }

  const github =
    cleanText(
      profile.contact
        .github
    );

  if (
    github &&
    !looksLikeUrl(
      github
    )
  ) {
    pushIssue(
      issues,
      {
        section:
          "contact",

        field:
          "github",

        label:
          "GitHub",

        message:
          "The GitHub value could not be confidently recognized as a profile URL. Please review it.",

        severity:
          "warning",

        reason:
          "suspicious",

        currentValue:
          github,

        requiresUserInput:
          true,
      }
    );
  }

  const website =
    cleanText(
      profile.contact
        .website
    );

  if (
    website &&
    !looksLikeUrl(
      website
    )
  ) {
    pushIssue(
      issues,
      {
        section:
          "contact",

        field:
          "website",

        label:
          "Portfolio / Website",

        message:
          "The website value could not be confidently recognized as a URL. Please review it.",

        severity:
          "warning",

        reason:
          "suspicious",

        currentValue:
          website,

        requiresUserInput:
          true,
      }
    );
  }

  return issues;
};

/* =========================================================
   EXPERIENCE ISSUES
========================================================= */

const buildExperienceIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.experience
    .forEach(
      (
        item,
        index
      ) => {
        const title =
          cleanText(
            item.title
          );

        const company =
          cleanText(
            item.company
          );

        if (!title) {
          pushIssue(
            issues,
            {
              section:
                "experience",

              index,

              field:
                "title",

              label:
                `Experience ${index + 1} — Job Title`,

              message:
                "This experience entry contains resume data, but the job title could not be identified safely. Please enter or confirm the real title.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );
        } else if (
          looksLikeSectionHeading(
            title
          ) ||
          looksLikeDateOnly(
            title
          ) ||
          looksLikeSkillsList(
            title
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "experience",

              index,

              field:
                "title",

              label:
                `Experience ${index + 1} — Job Title`,

              message:
                "The extracted job title looks suspicious and may have been parsed from another section. Please confirm it.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                title,

              requiresUserInput:
                true,
            }
          );
        }

        if (!company) {
          pushIssue(
            issues,
            {
              section:
                "experience",

              index,

              field:
                "company",

              label:
                `Experience ${index + 1} — Company`,

              message:
                "The company or organization could not be identified confidently. Please confirm it instead of allowing AI to guess.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );
        } else if (
          looksLikeSectionHeading(
            company
          ) ||
          looksLikeDateOnly(
            company
          ) ||
          looksLikeSkillsList(
            company
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "experience",

              index,

              field:
                "company",

              label:
                `Experience ${index + 1} — Company`,

              message:
                "The extracted company value looks suspicious. Please confirm the actual organization.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                company,

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};

/* =========================================================
   PROJECT ISSUES
========================================================= */

const buildProjectIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.projects
    .forEach(
      (
        item,
        index
      ) => {
        const name =
          cleanText(
            item.name
          );

        if (!name) {
          pushIssue(
            issues,
            {
              section:
                "projects",

              index,

              field:
                "name",

              label:
                `Project ${index + 1} — Name`,

              message:
                "Project information was found, but the project name could not be identified safely. Please enter the real project name.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeSkillsList(
            name
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "projects",

              index,

              field:
                "name",

              label:
                `Project ${index + 1} — Name`,

              message:
                "The extracted project name appears to be a technical skills list rather than a real project name. Please correct it.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                name,

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeSectionHeading(
            name
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "projects",

              index,

              field:
                "name",

              label:
                `Project ${index + 1} — Name`,

              message:
                "The extracted project name appears to be a resume section heading. Please confirm the real project name.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                name,

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeDateOnly(
            name
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "projects",

              index,

              field:
                "name",

              label:
                `Project ${index + 1} — Name`,

              message:
                "The extracted project name appears to be a date. Please confirm the actual project name.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                name,

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};

/* =========================================================
   EDUCATION ISSUES
========================================================= */

const buildEducationIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.education
    .forEach(
      (
        item,
        index
      ) => {
        const institution =
          cleanText(
            item.institution
          );

        if (!institution) {
          pushIssue(
            issues,
            {
              section:
                "education",

              index,

              field:
                "institution",

              label:
                `Education ${index + 1} — Institution`,

              message:
                "Education information was found, but the school or institution could not be identified safely. Please confirm it.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeSectionHeading(
            institution
          ) ||
          looksLikeDateOnly(
            institution
          ) ||
          looksLikeSkillsList(
            institution
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "education",

              index,

              field:
                "institution",

              label:
                `Education ${index + 1} — Institution`,

              message:
                "The extracted institution name looks suspicious. Please confirm the real school or university.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                institution,

              requiresUserInput:
                true,
            }
          );
        }

        const degree =
          cleanText(
            item.degree
          );

        const field =
          cleanText(
            item.field
          );

        /*
         * Degree and field are useful but are not always
         * explicitly written in every valid CV.
         *
         * Therefore missing degree/field is review-worthy,
         * but does not block the profile by itself.
         */
        if (
          !degree &&
          !field
        ) {
          pushIssue(
            issues,
            {
              section:
                "education",

              index,

              field:
                "degree",

              label:
                `Education ${index + 1} — Degree / Field`,

              message:
                "The institution was identified, but no degree or field of study was found. Add it if this information should appear on the CV.",

              severity:
                "warning",

              reason:
                "incomplete",

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};

/* =========================================================
   CERTIFICATION ISSUES
========================================================= */

const buildCertificationIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.certifications
    .forEach(
      (
        item,
        index
      ) => {
        const name =
          cleanText(
            item.name
          );

        if (!name) {
          pushIssue(
            issues,
            {
              section:
                "certifications",

              index,

              field:
                "name",

              label:
                `Certification ${index + 1} — Name`,

              message:
                "Certification or training information was found, but its name could not be identified safely. Please confirm it.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeSectionHeading(
            name
          ) ||
          looksLikeDateOnly(
            name
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "certifications",

              index,

              field:
                "name",

              label:
                `Certification ${index + 1} — Name`,

              message:
                "The extracted certification or training name looks suspicious. Please confirm it.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                name,

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};

/* =========================================================
   LANGUAGE ISSUES
========================================================= */

const buildLanguageIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.languages
    .forEach(
      (
        item,
        index
      ) => {
        const language =
          cleanText(
            item.language
          );

        const level =
          cleanText(
            item.level
          );

        if (!language) {
          pushIssue(
            issues,
            {
              section:
                "languages",

              index,

              field:
                "language",

              label:
                `Language ${index + 1}`,

              message:
                "A language entry exists, but the language name could not be identified. Please confirm it.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );

          return;
        }

        if (
          looksLikeSectionHeading(
            language
          ) ||
          looksLikeDateOnly(
            language
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "languages",

              index,

              field:
                "language",

              label:
                `Language ${index + 1}`,

              message:
                "The extracted language value looks suspicious. Please confirm the actual language.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                language,

              requiresUserInput:
                true,
            }
          );
        }

        /*
         * Proficiency level is useful, but a CV can still
         * legitimately list a language without a level.
         */
        if (!level) {
          pushIssue(
            issues,
            {
              section:
                "languages",

              index,

              field:
                "level",

              label:
                `${language || `Language ${index + 1}`} — Proficiency`,

              message:
                "No proficiency level was found for this language. Add one if you want it displayed.",

              severity:
                "warning",

              reason:
                "incomplete",

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};

/* =========================================================
   VOLUNTEERING ISSUES
========================================================= */

const buildVolunteeringIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  profile.volunteering
    .forEach(
      (
        item,
        index
      ) => {
        const organization =
          cleanText(
            item.organization
          );

        const role =
          cleanText(
            item.role
          );

        if (!organization) {
          pushIssue(
            issues,
            {
              section:
                "volunteering",

              index,

              field:
                "organization",

              label:
                `Volunteering ${index + 1} — Organization`,

              message:
                "Volunteer information was found, but the organization could not be identified safely. Please confirm it.",

              severity:
                "blocking",

              reason:
                "missing",

              requiresUserInput:
                true,
            }
          );
        } else if (
          looksLikeSectionHeading(
            organization
          ) ||
          looksLikeDateOnly(
            organization
          )
        ) {
          pushIssue(
            issues,
            {
              section:
                "volunteering",

              index,

              field:
                "organization",

              label:
                `Volunteering ${index + 1} — Organization`,

              message:
                "The extracted volunteer organization looks suspicious. Please confirm it.",

              severity:
                "blocking",

              reason:
                "suspicious",

              currentValue:
                organization,

              requiresUserInput:
                true,
            }
          );
        }

        /*
         * Role may genuinely be omitted in the source CV,
         * so keep it as review rather than blocking.
         */
        if (!role) {
          pushIssue(
            issues,
            {
              section:
                "volunteering",

              index,

              field:
                "role",

              label:
                `Volunteering ${index + 1} — Role`,

              message:
                "No volunteer role was identified. Add it if the source CV contains one or if you want it shown.",

              severity:
                "warning",

              reason:
                "incomplete",

              requiresUserInput:
                true,
            }
          );
        }
      }
    );

  return issues;
};


/* =========================================================
   HACKATHON / COMPETITION ISSUES
========================================================= */

const buildHackathonIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  const hackathons =
    profile.hackathons ??
    [];

  hackathons.forEach(
    (
      item,
      index
    ) => {
      const name =
        cleanText(
          item.name
        );

      if (!name) {
        pushIssue(
          issues,
          {
            section:
              "hackathons",

            index,

            field:
              "name",

            label:
              `Hackathon ${index + 1} — Name`,

            message:
              "Hackathon or competition information was found, but its name could not be identified safely. Please confirm the exact name from your original CV.",

            severity:
              "blocking",

            reason:
              "missing",

            requiresUserInput:
              true,
          }
        );

        return;
      }

      if (
        looksLikeSectionHeading(
          name
        ) ||
        looksLikeDateOnly(
          name
        ) ||
        looksLikeSkillsList(
          name
        )
      ) {
        pushIssue(
          issues,
          {
            section:
              "hackathons",

            index,

            field:
              "name",

            label:
              `Hackathon ${index + 1} — Name`,

            message:
              "The extracted hackathon or competition name looks suspicious. Please confirm the exact source value before CV generation.",

            severity:
              "blocking",

            reason:
              "suspicious",

            currentValue:
              name,

            requiresUserInput:
              true,
          }
        );
      }
    }
  );

  return issues;
};

/* =========================================================
   EXTRACTION ISSUES
========================================================= */

const buildExtractionIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues:
    ResumeProfileIssue[] = [];

  if (
    profile.extractionStatus ===
    "failed"
  ) {
    pushIssue(
      issues,
      {
        section:
          "profile",

        field:
          "extractionStatus",

        label:
          "Resume Extraction",

        message:
          "Resume extraction failed. The profile should be reviewed before generating an improved CV.",

        severity:
          "blocking",

        reason:
          "extraction-failed",

        currentValue:
          profile.extractionStatus,

        requiresUserInput:
          true,
      }
    );
  } else if (
    profile.extractionStatus ===
    "partial"
  ) {
    pushIssue(
      issues,
      {
        section:
          "profile",

        field:
          "extractionStatus",

        label:
          "Resume Extraction",

        message:
          "Some resume information could not be extracted with full confidence. Review the highlighted fields before generating the CV.",

        severity:
          "warning",

        reason:
          "extraction-warning",

        currentValue:
          profile.extractionStatus,

        requiresUserInput:
          false,
      }
    );
  }

  profile.extractionWarnings
    .forEach(
      (
        warning,
        index
      ) => {
        const cleaned =
          cleanText(
            warning
          );

        if (!cleaned) {
          return;
        }

        const groundingRemoval =
          isGroundingRemovalWarning(
            cleaned
          );

        pushIssue(
          issues,
          {
            section:
              "profile",

            index,

            field:
              groundingRemoval
                ? "sourceGrounding"
                : "extractionWarnings",

            label:
              groundingRemoval
                ? "Source Verification Required"
                : "Extraction Warning",

            message:
              groundingRemoval
                ? `${cleaned} Check the original CV and confirm the missing value before generation.`
                : cleaned,

            severity:
              groundingRemoval
                ? "blocking"
                : "warning",

            reason:
              groundingRemoval
                ? "source-review"
                : "extraction-warning",

            currentValue:
              cleaned,

            requiresUserInput:
              groundingRemoval,
          }
        );
      }
    );

  return issues;
};

/* =========================================================
   BUILD ALL ISSUES
========================================================= */

const buildResumeProfileIssues = (
  profile:
    ICVBuilderResumeProfile
): ResumeProfileIssue[] => {
  const issues: ResumeProfileIssue[] = [
    ...buildContactIssues(
      profile
    ),

    ...buildExperienceIssues(
      profile
    ),

    ...buildProjectIssues(
      profile
    ),

    ...buildEducationIssues(
      profile
    ),

    ...buildCertificationIssues(
      profile
    ),

    ...buildLanguageIssues(
      profile
    ),

    ...buildVolunteeringIssues(
      profile
    ),

    ...buildHackathonIssues(
      profile
    ),

    ...buildExtractionIssues(
      profile
    ),
  ];

  const seen =
    new Set<string>();

  return issues.filter(
    (issue) => {
      if (
        seen.has(
          issue.id
        )
      ) {
        return false;
      }

      seen.add(
        issue.id
      );

      return true;
    }
  );
};

/* =========================================================
   COMPLETENESS CHECK
========================================================= */

export const checkResumeProfileCompleteness =
  (
    profile:
      ICVBuilderResumeProfile
  ): ResumeProfileCompletenessResult => {
    const keys =
      Object.keys(
        FIELD_DEFINITIONS
      ) as ResumeFieldKey[];

    const existingFields:
      ResumeFieldKey[] = [];

    const missingRequiredFields:
      ResumeMissingField[] = [];

    const missingOptionalFields:
      ResumeMissingField[] = [];

    /* =====================================================
       CHECK EVERY TOP-LEVEL FIELD
    ===================================================== */

    for (
      const key
      of keys
    ) {
      const exists =
        getFieldState(
          profile,
          key
        );

      if (exists) {
        existingFields.push(
          key
        );

        continue;
      }

      const definition =
        FIELD_DEFINITIONS[
          key
        ];

      if (
        definition.required
      ) {
        missingRequiredFields.push(
          definition
        );
      } else {
        missingOptionalFields.push(
          definition
        );
      }
    }

    /* =====================================================
       COMPLETION SCORE

       Required information = 70%
       Optional information = 30%

       This preserves the previous scoring behavior.
    ===================================================== */

    const requiredKeys =
      keys.filter(
        (key) =>
          FIELD_DEFINITIONS[
            key
          ].required
      );

    const optionalKeys =
      keys.filter(
        (key) =>
          !FIELD_DEFINITIONS[
            key
          ].required
      );

    const existingRequiredCount =
      requiredKeys.filter(
        (key) =>
          existingFields.includes(
            key
          )
      ).length;

    const existingOptionalCount =
      optionalKeys.filter(
        (key) =>
          existingFields.includes(
            key
          )
      ).length;

    const requiredScore =
      requiredKeys.length >
      0
        ? (
            existingRequiredCount /
            requiredKeys.length
          ) *
          70
        : 70;

    const optionalScore =
      optionalKeys.length >
      0
        ? (
            existingOptionalCount /
            optionalKeys.length
          ) *
          30
        : 30;

    const completionPercentage =
      Math.min(
        100,
        Math.max(
          0,
          Math.round(
            requiredScore +
            optionalScore
          )
        )
      );

    /* =====================================================
       EXISTING GENERATION RULE

       Generation is blocked when:
       - required top-level identity fields are missing, OR
       - any blocking nested/source-verification issue remains.

       This is intentionally stricter than the legacy behavior
       because final PDF generation must use verified source data
       only and must never guess missing facts.
    ===================================================== */

    /* =====================================================
       NESTED / VERIFICATION ISSUES
    ===================================================== */

    const issues =
      buildResumeProfileIssues(
        profile
      );

    const blockingIssues =
      issues.filter(
        (issue) =>
          issue.severity ===
          "blocking"
      );

    const reviewIssues =
      issues.filter(
        (issue) =>
          issue.severity ===
          "warning"
      );

    /*
     * Final CV generation is allowed only when:
     * - required top-level identity fields exist, and
     * - no blocking source/structure issue remains.
     *
     * This prevents the PDF renderer from silently dropping,
     * guessing, or reshaping uncertain data.
     */
    const canGenerateCV =
      missingRequiredFields
        .length ===
        0 &&
      blockingIssues
        .length ===
        0;

    const needsUserReview =
      issues.length >
      0;

    /* =====================================================
       COMPLETE PROFILE

       Complete means:
       - required identity fields exist, and
       - no blocking nested/source issue remains.

       Optional whole sections do not make the profile
       incomplete by themselves. Warnings still trigger
       needsUserReview, but do not block generation.
    ===================================================== */

    const isComplete =
      missingRequiredFields
        .length ===
        0 &&
      blockingIssues
        .length ===
        0;

    return {
      isComplete,

      canGenerateCV,

      completionPercentage,

      missingRequiredFields,

      missingOptionalFields,

      allMissingFields: [
        ...missingRequiredFields,
        ...missingOptionalFields,
      ],

      existingFields,

      needsUserReview,

      issues,

      blockingIssues,

      reviewIssues,

      issueCount:
        issues.length,

      blockingIssueCount:
        blockingIssues.length,

      reviewIssueCount:
        reviewIssues.length,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  checkResumeProfileCompleteness,
};