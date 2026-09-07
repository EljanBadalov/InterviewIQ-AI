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
  type IResumeTemplate,
} from "../models/ResumeTemplate";

import {
  getValidatedUserSkills,
  type IValidatedUserSkill,
} from "./userSkillProfileService";

import {
  findBestResumeTemplateForJob,
} from "./resumeTemplateService";

import {
  calculateJobMatch,
  type IJobMatchResult,
} from "./jobMatchingService";

export interface ICVSkillEvidence {
  name: string;

  normalizedName: string;

  presentInResume: boolean;

  validatedByPlatform: boolean;

  requiredByJob: boolean;

  recommendedByTemplate: boolean;

  confidence?: number;

  averageScore?: number;

  evidenceCount?: number;

  level?:
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

  sources: string[];

  status:
  | "strong"
  | "supported"
  | "resume-only"
  | "platform-only"
  | "missing";
}

export interface ICVKeywordEvidence {
  keyword: string;

  presentInResume: boolean;

  requiredByJob: boolean;

  recommendedByTemplate: boolean;

  safeToRecommend: boolean;
}

export interface ICVEvidenceContext {
  userId: string;

  resume: {
    id?: string;

    fileName: string;

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
  };

  job: {
    id?: string;

    title: string;

    company: string;

    location: string;

    remoteType: string;

    employmentType: string;

    experienceMin: number;

    experienceMax: number | null;

    description: string;

    requirements: string[];

    responsibilities: string[];

    preferredQualifications: string[];

    skills: string[];

    keywords: string[];

    education: string[];

    salary: number;
  };

  template: {
    id?: string;

    role: string;

    displayName: string;

    score: number;

    reasons: string[];

    matchedTerms: string[];

    coreSkills: string[];

    technicalSkills: string[];

    softSkills: string[];

    atsKeywords: string[];

    sections: Array<{
      type: string;

      title: string;

      order: number;

      required: boolean;

      guidance: string[];
    }>;

    experiencePatterns: Array<{
      title: string;

      description: string;

      examples: string[];
    }>;

    projectPatterns: string[];

    educationPatterns: string[];

    certificationPatterns: string[];

    formattingRules: string[];

    resumeWritingRules: string[];
  } | null;

  platformSkills: IValidatedUserSkill[];

  skillEvidence: ICVSkillEvidence[];

  keywordEvidence: ICVKeywordEvidence[];

  match: IJobMatchResult;

  evidenceSummary: {
    totalResumeSkills: number;

    totalValidatedSkills: number;

    totalJobSkills: number;

    matchedJobSkills: number;

    missingJobSkills: number;

    platformSupportedJobSkills: number;

    templateRelevantSkills: number;
  };
}

export interface IGeneralCVEvidenceContext {
  userId: string;

  resume: ICVEvidenceContext["resume"];

  platformSkills: IValidatedUserSkill[];

  skillEvidence: ICVSkillEvidence[];

  evidenceSummary: {
    totalResumeSkills: number;
    totalValidatedSkills: number;
    platformSkillsMissingFromResume: number;
  };
}

interface BuildGeneralCVEvidenceContextParams {
  userId:
  | Types.ObjectId
  | string;

  resume:
  IResumeAnalysis;
}

interface BuildCVEvidenceContextParams {
  userId:
  | Types.ObjectId
  | string;

  resume:
  IResumeAnalysis;

  job:
  IJob;
}

