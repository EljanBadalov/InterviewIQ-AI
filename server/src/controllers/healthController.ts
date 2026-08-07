import type { Request, Response } from "express";
import { env } from "../config/env";

const healthController = (req: Request, res: Response) => {
    res.status(200).json({
        "success": true,
        "message": "Server is running successfully.",
        "environment": env.NODE_ENV,
        "timestamp": new Date().toISOString()
    })
}

export default healthController;