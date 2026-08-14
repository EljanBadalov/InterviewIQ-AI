import { body } from "express-validator";

export const updateProfileValidation = [
  body("fullName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Full name cannot be empty")
    .isLength({ min: 2 })
    .withMessage("Full name must be at least 2 characters long"),
];