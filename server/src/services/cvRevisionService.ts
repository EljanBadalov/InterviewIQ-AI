import { env } from "../config/env";
import qwenService from "./qwenService";

import {
  type IGeneratedCVData,
} from "./cvBuilderService";

/* =========================================================
   TYPES
========================================================= */

export interface ICVRevisionParams {
  cv: IGeneratedCVData;
  qualityFeedback: string[];
  attempt: number;
}

interface ICVRevisionExperienceItem {
  index: number;
  description?: string;
  bullets: string[];
}

interface ICVRevisionProjectItem {
  index: number;
  description?: string;
  bullets: string[];
}

interface ICVRevisionResponse {
  professionalSummary: string;
  primarySkills: string[];
  additionalSupportedSkills: string[];
  experience: ICVRevisionExperienceItem[];
  projects: ICVRevisionProjectItem[];
  revisionNotes: string[];
}

export interface ICVRevisionResult {
  cv: IGeneratedCVData;
  revisionNotes: string[];
}

/* =========================================================
   NORMALIZATION HELPERS
========================================================= */

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
};

const normalizeStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const cleaned = normalizeText(item);

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
};

const normalizeIndex = (value: unknown): number | null => {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
};

const normalizeRevisionItems = (
  value: unknown
): Array<{
  index: number;
  description?: string;
  bullets: string[];
}> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: Array<{
    index: number;
    description?: string;
    bullets: string[];
  }> = [];

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      continue;
    }

    const data = item as Record<string, unknown>;
    const index = normalizeIndex(data.index);

    if (index === null) {
      continue;
    }

    const description = normalizeText(data.description);

    result.push({
      index,
      description: description || undefined,
      bullets: normalizeStrings(data.bullets),
    });
  }

  return result;
};

const normalizeRevisionResponse = (
  value: unknown
): ICVRevisionResponse => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Qwen returned an invalid CV revision object"
    );
  }

  const data = value as Record<string, unknown>;

  return {
    professionalSummary: normalizeText(
      data.professionalSummary
    ),

    primarySkills: normalizeStrings(
      data.primarySkills
    ),

    additionalSupportedSkills: normalizeStrings(
      data.additionalSupportedSkills
    ),

    experience: normalizeRevisionItems(
      data.experience
    ),

    projects: normalizeRevisionItems(
      data.projects
    ),

    revisionNotes: normalizeStrings(
      data.revisionNotes
    ),
  };
};

/* =========================================================
   SAFETY HELPERS
========================================================= */

const buildAllowedSkillMap = (
  cv: IGeneratedCVData
): Map<string, string> => {
  const allowed = [
    ...cv.skills.primary,
    ...cv.skills.verified,
    ...cv.skills.additionalSupported,
    ...cv.sourceEvidence.resumeSkills,
    ...cv.sourceEvidence.platformVerifiedSkills,
    ...cv.sourceEvidence.safeSkillsForCV,
  ];

  const result = new Map<string, string>();

  for (const skill of allowed) {
    const cleaned = normalizeText(skill);

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();

    if (!result.has(key)) {
      result.set(key, cleaned);
    }
  }

  return result;
};

const filterSupportedSkills = (
  values: string[],
  allowedSkillMap: Map<string, string>
): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const key = value.toLowerCase();
    const supported = allowedSkillMap.get(key);

    if (!supported || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(supported);
  }

  return result;
};

