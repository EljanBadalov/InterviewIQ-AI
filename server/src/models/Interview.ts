import { Schema, model, Types } from "mongoose";
import type { QuestionDifficulty, InterviewType } from "./Question";

export type InterviewStatus = "in_progress" | "completed" | "cancelled";
export type EvaluationStatus = "pending" | "completed" | "failed";

export interface IInterviewAnswer {
  _id?: Types.ObjectId;
  question: Types.ObjectId;
  questionText: string;
  answerText?: string;
  score?: number;
  technicalAccuracy?: number;
  completeness?: number;
  communication?: number;
  strengths?: string[];
  weaknesses?: string[];
  feedback?: string;
  improvedAnswer?: string;
  followUpQuestion?: string;
  evaluationStatus: EvaluationStatus;
}

export interface IFinalReport {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
}

export interface IInterview {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  category: string;
  difficulty: QuestionDifficulty;
  interviewType: InterviewType;
  status: InterviewStatus;
  answers: IInterviewAnswer[];
  overallScore?: number;
  finalReport?: IFinalReport;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const interviewAnswerSchema = new Schema<IInterviewAnswer>(
  {
    question: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: [true, "Question reference is required"],
    },
    questionText: {
      type: String,
      required: [true, "Question text snapshot is required"],
      trim: true,
    },
    answerText: {
      type: String,
      trim: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    technicalAccuracy: {
      type: Number,
      min: 0,
      max: 100,
    },
    completeness: {
      type: Number,
      min: 0,
      max: 100,
    },
    communication: {
      type: Number,
      min: 0,
      max: 100,
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    feedback: {
      type: String,
      trim: true,
    },
    improvedAnswer: {
      type: String,
      trim: true,
    },
    followUpQuestion: {
      type: String,
      trim: true,
    },
    evaluationStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  { _id: true }
);

const interviewSchema = new Schema<IInterview>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      lowercase: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "senior"],
      required: [true, "Difficulty level is required"],
    },
    interviewType: {
      type: String,
      enum: ["technical", "behavioral"],
      required: [true, "Interview type is required"],
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "cancelled"],
      default: "in_progress",
    },
    answers: {
      type: [interviewAnswerSchema],
      default: [],
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    finalReport: {
      summary: { type: String, trim: true },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      recommendations: { type: [String], default: [] },
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

interviewSchema.index({ user: 1, createdAt: -1 });

interviewSchema.index({ user: 1, status: 1 });

export const Interview = model<IInterview>("Interview", interviewSchema);