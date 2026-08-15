import {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Question } from "../models/Question";

const getParamString = (
  value: string | string[] | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

export const getBookmarksController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const user = await User.findById(req.user._id).populate({
      path: "bookmarks",
      model: "Question",
      select:
        "text category difficulty interviewType tags isActive createdAt",
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        bookmarks: user.bookmarks,
        totalBookmarks: user.bookmarks.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addBookmarkController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const questionId = getParamString(req.params.questionId);

    if (!questionId || !Types.ObjectId.isValid(questionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
      return;
    }

    const question = await Question.findById(questionId);

    if (!question) {
      res.status(404).json({
        success: false,
        message: "Question not found",
      });
      return;
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const questionObjectId = new Types.ObjectId(questionId);

    const alreadyBookmarked = user.bookmarks.some(
      (bookmarkId) =>
        bookmarkId.toString() === questionObjectId.toString()
    );

    if (alreadyBookmarked) {
      res.status(200).json({
        success: true,
        message: "Question is already bookmarked",
        data: {
          questionId,
          bookmarked: true,
        },
      });
      return;
    }

    user.bookmarks.push(questionObjectId);

    await user.save();

    res.status(201).json({
      success: true,
      message: "Question bookmarked successfully",
      data: {
        questionId,
        bookmarked: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeBookmarkController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const questionId = getParamString(req.params.questionId);

    if (!questionId || !Types.ObjectId.isValid(questionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
      return;
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const bookmarkExists = user.bookmarks.some(
      (bookmarkId) =>
        bookmarkId.toString() === questionId
    );

    if (!bookmarkExists) {
      res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
      return;
    }

    user.bookmarks = user.bookmarks.filter(
      (bookmarkId) =>
        bookmarkId.toString() !== questionId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
      data: {
        questionId,
        bookmarked: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookmarkStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user._id) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const questionId = getParamString(req.params.questionId);

    if (!questionId || !Types.ObjectId.isValid(questionId)) {
      res.status(400).json({
        success: false,
        message: "Invalid question ID",
      });
      return;
    }

    const user = await User.findById(req.user._id).select(
      "bookmarks"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const bookmarked = user.bookmarks.some(
      (bookmarkId) =>
        bookmarkId.toString() === questionId
    );

    res.status(200).json({
      success: true,
      data: {
        questionId,
        bookmarked,
      },
    });
  } catch (error) {
    next(error);
  }
};