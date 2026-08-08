import { type Request, type Response, type NextFunction } from "express";
import { validationResult } from "express-validator";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: "path" in err ? err.path : "",
        message: err.msg,
      })),
    });
    return;
  }

  next();
};