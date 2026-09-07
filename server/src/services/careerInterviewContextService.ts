import {
  Types,
} from "mongoose";

import {
  Interview,
  type IInterview,
  type IInterviewAnswer,
} from "../models/Interview";

/* =========================================================
   TYPES
========================================================= */

export interface ICareerInterviewAnswerSummary {
  questionId?: string;

  questionText: string;

  answerText?: string;

  score?: number;

  technicalAccuracy?: number;

  completeness?: number;

  communication?: number;

  strengths: string[];

  weaknesses: string[];

  feedback?: string;

  improvedAnswer?: string;

  followUpQuestion?: string;

  evaluationStatus:
    | "pending"
    | "completed"
    | "failed";
}

export interface ICareerInterviewContext {
  id: string;

  category: string;

  difficulty: string;

  interviewType: string;

  status: string;

  overallScore?: number;

  answers:
    ICareerInterviewAnswerSummary[];

  finalReport: {
    summary?: string;

    strengths: string[];

    improvements: string[];

    recommendations: string[];
  };

  completedAnswers: number;

  evaluatedAnswers: number;

  averageTechnicalAccuracy?: number;

  averageCompleteness?: number;

  averageCommunication?: number;

  startedAt?: Date;

  completedAt?: Date;

  createdAt?: Date;

  updatedAt?: Date;
}

export interface ICareerInterviewContextResult {
  found: boolean;

  data?: ICareerInterviewContext;

  reason?:
    | "INVALID_USER_ID"
    | "INVALID_INTERVIEW_ID"
    | "NOT_FOUND";
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeString = (
  value:
    | string
    | undefined
    | null
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized ||
    undefined;
};

const isValidObjectId = (
  value:
    | string
    | undefined
    | null
): boolean => {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return false;
  }

  return Types.ObjectId.isValid(
    normalized
  );
};

const averageNumbers = (
  values: Array<
    number | undefined
  >
): number | undefined => {
  const numbers =
    values.filter(
      (
        value
      ): value is number =>
        typeof value ===
          "number" &&
        Number.isFinite(
          value
        )
    );

  if (
    numbers.length ===
    0
  ) {
    return undefined;
  }

  const total =
    numbers.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );

  return Math.round(
    total /
      numbers.length
  );
};

/* =========================================================
   MAP ANSWER
========================================================= */

const mapInterviewAnswer = (
  answer: IInterviewAnswer
): ICareerInterviewAnswerSummary => {
  return {
    questionId:
      answer.question
        ? String(
            answer.question
          )
        : undefined,

    questionText:
      answer.questionText,

    answerText:
      answer.answerText,

    score:
      answer.score,

    technicalAccuracy:
      answer.technicalAccuracy,

    completeness:
      answer.completeness,

    communication:
      answer.communication,

    strengths:
      answer.strengths ??
      [],

    weaknesses:
      answer.weaknesses ??
      [],

    feedback:
      answer.feedback,

    improvedAnswer:
      answer.improvedAnswer,

    followUpQuestion:
      answer.followUpQuestion,

    evaluationStatus:
      answer.evaluationStatus,
  };
};

/* =========================================================
   MAP INTERVIEW
========================================================= */

const mapInterview = (
  interview: IInterview
): ICareerInterviewContext => {
  const answers =
    (
      interview.answers ??
      []
    ).map(
      mapInterviewAnswer
    );

  const completedAnswers =
    answers.filter(
      (
        answer
      ) =>
        Boolean(
          answer.answerText
        )
    ).length;

  const evaluatedAnswers =
    answers.filter(
      (
        answer
      ) =>
        answer.evaluationStatus ===
        "completed"
    ).length;

  return {
    id:
      interview._id
        ? String(
            interview._id
          )
        : "",

    category:
      interview.category,

    difficulty:
      interview.difficulty,

    interviewType:
      interview.interviewType,

    status:
      interview.status,

    overallScore:
      interview.overallScore,

    answers,

    finalReport: {
      summary:
        interview.finalReport
          ?.summary,

      strengths:
        interview.finalReport
          ?.strengths ??
        [],

      improvements:
        interview.finalReport
          ?.improvements ??
        [],

      recommendations:
        interview.finalReport
          ?.recommendations ??
        [],
    },

    completedAnswers,

    evaluatedAnswers,

    averageTechnicalAccuracy:
      averageNumbers(
        answers.map(
          (
            answer
          ) =>
            answer
              .technicalAccuracy
        )
      ),

    averageCompleteness:
      averageNumbers(
        answers.map(
          (
            answer
          ) =>
            answer
              .completeness
        )
      ),

    averageCommunication:
      averageNumbers(
        answers.map(
          (
            answer
          ) =>
            answer
              .communication
        )
      ),

    startedAt:
      interview.startedAt,

    completedAt:
      interview.completedAt,

    createdAt:
      interview.createdAt,

    updatedAt:
      interview.updatedAt,
  };
};

/* =========================================================
   GET INTERVIEW BY ID
========================================================= */

export const getCareerInterviewById =
  async ({
    userId,
    interviewId,
  }: {
    userId: string;

    interviewId: string;
  }): Promise<
    ICareerInterviewContextResult
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    const normalizedInterviewId =
      normalizeString(
        interviewId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER_ID",
      };
    }

    if (
      !normalizedInterviewId ||
      !isValidObjectId(
        normalizedInterviewId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_INTERVIEW_ID",
      };
    }

    const interview =
      await Interview
        .findOne({
          _id:
            new Types.ObjectId(
              normalizedInterviewId
            ),

          user:
            new Types.ObjectId(
              normalizedUserId
            ),
        })
        .lean<IInterview>()
        .exec();

    if (
      !interview
    ) {
      return {
        found:
          false,

        reason:
          "NOT_FOUND",
      };
    }

    return {
      found:
        true,

      data:
        mapInterview(
          interview
        ),
    };
  };

