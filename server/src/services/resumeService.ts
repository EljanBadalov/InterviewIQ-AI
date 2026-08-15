import {
  GoogleGenAI,
  Type,
} from "@google/genai";

import { env } from "../config/env";

import {
  generateContentWithRetry,
} from "./geminiService";

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

interface AnalyzeResumeParams {
  resumeText: string;
}

const resumeAnalysisSchema = {
  type: Type.OBJECT,

  properties: {
    overallScore: {
      type: Type.INTEGER,

      description:
        "Overall resume quality and ATS readiness score from 0 to 100",
    },

    atsScore: {
      type: Type.INTEGER,

      description:
        "ATS compatibility score from 0 to 100 based on keyword usage, parsing readiness, section clarity, and ATS-friendly organization",
    },

    contentScore: {
      type: Type.INTEGER,

      description:
        "Resume content quality score from 0 to 100 based on clarity, achievements, impact, relevance, and professional wording",
    },

    structureScore: {
      type: Type.INTEGER,

      description:
        "Resume structural quality score from 0 to 100 based on section organization, consistency, readability, and logical ordering",
    },

    skillsScore: {
      type: Type.INTEGER,

      description:
        "Skills presentation score from 0 to 100 based on relevant technical and professional skills, keyword coverage, and clarity",
    },

    experienceScore: {
      type: Type.INTEGER,

      description:
        "Experience presentation score from 0 to 100 based on role clarity, achievements, measurable impact, action verbs, and relevance",
    },

    summary: {
      type: Type.STRING,

      description:
        "Concise professional summary of the candidate and overall resume quality",
    },

    skillsDetected: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Relevant technical and professional skills detected in the resume",
    },

    strengths: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Specific strengths demonstrated by the resume",
    },

    weaknesses: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Specific weaknesses or issues reducing resume quality",
    },

    missingSkills: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Relevant skills, technologies, or keywords that could strengthen the resume",
    },

    atsSuggestions: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Specific actionable recommendations to improve ATS compatibility",
    },

    formattingFeedback: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Feedback about resume structure, organization, section clarity, consistency, and text readability",
    },

    recommendations: {
      type: Type.ARRAY,

      items: {
        type: Type.STRING,
      },

      description:
        "Prioritized recommendations for improving the resume",
    },
  },

  required: [
    "overallScore",

    "atsScore",
    "contentScore",
    "structureScore",
    "skillsScore",
    "experienceScore",

    "summary",

    "skillsDetected",

    "strengths",

    "weaknesses",

    "missingSkills",

    "atsSuggestions",

    "formattingFeedback",

    "recommendations",
  ],
};

const clampScore = (
  value: unknown,
  fallback = 0
): number => {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        numberValue
      )
    )
  );
};

const normalizeString = (
  value: unknown,
  fallback = ""
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  const cleaned =
    value.trim();

  return cleaned ||
    fallback;
};

const normalizeArray = (
  value: unknown
): string[] => {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .filter(
      (
        item
      ): item is string =>
        typeof item ===
        "string"
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
};

const normalizeResumeAnalysis = (
  value: unknown
): IResumeAnalysis => {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Gemini returned an invalid resume analysis object"
    );
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const overallScore =
    clampScore(
      data.overallScore
    );

  const atsScore =
    clampScore(
      data.atsScore,
      overallScore
    );

  const contentScore =
    clampScore(
      data.contentScore,
      overallScore
    );

  const structureScore =
    clampScore(
      data.structureScore,
      overallScore
    );

  const skillsScore =
    clampScore(
      data.skillsScore,
      overallScore
    );

  const experienceScore =
    clampScore(
      data.experienceScore,
      overallScore
    );

  return {
    overallScore,

    atsScore,

    contentScore,

    structureScore,

    skillsScore,

    experienceScore,

    summary:
      normalizeString(
        data.summary,
        "Resume analysis completed."
      ),

    skillsDetected:
      normalizeArray(
        data.skillsDetected
      ),

    strengths:
      normalizeArray(
        data.strengths
      ),

    weaknesses:
      normalizeArray(
        data.weaknesses
      ),

    missingSkills:
      normalizeArray(
        data.missingSkills
      ),

    atsSuggestions:
      normalizeArray(
        data.atsSuggestions
      ),

    formattingFeedback:
      normalizeArray(
        data.formattingFeedback
      ),

    recommendations:
      normalizeArray(
        data.recommendations
      ),
  };
};

