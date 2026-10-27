import { type Request, type Response, type NextFunction } from "express";
import { Types } from "mongoose";
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

        // Aggregate statistics inside MongoDB instead of transferring every score.
        // Aggregation pipelines do not apply Mongoose's normal ObjectId casting.
        const [summary, recentInterviews] = await Promise.all([
            Interview.aggregate([
                { $match: { user: new Types.ObjectId(String(userId)) } },
                { $group: {
                    _id: null,
                    totalInterviews: { $sum: 1 },
                    completedInterviews: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    inProgressInterviews: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
                    scoreTotal: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $isNumber: "$overallScore" }] }, "$overallScore", 0] } },
                    scoredCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $isNumber: "$overallScore" }] }, 1, 0] } },
                    bestScore: { $max: { $cond: [{ $and: [{ $eq: ["$status", "completed"] }, { $isNumber: "$overallScore" }] }, "$overallScore", null] } },
                } },
            ]),
            Interview.find({ user: userId })
                .sort({ createdAt: -1 }).limit(5)
                .select("_id category difficulty interviewType status overallScore startedAt completedAt createdAt")
                .lean(),
        ]);
        const totals = summary[0];
        const totalInterviews = totals?.totalInterviews ?? 0;
        const completedInterviews = totals?.completedInterviews ?? 0;
        const inProgressInterviews = totals?.inProgressInterviews ?? 0;
        const averageScore = totals?.scoredCount ? Math.round(totals.scoreTotal / totals.scoredCount) : 0;
        const bestScore = totals?.bestScore ?? 0;

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