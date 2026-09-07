/* =========================================================
   INTERVIEW EVALUATION SERVICE
   Evaluates candidate interview answers using the local Qwen model.
========================================================= */

import qwenService, { IQwenJSONResult } from "./qwenService";

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

const clampScore = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeEvaluation = (raw: unknown): InterviewEvaluation => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Qwen response is not a valid object");
  }

  const data = raw as Record<string, unknown>;

  const score = clampScore(data.score, 50);
  const technicalAccuracy = clampScore(data.technicalAccuracy, score);
  const completeness = clampScore(data.completeness, score);
  const communication = clampScore(data.communication, score);

  let strengths = toStringArray(data.strengths);
  let weaknesses = toStringArray(data.weaknesses);
  let feedback = typeof data.feedback === "string" ? data.feedback.trim() : "";
  let improvedAnswer = typeof data.improvedAnswer === "string" ? data.improvedAnswer.trim() : "";
  let followUpQuestion = typeof data.followUpQuestion === "string" ? data.followUpQuestion.trim() : "";

  if (strengths.length === 0) {
    strengths = ["The answer addressed the main topic and demonstrated relevant understanding."];
  }
  if (weaknesses.length === 0) {
    weaknesses = ["The answer could be improved with additional detail or practical examples."];
  }
  if (!feedback) {
    feedback = "The response demonstrates relevant understanding. It could be improved by providing more specific reasoning.";
  }
  if (!improvedAnswer) {
    improvedAnswer = "A stronger interview answer would include a practical example and mention important trade-offs.";
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

const createPrompt = (input: EvaluateInterviewAnswerInput): string => {
  return `
You are a professional interviewer for InterviewIQ.
Evaluate the candidate's answer accurately and fairly.

INTERVIEW INFORMATION
Category: ${input.category}
Difficulty: ${input.difficulty}
Interview Type: ${input.interviewType}

QUESTION:
${input.question}

CANDIDATE ANSWER:
${input.answer}

Evaluate the answer using these criteria:
1. score: Overall answer quality from 0 to 100.
2. technicalAccuracy: Technical correctness from 0 to 100.
3. completeness: How completely the candidate answered the question, from 0 to 100.
4. communication: Clarity, structure, professionalism, and explanation quality from 0 to 100.

Return ONLY valid JSON with exactly these fields:
{
  "score": 0,
  "technicalAccuracy": 0,
  "completeness": 0,
  "communication": 0,
  "strengths": ["specific strength"],
  "weaknesses": ["specific improvement"],
  "feedback": "Detailed interview feedback.",
  "improvedAnswer": "A stronger example answer.",
  "followUpQuestion": "A relevant follow-up question."
}
`.trim();
};

export const evaluateInterviewAnswer = async (
  input: EvaluateInterviewAnswerInput
): Promise<InterviewEvaluation> => {
  const response: IQwenJSONResult<InterviewEvaluation> = await qwenService.generateQwenJSON<InterviewEvaluation>({
    messages: [{ role: "user", content: createPrompt(input) }],
    temperature: 0.2
  });

  if (!response.success || !response.data) {
    throw new Error(`Interview evaluation failed: ${response.error}`);
  }

  return normalizeEvaluation(response.data);
};

export default { evaluateInterviewAnswer };