const normalizeText = (
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

const normalizeSkill = (
  value: string
): string => {
  const normalized =
    normalizeText(
      value
    );

  const aliases: Record<
    string,
    string
  > = {
    js: "javascript",
    javascript:
      "javascript",

    ts: "typescript",
    typescript:
      "typescript",

    reactjs: "react",
    "react.js": "react",
    react: "react",

    nextjs: "next.js",
    "next.js": "next.js",

    node: "node.js",
    nodejs: "node.js",
    "node.js": "node.js",

    expressjs: "express",
    "express.js": "express",
    express: "express",

    mongo: "mongodb",
    mongodb: "mongodb",

    postgres: "postgresql",
    postgresql: "postgresql",

    html5: "html",
    html: "html",

    css3: "css",
    css: "css",

    restful: "rest api",
    rest: "rest api",
    api: "rest api",
    "rest api": "rest api",
    "restful api":
      "rest api",

    k8s: "kubernetes",
    kubernetes:
      "kubernetes",

    cicd: "ci/cd",
    "ci cd": "ci/cd",
    "ci/cd": "ci/cd",

    ml:
      "machine learning",
    "machine learning":
      "machine learning",

    ai:
      "artificial intelligence",
    "artificial intelligence":
      "artificial intelligence",

    sklearn:
      "scikit-learn",
    "scikit learn":
      "scikit-learn",
    "scikit-learn":
      "scikit-learn",

    pentesting:
      "penetration testing",
    pentest:
      "penetration testing",
    "penetration testing":
      "penetration testing",

    redteam:
      "red team",
    "red teaming":
      "red team",
    "red team":
      "red team",

    "data structures and algorithms":
      "data structures",
    dsa:
      "data structures",

    "solid-principles":
      "solid principles",
    "solid principles":
      "solid principles",

    oop:
      "object-oriented programming",
    "object oriented programming":
      "object-oriented programming",
    "object-oriented programming":
      "object-oriented programming",
  };

  return (
    aliases[normalized] ||
    normalized
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
      value.trim();

    if (!cleaned) {
      continue;
    }

    const normalized =
      cleaned.toLowerCase();

    if (
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      cleaned
    );
  }

  return result;
};

const getDisplaySkillName = (
  normalizedName: string,
  candidateNames: string[]
): string => {
  const directMatch =
    candidateNames.find(
      (name) =>
        normalizeSkill(
          name
        ) ===
        normalizedName
    );

  if (
    directMatch
  ) {
    return directMatch;
  }

  const displayNames: Record<
    string,
    string
  > = {
    javascript:
      "JavaScript",

    typescript:
      "TypeScript",

    react:
      "React",

    "next.js":
      "Next.js",

    "node.js":
      "Node.js",

    express:
      "Express",

    mongodb:
      "MongoDB",

    postgresql:
      "PostgreSQL",

    mysql:
      "MySQL",

    "rest api":
      "REST API",

    graphql:
      "GraphQL",

    git:
      "Git",

    github:
      "GitHub",

    "ci/cd":
      "CI/CD",

    docker:
      "Docker",

    python:
      "Python",

    pandas:
      "Pandas",

    numpy:
      "NumPy",

    tensorflow:
      "TensorFlow",

    pytorch:
      "PyTorch",

    "scikit-learn":
      "Scikit-learn",

    "machine learning":
      "Machine Learning",

    "artificial intelligence":
      "Artificial Intelligence",

    sql:
      "SQL",

    linux:
      "Linux",

    "penetration testing":
      "Penetration Testing",

    "red team":
      "Red Team",

    siem:
      "SIEM",

    splunk:
      "Splunk",

    "data structures":
      "Data Structures",

    algorithms:
      "Algorithms",

    "solid principles":
      "SOLID Principles",

    "object-oriented programming":
      "Object-Oriented Programming",
  };

  if (
    displayNames[
    normalizedName
    ]
  ) {
    return displayNames[
      normalizedName
    ];
  }

  return normalizedName
    .split(" ")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
};

const buildSkillEvidence = (
  resume:
    IResumeAnalysis,
  job:
    IJob,
  template:
    IResumeTemplate | null,
  platformSkills:
    IValidatedUserSkill[]
): ICVSkillEvidence[] => {
  const resumeSkills =
    uniqueStrings(
      resume.skillsDetected
    );

  const jobSkills =
    uniqueStrings(
      (job.skills ?? [])
    );

  const templateSkills =
    template
      ? uniqueStrings([
        ...template.coreSkills,
        ...template.technicalSkills,
      ])
      : [];

  const allNames =
    uniqueStrings([
      ...resumeSkills,
      ...jobSkills,
      ...templateSkills,
      ...platformSkills.map(
        (skill) =>
          skill.name
      ),
    ]);

  const resumeSet =
    new Set(
      resumeSkills.map(
        normalizeSkill
      )
    );

  const jobSet =
    new Set(
      jobSkills.map(
        normalizeSkill
      )
    );

  const templateSet =
    new Set(
      templateSkills.map(
        normalizeSkill
      )
    );

  const platformMap =
    new Map(
      platformSkills.map(
        (skill) => [
          normalizeSkill(
            skill.name
          ),
          skill,
        ]
      )
    );

  const normalizedNames =
    uniqueStrings(
      allNames.map(
        normalizeSkill
      )
    );

  return normalizedNames.map(
    (
      normalizedName
    ): ICVSkillEvidence => {
      const presentInResume =
        resumeSet.has(
          normalizedName
        );

      const requiredByJob =
        jobSet.has(
          normalizedName
        );

      const recommendedByTemplate =
        templateSet.has(
          normalizedName
        );

      const platformSkill =
        platformMap.get(
          normalizedName
        );

      const validatedByPlatform =
        Boolean(
          platformSkill
        );

      let status:
        ICVSkillEvidence["status"];

      if (
        presentInResume &&
        validatedByPlatform
      ) {
        status =
          "strong";
      } else if (
        validatedByPlatform
      ) {
        status =
          "platform-only";
      } else if (
        presentInResume
      ) {
        status =
          "resume-only";
      } else if (
        requiredByJob ||
        recommendedByTemplate
      ) {
        status =
          "missing";
      } else {
        status =
          "supported";
      }

      const sources:
        string[] = [];

      if (
        presentInResume
      ) {
        sources.push(
          "resume"
        );
      }

      if (
        validatedByPlatform
      ) {
        sources.push(
          "platform"
        );

        sources.push(
          ...(
            platformSkill
              ?.sources ||
            []
          )
        );
      }

      if (
        requiredByJob
      ) {
        sources.push(
          "job"
        );
      }

      if (
        recommendedByTemplate
      ) {
        sources.push(
          "professional-template"
        );
      }

      return {
        name:
          getDisplaySkillName(
            normalizedName,
            allNames
          ),

        normalizedName,

        presentInResume,

        validatedByPlatform,

        requiredByJob,

        recommendedByTemplate,

        confidence:
          platformSkill
            ?.confidence,

        averageScore:
          platformSkill
            ?.averageScore,

        evidenceCount:
          platformSkill
            ?.evidenceCount,

        level:
          platformSkill
            ?.level,

        sources:
          uniqueStrings(
            sources
          ),

        status,
      };
    }
  );
};

const buildKeywordEvidence = (
  resume:
    IResumeAnalysis,
  job:
    IJob,
  template:
    IResumeTemplate | null,
  skillEvidence:
    ICVSkillEvidence[]
): ICVKeywordEvidence[] => {
  const resumeText =
    normalizeText(
      [
        resume.summary,

        ...resume.skillsDetected,

        ...resume.strengths,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const jobKeywords =
    uniqueStrings(
      (job.keywords ?? [])
    );

  const templateKeywords =
    template
      ? uniqueStrings(
        template.atsKeywords
      )
      : [];

  const keywords =
    uniqueStrings([
      ...jobKeywords,
      ...templateKeywords,
    ]);

  const jobKeywordSet =
    new Set(
      jobKeywords.map(
        normalizeText
      )
    );

  const templateKeywordSet =
    new Set(
      templateKeywords.map(
        normalizeText
      )
    );

  const safeSkillSet =
    new Set(
      skillEvidence
        .filter(
          (skill) =>
            skill.presentInResume ||
            skill.validatedByPlatform
        )
        .map(
          (skill) =>
            skill.normalizedName
        )
    );

  return keywords.map(
    (
      keyword
    ): ICVKeywordEvidence => {
      const normalizedKeyword =
        normalizeText(
          keyword
        );

      const normalizedSkillKeyword =
        normalizeSkill(
          keyword
        );

      const presentInResume =
        resumeText.includes(
          normalizedKeyword
        );

      const requiredByJob =
        jobKeywordSet.has(
          normalizedKeyword
        );

      const recommendedByTemplate =
        templateKeywordSet.has(
          normalizedKeyword
        );

      const safeToRecommend =
        presentInResume ||
        safeSkillSet.has(
          normalizedSkillKeyword
        );

      return {
        keyword,

        presentInResume,

        requiredByJob,

        recommendedByTemplate,

        safeToRecommend,
      };
    }
  );
};

export const buildCVEvidenceContext =
  async ({
    userId,
    resume,
    job,
  }: BuildCVEvidenceContextParams): Promise<ICVEvidenceContext> => {
    const [
      platformSkills,
      templateMatch,
    ] =
      await Promise.all([
        getValidatedUserSkills(
          userId
        ),

        findBestResumeTemplateForJob(
          job
        ),
      ]);

    const template =
      templateMatch
        ?.template ||
      null;

    const skillEvidence =
      buildSkillEvidence(
        resume,
        job,
        template,
        platformSkills
      );

    const keywordEvidence =
      buildKeywordEvidence(
        resume,
        job,
        template,
        skillEvidence
      );

    const match =
      calculateJobMatch(
        resume,
        job
      );

    const platformSupportedJobSkills =
      skillEvidence.filter(
        (skill) =>
          skill.requiredByJob &&
          skill.validatedByPlatform
      ).length;

    const templateRelevantSkills =
      skillEvidence.filter(
        (skill) =>
          skill.recommendedByTemplate
      ).length;

    return {
      userId:
        userId.toString(),

      resume: {
        id:
          resume._id
            ?.toString(),

        fileName:
          resume.fileName,

        overallScore:
          resume.overallScore,

        atsScore:
          resume.atsScore,

        contentScore:
          resume.contentScore,

        structureScore:
          resume.structureScore,

        skillsScore:
          resume.skillsScore,

        experienceScore:
          resume.experienceScore,

        summary:
          resume.summary,

        skillsDetected:
          resume.skillsDetected,

        strengths:
          resume.strengths,

        weaknesses:
          resume.weaknesses,

        missingSkills:
          resume.missingSkills,

        atsSuggestions:
          resume.atsSuggestions,

        formattingFeedback:
          resume.formattingFeedback,

        recommendations:
          resume.recommendations,
      },

      job: {
        id:
          job._id
            ?.toString(),

        title:
          job.title,

        company:
          job.company,

        location:
          job.location,

        remoteType:
          job.remoteType,

        employmentType:
          job.employmentType,

        experienceMin:
          job.experienceMin,

        experienceMax:
          job.experienceMax,

        description:
          job.description,

        requirements:
          (job.requirements ?? []),

        responsibilities:
          (job.responsibilities ?? []),

        preferredQualifications:
          (job.preferredQualifications ?? []),

        skills:
          (job.skills ?? []),

        keywords:
          (job.keywords ?? []),

        education:
          (job.education ?? []),

        salary:
          job.salary,
      },

      template:
        template &&
          templateMatch
          ? {
            id:
              template._id
                ?.toString(),

            role:
              template.role,

            displayName:
              template.displayName,

            score:
              templateMatch.score,

            reasons:
              templateMatch.reasons,

            matchedTerms:
              templateMatch.matchedTerms,

            coreSkills:
              template.coreSkills,

            technicalSkills:
              template.technicalSkills,

            softSkills:
              template.softSkills,

            atsKeywords:
              template.atsKeywords,

            sections:
              template.sections
                .sort(
                  (
                    a,
                    b
                  ) =>
                    a.order -
                    b.order
                )
                .map(
                  (section) => ({
                    type:
                      section.type,

                    title:
                      section.title,

                    order:
                      section.order,

                    required:
                      section.required,

                    guidance:
                      section.guidance,
                  })
                ),

            experiencePatterns:
              template.experiencePatterns.map(
                (pattern) => ({
                  title:
                    pattern.title,

                  description:
                    pattern.description,

                  examples:
                    pattern.examples,
                })
              ),

            projectPatterns:
              template.projectPatterns,

            educationPatterns:
              template.educationPatterns,

            certificationPatterns:
              template.certificationPatterns,

            formattingRules:
              template.formattingRules,

            resumeWritingRules:
              template.resumeWritingRules,
          }
          : null,

      platformSkills,

      skillEvidence,

      keywordEvidence,

      match,

      evidenceSummary: {
        totalResumeSkills:
          resume.skillsDetected.length,

        totalValidatedSkills:
          platformSkills.length,

        totalJobSkills:
          (job.skills ?? []).length,

        matchedJobSkills:
          match.matchedSkills.length,

        missingJobSkills:
          match.missingSkills.length,

        platformSupportedJobSkills,

        templateRelevantSkills,
      },
    };
  };

/* =========================================================
   GENERAL CV EVIDENCE

   No vacancy is required here. General improvement uses only:
   - skills already present in the resume
   - platform-validated skills

   It does not create a synthetic job and does not treat
   professional-template-only skills as candidate facts.
========================================================= */

export const buildGeneralCVEvidenceContext =
  async ({
    userId,
    resume,
  }: BuildGeneralCVEvidenceContextParams): Promise<IGeneralCVEvidenceContext> => {
    const platformSkills =
      await getValidatedUserSkills(
        userId
      );

    const resumeSkills =
      uniqueStrings(
        resume.skillsDetected ?? []
      );

    const allNames =
      uniqueStrings([
        ...resumeSkills,

        ...platformSkills.map(
          (skill) =>
            skill.name
        ),
      ]);

    const resumeSet =
      new Set(
        resumeSkills.map(
          normalizeSkill
        )
      );

    const platformMap =
      new Map(
        platformSkills.map(
          (skill) => [
            normalizeSkill(
              skill.name
            ),
            skill,
          ]
        )
      );

    const normalizedNames =
      uniqueStrings(
        allNames.map(
          normalizeSkill
        )
      );

    const skillEvidence =
      normalizedNames.map(
        (
          normalizedName
        ): ICVSkillEvidence => {
          const presentInResume =
            resumeSet.has(
              normalizedName
            );

          const platformSkill =
            platformMap.get(
              normalizedName
            );

          const validatedByPlatform =
            Boolean(
              platformSkill
            );

          let status:
            ICVSkillEvidence["status"];

          if (
            presentInResume &&
            validatedByPlatform
          ) {
            status =
              "strong";
          } else if (
            validatedByPlatform
          ) {
            status =
              "platform-only";
          } else {
            status =
              "resume-only";
          }

          const sources:
            string[] = [];

          if (
            presentInResume
          ) {
            sources.push(
              "resume"
            );
          }

          if (
            validatedByPlatform
          ) {
            sources.push(
              "platform"
            );

            sources.push(
              ...(
                platformSkill
                  ?.sources ||
                []
              )
            );
          }

          return {
            name:
              getDisplaySkillName(
                normalizedName,
                allNames
              ),

            normalizedName,

            presentInResume,

            validatedByPlatform,

            requiredByJob:
              false,

            recommendedByTemplate:
              false,

            confidence:
              platformSkill
                ?.confidence,

            averageScore:
              platformSkill
                ?.averageScore,

            evidenceCount:
              platformSkill
                ?.evidenceCount,

            level:
              platformSkill
                ?.level,

            sources:
              uniqueStrings(
                sources
              ),

            status,
          };
        }
      );

    const platformSkillsMissingFromResume =
      skillEvidence.filter(
        (skill) =>
          skill.validatedByPlatform &&
          !skill.presentInResume
      ).length;

    return {
      userId:
        userId.toString(),

      resume: {
        id:
          resume._id
            ?.toString(),

        fileName:
          resume.fileName,

        overallScore:
          resume.overallScore,

        atsScore:
          resume.atsScore,

        contentScore:
          resume.contentScore,

        structureScore:
          resume.structureScore,

        skillsScore:
          resume.skillsScore,

        experienceScore:
          resume.experienceScore,

        summary:
          resume.summary,

        skillsDetected:
          resume.skillsDetected ?? [],

        strengths:
          resume.strengths ?? [],

        weaknesses:
          resume.weaknesses ?? [],

        missingSkills:
          resume.missingSkills ?? [],

        atsSuggestions:
          resume.atsSuggestions ?? [],

        formattingFeedback:
          resume.formattingFeedback ?? [],

        recommendations:
          resume.recommendations ?? [],
      },

      platformSkills,

      skillEvidence,

      evidenceSummary: {
        totalResumeSkills:
          resumeSkills.length,

        totalValidatedSkills:
          platformSkills.length,

        platformSkillsMissingFromResume,
      },
    };
  };

export const getSafeSkillsForGeneralCV =
  (
    context:
      IGeneralCVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence
      .filter(
        (skill) =>
          skill.presentInResume ||
          skill.validatedByPlatform
      )
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

          if (
            a.presentInResume !==
            b.presentInResume
          ) {
            return a.presentInResume
              ? -1
              : 1;
          }

          if (
            (
              b.averageScore ||
              0
            ) !==
            (
              a.averageScore ||
              0
            )
          ) {
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
      );
  };

export const getPlatformSkillsMissingFromResumeGeneral =
  (
    context:
      IGeneralCVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence.filter(
      (skill) =>
        skill.validatedByPlatform &&
        !skill.presentInResume
    );
  };


export const getSafeSkillsForCV =
  (
    context:
      ICVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence
      .filter(
        (skill) =>
          skill.presentInResume ||
          skill.validatedByPlatform
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
      );
  };

export const getSafeKeywordsForCV =
  (
    context:
      ICVEvidenceContext
  ): ICVKeywordEvidence[] => {
    return context.keywordEvidence
      .filter(
        (keyword) =>
          keyword.safeToRecommend
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
            a.recommendedByTemplate !==
            b.recommendedByTemplate
          ) {
            return a.recommendedByTemplate
              ? -1
              : 1;
          }

          return 0;
        }
      );
  };

export const getMissingJobSkills =
  (
    context:
      ICVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence.filter(
      (skill) =>
        skill.requiredByJob &&
        !skill.presentInResume &&
        !skill.validatedByPlatform
    );
  };

export const getPlatformSkillsMissingFromResume =
  (
    context:
      ICVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence.filter(
      (skill) =>
        skill.validatedByPlatform &&
        !skill.presentInResume
    );
  };

export const getStrongEvidenceSkills =
  (
    context:
      ICVEvidenceContext
  ): ICVSkillEvidence[] => {
    return context.skillEvidence.filter(
      (skill) =>
        skill.validatedByPlatform &&
        (
          skill.level ===
          "advanced" ||
          skill.level ===
          "expert"
        ) &&
        (
          skill.confidence ||
          0
        ) >= 0.65
    );
  };