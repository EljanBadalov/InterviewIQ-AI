import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not defined"
  );
}

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.6-flash";

export const geminiAI =
  new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
  });

const wait = (
  milliseconds: number
): Promise<void> => {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
};

export const generateContentWithRetry =
  async (
    ai: GoogleGenAI,
    request: Parameters<
      typeof ai.models.generateContent
    >[0],
    maxAttempts = 3
  ) => {
    let lastError:
      unknown = null;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      try {
        console.log(
          `Gemini request attempt ${attempt}/${maxAttempts}`
        );

        const response =
          await ai.models.generateContent(
            request
          );

        console.log(
          `Gemini request succeeded on attempt ${attempt}`
        );

        return response;
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini request attempt ${attempt} failed:`,
          error
        );

        if (
          attempt <
          maxAttempts
        ) {
          const delay =
            attempt *
            1500;

          console.log(
            `Retrying Gemini request in ${delay}ms...`
          );

          await wait(
            delay
          );
        }
      }
    }

    if (
      lastError instanceof Error
    ) {
      throw lastError;
    }

    throw new Error(
      "Gemini request failed after all retry attempts"
    );
  };

export interface EvaluateInterviewAnswerInput {
  category: string;
  difficulty: string;
  interviewType: string;
  question: string;
  answer: string;
}

export interface InterviewEvaluation {
  score: number;

  technicalAccuracy: number;
  completeness: number;
  communication: number;

  strengths: string[];
  weaknesses: string[];

  feedback: string;
  improvedAnswer: string;

  followUpQuestion?: string;
}

const clampScore = (
  value: unknown,
  fallback = 0
): number => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(parsed)
    )
  );
};

const toStringValue = (
  value: unknown
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
};

const toStringArray = (
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

const cleanJsonResponse = (
  value: string
): string => {
  return value
    .trim()
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
};

const normalizeEvaluation = (
  raw: unknown
): InterviewEvaluation => {
  if (
    typeof raw !==
      "object" ||
    raw === null ||
    Array.isArray(raw)
  ) {
    throw new Error(
      "Gemini response is not a valid object"
    );
  }

  const data =
    raw as Record<
      string,
      unknown
    >;

  const score =
    clampScore(
      data.score,
      50
    );

  const technicalAccuracy =
    clampScore(
      data.technicalAccuracy,
      score
    );

  const completeness =
    clampScore(
      data.completeness,
      score
    );

  const communication =
    clampScore(
      data.communication,
      score
    );

  let strengths =
    toStringArray(
      data.strengths
    );

  let weaknesses =
    toStringArray(
      data.weaknesses
    );

  let feedback =
    toStringValue(
      data.feedback
    );

  let improvedAnswer =
    toStringValue(
      data.improvedAnswer
    );

  let followUpQuestion =
    toStringValue(
      data.followUpQuestion
    );

  if (
    strengths.length === 0
  ) {
    strengths = [
      "The answer addressed the main topic and demonstrated relevant understanding.",
    ];
  }

  if (
    weaknesses.length === 0
  ) {
    weaknesses = [
      "The answer could be improved with additional detail, practical examples, or clearer explanation of trade-offs.",
    ];
  }

  if (!feedback) {
    feedback =
      "The response demonstrates relevant understanding. It could be improved by providing more specific reasoning, examples, and a clearer structure.";
  }

  if (!improvedAnswer) {
    improvedAnswer =
      "A stronger interview answer would begin with a direct explanation, describe the main concepts step by step, include a practical example, and mention important edge cases or trade-offs.";
  }

  if (!followUpQuestion) {
    followUpQuestion =
      "Can you give a practical example and explain the main trade-offs involved?";
  }

  return {
    score,
    technicalAccuracy,
    completeness,
    communication,
    strengths,
    weaknesses,
    feedback,
    improvedAnswer,
    followUpQuestion,
  };
};

const createPrompt = (
  input: EvaluateInterviewAnswerInput
): string => {
  return `
You are a professional interviewer for InterviewIQ.

Evaluate the candidate's answer accurately and fairly.

INTERVIEW INFORMATION

Category:
${input.category}

Difficulty:
${input.difficulty}

Interview Type:
${input.interviewType}

QUESTION:

${input.question}

CANDIDATE ANSWER:

${input.answer}

Evaluate the answer using these criteria:

1. score
Overall answer quality from 0 to 100.

2. technicalAccuracy
Technical correctness from 0 to 100.

For behavioral interviews, evaluate the correctness
and relevance of the candidate's reasoning and decisions.

3. completeness
How completely the candidate answered the question,
from 0 to 100.

4. communication
Clarity, structure, professionalism, and explanation
quality from 0 to 100.

Also return:

- strengths
- weaknesses
- feedback
- improvedAnswer
- followUpQuestion

DIFFICULTY EXPECTATIONS

Beginner:
Expect fundamentals and basic understanding.

Intermediate:
Expect practical knowledge, correct terminology,
reasonable depth, and useful examples.

Advanced:
Expect deep understanding, trade-offs,
edge cases, and production-level reasoning.

Senior:
Expect architecture-level thinking,
scalability, trade-offs, risk awareness,
leadership reasoning, and production experience.

IMPORTANT RULES

- Evaluate only the answer actually provided.
- Do not automatically give high scores.
- Penalize incorrect technical claims.
- Penalize incomplete answers.
- Penalize vague answers.
- Reward correct and well-structured explanations.
- Strengths must be specific.
- Weaknesses must be constructive.
- improvedAnswer must be a genuinely stronger answer.
- followUpQuestion must be relevant.
- Do not return markdown.
- Do not return code fences.
- Return ONLY valid JSON.

Return JSON with exactly these fields:

{
  "score": 0,
  "technicalAccuracy": 0,
  "completeness": 0,
  "communication": 0,
  "strengths": [
    "specific strength"
  ],
  "weaknesses": [
    "specific improvement"
  ],
  "feedback": "Detailed interview feedback.",
  "improvedAnswer": "A stronger example answer.",
  "followUpQuestion": "A relevant follow-up question."
}
`.trim();
};

const runEvaluation =
  async (
    input: EvaluateInterviewAnswerInput
  ): Promise<InterviewEvaluation> => {
    const response =
      await generateContentWithRetry(
        geminiAI,
        {
          model:
            GEMINI_MODEL,

          contents:
            createPrompt(
              input
            ),

          config: {
            responseMimeType:
              "application/json",
          },
        }
      );

    const rawText =
      response.text;

    if (
      !rawText ||
      !rawText.trim()
    ) {
      throw new Error(
        "Gemini returned an empty response"
      );
    }

    const cleanedText =
      cleanJsonResponse(
        rawText
      );

    let parsed:
      unknown;

    try {
      parsed =
        JSON.parse(
          cleanedText
        );
    } catch (error) {
      console.error(
        "Gemini JSON parse failed:"
      );

      console.error(
        rawText
      );

      throw new Error(
        "Gemini returned invalid JSON"
      );
    }

    return normalizeEvaluation(
      parsed
    );
  };

export const evaluateInterviewAnswer =
  async (
    input: EvaluateInterviewAnswerInput
  ): Promise<InterviewEvaluation> => {
    return runEvaluation(
      input
    );
  };

export default {
  geminiAI,
  generateContentWithRetry,
  evaluateInterviewAnswer,
};