import { type Request, type Response, type NextFunction } from "express";
import { Interview } from "../models/Interview";

export const getDashboardStatsController = async (
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

        const [totalInterviews, completedInterviews, inProgressInterviews] =
            await Promise.all([
                Interview.countDocuments({ user: userId }),
                Interview.countDocuments({ user: userId, status: "completed" }),
                Interview.countDocuments({ user: userId, status: "in_progress" }),
            ]);

        const completedInterviewScores = await Interview.find({
            user: userId,
            status: "completed",
            overallScore: { $exists: true, $ne: null },
        }).select("overallScore -_id");

        const scores = completedInterviewScores
            .map((doc) => doc.overallScore)
            .filter((score): score is number => typeof score === "number");

        let averageScore = 0;
        let bestScore = 0;

        if (scores.length > 0) {
            const totalScore = scores.reduce((sum, score) => sum + score, 0);
            averageScore = Math.round(totalScore / scores.length);
            bestScore = Math.max(...scores);
        }

        const recentInterviews = await Interview.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select(
                "_id category difficulty interviewType status overallScore startedAt completedAt createdAt"
            );

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalInterviews,
                    completedInterviews,
                    inProgressInterviews,
                    averageScore,
                    bestScore,
                },
                recentInterviews,
            },
        });
    } catch (error) {
        next(error);
    }
};