import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";
import type { QuestionDifficulty, InterviewType } from "../models/Question";

export interface IAIEvaluation {
    score: number;
    technicalAccuracy: number;
    completeness: number;
    communication: number;
    strengths: string[];
    weaknesses: string[];
    feedback: string;
    improvedAnswer: string;
    followUpQuestion: string;
}

interface EvaluateAnswerParams {
    questionText: string;
    answerText: string;
    category: string;
    difficulty: QuestionDifficulty;
    interviewType: InterviewType;
}

const evaluationSchema = {
    type: Type.OBJECT,
    properties: {
        score: {
            type: Type.INTEGER,
            description: "Overall evaluation score out of 100",
            minimum: 0,
            maximum: 100,
        },
        technicalAccuracy: {
            type: Type.INTEGER,
            description: "Technical correctness score out of 100",
            minimum: 0,
            maximum: 100,
        },
        completeness: {
            type: Type.INTEGER,
            description: "Completeness of the candidate's response out of 100",
            minimum: 0,
            maximum: 100,
        },
        communication: {
            type: Type.INTEGER,
            description: "Clarity and structure of communication out of 100",
            minimum: 0,
            maximum: 100,
        },
        strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key strong points in the answer",
        },
        weaknesses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Areas where the candidate missed details or gave incorrect info",
        },
        feedback: {
            type: Type.STRING,
            description: "Constructive overall feedback",
        },
        improvedAnswer: {
            type: Type.STRING,
            description: "A model answer demonstrating a top-tier candidate response",
        },
        followUpQuestion: {
            type: Type.STRING,
            description: "A logical follow-up question based on their response",
        },
    },
    required: [
        "score",
        "technicalAccuracy",
        "completeness",
        "communication",
        "strengths",
        "weaknesses",
        "feedback",
        "improvedAnswer",
        "followUpQuestion",
    ],
};

export const evaluateAnswer = async ({
    questionText,
    answerText,
    category,
    difficulty,
    interviewType,
}: EvaluateAnswerParams): Promise<IAIEvaluation> => {
    if (!env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const systemInstruction = `
    You are an expert technical interviewer evaluating candidate answers.
    Your task is to analyze the user's response objectively, fairly, and constructively based on the context provided.
    Always return your assessment strictly according to the requested JSON schema.
  `;

    const prompt = `
    Context:
    - Domain/Category: ${category}
    - Difficulty Level: ${difficulty}
    - Interview Type: ${interviewType}

    Question Asked:
    "${questionText}"

    Candidate's Answer:
    "${answerText}"

    Evaluate the answer provided above. Provide scores (0 to 100), key strengths, weaknesses, feedback, a model improved answer, and a follow-up question.
  `;

    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: evaluationSchema,
            temperature: 0.2,
        },
    });

    const responseText = response.text;

    if (!responseText) {
        throw new Error("Empty response received from Gemini API");
    }

    const evaluation: IAIEvaluation = JSON.parse(responseText);

    return evaluation;
};

export interface IAIEvaluation {
    score: number;
    technicalAccuracy: number;
    completeness: number;
    communication: number;
    strengths: string[];
    weaknesses: string[];
    feedback: string;
    improvedAnswer: string;
    followUpQuestion: string;
}

export interface IFinalInterviewReport {
    summary: string;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
}

export interface IFinalReportAnswerInput {
  questionText: string;
  answerText: string;
  score?: number;
  technicalAccuracy?: number;
  completeness?: number;
  communication?: number;
  strengths?: string[];
  weaknesses?: string[];
  feedback?: string;
}

export interface GenerateFinalReportParams {
  category: string;
  difficulty: QuestionDifficulty;
  interviewType: InterviewType;
  answers: IFinalReportAnswerInput[];
}

const finalReportSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Overall executive summary of the candidate's performance throughout the interview",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key technical or behavioral strengths demonstrated across all questions",
    },
    improvements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Critical areas where the candidate showed weakness or knowledge gaps",
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable recommendations and study topics for future preparation",
    },
  },
  required: ["summary", "strengths", "improvements", "recommendations"],
};

export const generateFinalReport = async ({
  category,
  difficulty,
  interviewType,
  answers,
}: GenerateFinalReportParams): Promise<IFinalInterviewReport> => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const formattedAnswersText = answers
    .map((ans, index) => {
      return `
Question #${index + 1}:
- Question: ${ans.questionText}
- Answer: ${ans.answerText || "No answer provided"}
- Score: ${ans.score ?? "N/A"}
- Technical Accuracy: ${ans.technicalAccuracy ?? "N/A"}
- Completeness: ${ans.completeness ?? "N/A"}
- Communication: ${ans.communication ?? "N/A"}
- Strengths: ${ans.strengths?.join(", ") || "None"}
- Weaknesses: ${ans.weaknesses?.join(", ") || "None"}
- Feedback: ${ans.feedback || "None"}
`;
    })
    .join("\n-----------------------------------\n");

  const systemInstruction = `
    You are a senior technical interviewer and hiring expert. 
    Your task is to analyze the entire interview performance of a candidate based on all individual question responses and evaluations provided.
    Provide a comprehensive overall assessment including an executive summary, main overall strengths, critical areas for improvement, and actionable learning recommendations.
    Always return your report strictly according to the requested JSON schema.
  `;

  const prompt = `
Context:
- Category/Domain: ${category}
- Difficulty Level: ${difficulty}
- Interview Type: ${interviewType}

Full Interview Performance Data:
${formattedAnswersText}

Analyze the candidate's performance across all questions and generate a comprehensive final interview report.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: finalReportSchema,
      temperature: 0.2,
    },
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Empty response received from Gemini API during final report generation");
  }

  const finalReport: IFinalInterviewReport = JSON.parse(responseText);

  return finalReport;
};