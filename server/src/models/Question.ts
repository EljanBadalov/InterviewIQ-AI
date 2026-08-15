import { Schema, model, Types } from "mongoose";

export type QuestionDifficulty = "beginner" | "intermediate" | "advanced" | "senior";
export type InterviewType = "technical" | "behavioral";

export interface IQuestion {
  _id?: Types.ObjectId;
  text: string;
  category: string;
  difficulty: QuestionDifficulty;
  interviewType: InterviewType;
  tags?: string[];
  isActive?: boolean;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    text: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
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
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "CreatedBy (User ID) is required"],
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({
  category: 1,
  difficulty: 1,
  interviewType: 1,
  isActive: 1,
});

export const Question = model<IQuestion>("Question", questionSchema);