/* =========================================================
   GET LATEST COMPLETED INTERVIEW
========================================================= */

export const getLatestCompletedCareerInterview =
  async (
    userId: string
  ): Promise<
    ICareerInterviewContextResult
  > => {
    const normalizedUserId =
      normalizeString(
        userId
      );

    if (
      !normalizedUserId ||
      !isValidObjectId(
        normalizedUserId
      )
    ) {
      return {
        found:
          false,

        reason:
          "INVALID_USER_ID",
      };
    }

    const interview =
      await Interview
        .findOne({
          user:
            new Types.ObjectId(
              normalizedUserId
            ),

          status:
            "completed",
        })
        .sort({
          completedAt:
            -1,

          createdAt:
            -1,
        })
        .lean<IInterview>()
        .exec();

    if (
      !interview
    ) {
      return {
        found:
          false,

        reason:
          "NOT_FOUND",
      };
    }

    return {
      found:
        true,

      data:
        mapInterview(
          interview
        ),
    };
  };

/* =========================================================
   RESOLVE INTERVIEW CONTEXT

   If activeInterviewId exists:
   -> load that interview.

   Otherwise:
   -> use latest completed interview.
========================================================= */

export const resolveCareerInterviewContext =
  async ({
    userId,
    activeInterviewId,
  }: {
    userId: string;

    activeInterviewId?: string;
  }): Promise<
    ICareerInterviewContextResult
  > => {
    if (
      activeInterviewId
    ) {
      return getCareerInterviewById({
        userId,

        interviewId:
          activeInterviewId,
      });
    }

    return getLatestCompletedCareerInterview(
      userId
    );
  };

/* =========================================================
   BUILD INTERVIEW FEEDBACK REPLY
========================================================= */

export const buildCareerInterviewFeedbackReply =
  (
    interview:
      ICareerInterviewContext
  ): string => {
    const parts:
      string[] = [];

    if (
      typeof interview
        .overallScore ===
      "number"
    ) {
      parts.push(
        `Your latest ${interview.interviewType} interview score was ${interview.overallScore}/100.`
      );
    } else {
      parts.push(
        `I found your latest ${interview.interviewType} interview.`
      );
    }

    if (
      interview
        .finalReport
        .summary
    ) {
      parts.push(
        interview
          .finalReport
          .summary
      );
    }

    if (
      interview
        .finalReport
        .strengths
        .length >
      0
    ) {
      parts.push(
        `Your main strengths were ${interview.finalReport.strengths
          .slice(
            0,
            3
          )
          .join(
            ", "
          )}.`
      );
    }

    if (
      interview
        .finalReport
        .improvements
        .length >
      0
    ) {
      parts.push(
        `The main areas to improve are ${interview.finalReport.improvements
          .slice(
            0,
            3
          )
          .join(
            ", "
          )}.`
      );
    }

    if (
      interview
        .finalReport
        .recommendations
        .length >
      0
    ) {
      parts.push(
        `A high-priority recommendation is: ${interview.finalReport.recommendations[0]}`
      );
    }

    if (
      typeof interview
        .averageTechnicalAccuracy ===
      "number"
    ) {
      parts.push(
        `Average technical accuracy was ${interview.averageTechnicalAccuracy}/100.`
      );
    }

    if (
      typeof interview
        .averageCommunication ===
      "number"
    ) {
      parts.push(
        `Average communication was ${interview.averageCommunication}/100.`
      );
    }

    return parts.join(
      " "
    );
  };

/* =========================================================
   BUILD INTERVIEW DATA SUMMARY
========================================================= */

export const buildCareerInterviewSummary =
  (
    interview:
      ICareerInterviewContext
  ): Record<
    string,
    unknown
  > => {
    return {
      interviewId:
        interview.id,

      category:
        interview.category,

      difficulty:
        interview.difficulty,

      interviewType:
        interview.interviewType,

      status:
        interview.status,

      overallScore:
        interview.overallScore,

      completedAnswers:
        interview.completedAnswers,

      evaluatedAnswers:
        interview.evaluatedAnswers,

      metrics: {
        technicalAccuracy:
          interview
            .averageTechnicalAccuracy,

        completeness:
          interview
            .averageCompleteness,

        communication:
          interview
            .averageCommunication,
      },

      finalReport:
        interview.finalReport,

      answers:
        interview.answers.map(
          (
            answer
          ) => ({
            questionText:
              answer.questionText,

            score:
              answer.score,

            technicalAccuracy:
              answer
                .technicalAccuracy,

            completeness:
              answer.completeness,

            communication:
              answer.communication,

            strengths:
              answer.strengths,

            weaknesses:
              answer.weaknesses,

            feedback:
              answer.feedback,

            improvedAnswer:
              answer.improvedAnswer,
          })
        ),

      completedAt:
        interview.completedAt,
    };
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getCareerInterviewById,

  getLatestCompletedCareerInterview,

  resolveCareerInterviewContext,

  buildCareerInterviewFeedbackReply,

  buildCareerInterviewSummary,
};