const mergeMissingSupportedSkills = (
  revised: string[],
  original: string[],
  allowedSkillMap: Map<string, string>
): string[] => {
  const result = [...revised];
  const seen = new Set(
    result.map((item) => item.toLowerCase())
  );

  for (const item of original) {
    const key = item.toLowerCase();
    const supported = allowedSkillMap.get(key);

    if (!supported || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(supported);
  }

  return result;
};

/* =========================================================
   APPLY SAFE REVISION
========================================================= */

const applyRevision = (
  cv: IGeneratedCVData,
  revision: ICVRevisionResponse
): IGeneratedCVData => {
  const allowedSkillMap = buildAllowedSkillMap(cv);

  const revisedPrimary = mergeMissingSupportedSkills(
    filterSupportedSkills(
      revision.primarySkills,
      allowedSkillMap
    ),
    cv.skills.primary,
    allowedSkillMap
  ).slice(0, 18);

  const primarySet = new Set(
    revisedPrimary.map((skill) => skill.toLowerCase())
  );

  const revisedAdditional = mergeMissingSupportedSkills(
    filterSupportedSkills(
      revision.additionalSupportedSkills,
      allowedSkillMap
    ).filter(
      (skill) => !primarySet.has(skill.toLowerCase())
    ),
    cv.skills.additionalSupported,
    allowedSkillMap
  )
    .filter(
      (skill) => !primarySet.has(skill.toLowerCase())
    )
    .slice(0, 15);

  const experienceRevisionMap = new Map(
    revision.experience.map((item) => [item.index, item])
  );

  const projectRevisionMap = new Map(
    revision.projects.map((item) => [item.index, item])
  );

  return {
    ...cv,

    metadata: {
      ...cv.metadata,
      generatedAt: new Date().toISOString(),
    },

    professionalSummary:
      revision.professionalSummary ||
      cv.professionalSummary,

    skills: {
      ...cv.skills,
      primary: revisedPrimary,
      additionalSupported: revisedAdditional,
    },

    experience: {
      ...cv.experience,
      items: cv.experience.items.map((item, index) => {
        const revised = experienceRevisionMap.get(index);

        if (!revised) {
          return item;
        }

        return {
          ...item,
          description:
            revised.description || item.description,
          bullets:
            revised.bullets.length > 0
              ? revised.bullets
              : item.bullets,
        };
      }),
    },

    projects: {
      ...cv.projects,
      items: cv.projects.items.map((item, index) => {
        const revised = projectRevisionMap.get(index);

        if (!revised) {
          return item;
        }

        return {
          ...item,
          description:
            revised.description || item.description,
          bullets:
            revised.bullets.length > 0
              ? revised.bullets
              : item.bullets,
        };
      }),
    },

    warnings: [
      ...cv.warnings,
      "This CV was revised after an internal quality review. No unsupported candidate facts may be introduced during revision.",
    ],
  };
};

/* =========================================================
   REVISE CV
========================================================= */

export const reviseGeneratedCV = async ({
  cv,
  qualityFeedback,
  attempt,
}: ICVRevisionParams): Promise<ICVRevisionResult> => {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error(
      "CV revision attempt must be a positive integer"
    );
  }

  const systemInstruction = `
You are InterviewIQ's CV revision engine.
Your task is to improve an already-generated CV after an internal Quality Gate rejected it.

CRITICAL GOAL
Improve only the weak or regressed parts identified by the Quality Gate while preserving factual accuracy and sections that are already strong.

ABSOLUTE TRUTHFULNESS RULES
Never invent candidate information.
Never invent or add: employers, job titles, dates, education, institutions, projects, certifications, technologies, skills, responsibilities, achievements, metrics, etc.

Do not turn recommendations, vacancy requirements, professional-template examples, or Quality Gate feedback into candidate facts.

SKILLS
You may ONLY return skills that already exist in ALLOWED SUPPORTED SKILLS. You must not create a new skill.

EXPERIENCE AND PROJECTS
You may rewrite existing descriptions and bullets for clarity, conciseness, ATS readability, grammar, and professional tone.
You MUST preserve the exact factual meaning.
Do not add a result, metric, responsibility, or action that is not supported by the original item.

PROFESSIONAL SUMMARY
You may rewrite the professional summary using ONLY facts and supported skills already contained in the supplied CV data.

QUALITY GATE
Treat QUALITY GATE FEEDBACK as editing instructions, not candidate facts. Prioritize the failed dimensions.

OUTPUT FORMAT
Return ONLY valid JSON with the following structure. Do not include markdown fences.
{
  "professionalSummary": "string",
  "primarySkills": ["string"],
  "additionalSupportedSkills": ["string"],
  "experience": [
    {
      "index": 0,
      "description": "string",
      "bullets": ["string"]
    }
  ],
  "projects": [
    {
      "index": 0,
      "description": "string",
      "bullets": ["string"]
    }
  ],
  "revisionNotes": ["string"]
}
  `.trim();

  const prompt = `
REVISION ATTEMPT: ${attempt}

QUALITY GATE FEEDBACK
${JSON.stringify(qualityFeedback, null, 2)}

ALLOWED SUPPORTED SKILLS
${JSON.stringify(
  Array.from(buildAllowedSkillMap(cv).values()),
  null,
  2
)}

CURRENT GENERATED CV
${JSON.stringify(
  {
    targetJob: cv.metadata.targetJob,
    strategy: cv.metadata.strategy,
    professionalSummary: cv.professionalSummary,
    skills: cv.skills,
    keywords: cv.keywords,
    experience: cv.experience.items,
    projects: cv.projects.items,
    education: cv.education.items,
    certifications: cv.certifications.items,
    languages: cv.languages.items,
    volunteering: cv.volunteering.items,
    achievements: cv.achievements.items,
    interests: cv.interests.items,
    sourceEvidence: cv.sourceEvidence,
    optimization: cv.optimization,
    warnings: cv.warnings,
  },
  null,
  2
)}

Revise this CV conservatively. Do not invent facts in order to increase a score.
A safe smaller improvement is better than a fabricated high-scoring CV.
  `.trim();

  const response = await qwenService.generateQwenJSON<ICVRevisionResponse>({
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    maxCompletionTokens: 3000,
    retries: 2,
  });

  if (!response.success || !response.data) {
    throw new Error(
      `Qwen returned invalid or empty JSON during CV revision: ${response.error}`
    );
  }

  const revision = normalizeRevisionResponse(response.data);
  const revisedCV = applyRevision(cv, revision);

  return {
    cv: revisedCV,
    revisionNotes: revision.revisionNotes,
  };
};

export default {
  reviseGeneratedCV,
};