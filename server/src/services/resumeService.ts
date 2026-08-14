import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env";
import { generateContentWithRetry } from "./geminiService";

export interface IResumeAnalysis {
  overallScore: number;
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
      description: "Overall ATS and quality score for the resume out of 100",
      minimum: 0,
      maximum: 100,
    },
    summary: {
      type: Type.STRING,
      description: "Executive summary of the candidate's professional profile",
    },
    skillsDetected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key hard and soft skills extracted from the resume",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key strengths highlighted in the resume content",
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Areas where the resume lacks clarity or depth",
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Important industry-standard skills that are noticeably absent",
    },
    atsSuggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Actionable tips to improve ATS optimization and keyword matching",
    },
    formattingFeedback: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Bullet-point feedback regarding visual layout, structure, and readability",
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Step-by-step guidance for enhancing overall resume impact",
    },
  },
  required: [
    "overallScore",
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

export const analyzeResume = async ({
  resumeText,
}: AnalyzeResumeParams): Promise<IResumeAnalysis> => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const systemInstruction = `
    You are an expert HR recruiter and ATS (Applicant Tracking System) specialist.
    Your task is to analyze the plain text extracted from a candidate's resume and return a structured assessment.
    Evaluate ATS readiness, technical clarity, formatting impact, missing keywords, and provide actionable recommendations.
    Always return your analysis strictly according to the requested JSON schema.
  `;

  const prompt = `
Resume Content:
"""
${resumeText}
"""

Please conduct a comprehensive review of this resume content and provide detailed feedback and scoring.
  `;

  const response = await generateContentWithRetry(ai, {
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: resumeAnalysisSchema,
      temperature: 0.2,
    },
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Empty response received from Gemini API during resume analysis");
  }

  const analysis: IResumeAnalysis = JSON.parse(responseText);

  return analysis;
};