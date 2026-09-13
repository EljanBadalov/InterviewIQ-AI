/* =========================================================
   INTERVIEW EVALUATION SERVICE

   Evaluates candidate interview answers using the local Qwen model.

   Updated:
   - supports Career Field roleSlug
   - keeps category for backward compatibility
   - gives Qwen clearer role-specific evaluation context
========================================================= */

import qwenService, {
  IQwenJSONResult,
} from "./qwenService";

/* =========================================================
   TYPES
========================================================= */

export interface EvaluateInterviewAnswerInput {
  roleSlug?: string;

  category?: string;

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

/* =========================================================
   HELPERS
========================================================= */

const clampScore = (
  value: unknown,
  fallback = 0
): number => {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        parsed
      )
    )
  );
};

const toStringArray = (
  value: unknown
): string[] => {
  if (
    !Array.isArray(
      value
    )
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
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );
};

const normalizeText = (
  value:
    unknown
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

const formatRoleLabel = (
  value: string
): string => {
  return value
    .replace(
      /[_-]+/g,
      " "
    )
    .split(
      " "
    )
    .filter(
      Boolean
    )
    .map(
      (
        word
      ) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(
      " "
    );
};

/* =========================================================
   NORMALIZER
========================================================= */

const normalizeEvaluation = (
  raw: unknown
): InterviewEvaluation => {
  if (
    typeof raw !==
      "object" ||
    raw === null ||
    Array.isArray(
      raw
    )
  ) {
    throw new Error(
      "Qwen response is not a valid object"
    );
  }

  const data =
    raw as
      Record<
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
    normalizeText(
      data.feedback
    );

  let improvedAnswer =
    normalizeText(
      data.improvedAnswer
    );

  let followUpQuestion =
    normalizeText(
      data.followUpQuestion
    );

  if (
    strengths.length ===
    0
  ) {
    strengths = [
      "The answer addressed the main topic and demonstrated relevant understanding.",
    ];
  }

  if (
    weaknesses.length ===
    0
  ) {
    weaknesses = [
      "The answer could be improved with additional detail, stronger reasoning, or a practical example.",
    ];
  }

  if (
    !feedback
  ) {
    feedback =
      "The response demonstrates relevant understanding, but it could be stronger with more specific reasoning and evidence.";
  }

  if (
    !improvedAnswer
  ) {
    improvedAnswer =
      "A stronger interview answer would directly answer the question, explain the reasoning, and include a relevant practical example or trade-off.";
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

    followUpQuestion:
      followUpQuestion ||
      undefined,
  };
};

/* =========================================================
   PROMPT
========================================================= */

const createPrompt = (
  input:
    EvaluateInterviewAnswerInput
): string => {
  const roleIdentifier =
    normalizeText(
      input.roleSlug
    ) ||
    normalizeText(
      input.category
    ) ||
    "general";

  const roleLabel =
    formatRoleLabel(
      roleIdentifier
    );

  return `
You are a professional interviewer and interview evaluator for InterviewIQ.

Your task is to evaluate the candidate specifically in the context of the selected career field.

INTERVIEW CONTEXT
Career Field: ${roleLabel}
Career Field Slug: ${roleIdentifier}
Difficulty: ${input.difficulty}
Interview Type: ${input.interviewType}

QUESTION
${input.question}

CANDIDATE ANSWER
${input.answer}

EVALUATION RULES

1. Judge the answer against the expectations of a real ${roleLabel} interview.
2. Respect the selected difficulty level.
3. Do not give a high score merely because the answer sounds confident.
4. Reward technically or professionally correct reasoning, relevant examples, trade-offs, and clear communication.
5. Penalize vague, generic, incorrect, incomplete, or off-topic answers.
6. For technical interviews, technicalAccuracy must reflect field-specific correctness.
7. For behavioral interviews, evaluate relevance, structure, ownership, communication, and evidence from the candidate's example.
8. Feedback must be specific to the exact question and answer.
9. The improved answer should be realistic and usable in an interview, not generic filler.
10. The follow-up question should naturally test the same competency at a deeper level.

SCORING

score:
Overall answer quality from 0 to 100.

technicalAccuracy:
Correctness and role-specific knowledge from 0 to 100.
For non-technical behavioral questions, interpret this as professional/domain accuracy.

completeness:
How completely the candidate answered the actual question from 0 to 100.

communication:
Clarity, structure, professionalism, and explanation quality from 0 to 100.

Return ONLY valid JSON with exactly these fields:

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
  "feedback": "Detailed feedback specific to this answer.",
  "improvedAnswer": "A stronger realistic example answer.",
  "followUpQuestion": "A relevant deeper follow-up question."
}
`.trim();
};

/* =========================================================
   EVALUATE
========================================================= */

export const evaluateInterviewAnswer =
  async (
    input:
      EvaluateInterviewAnswerInput
  ): Promise<InterviewEvaluation> => {
    const roleIdentifier =
      normalizeText(
        input.roleSlug
      ) ||
      normalizeText(
        input.category
      );

    if (
      !roleIdentifier
    ) {
      throw new Error(
        "Career field is required for interview evaluation."
      );
    }

    if (
      !normalizeText(
        input.question
      )
    ) {
      throw new Error(
        "Interview question is required."
      );
    }

    if (
      !normalizeText(
        input.answer
      )
    ) {
      throw new Error(
        "Candidate answer is required."
      );
    }

    const response:
      IQwenJSONResult<
        InterviewEvaluation
      > =
      await qwenService.generateQwenJSON<
        InterviewEvaluation
      >({
        messages: [
          {
            role:
              "user",

            content:
              createPrompt(
                input
              ),
          },
        ],

        temperature:
          0.2,
      });

    if (
      !response.success ||
      !response.data
    ) {
      throw new Error(
        `Interview evaluation failed: ${
          response.error ||
          "Qwen returned no evaluation data."
        }`
      );
    }

    return normalizeEvaluation(
      response.data
    );
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  evaluateInterviewAnswer,
};
