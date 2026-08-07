import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

const notFound = (req: Request, res: Response,) => {
    return res.status(404).json({
        success: false,
        message: `Route not found - ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
}

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    res.status(statusCode).json({
        success: false,
        message: errorMessage,
        stack: env.NODE_ENV === "development" ? errorStack : undefined,
        timestamp: new Date().toISOString()
    })
}

export { notFound, errorHandler };