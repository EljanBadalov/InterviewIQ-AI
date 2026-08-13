import { type Request, type Response, type NextFunction } from "express";
import { Interview } from "../models/Interview";

interface CategoryStat {
  category: string;
  totalScore: number;
  count: number;
}

export const getProgressController = async (
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

    const userId = req.user._id;

    const completedInterviews = await Interview.find({
      user: userId,
      status: "completed",
    })
      .sort({ createdAt: 1 })
      .select("category overallScore answers completedAt createdAt");

    const completedInterviewsCount = completedInterviews.length;

    // Yalnız həqiqi numeric overallScore olan interview-ləri qrafik progression-una daxil edirik
    const scoreProgression = completedInterviews
      .filter((interview) => typeof interview.overallScore === "number")
      .map((interview) => ({
        interviewId: interview._id,
        date: interview.completedAt || interview.createdAt,
        category: interview.category,
        score: interview.overallScore as number,
      }));

    const categoryMap = new Map<string, CategoryStat>();

    let totalTechAccuracy = 0;
    let countTechAccuracy = 0;

    let totalCompleteness = 0;
    let countCompleteness = 0;

    let totalCommunication = 0;
    let countCommunication = 0;

    completedInterviews.forEach((interview) => {
      if (typeof interview.overallScore === "number") {
        const cat = interview.category;
        const currentCat = categoryMap.get(cat) || {
          category: cat,
          totalScore: 0,
          count: 0,
        };

        categoryMap.set(cat, {
          category: cat,
          totalScore: currentCat.totalScore + interview.overallScore,
          count: currentCat.count + 1,
        });
      }

      if (Array.isArray(interview.answers)) {
        interview.answers.forEach((ans) => {
          if (ans.evaluationStatus === "completed") {
            if (typeof ans.technicalAccuracy === "number") {
              totalTechAccuracy += ans.technicalAccuracy;
              countTechAccuracy++;
            }
            if (typeof ans.completeness === "number") {
              totalCompleteness += ans.completeness;
              countCompleteness++;
            }
            if (typeof ans.communication === "number") {
              totalCommunication += ans.communication;
              countCommunication++;
            }
          }
        });
      }
    });

    const categoryPerformance = Array.from(categoryMap.values()).map(
      (item) => ({
        category: item.category,
        averageScore: Math.round(item.totalScore / item.count),
        interviewCount: item.count,
      })
    );

    let strongestCategory: { category: string; averageScore: number } | null = null;
    let weakestCategory: { category: string; averageScore: number } | null = null;

    if (categoryPerformance.length > 0) {
      const sortedByScore = [...categoryPerformance].sort(
        (a, b) => b.averageScore - a.averageScore
      );

      const firstItem = sortedByScore[0];
      const lastItem = sortedByScore[sortedByScore.length - 1];

      if (firstItem) {
        strongestCategory = {
          category: firstItem.category,
          averageScore: firstItem.averageScore,
        };
      }

      if (lastItem) {
        weakestCategory = {
          category: lastItem.category,
          averageScore: lastItem.averageScore,
        };
      }
    }

    const averageTechnicalAccuracy =
      countTechAccuracy > 0
        ? Math.round(totalTechAccuracy / countTechAccuracy)
        : 0;

    const averageCompleteness =
      countCompleteness > 0
        ? Math.round(totalCompleteness / countCompleteness)
        : 0;

    const averageCommunication =
      countCommunication > 0
        ? Math.round(totalCommunication / countCommunication)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        completedInterviewsCount,
        averageTechnicalAccuracy,
        averageCompleteness,
        averageCommunication,
        strongestCategory,
        weakestCategory,
        scoreProgression,
        categoryPerformance,
      },
    });
  } catch (error) {
    next(error);
  }
};