export const analyzeResume =
  async ({
    resumeText,
  }: AnalyzeResumeParams): Promise<IResumeAnalysis> => {
    if (
      !env.GEMINI_API_KEY
    ) {
      throw new Error(
        "GEMINI_API_KEY is not configured in environment variables"
      );
    }

    if (
      !resumeText ||
      resumeText.trim().length <
        20
    ) {
      throw new Error(
        "Resume text is empty or too short to analyze"
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey:
          env.GEMINI_API_KEY,
      });

    const systemInstruction = `
You are an expert HR recruiter, resume writer, career advisor, and ATS specialist working for InterviewIQ.

Your task is to analyze the candidate's resume objectively and professionally.

You receive plain text extracted from a PDF resume.

You must evaluate the resume across six scoring dimensions:

1. overallScore
2. atsScore
3. contentScore
4. structureScore
5. skillsScore
6. experienceScore

Every score must be between 0 and 100.

SCORING RULES

overallScore:
The overall quality of the resume considering ATS readiness, content quality, structure, skills, and experience.

atsScore:
Evaluate how well the resume is likely to work with Applicant Tracking Systems.
Consider:
- clear section headings
- relevant keywords
- standard terminology
- predictable structure
- readable text
- keyword coverage
- ATS-friendly organization

Do NOT judge graphics, colors, fonts, or visual columns because you only have extracted text.

contentScore:
Evaluate:
- clarity
- professional language
- specificity
- measurable achievements
- use of action verbs
- relevance
- conciseness
- impact of bullet points

structureScore:
Evaluate:
- section ordering
- heading consistency
- information hierarchy
- duplicate sections
- missing important sections
- readability of extracted text
- logical organization

skillsScore:
Evaluate:
- relevance of skills
- breadth and depth
- technical keywords
- consistency with projects and experience
- whether important skills appear to be missing
- quality of skill presentation

experienceScore:
Evaluate:
- clarity of work experience
- relevance of roles
- measurable achievements
- business or technical impact
- action-oriented descriptions
- role responsibilities
- career progression
- evidence supporting claimed skills

IMPORTANT

Do not make up achievements or experience that are not present.

Do not reward a resume just because it is long.

Do not automatically give high scores.

Do not automatically make every score similar.

Each score should independently reflect that category.

For example:

A resume may have:
- strong skills
- weak work experience
- moderate ATS readiness
- poor structure

In that situation, the scores should reflect those differences.

Because the resume was extracted from PDF text, do not claim to have visually inspected:
- colors
- font size
- margins
- graphics
- icons
- visual columns
- actual page layout

You may evaluate structural formatting visible from extracted text, including:
- section ordering
- duplicated headings
- broken URLs
- inconsistent wording
- poor bullet organization
- readability problems

Return your analysis strictly according to the requested JSON schema.
`.trim();

    const prompt = `
RESUME CONTENT

"""
${resumeText.trim()}
"""

Analyze this resume thoroughly.

Return independent scores for:

overallScore
atsScore
contentScore
structureScore
skillsScore
experienceScore

Do not simply copy overallScore into the other categories.

ATS SCORE

Consider:
- keyword compatibility
- standard section naming
- ATS-readable structure
- professional terminology
- likely parsing quality
- appropriate keyword coverage

CONTENT SCORE

Consider:
- writing quality
- clarity
- action verbs
- measurable achievements
- relevance
- professional impact
- concise wording

STRUCTURE SCORE

Consider:
- logical section organization
- consistent headings
- duplicate or incorrect sections
- information hierarchy
- text readability
- organization of contact information

SKILLS SCORE

Consider:
- relevant technical skills
- professional skills
- keyword coverage
- whether listed skills are supported by projects or experience
- missing important skills

EXPERIENCE SCORE

Consider:
- clarity of experience
- responsibilities
- achievements
- measurable outcomes
- relevance
- professional impact
- strength of bullet points

SUMMARY

Provide a concise explanation of the candidate's current professional profile and the general quality of the resume.

STRENGTHS

Return specific strengths actually demonstrated by the resume.

WEAKNESSES

Return specific issues actually present in the resume.

MISSING SKILLS

Suggest only skills or keywords reasonably relevant to the candidate's apparent career direction.

ATS SUGGESTIONS

Provide specific improvements that could make the resume more ATS-friendly.

FORMATTING FEEDBACK

Because you only receive extracted PDF text, evaluate structural formatting such as:
- headings
- ordering
- duplication
- broken text
- consistency
- bullet organization
- readability

Do not pretend to evaluate visual design properties you cannot see.

RECOMMENDATIONS

Return prioritized, actionable recommendations that would materially improve this resume.
`.trim();

    const response =
      await generateContentWithRetry(
        ai,
        {
          model:
            "gemini-3.6-flash",

          contents:
            prompt,

          config: {
            systemInstruction,

            responseMimeType:
              "application/json",

            responseSchema:
              resumeAnalysisSchema,
          },
        }
      );

    const responseText =
      response.text;

    if (
      !responseText ||
      !responseText.trim()
    ) {
      throw new Error(
        "Empty response received from Gemini API during resume analysis"
      );
    }

    let parsed:
      unknown;

    try {
      parsed =
        JSON.parse(
          responseText
        );
    } catch (
      error
    ) {
      console.error(
        "Resume analysis JSON parse error:"
      );

      console.error(
        responseText
      );

      console.error(
        error
      );

      throw new Error(
        "Gemini returned invalid JSON during resume analysis"
      );
    }

    const analysis =
      normalizeResumeAnalysis(
        parsed
      );

    console.log(
      "Resume analysis completed:"
    );

    console.log(
      JSON.stringify(
        {
          overallScore:
            analysis.overallScore,

          atsScore:
            analysis.atsScore,

          contentScore:
            analysis.contentScore,

          structureScore:
            analysis.structureScore,

          skillsScore:
            analysis.skillsScore,

          experienceScore:
            analysis.experienceScore,
        },
        null,
        2
      )
    );

    return analysis;
  };

export default {
  analyzeResume,
};