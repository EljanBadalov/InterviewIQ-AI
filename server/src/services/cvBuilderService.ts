import {
  type Types,
} from "mongoose";

import {
  type IJob,
} from "../models/Job";

import {
  type IResumeAnalysis,
} from "../models/resumeAnalysis";

import {
  buildCVEvidenceContext,
  buildGeneralCVEvidenceContext,
  getSafeSkillsForGeneralCV,
  getPlatformSkillsMissingFromResumeGeneral,
  getMissingJobSkills,
  getPlatformSkillsMissingFromResume,
  getSafeKeywordsForCV,
  getSafeSkillsForCV,
  type ICVEvidenceContext,
} from "./cvEvidenceService";

import {
  optimizeCVForJob,
  optimizeCVGenerally,
  type ICVOptimizationResult,
} from "./cvOptimizationService";

import {
  getResumeProfileForBuilder,
  type ICVBuilderResumeProfile,
} from "./resumeProfileService";

/* =========================================================
   GENERATED CV TYPES
========================================================= */

export interface IGeneratedCVSection {
  title: string;

  items: string[];
}

export interface IGeneratedCVExperienceItem {
  title: string;

  company?: string;

  location?: string;

  employmentType?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  description?: string;

  bullets: string[];

  technologies: string[];
}

export interface IGeneratedCVProjectItem {
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

export interface IGeneratedCVEducationItem {
  institution: string;

  degree?: string;

  field?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  gpa?: string;

  coursework: string[];

  achievements: string[];
}

export interface IGeneratedCVCertificationItem {
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

export interface IGeneratedCVLanguageItem {
  language: string;

  level?: string;
}

export interface IGeneratedCVVolunteerItem {
  organization: string;

  role?: string;

  location?: string;

  startDate?: string;

  endDate?: string;

  isCurrent?: boolean;

  description?: string;

  bullets: string[];
}

export interface IGeneratedCVHackathonItem {
  name: string;

  organization?: string;

  role?: string;

  date?: string;

  description?: string;

  achievements: string[];
}

export interface IGeneratedCVData {
  metadata: {
    targetJob: {
      id?: string;

      title: string;

      company: string;
    } | null;

    sourceResume: {
      id?: string;

      profileId?: string;

      fileName: string;
    };

    template: {
      id?: string;

      role: string;

      displayName: string;

      matchScore: number;
    } | null;

    generatedAt: string;

    strategy:
      | "optimize-existing-resume"
      | "general-improvement"
      | "build-from-profile";
  };

  contact: {
    fullName?: string;

    email?: string;

    phone?: string;

    location?: string;

    linkedin?: string;

    github?: string;

    website?: string;
  };

  professionalSummary: string;

  skills: {
    primary: string[];

    verified: string[];

    additionalSupported: string[];

    missingForTargetJob: string[];
  };

  keywords: string[];

  experience: {
    guidance: string[];

    items: IGeneratedCVExperienceItem[];
  };

  projects: {
    guidance: string[];

    items: IGeneratedCVProjectItem[];
  };

  education: {
    title: string;

    items: IGeneratedCVEducationItem[];
  };

  certifications: {
    title: string;

    items: IGeneratedCVCertificationItem[];
  };

  languages: {
    title: string;

    items: IGeneratedCVLanguageItem[];
  };

  volunteering: {
    title: string;

    items: IGeneratedCVVolunteerItem[];
  };

  hackathons: {
    title: string;

    items: IGeneratedCVHackathonItem[];
  };

  achievements: IGeneratedCVSection;

  interests: IGeneratedCVSection;

  ats: {
    score: number;

    suggestions: string[];
  };

  formatting: {
    suggestions: string[];
  };

  sourceEvidence: {
    resumeSkills: string[];

    platformVerifiedSkills: string[];

    platformSkillsMissingFromResume: string[];

    safeSkillsForCV: string[];

    matchedSkills: string[];

    missingSkills: string[];
  };

