import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type UserRole } from "../models/User";
import { env } from "../config/env";

interface JwtPayload {
    id: string;
}

export const protect = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                message: "Not authorized, no token provided",
            });
            return;
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

        if (!decoded || typeof decoded.id !== "string") {
            res.status(401).json({
                success: false,
                message: "Not authorized, invalid token payload",
            });
            return;
        }

        const careerRead = req.method === 'GET' && /\/(progress|jobs|career-automation)(\/|$)/.test(req.path) && !req.path.endsWith('/generation-status');
        const query = User.findById(decoded.id);
        if(careerRead) query.select('+roadmapEvidenceRevision +roadmapAutomationRevision').read('primary').readConcern('majority');
        const user = await query;

        if (!user) {
            res.status(401).json({
                success: false,
                message: "Not authorized, user not found",
            });
            return;
        }

        if(careerRead) {
            req.careerReadVersions = {evidenceRevision:user.roadmapEvidenceRevision??0,automationRevision:user.roadmapAutomationRevision??0};
            // Internal counters never become part of the public user document.
            user.set('roadmapEvidenceRevision',undefined);
            user.set('roadmapAutomationRevision',undefined);
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Not authorized, token failed",
        });
    }
};

export const authorize = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Not authorized",
            });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`,
            });
            return;
        }

        next();
    };
}; 