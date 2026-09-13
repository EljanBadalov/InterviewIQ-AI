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

import {
  buildCareerSkillProfile,
} from "../services/careerSkillProfileService";

/* =========================================
   CONSTANTS
========================================= */

const QUESTIONS_PER_TYPE = 3;
const TOTAL_QUESTIONS = 6;

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

const DIFFICULTY_ORDER:
  QuestionDifficulty[] = [
    "beginner",
    "intermediate",
    "advanced",
    "senior",
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


const normalizeRoleSlug = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

/*
 * Existing Question documents may still use the older category names.
 * Career Fields now use slugs such as "frontend-developer".
 *
 * These aliases keep the old question bank working while allowing
 * new question documents to use the Career Field slug directly.
 */
const LEGACY_CATEGORY_ALIASES:
  Record<
    string,
    string[]
  > = {
    "frontend-developer": [
      "frontend-developer",
      "frontend",
    ],

    "backend-developer": [
      "backend-developer",
      "backend",
    ],

    "software-engineer": [
      "software-engineer",
      "software-engineering",
    ],

    "devops-engineer": [
      "devops-engineer",
      "devops",
    ],

    "ui-ux-designer": [
      "ui-ux-designer",
      "ui-ux-design",
    ],

    "machine-learning-engineer": [
      "machine-learning-engineer",
      "machine-learning",
    ],
  };

const getQuestionCategoryCandidates = (
  roleSlug: string
): string[] => {
  const values =
    LEGACY_CATEGORY_ALIASES[
      roleSlug
    ] || [roleSlug];

  return [
    ...new Set(
      values
        .map(
          (
            value
          ) =>
            normalizeCategory(
              value
            )
        )
        .filter(Boolean)
    ),
  ];
};


/* =========================================
   ADAPTIVE DIFFICULTY
========================================= */

interface IAdaptiveDifficultyResult {
  detectedLevel:
    QuestionDifficulty;

  stretchLevel:
    QuestionDifficulty;

  confidenceScore:
    number;

  previousInterviewAverage?:
    number;

  evidenceAverage?:
    number;

  reason:
    string;
}

const averageNumbers = (
  values:
    number[]
): number | undefined => {
  const safe =
    values.filter(
      (
        value
      ) =>
        Number.isFinite(
          value
        )
    );

  if (
    safe.length ===
    0
  ) {
    return undefined;
  }

  return (
    safe.reduce(
      (
        total,
        value
      ) =>
        total +
        value,
      0
    ) /
    safe.length
  );
};

const getNextDifficulty = (
  difficulty:
    QuestionDifficulty
): QuestionDifficulty => {
  const index =
    DIFFICULTY_ORDER.indexOf(
      difficulty
    );

  if (
    index < 0 ||
    index >=
      DIFFICULTY_ORDER.length -
        1
  ) {
    return difficulty;
  }

  return (
    DIFFICULTY_ORDER[
      index + 1
    ] ||
    difficulty
  );
};

const scoreToDifficulty = (
  score:
    number
): QuestionDifficulty => {
  if (
    score >=
    88
  ) {
    return "senior";
  }

  if (
    score >=
    74
  ) {
    return "advanced";
  }

  if (
    score >=
    48
  ) {
    return "intermediate";
  }

  return "beginner";
};

const determineAdaptiveDifficulty =
  async ({
    userId,
    roleSlug,
  }: {
    userId:
      mongoose.Types.ObjectId;

    roleSlug:
      string;
  }): Promise<IAdaptiveDifficultyResult> => {
    /*
     * 1. Previous completed interviews for the SAME career field
     *    are the strongest signal because they are directly
     *    role-specific.
     */
    const previousInterviews =
      await Interview.find({
        user:
          userId,

        category:
          roleSlug,

        status:
          "completed",
      })
        .sort({
          completedAt:
            -1,
        })
        .limit(
          5
        )
        .select(
          "overallScore"
        )
        .lean();

    const previousInterviewAverage =
      averageNumbers(
        previousInterviews
          .map(
            (
              interview
            ) =>
              typeof interview.overallScore ===
              "number"
                ? interview.overallScore
                : NaN
          )
      );

    /*
     * 2. Unified Career Skill Profile provides broader evidence
     *    from resume + mock interview + technical questions +
     *    projects + other verified evidence.
     *
     *    CV formatting / ATS score is intentionally NOT used.
     */
    let evidenceAverage:
      number | undefined;

    try {
      const profile =
        await buildCareerSkillProfile({
          userId,

          strongestSkillLimit:
            10,
        });

      const verifiedScores =
        profile
          .verifiedSkills
          .map(
            (
              skill
            ) =>
              skill.skillScore
          )
          .filter(
            (
              score
            ) =>
              Number.isFinite(
                score
              )
          );

      const strongestScores =
        profile
          .strongestSkills
          .map(
            (
              skill
            ) =>
              skill.skillScore
          )
          .filter(
            (
              score
            ) =>
              Number.isFinite(
                score
              )
          );

      evidenceAverage =
        averageNumbers(
          verifiedScores.length >
            0
            ? verifiedScores
            : strongestScores
        );
    } catch (
      profileError
    ) {
      console.error(
        "[Interview Adaptive Difficulty] Career profile could not be loaded:",
        profileError
      );
    }

    /*
     * Weight role-specific interview history more heavily.
     */
    let confidenceScore =
      50;

    let reason =
      "No strong prior evidence was available, so InterviewIQ starts at an intermediate baseline.";

    if (
      typeof previousInterviewAverage ===
        "number" &&
      typeof evidenceAverage ===
        "number"
    ) {
      confidenceScore =
        Math.round(
          previousInterviewAverage *
            0.7 +
          evidenceAverage *
            0.3
        );

      reason =
        "Difficulty was calculated from previous interviews in this career field plus verified skill evidence.";
    } else if (
      typeof previousInterviewAverage ===
      "number"
    ) {
      confidenceScore =
        Math.round(
          previousInterviewAverage
        );

      reason =
        "Difficulty was calculated primarily from previous interviews in this career field.";
    } else if (
      typeof evidenceAverage ===
      "number"
    ) {
      confidenceScore =
        Math.round(
          evidenceAverage
        );

      /*
       * Do not jump a first-time user directly to Senior solely
       * from general skill evidence.
       */
      confidenceScore =
        Math.min(
          confidenceScore,
          82
        );

      reason =
        "Difficulty was estimated from verified skill evidence because no completed interview exists for this career field yet.";
    }

    const detectedLevel =
      scoreToDifficulty(
        confidenceScore
      );

    const stretchLevel =
      getNextDifficulty(
        detectedLevel
      );

    return {
      detectedLevel,

      stretchLevel,

      confidenceScore,

      previousInterviewAverage:
        typeof previousInterviewAverage ===
        "number"
          ? Math.round(
              previousInterviewAverage
            )
          : undefined,

      evidenceAverage:
        typeof evidenceAverage ===
        "number"
          ? Math.round(
              evidenceAverage
            )
          : undefined,

      reason,
    };
  };

/* =========================================
   QUESTION SELECTION
========================================= */

const sampleQuestions = async ({
  categoryCandidates,
  interviewType,
  difficulty,
  size,
  excludedIds,
}: {
  categoryCandidates:
    string[];

  interviewType:
    InterviewType;

  difficulty:
    QuestionDifficulty;

  size:
    number;

  excludedIds:
    mongoose.Types.ObjectId[];
}) => {
  if (
    size <= 0
  ) {
    return [];
  }

  const match:
    Record<
      string,
      unknown
    > = {
    category: {
      $in:
        categoryCandidates,
    },

    difficulty,

    interviewType,

    isActive:
      true,
  };

  if (
    excludedIds.length >
    0
  ) {
    match._id = {
      $nin:
        excludedIds,
    };
  }

  return Question.aggregate([
    {
      $match:
        match,
    },

    {
      $sample: {
        size,
      },
    },

    {
      $project: {
        _id:
          1,

        text:
          1,

        category:
          1,

        difficulty:
          1,

        interviewType:
          1,

        tags:
          1,
      },
    },
  ]);
};

const getAdaptiveQuestionsForType =
  async ({
    categoryCandidates,
    interviewType,
    detectedLevel,
    stretchLevel,
  }: {
    categoryCandidates:
      string[];

    interviewType:
      InterviewType;

    detectedLevel:
      QuestionDifficulty;

    stretchLevel:
      QuestionDifficulty;
  }) => {
    const selected:
      any[] = [];

    /*
     * Default mix:
     * 2 questions at detected level
     * 1 stretch question one level higher
     *
     * Senior users receive 3 senior questions.
     */
    const baseCount =
      detectedLevel ===
      stretchLevel
        ? 3
        : 2;

    const stretchCount =
      detectedLevel ===
      stretchLevel
        ? 0
        : 1;

    const baseQuestions =
      await sampleQuestions({
        categoryCandidates,

        interviewType,

        difficulty:
          detectedLevel,

        size:
          baseCount,

        excludedIds:
          [],
      });

    selected.push(
      ...baseQuestions
    );

    const excludedIds =
      selected.map(
        (
          question
        ) =>
          new mongoose.Types.ObjectId(
            question._id
          )
      );

    const stretchQuestions =
      await sampleQuestions({
        categoryCandidates,

        interviewType,

        difficulty:
          stretchLevel,

        size:
          stretchCount,

        excludedIds,
      });

    selected.push(
      ...stretchQuestions
    );

    /*
     * If the preferred mix is short, fill remaining slots from
     * the nearest useful difficulties rather than failing
     * immediately.
     */
    if (
      selected.length <
      QUESTIONS_PER_TYPE
    ) {
      const fallbackOrder =
        DIFFICULTY_ORDER
          .slice()
          .sort(
            (
              a,
              b
            ) =>
              Math.abs(
                DIFFICULTY_ORDER.indexOf(
                  a
                ) -
                DIFFICULTY_ORDER.indexOf(
                  detectedLevel
                )
              ) -
              Math.abs(
                DIFFICULTY_ORDER.indexOf(
                  b
                ) -
                DIFFICULTY_ORDER.indexOf(
                  detectedLevel
                )
              )
          );

      for (
        const fallbackDifficulty
        of fallbackOrder
      ) {
        if (
          selected.length >=
          QUESTIONS_PER_TYPE
        ) {
          break;
        }

        const currentExcludedIds =
          selected.map(
            (
              question
            ) =>
              new mongoose.Types.ObjectId(
                question._id
              )
          );

        const needed =
          QUESTIONS_PER_TYPE -
          selected.length;

        const fallbackQuestions =
          await sampleQuestions({
            categoryCandidates,

            interviewType,

            difficulty:
              fallbackDifficulty,

            size:
              needed,

            excludedIds:
              currentExcludedIds,
          });

        selected.push(
          ...fallbackQuestions
        );
      }
    }

    return selected.slice(
      0,
      QUESTIONS_PER_TYPE
    );
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

      if (
        !userId
      ) {
        res.status(
          401
        ).json({
          success:
            false,

          message:
            "Not authorized",
        });

        return;
      }

      /*
       * Frontend only needs to send:
       *
       * {
       *   roleSlug: "frontend-developer"
       * }
       *
       * Old category remains a fallback for backward compatibility.
       */
      const roleSlug =
        normalizeRoleSlug(
          req.body.roleSlug ||
          req.body.category
        );

      if (
        !roleSlug
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            "Career field is required",
        });

        return;
      }

      const categoryCandidates =
        getQuestionCategoryCandidates(
          roleSlug
        );

      /* =========================
         ADAPTIVE LEVEL
      ========================= */

      const adaptive =
        await determineAdaptiveDifficulty({
          userId,

          roleSlug,
        });

      /* =========================
         3 TECHNICAL
      ========================= */

      const technicalQuestions =
        await getAdaptiveQuestionsForType({
          categoryCandidates,

          interviewType:
            "technical",

          detectedLevel:
            adaptive.detectedLevel,

          stretchLevel:
            adaptive.stretchLevel,
        });

      /* =========================
         3 BEHAVIORAL
      ========================= */

      const behavioralQuestions =
        await getAdaptiveQuestionsForType({
          categoryCandidates,

          interviewType:
            "behavioral",

          detectedLevel:
            adaptive.detectedLevel,

          stretchLevel:
            adaptive.stretchLevel,
        });

      if (
        technicalQuestions.length <
          QUESTIONS_PER_TYPE ||
        behavioralQuestions.length <
          QUESTIONS_PER_TYPE
      ) {
        res.status(
          400
        ).json({
          success:
            false,

          message:
            `Not enough questions are available for ${roleSlug}. ` +
            `InterviewIQ requires ${QUESTIONS_PER_TYPE} technical and ${QUESTIONS_PER_TYPE} behavioral questions. ` +
            `Available for this adaptive session: ${technicalQuestions.length} technical and ${behavioralQuestions.length} behavioral.`,
        });

        return;
      }

      /*
       * Keep a predictable format:
       * first 3 technical, then 3 behavioral.
       *
       * Each question snapshot still points to its original
       * Question document, so evaluation/evidence keeps working.
       */
      const questions = [
        ...technicalQuestions,

        ...behavioralQuestions,
      ];

      if (
        questions.length !==
        TOTAL_QUESTIONS
      ) {
        throw new Error(
          `Adaptive interview must contain exactly ${TOTAL_QUESTIONS} questions.`
        );
      }

      const answerSnapshots:
        IInterviewAnswer[] =
        questions.map(
          (
            question
          ) => ({
            question:
              question._id,

            questionText:
              question.text,

            evaluationStatus:
              "pending",
          })
        );

      /*
       * Interview model currently has one difficulty and one
       * interviewType field.
       *
       * Store detected base level in difficulty.
       * "technical" is kept in interviewType only for legacy
       * schema compatibility; the actual session is mixed and
       * each Question document retains its own interviewType.
       */
      const interview =
        await Interview.create({
          user:
            userId,

          category:
            roleSlug,

          difficulty:
            adaptive.detectedLevel,

          interviewType:
            "technical",

          status:
            "in_progress",

          answers:
            answerSnapshots,

          startedAt:
            new Date(),
        });

      const firstQuestion =
        interview.answers[
          0
        ];

      if (
        !firstQuestion
      ) {
        throw new Error(
          "Interview was created without questions."
        );
      }

      res.status(
        201
      ).json({
        success:
          true,

        message:
          "Adaptive interview started successfully",

        data: {
          interviewId:
            interview._id,

          roleSlug,

          category:
            interview.category,

          difficultyMode:
            "adaptive",

          detectedDifficulty:
            adaptive.detectedLevel,

          stretchDifficulty:
            adaptive.stretchLevel,

          difficultyScore:
            adaptive.confidenceScore,

          difficultyReason:
            adaptive.reason,

          format: {
            technicalQuestions:
              QUESTIONS_PER_TYPE,

            behavioralQuestions:
              QUESTIONS_PER_TYPE,

            totalQuestions:
              TOTAL_QUESTIONS,
          },

          status:
            interview.status,

          totalQuestions:
            interview.answers.length,

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
    } catch (
      error
    ) {
      next(
        error
      );
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
              roleSlug:
                interview.category,

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
          user:
            userId,
        })
          .sort({
            createdAt:
              -1,
          })
          .select(
            "_id category difficulty interviewType status overallScore startedAt completedAt createdAt"
          );

      res.status(200).json({
        success:
          true,

        data:
          interviews,
      });
    } catch (
      error
    ) {
      next(
        error
      );
    }
  };

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