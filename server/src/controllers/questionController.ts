import { type Request, type Response, type NextFunction } from "express";
import { type QueryFilter, Types } from "mongoose";
import { Question, type IQuestion } from "../models/Question";

export const createQuestionController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { text, category, difficulty, interviewType, tags, isActive } = req.body;

        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Not authorized",
            });
            return;
        }

        const question = await Question.create({
            text,
            category,
            difficulty,
            interviewType,
            tags,
            isActive,
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: "Question created successfully",
            data: {
                question,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getQuestionsController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { category, difficulty, interviewType } = req.query;

        const filter: QueryFilter<IQuestion> = {
            isActive: true,
        };

        if (category) {
            filter.category = (category as string).toLowerCase().trim();
        }

        if (difficulty) {
            filter.difficulty = difficulty as IQuestion["difficulty"];
        }

        if (interviewType) {
            filter.interviewType = interviewType as IQuestion["interviewType"];
        }

        const questions = await Question.find(filter).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: questions.length,
            data: {
                questions,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const getQuestionByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid question ID format",
            });
            return;
        }

        const question = await Question.findById(id);

        if (!question) {
            res.status(404).json({
                success: false,
                message: "Question not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                question,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateQuestionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
      return;
    }

    const question = await Question.findById(id);

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    const { text, category, difficulty, interviewType, tags, isActive } = req.body;

    if (text !== undefined) question.text = text;
    if (category !== undefined) question.category = category;
    if (difficulty !== undefined) question.difficulty = difficulty;
    if (interviewType !== undefined) question.interviewType = interviewType;
    if (tags !== undefined) question.tags = tags;
    if (isActive !== undefined) question.isActive = isActive;

    const updatedQuestion = await question.save();

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: {
        question: updatedQuestion,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID format",
      });
      return;
    }

    const question = await Question.findById(id);

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    await question.deleteOne();

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};