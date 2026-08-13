import { type Request, type Response, type NextFunction } from "express";
import { Question } from "../models/Question";
import { Interview } from "../models/Interview";
import { Types } from "mongoose";
import { evaluateAnswer } from "../services/geminiService";

export const createInterviewController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Not authorized",
            });
            return;
        }

        const { category, difficulty, interviewType } = req.body;

        const formattedCategory = (category as string).toLowerCase().trim();

        const questions = await Question.aggregate([
            {
                $match: {
                    category: formattedCategory,
                    difficulty,
                    interviewType,
                    isActive: true,
                },
            },
            {
                $sample: { size: 5 },
            },
        ]);

        if (!questions || questions.length === 0) {
            res.status(404).json({
                success: false,
                message: "No questions available for the selected interview criteria",
            });
            return;
        }

        const initialAnswers = questions.map((q) => ({
            question: q._id,
            questionText: q.text,
            evaluationStatus: "pending" as const,
        }));

        const interview = await Interview.create({
            user: req.user._id,
            category: formattedCategory,
            difficulty,
            interviewType,
            answers: initialAnswers,
        });

        const firstQuestion = {
            questionId: interview.answers[0].question,
            questionText: interview.answers[0].questionText,
        };

        res.status(201).json({
            success: true,
            message: "Interview started successfully",
            data: {
                interviewId: interview._id,
                status: interview.status,
                totalQuestions: interview.answers.length,
                currentQuestionIndex: 0,
                question: firstQuestion,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const submitAnswerController = async (
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

    const { id } = req.params;

    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid interview ID format",
      });
      return;
    }

    const interview = await Interview.findById(id);

    if (!interview) {
      res.status(404).json({
        success: false,
        message: "Interview session not found",
      });
      return;
    }

    if (interview.user.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to access this interview session",
      });
      return;
    }

    if (interview.status !== "in_progress") {
      res.status(400).json({
        success: false,
        message: `Cannot submit answer. Interview status is '${interview.status}'`,
      });
      return;
    }

    const unansweredIndex = interview.answers.findIndex(
      (ans) => !ans.answerText || ans.answerText.trim() === ""
    );

    if (unansweredIndex === -1) {
      res.status(400).json({
        success: false,
        message: "All questions in this interview session have already been answered",
      });
      return;
    }

    const { answerText } = req.body;
    const currentAnswer = interview.answers[unansweredIndex];

    currentAnswer.answerText = answerText;

    try {
      const aiResult = await evaluateAnswer({
        questionText: currentAnswer.questionText,
        answerText,
        category: interview.category,
        difficulty: interview.difficulty,
        interviewType: interview.interviewType,
      });

      currentAnswer.score = aiResult.score;
      currentAnswer.technicalAccuracy = aiResult.technicalAccuracy;
      currentAnswer.completeness = aiResult.completeness;
      currentAnswer.communication = aiResult.communication;
      currentAnswer.strengths = aiResult.strengths;
      currentAnswer.weaknesses = aiResult.weaknesses;
      currentAnswer.feedback = aiResult.feedback;
      currentAnswer.improvedAnswer = aiResult.improvedAnswer;
      currentAnswer.followUpQuestion = aiResult.followUpQuestion;
      currentAnswer.evaluationStatus = "completed";
    } catch (aiError) {
      console.error("Gemini AI evaluation error:", aiError);
      currentAnswer.evaluationStatus = "failed";
    }

    await interview.save();

    const nextUnansweredIndex = interview.answers.findIndex(
      (ans) => !ans.answerText || ans.answerText.trim() === ""
    );

    const submittedEvaluation = {
      score: currentAnswer.score,
      technicalAccuracy: currentAnswer.technicalAccuracy,
      completeness: currentAnswer.completeness,
      communication: currentAnswer.communication,
      strengths: currentAnswer.strengths,
      weaknesses: currentAnswer.weaknesses,
      feedback: currentAnswer.feedback,
      improvedAnswer: currentAnswer.improvedAnswer,
      followUpQuestion: currentAnswer.followUpQuestion,
      evaluationStatus: currentAnswer.evaluationStatus,
    };

    const isAiSuccess = currentAnswer.evaluationStatus === "completed";

    if (nextUnansweredIndex !== -1) {
      const nextQuestion = interview.answers[nextUnansweredIndex];

      res.status(200).json({
        success: true,
        message: isAiSuccess
          ? "Answer submitted and evaluated successfully"
          : "Answer saved, but AI evaluation failed",
        data: {
          isCompleted: false,
          currentQuestionIndex: nextUnansweredIndex,
          totalQuestions: interview.answers.length,
          evaluation: submittedEvaluation,
          nextQuestion: {
            questionId: nextQuestion.question,
            questionText: nextQuestion.questionText,
          },
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: isAiSuccess
        ? "All questions answered and evaluated successfully"
        : "All questions answered, but last AI evaluation failed",
      data: {
        isCompleted: true,
        totalQuestions: interview.answers.length,
        evaluation: submittedEvaluation,
      },
    });
  } catch (error) {
    next(error);
  }
};9