  optimization: {
    currentResumeScore: number;

    currentJobMatchScore: number;

    priorityActions:
      ICVOptimizationResult["priorityActions"];

    sectionsToImprove:
      ICVOptimizationResult["sectionsToImprove"];
  };

  warnings: string[];
}

interface BuildOptimizedCVParams {
  userId:
    | Types.ObjectId
    | string;

  resume:
    IResumeAnalysis;

  job:
    IJob;

  sourceProfile?:
    ICVBuilderResumeProfile;
}

/* =========================================================
   COMMON HELPERS
========================================================= */

const normalizeText = (
  value: string
): string => {
  return value
    .trim()
    .replace(
      /\s+/g,
      " "
    );
};

const normalizeComparisonText = (
  value: string
): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(
      /[^\w+#.\-/ ]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
};

const uniqueStrings = (
  values: string[]
): string[] => {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const value
    of values
  ) {
    const cleaned =
      normalizeText(
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

const countMatches = (
  sourceText: string,
  terms: string[]
): number => {
  const text =
    normalizeComparisonText(
      sourceText
    );

  let score =
    0;

  for (
    const term
    of terms
  ) {
    const normalizedTerm =
      normalizeComparisonText(
        term
      );

    if (
      normalizedTerm &&
      text.includes(
        normalizedTerm
      )
    ) {
      score += 1;
    }
  }

  return score;
};

/* =========================================================
   SKILLS
========================================================= */

const buildPrimarySkills = (
  context:
    ICVEvidenceContext
): string[] => {
  return uniqueStrings(
    getSafeSkillsForCV(
      context
    )
      .filter(
        (skill) =>
          skill.requiredByJob ||
          skill.recommendedByTemplate
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.requiredByJob !==
            b.requiredByJob
          ) {
            return a.requiredByJob
              ? -1
              : 1;
          }

          if (
            a.validatedByPlatform !==
            b.validatedByPlatform
          ) {
            return a.validatedByPlatform
              ? -1
              : 1;
          }

          return (
            (
              b.confidence ||
              0
            ) -
            (
              a.confidence ||
              0
            )
          );
        }
      )
      .map(
        (skill) =>
          skill.name
      )
  ).slice(
    0,
    18
  );
};

const buildVerifiedSkills = (
  context:
    ICVEvidenceContext
): string[] => {
  return uniqueStrings(
    context.platformSkills.map(
      (skill) =>
        skill.name
    )
  );
};

const buildAdditionalSupportedSkills = (
  context:
    ICVEvidenceContext,
  primarySkills:
    string[]
): string[] => {
  const primarySet =
    new Set(
      primarySkills.map(
        (skill) =>
          skill.toLowerCase()
      )
    );

  return uniqueStrings(
    getSafeSkillsForCV(
      context
    )
      .filter(
        (skill) =>
          !primarySet.has(
            skill.name.toLowerCase()
          )
      )
      .map(
        (skill) =>
          skill.name
      )
  ).slice(
    0,
    15
  );
};

const buildSupportedKeywords = (
  context:
    ICVEvidenceContext
): string[] => {
  return uniqueStrings(
    getSafeKeywordsForCV(
      context
    ).map(
      (item) =>
        item.keyword
    )
  ).slice(
    0,
    20
  );
};

/* =========================================================
   EXPERIENCE
========================================================= */

const buildExperienceGuidance = (
  context:
    ICVEvidenceContext,
  optimization:
    ICVOptimizationResult
): string[] => {
  const result:
    string[] = [
      ...optimization
        .experienceSuggestions,
    ];

  if (
    context.template
      ?.experiencePatterns
      .length
  ) {
    for (
      const pattern
      of context.template
        .experiencePatterns
    ) {
      result.push(
        `${pattern.title}: ${pattern.description}`
      );
    }
  }

  return uniqueStrings(
    result
  );
};

const rankExperienceForJob = (
  profile:
    ICVBuilderResumeProfile,
  job:
    IJob
): IGeneratedCVExperienceItem[] => {
  const targetTerms =
    uniqueStrings([
      ...job.skills,
      ...job.keywords,
      job.title,
    ]);

  return profile.experience
    .map(
      (
        item,
        originalIndex
      ) => {
        const searchableText =
          [
            item.title,
            item.company,
            item.description,
            ...item.bullets,
            ...item.technologies,
          ]
            .filter(Boolean)
            .join(
              " "
            );

        return {
          item,
          originalIndex,

          relevance:
            countMatches(
              searchableText,
              targetTerms
            ),
        };
      }
    )
    .sort(
      (
        a,
        b
      ) => {
        if (
          b.relevance !==
          a.relevance
        ) {
          return (
            b.relevance -
            a.relevance
          );
        }

        return (
          a.originalIndex -
          b.originalIndex
        );
      }
    )
    .map(
      ({
        item,
      }) => ({
        title:
          item.title,

        company:
          item.company,

        location:
          item.location,

        employmentType:
          item.employmentType,

        startDate:
          item.startDate,

        endDate:
          item.endDate,

        isCurrent:
          item.isCurrent,

        description:
          item.description,

        bullets:
          uniqueStrings(
            item.bullets
          ),

        technologies:
          uniqueStrings(
            item.technologies
          ),
      })
    );
};

/* =========================================================
   PROJECTS
========================================================= */

const buildProjectGuidance = (
  context:
    ICVEvidenceContext,
  optimization:
    ICVOptimizationResult
): string[] => {
  const result:
    string[] = [
      ...optimization
        .projectSuggestions,
    ];

  if (
    context.template
      ?.projectPatterns
      .length
  ) {
    result.push(
      `Relevant professional reference project patterns: ${context.template.projectPatterns
        .slice(
          0,
          8
        )
        .join(
          ", "
        )}.`
    );
  }

  return uniqueStrings(
    result
  );
};

const rankProjectsForJob = (
  profile:
    ICVBuilderResumeProfile,
  job:
    IJob
): IGeneratedCVProjectItem[] => {
  const targetTerms =
    uniqueStrings([
      ...job.skills,
      ...job.keywords,
      job.title,
    ]);

  return profile.projects
    .map(
      (
        item,
        originalIndex
      ) => {
        const searchableText =
          [
            item.name,
            item.role,
            item.description,
            ...item.bullets,
            ...item.technologies,
          ]
            .filter(Boolean)
            .join(
              " "
            );

        return {
          item,
          originalIndex,

          relevance:
            countMatches(
              searchableText,
              targetTerms
            ),
        };
      }
    )
    .sort(
      (
        a,
        b
      ) => {
        if (
          b.relevance !==
          a.relevance
        ) {
          return (
            b.relevance -
            a.relevance
          );
        }

        return (
          a.originalIndex -
          b.originalIndex
        );
      }
    )
    .map(
      ({
        item,
      }) => ({
        name:
          item.name,

        role:
          item.role,

        description:
          item.description,

        startDate:
          item.startDate,

        endDate:
          item.endDate,

        technologies:
          uniqueStrings(
            item.technologies
          ),

        bullets:
          uniqueStrings(
            item.bullets
          ),

        url:
          item.url,

        github:
          item.github,
      })
    );
};

/* =========================================================
   EDUCATION
========================================================= */

const buildEducation = (
  profile:
    ICVBuilderResumeProfile
): IGeneratedCVEducationItem[] => {
  return profile.education.map(
    (
      item
    ) => ({
      institution:
        item.institution,

      degree:
        item.degree,

      field:
        item.field,

      location:
        item.location,

      startDate:
        item.startDate,

      endDate:
        item.endDate,

      isCurrent:
        item.isCurrent,

      gpa:
        item.gpa,

      coursework:
        uniqueStrings(
          item.coursework
        ),

      achievements:
        uniqueStrings(
          item.achievements
        ),
    })
  );
};

/* =========================================================
   CERTIFICATIONS
========================================================= */

const buildCertifications = (
  profile:
    ICVBuilderResumeProfile
): IGeneratedCVCertificationItem[] => {
  return profile.certifications.map(
    (
      item
    ) => ({
      name:
        item.name,

      issuer:
        item.issuer,

      issueDate:
        item.issueDate,

      expirationDate:
        item.expirationDate,

      credentialId:
        item.credentialId,

      credentialUrl:
        item.credentialUrl,

      status:
        item.status,
    })
  );
};

/* =========================================================
   LANGUAGES
========================================================= */

const buildLanguages = (
  profile:
    ICVBuilderResumeProfile
): IGeneratedCVLanguageItem[] => {
  return profile.languages.map(
    (
      item
    ) => ({
      language:
        item.language,

      level:
        item.level,
    })
  );
};

/* =========================================================
   VOLUNTEERING
========================================================= */

const buildVolunteering = (
  profile:
    ICVBuilderResumeProfile
): IGeneratedCVVolunteerItem[] => {
  return profile.volunteering.map(
    (
      item
    ) => ({
      organization:
        item.organization,

      role:
        item.role,

      location:
        item.location,

      startDate:
        item.startDate,

      endDate:
        item.endDate,

      isCurrent:
        item.isCurrent,

      description:
        item.description,

      bullets:
        uniqueStrings(
          item.bullets
        ),
    })
  );
};

/* =========================================================
   HACKATHONS / COMPETITIONS
========================================================= */

const buildHackathons = (
  profile:
    ICVBuilderResumeProfile
): IGeneratedCVHackathonItem[] => {
  return (
    profile.hackathons ??
    []
  ).map(
    (item) => ({
      name:
        item.name,

      organization:
        item.organization,

      role:
        item.role,

      date:
        item.date,

      description:
        item.description,

      achievements:
        uniqueStrings(
          item.achievements
        ),
    })
  );
};

/* =========================================================
   WARNINGS
========================================================= */

const buildWarnings = (
  context:
    ICVEvidenceContext,
  profile:
    ICVBuilderResumeProfile
): string[] => {
  const warnings:
    string[] = [];

  const missingSkills =
    getMissingJobSkills(
      context
    );

  if (
    missingSkills.length >
    0
  ) {
    warnings.push(
      `Do not automatically add these unverified target-job skills: ${missingSkills
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )}.`
    );
  }

  const platformOnly =
    getPlatformSkillsMissingFromResume(
      context
    );

  if (
    platformOnly.length >
    0
  ) {
    warnings.push(
      `InterviewIQ has evidence for skills not currently visible in the uploaded CV: ${platformOnly
        .map(
          (skill) =>
            skill.name
        )
        .join(
          ", "
        )}. Add them only where they can be represented truthfully.`
    );
  }

  if (
    profile.extractionStatus ===
    "partial"
  ) {
    warnings.push(
      "The uploaded resume was only partially extracted. Review generated CV data before export."
    );
  }

  if (
    profile.extractionWarnings
      .length >
    0
  ) {
    warnings.push(
      ...profile
        .extractionWarnings
    );
  }

  warnings.push(
    "Do not invent employment history, project outcomes, certifications, education, dates, metrics, employers, clients, or responsibilities."
  );

  warnings.push(
    "Professional reference CVs are used for structure and writing guidance only. Their personal facts must never be copied into the user's CV."
  );

  return uniqueStrings(
    warnings
  );
};

/* =========================================================
   BUILD OPTIMIZED CV
========================================================= */

export const buildOptimizedCV =
  async ({
    userId,
    resume,
    job,
    sourceProfile,
  }: BuildOptimizedCVParams): Promise<IGeneratedCVData> => {
    /*
     * Get:
     *
     * 1. CV evidence
     * 2. optimization plan
     * 3. structured ResumeProfile
     */

    const [
      context,
      optimization,
      profile,
    ] =
      await Promise.all([
        buildCVEvidenceContext({
          userId,
          resume,
          job,
        }),

        optimizeCVForJob({
          userId,
          resume,
          job,
        }),

        sourceProfile
          ? Promise.resolve(
              sourceProfile
            )
          : getResumeProfileForBuilder(
              userId,
              resume._id
            ),
      ]);

    /*
     * Builder cannot create a real CV without
     * structured source information.
     */

    if (!profile) {
      throw new Error(
        "Structured resume profile was not found. Please analyze the resume again before generating an improved CV."
      );
    }

    /* =====================================================
       SKILLS
    ===================================================== */

    const targetedPrimarySkills =
      buildPrimarySkills(
        context
      );

    /*
     * A low-match vacancy may have zero supported target skills.
     * That must NOT erase the candidate's real skill section.
     *
     * We preserve genuine ResumeProfile skills as a fallback and
     * never add unsupported vacancy-only skills.
     */
    const profileSkillFallback =
      uniqueStrings([
        ...profile
          .technicalSkills,
        ...profile
          .skills,
      ]).slice(
        0,
        18
      );

    const primarySkills =
      targetedPrimarySkills
        .length >
        0
        ? targetedPrimarySkills
        : profileSkillFallback;

    const verifiedSkills =
      buildVerifiedSkills(
        context
      );

    const additionalSupportedSkills =
      buildAdditionalSupportedSkills(
        context,
        primarySkills
      );

    const keywords =
      buildSupportedKeywords(
        context
      );

    /* =====================================================
       REAL USER CONTENT
    ===================================================== */

    /*
     * Lossless source mapping:
     * final CV content preserves the original resume order.
     * Job relevance may influence guidance/analysis, but must not
     * reorder, replace, or remove the candidate's factual entries.
     */
    const experienceItems:
      IGeneratedCVExperienceItem[] =
      profile.experience.map(
        (item) => ({
          title:
            item.title,

          company:
            item.company,

          location:
            item.location,

          employmentType:
            item.employmentType,

          startDate:
            item.startDate,

          endDate:
            item.endDate,

          isCurrent:
            item.isCurrent,

          description:
            item.description,

          bullets:
            uniqueStrings(
              item.bullets
            ),

          technologies:
            uniqueStrings(
              item.technologies
            ),
        })
      );

    const projectItems:
      IGeneratedCVProjectItem[] =
      profile.projects.map(
        (item) => ({
          name:
            item.name,

          role:
            item.role,

          description:
            item.description,

          startDate:
            item.startDate,

          endDate:
            item.endDate,

          technologies:
            uniqueStrings(
              item.technologies
            ),

          bullets:
            uniqueStrings(
              item.bullets
            ),

          url:
            item.url,

          github:
            item.github,
        })
      );

    const educationItems =
      buildEducation(
        profile
      );

    const certificationItems =
      buildCertifications(
        profile
      );

    const languageItems =
      buildLanguages(
        profile
      );

    const volunteeringItems =
      buildVolunteering(
        profile
      );

    const hackathonItems =
      buildHackathons(
        profile
      );

    /* =====================================================
       GUIDANCE
    ===================================================== */

    const experienceGuidance =
      buildExperienceGuidance(
        context,
        optimization
      );

    const projectGuidance =
      buildProjectGuidance(
        context,
        optimization
      );

    const warnings =
      buildWarnings(
        context,
        profile
      );

    /* =====================================================
       FINAL GENERATED STRUCTURE
    ===================================================== */

    return {
      metadata: {
        targetJob: {
          id:
            job._id
              ?.toString(),

          title:
            job.title,

          company:
            job.company,
        },

        sourceResume: {
          id:
            resume._id
              ?.toString(),

          profileId:
            profile.id,

          fileName:
            resume.fileName,
        },

        template:
          optimization
            .templateUsed
            ? {
                id:
                  optimization
                    .templateUsed
                    .id,

                role:
                  optimization
                    .templateUsed
                    .role,

                displayName:
                  optimization
                    .templateUsed
                    .displayName,

                matchScore:
                  optimization
                    .templateUsed
                    .matchScore,
              }
            : null,

        generatedAt:
          new Date()
            .toISOString(),

        strategy:
          "optimize-existing-resume",
      },

      /* ===================================================
         CONTACT

         This always comes from the user's actual CV.
      =================================================== */

      contact: {
        fullName:
          profile.contact
            .fullName,

        email:
          profile.contact
            .email,

        phone:
          profile.contact
            .phone,

        location:
          profile.contact
            .location,

        linkedin:
          profile.contact
            .linkedin,

        github:
          profile.contact
            .github,

        website:
          profile.contact
            .website,
      },

      /* ===================================================
         SUMMARY

         This is the new tailored summary produced by the
         optimization service.
      =================================================== */

      /*
       * The final PDF must never receive an AI-authored factual
       * summary. Preserve only the summary extracted from the
       * candidate's source resume.
       */
      professionalSummary:
        profile.professionalSummary,

      /* ===================================================
         SKILLS
      =================================================== */

      /*
       * Final rendered skills come only from the uploaded resume.
       * Platform/job/template skills remain analysis metadata and
       * are not inserted into the candidate's CV automatically.
       */
      skills: {
        primary:
          uniqueStrings([
            ...profile.technicalSkills,
            ...profile.skills,
          ]),

        verified:
          [],

        additionalSupported:
          [],

        missingForTargetJob:
          optimization
            .missingSkills,
      },

      keywords:
        [],

      /* ===================================================
         EXPERIENCE

         Real user experience.
         Only relevance ordering changes.
         Facts are not invented.
      =================================================== */

      experience: {
        guidance:
          experienceGuidance,

        items:
          experienceItems,
      },

      /* ===================================================
         PROJECTS

         Real user projects.
         Most target-job-relevant projects appear first.
      =================================================== */

      projects: {
        guidance:
          projectGuidance,

        items:
          projectItems,
      },

      /* ===================================================
         EDUCATION
      =================================================== */

      education: {
        title:
          "Education",

        items:
          educationItems,
      },

      /* ===================================================
         CERTIFICATIONS
      =================================================== */

      certifications: {
        title:
          "Certifications",

        items:
          certificationItems,
      },

      /* ===================================================
         LANGUAGES
      =================================================== */

      languages: {
        title:
          "Languages",

        items:
          languageItems,
      },

      /* ===================================================
         VOLUNTEERING
      =================================================== */

      volunteering: {
        title:
          "Volunteering",

        items:
          volunteeringItems,
      },

      hackathons: {
        title:
          "Hackathons & Competitions",

        items:
          hackathonItems,
      },

      /* ===================================================
         ACHIEVEMENTS
      =================================================== */

      achievements: {
        title:
          "Achievements",

        items:
          uniqueStrings(
            profile.achievements
          ),
      },

      /* ===================================================
         INTERESTS
      =================================================== */

      interests: {
        title:
          "Interests",

        items:
          uniqueStrings(
            profile.interests
          ),
      },

      /* ===================================================
         ATS
      =================================================== */

      ats: {
        score:
          resume.atsScore,

        suggestions:
          optimization
            .atsSuggestions,
      },

      formatting: {
        suggestions:
          optimization
            .formattingSuggestions,
      },

      /* ===================================================
         EVIDENCE TRACE

         Useful for debugging and later frontend display.
      =================================================== */

      sourceEvidence: {
        resumeSkills:
          resume
            .skillsDetected,

        platformVerifiedSkills:
          verifiedSkills,

        platformSkillsMissingFromResume:
          optimization
            .platformSkillsMissingFromResume,

        safeSkillsForCV:
          optimization
            .safeSkillsForCV,

        matchedSkills:
          optimization
            .matchedSkills,

        missingSkills:
          optimization
            .missingSkills,
      },

      optimization: {
        currentResumeScore:
          optimization
            .currentResumeScore,

        currentJobMatchScore:
          optimization
            .currentJobMatchScore,

        priorityActions:
          optimization
            .priorityActions,

        sectionsToImprove:
          optimization
            .sectionsToImprove,
      },

      warnings,
    };
  };

/* =========================================================
   BUILD GENERAL IMPROVED CV
   Vacancy is optional. No synthetic job is created.
========================================================= */

export const buildGeneralImprovedCV =
  async ({
    userId,
    resume,
    sourceProfile,
  }: {
    userId:
      | Types.ObjectId
      | string;

    resume:
      IResumeAnalysis;

    sourceProfile?:
      ICVBuilderResumeProfile;
  }): Promise<IGeneratedCVData> => {
    const [
      context,
      optimization,
      profile,
    ] =
      await Promise.all([
        buildGeneralCVEvidenceContext({
          userId,
          resume,
        }),

        optimizeCVGenerally({
          userId,
          resume,
        }),

        sourceProfile
          ? Promise.resolve(
              sourceProfile
            )
          : getResumeProfileForBuilder(
              userId,
              resume._id
            ),
      ]);

    if (!profile) {
      throw new Error(
        "Structured resume profile was not found. Please analyze the resume again before generating an improved CV."
      );
    }

    const safeSkills =
      getSafeSkillsForGeneralCV(
        context
      );

    const platformOnly =
      getPlatformSkillsMissingFromResumeGeneral(
        context
      );

    const verifiedSkills =
      uniqueStrings(
        context.platformSkills.map(
          (skill) =>
            skill.name
        )
      );

    const evidencePrimarySkills =
      uniqueStrings(
        safeSkills
          .sort(
            (
              a,
              b
            ) => {
              if (
                a.validatedByPlatform !==
                b.validatedByPlatform
              ) {
                return a.validatedByPlatform
                  ? -1
                  : 1;
              }

              return (
                (
                  b.averageScore ||
                  0
                ) -
                (
                  a.averageScore ||
                  0
                )
              );
            }
          )
          .map(
            (skill) =>
              skill.name
          )
      ).slice(
        0,
        18
      );

    const primarySkills =
      evidencePrimarySkills
        .length >
        0
        ? evidencePrimarySkills
        : uniqueStrings([
            ...profile
              .technicalSkills,
            ...profile
              .skills,
          ]).slice(
            0,
            18
          );

    const primarySet =
      new Set(
        primarySkills.map(
          (skill) =>
            skill.toLowerCase()
        )
      );

    const additionalSupportedSkills =
      uniqueStrings(
        safeSkills
          .filter(
            (skill) =>
              !primarySet.has(
                skill.name.toLowerCase()
              )
          )
          .map(
            (skill) =>
              skill.name
          )
      ).slice(
        0,
        15
      );

    /*
     * General mode preserves the user's actual ordering.
     * We do not rank experience/projects against a fake job.
     */

    const experienceItems:
      IGeneratedCVExperienceItem[] =
      profile.experience.map(
        (item) => ({
          title:
            item.title,

          company:
            item.company,

          location:
            item.location,

          employmentType:
            item.employmentType,

          startDate:
            item.startDate,

          endDate:
            item.endDate,

          isCurrent:
            item.isCurrent,

          description:
            item.description,

          bullets:
            uniqueStrings(
              item.bullets
            ),

          technologies:
            uniqueStrings(
              item.technologies
            ),
        })
      );

    const projectItems:
      IGeneratedCVProjectItem[] =
      profile.projects.map(
        (item) => ({
          name:
            item.name,

          role:
            item.role,

          description:
            item.description,

          startDate:
            item.startDate,

          endDate:
            item.endDate,

          technologies:
            uniqueStrings(
              item.technologies
            ),

          bullets:
            uniqueStrings(
              item.bullets
            ),

          url:
            item.url,

          github:
            item.github,
        })
      );

    const educationItems =
      buildEducation(
        profile
      );

    const certificationItems =
      buildCertifications(
        profile
      );

    const languageItems =
      buildLanguages(
        profile
      );

    const volunteeringItems =
      buildVolunteering(
        profile
      );

    const hackathonItems =
      buildHackathons(
        profile
      );

    const warnings =
      uniqueStrings([
        platformOnly.length > 0
          ? `InterviewIQ has evidence for skills not currently visible in the uploaded CV: ${platformOnly
              .map(
                (skill) =>
                  skill.name
              )
              .join(
                ", "
              )}. Add them only where they can be represented truthfully.`
          : "",

        ...(profile.extractionStatus ===
        "partial"
          ? [
              "The uploaded resume was only partially extracted. Review generated CV data before export.",
            ]
          : []),

        ...(profile.extractionWarnings ??
          []),

        "Do not invent employment history, project outcomes, certifications, education, dates, metrics, employers, clients, responsibilities, or technologies.",

        "General improvement does not use a synthetic vacancy. Preserve strong factual content and improve weak content using supported evidence only.",
      ]);

    return {
      metadata: {
        targetJob:
          null,

        sourceResume: {
          id:
            resume._id
              ?.toString(),

          profileId:
            profile.id,

          fileName:
            resume.fileName,
        },

        template:
          null,

        generatedAt:
          new Date()
            .toISOString(),

        strategy:
          "general-improvement",
      },

      contact: {
        fullName:
          profile.contact
            .fullName,

        email:
          profile.contact
            .email,

        phone:
          profile.contact
            .phone,

        location:
          profile.contact
            .location,

        linkedin:
          profile.contact
            .linkedin,

        github:
          profile.contact
            .github,

        website:
          profile.contact
            .website,
      },

      professionalSummary:
        profile.professionalSummary,

      skills: {
        primary:
          uniqueStrings([
            ...profile.technicalSkills,
            ...profile.skills,
          ]),

        verified:
          [],

        additionalSupported:
          [],

        missingForTargetJob:
          [],
      },

      keywords:
        [],

      experience: {
        guidance:
          optimization
            .experienceSuggestions,

        items:
          experienceItems,
      },

      projects: {
        guidance:
          optimization
            .projectSuggestions,

        items:
          projectItems,
      },

      education: {
        title:
          "Education",

        items:
          educationItems,
      },

      certifications: {
        title:
          "Certifications",

        items:
          certificationItems,
      },

      languages: {
        title:
          "Languages",

        items:
          languageItems,
      },

      volunteering: {
        title:
          "Volunteering",

        items:
          volunteeringItems,
      },

      hackathons: {
        title:
          "Hackathons & Competitions",

        items:
          hackathonItems,
      },

      achievements: {
        title:
          "Achievements",

        items:
          uniqueStrings(
            profile.achievements
          ),
      },

      interests: {
        title:
          "Interests",

        items:
          uniqueStrings(
            profile.interests
          ),
      },

      ats: {
        score:
          resume.atsScore,

        suggestions:
          optimization
            .atsSuggestions,
      },

      formatting: {
        suggestions:
          optimization
            .formattingSuggestions,
      },

      sourceEvidence: {
        resumeSkills:
          resume.skillsDetected ??
          [],

        platformVerifiedSkills:
          verifiedSkills,

        platformSkillsMissingFromResume:
          platformOnly.map(
            (skill) =>
              skill.name
          ),

        safeSkillsForCV:
          safeSkills.map(
            (skill) =>
              skill.name
          ),

        matchedSkills:
          [],

        missingSkills:
          [],
      },

      optimization: {
        currentResumeScore:
          optimization
            .currentResumeScore,

        currentJobMatchScore:
          0,

        priorityActions:
          optimization
            .priorityActions,

        sectionsToImprove:
          optimization
            .sectionsToImprove,
      },

      warnings,
    };
  };
