import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import mongoose from "mongoose";

import {
  Interview,
  type IInterviewAnswer,
} from "../models/Interview";

import {
  Question,
  type QuestionDifficulty,
  type InterviewType,
} from "../models/Question";

import {
  evaluateInterviewAnswer,
} from "../services/interviewEvaluationService";

import {
  recordInterviewSkillEvidence,
} from "../services/skillEvidenceService";

/* =========================================
   CONSTANTS
========================================= */

const QUESTIONS_PER_INTERVIEW = 4;

const VALID_DIFFICULTIES: QuestionDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "senior",
];

const VALID_INTERVIEW_TYPES: InterviewType[] = [
  "technical",
  "behavioral",
];

/* =========================================
   HELPERS
========================================= */

const getUserId = (
  req: Request
): mongoose.Types.ObjectId | null => {
  if (!req.user || !req.user._id) {
    return null;
  }

  return new mongoose.Types.ObjectId(
    String(req.user._id)
  );
};

const getParamString = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

const isValidObjectId = (
  value: string
): boolean => {
  return mongoose.Types.ObjectId.isValid(
    value
  );
};

const normalizeCategory = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
};

/* =========================================
   START INTERVIEW
========================================= */

export const startInterviewController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const category =
        normalizeCategory(
          req.body.category
        );

      const difficulty =
        req.body
          .difficulty as QuestionDifficulty;

      const interviewType =
        req.body
          .interviewType as InterviewType;

      /* =========================
         VALIDATION
      ========================= */

      if (!category) {
        res.status(400).json({
          success: false,
          message:
            "Category is required",
        });

        return;
      }

      if (
        !VALID_DIFFICULTIES.includes(
          difficulty
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid difficulty",
        });

        return;
      }

      if (
        !VALID_INTERVIEW_TYPES.includes(
          interviewType
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid interview type",
        });

        return;
      }

      /* =========================
         RANDOM QUESTIONS
      ========================= */

      const questions =
        await Question.aggregate([
          {
            $match: {
              category,
              difficulty,
              interviewType,
              isActive: true,
            },
          },

          {
            $sample: {
              size:
                QUESTIONS_PER_INTERVIEW,
            },
          },

          {
            $project: {
              _id: 1,
              text: 1,
              category: 1,
              difficulty: 1,
              interviewType: 1,
              tags: 1,
            },
          },
        ]);

      /* =========================
         NOT ENOUGH QUESTIONS
      ========================= */

      if (
        questions.length <
        QUESTIONS_PER_INTERVIEW
      ) {
        res.status(400).json({
          success: false,

          message:
            `Not enough questions available for ${category} / ${difficulty} / ${interviewType}. ` +
            `Required: ${QUESTIONS_PER_INTERVIEW}, available: ${questions.length}.`,
        });

        return;
      }

      /* =========================
         CREATE SNAPSHOTS
      ========================= */

      const answerSnapshots:
        IInterviewAnswer[] =
        questions.map(
          (question) => ({
            question:
              question._id,

            questionText:
              question.text,

            evaluationStatus:
              "pending",
          })
        );

      /* =========================
         CREATE INTERVIEW
      ========================= */

      const interview =
        await Interview.create({
          user: userId,

          category,

          difficulty,

          interviewType,

          status:
            "in_progress",

          answers:
            answerSnapshots,

          startedAt:
            new Date(),
        });

      const firstQuestion =
        interview.answers[0];

      if (!firstQuestion) {
        throw new Error(
          "Interview was created without questions."
        );
      }

      /* =========================
         RESPONSE
      ========================= */

      res.status(201).json({
        success: true,

        message:
          "Interview started successfully",

        data: {
          interviewId:
            interview._id,

          status:
            interview.status,

          totalQuestions:
            interview.answers
              .length,

          currentQuestionIndex:
            0,

          question: {
            questionId:
              firstQuestion.question,

            questionText:
              firstQuestion.questionText,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

/* =========================================
   SUBMIT ANSWER
========================================= */

export const submitInterviewAnswerController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const interviewId =
        getParamString(
          req.params.id
        );

      const {
        questionId,
        answerText,
      } = req.body;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !interviewId ||
        !isValidObjectId(
          interviewId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid interview ID",
        });

        return;
      }

      if (
        !questionId ||
        typeof questionId !==
          "string" ||
        !isValidObjectId(
          questionId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Valid questionId is required",
        });

        return;
      }

      if (
        typeof answerText !==
          "string" ||
        answerText.trim().length <
          10
      ) {
        res.status(400).json({
          success: false,

          message:
            "Answer must contain at least 10 characters",
        });

        return;
      }

      /* =========================
         LOAD INTERVIEW
      ========================= */

      const interview =
        await Interview.findOne({
          _id: interviewId,
          user: userId,
        });

      if (!interview) {
        res.status(404).json({
          success: false,
          message:
            "Interview not found",
        });

        return;
      }

      if (
        interview.status !==
        "in_progress"
      ) {
        res.status(400).json({
          success: false,

          message:
            "This interview is not in progress",
        });

        return;
      }

      /* =========================
         FIND QUESTION
      ========================= */

      const answerIndex =
        interview.answers.findIndex(
          (item) =>
            String(
              item.question
            ) === questionId
        );

      if (
        answerIndex === -1
      ) {
        res.status(404).json({
          success: false,

          message:
            "Question does not belong to this interview",
        });

        return;
      }

      const answerDocument =
        interview.answers[
          answerIndex
        ];

      if (!answerDocument) {
        res.status(404).json({
          success: false,
          message:
            "Question not found",
        });

        return;
      }

      /* =========================
         PREVENT DUPLICATE
      ========================= */

      if (
        answerDocument.answerText &&
        answerDocument
          .evaluationStatus ===
          "completed"
      ) {
        res.status(409).json({
          success: false,

          message:
            "This question has already been answered",
        });

        return;
      }

      /* =====================================
         AI EVALUATION
      ===================================== */

      let evaluation;

      try {
        evaluation =
          await evaluateInterviewAnswer(
            {
              category:
                interview.category,

              difficulty:
                interview.difficulty,

              interviewType:
                interview.interviewType,

              question:
                answerDocument.questionText,

              answer:
                answerText.trim(),
            }
          );
      } catch (evaluationError) {
        console.error(
          "Interview AI evaluation failed:",
          evaluationError
        );

        res.status(503).json({
          success: false,

          message:
            "AI evaluation could not be completed. Your answer was not skipped. Please submit it again.",
        });

        return;
      }

      /* =====================================
         SAVE ONLY AFTER VALID EVALUATION
      ===================================== */

      answerDocument.answerText =
        answerText.trim();

      answerDocument.score =
        evaluation.score;

      answerDocument.technicalAccuracy =
        evaluation.technicalAccuracy;

      answerDocument.completeness =
        evaluation.completeness;

      answerDocument.communication =
        evaluation.communication;

      answerDocument.strengths =
        evaluation.strengths;

      answerDocument.weaknesses =
        evaluation.weaknesses;

      answerDocument.feedback =
        evaluation.feedback;

      answerDocument.improvedAnswer =
        evaluation.improvedAnswer;

      answerDocument.followUpQuestion =
        evaluation.followUpQuestion;

      answerDocument.evaluationStatus =
        "completed";

      /* =====================================
         VERIFIED SKILL EVIDENCE
      ===================================== */

      try {
        const question =
          await Question.findById(
            questionId
          )
            .select(
              "tags category interviewType"
            )
            .lean();

        if (question) {
          await recordInterviewSkillEvidence({
            userId,
            interviewId:
              new mongoose.Types.ObjectId(
                interviewId
              ),
            questionId:
              new mongoose.Types.ObjectId(
                questionId
              ),
            questionTags:
              question.tags ?? [],
            score:
              evaluation.score,
            technicalAccuracy:
              evaluation.technicalAccuracy,
            interviewType:
              question.interviewType,
            category:
              question.category,
          });
        }
      } catch (skillEvidenceError) {
        console.error(
          "Skill evidence update failed:",
          skillEvidenceError
        );
      }

      /* =====================================
         FIND NEXT QUESTION
      ===================================== */

      let nextQuestionIndex =
        -1;

      for (
        let index =
          answerIndex + 1;
        index <
        interview.answers.length;
        index++
      ) {
        const candidate =
          interview.answers[
            index
          ];

        if (
          candidate &&
          !candidate.answerText
        ) {
          nextQuestionIndex =
            index;

          break;
        }
      }

      if (
        nextQuestionIndex === -1
      ) {
        nextQuestionIndex =
          interview.answers.findIndex(
            (candidate) =>
              !candidate.answerText
          );
      }

      const hasNextQuestion =
        nextQuestionIndex !==
        -1;

      /* =====================================
         COMPLETE INTERVIEW
      ===================================== */

      if (!hasNextQuestion) {
        const completedScores =
          interview.answers
            .map(
              (item) =>
                item.score
            )
            .filter(
              (
                score
              ): score is number =>
                typeof score ===
                "number"
            );

        const overallScore =
          completedScores.length >
          0
            ? Math.round(
                completedScores.reduce(
                  (
                    total,
                    score
                  ) =>
                    total +
                    score,
                  0
                ) /
                  completedScores.length
              )
            : 0;

        const allStrengths =
          interview.answers
            .flatMap(
              (item) =>
                item.strengths ??
                []
            )
            .filter(Boolean);

        const allWeaknesses =
          interview.answers
            .flatMap(
              (item) =>
                item.weaknesses ??
                []
            )
            .filter(Boolean);

        interview.overallScore =
          overallScore;

        interview.status =
          "completed";

        interview.completedAt =
          new Date();

        interview.finalReport = {
          summary:
            `Interview completed with an overall score of ${overallScore}%.`,

          strengths: [
            ...new Set(
              allStrengths
            ),
          ].slice(0, 6),

          improvements: [
            ...new Set(
              allWeaknesses
            ),
          ].slice(0, 6),

          recommendations: [
            "Review the questions where your score was lowest.",
            "Practice explaining your reasoning clearly and concisely.",
            "Use concrete examples when answering interview questions.",
          ],
        };

        await interview.save();

        res.status(200).json({
          success: true,

          message:
            "Answer analyzed and interview completed successfully",

          data: {
            status:
              "completed",

            completed: true,

            currentQuestionIndex:
              answerIndex,

            totalQuestions:
              interview.answers
                .length,

            evaluation: {
              score:
                evaluation.score,

              technicalAccuracy:
                evaluation.technicalAccuracy,

              completeness:
                evaluation.completeness,

              communication:
                evaluation.communication,

              strengths:
                evaluation.strengths,

              weaknesses:
                evaluation.weaknesses,

              feedback:
                evaluation.feedback,

              improvedAnswer:
                evaluation.improvedAnswer,

              followUpQuestion:
                evaluation.followUpQuestion,
            },

            overallScore,

            finalReport:
              interview.finalReport,
          },
        });

        return;
      }

      /* =====================================
         NEXT QUESTION
      ===================================== */

      const nextAnswer =
        interview.answers[
          nextQuestionIndex
        ];

      if (!nextAnswer) {
        throw new Error(
          "Next interview question could not be found."
        );
      }

      await interview.save();

      res.status(200).json({
        success: true,

        message:
          "Answer analyzed successfully",

        data: {
          status:
            "in_progress",

          completed: false,

          currentQuestionIndex:
            nextQuestionIndex,

          totalQuestions:
            interview.answers
              .length,

          evaluation: {
            score:
              evaluation.score,

            technicalAccuracy:
              evaluation.technicalAccuracy,

            completeness:
              evaluation.completeness,

            communication:
              evaluation.communication,

            strengths:
              evaluation.strengths,

            weaknesses:
              evaluation.weaknesses,

            feedback:
              evaluation.feedback,

            improvedAnswer:
              evaluation.improvedAnswer,

            followUpQuestion:
              evaluation.followUpQuestion,
          },

          nextQuestion: {
            questionId:
              nextAnswer.question,

            questionText:
              nextAnswer.questionText,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

/* =========================================
   GET ONE INTERVIEW
========================================= */

export const getInterviewController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const interviewId =
        getParamString(
          req.params.id
        );

      if (
        !interviewId ||
        !isValidObjectId(
          interviewId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid interview ID",
        });

        return;
      }

      const interview =
        await Interview.findOne({
          _id: interviewId,
          user: userId,
        });

      if (!interview) {
        res.status(404).json({
          success: false,
          message:
            "Interview not found",
        });

        return;
      }

      const currentIndex =
        interview.status ===
        "completed"
          ? Math.max(
              interview.answers
                .length - 1,
              0
            )
          : interview.answers.findIndex(
              (item) =>
                !item.answerText
            );

      const safeIndex =
        currentIndex >= 0
          ? currentIndex
          : 0;

      const currentQuestion =
        interview.answers[
          safeIndex
        ];

      res.status(200).json({
        success: true,

        data: {
          interviewId:
            interview._id,

          category:
            interview.category,

          difficulty:
            interview.difficulty,

          interviewType:
            interview.interviewType,

          status:
            interview.status,

          totalQuestions:
            interview.answers
              .length,

          currentQuestionIndex:
            safeIndex,

          overallScore:
            interview.overallScore,

          finalReport:
            interview.finalReport,

          question:
            currentQuestion
              ? {
                  questionId:
                    currentQuestion.question,

                  questionText:
                    currentQuestion.questionText,
                }
              : null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

/* =========================================
   GET ALL USER INTERVIEWS
========================================= */

export const getInterviewsController =
  async (
    req: Request,
    req2: Request, // Note: Adding a dummy to match the format of arguments correctly? The original had req, res, next
    res: Response,
    next: NextFunction
  ): Promise<void> => { // Let's correct this back
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const interviews =
        await Interview.find({
          user: userId,
        })
          .sort({
            createdAt: -1,
          })
          .select(
            "_id category difficulty interviewType status overallScore startedAt completedAt createdAt"
          );

      res.status(200).json({
        success: true,
        data: interviews,
      });
    } catch (error) {
      next(error);
    }
  };

// Correcting the function signature for getInterviewsController
export const getInterviewsControllerCorrected =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const interviews =
        await Interview.find({
          user: userId,
        })
          .sort({
            createdAt: -1,
          })
          .select(
            "_id category difficulty interviewType status overallScore startedAt completedAt createdAt"
          );

      res.status(200).json({
        success: true,
        data: interviews,
      });
    } catch (error) {
      next(error);
    }
  };

// Re-exporting with correct name
export { getInterviewsControllerCorrected as getInterviewsControllerAlternative }

/* =========================================
   DELETE INTERVIEW
========================================= */

export const deleteInterviewController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId =
        getUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const interviewId =
        getParamString(
          req.params.id
        );

      if (
        !interviewId ||
        !isValidObjectId(
          interviewId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid interview ID",
        });

        return;
      }

      const interview =
        await Interview.findOneAndDelete(
          {
            _id: interviewId,
            user: userId,
          }
        );

      if (!interview) {
        res.status(404).json({
          success: false,
          message:
            "Interview not found",
        });

        return;
      }

      res.status(200).json({
        success: true,

        message:
          "Interview deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };