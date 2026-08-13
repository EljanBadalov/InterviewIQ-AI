import { body } from "express-validator";

export const createQuestionValidation = [
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Question text is required")
    .isLength({ min: 10 })
    .withMessage("Question text must be at least 10 characters long"),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .toLowerCase(),

  body("difficulty")
    .trim()
    .notEmpty()
    .withMessage("Difficulty is required")
    .isIn(["beginner", "intermediate", "advanced", "senior"])
    .withMessage("Invalid difficulty level"),

  body("interviewType")
    .trim()
    .notEmpty()
    .withMessage("Interview type is required")
    .isIn(["technical", "behavioral"])
    .withMessage("Invalid interview type"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),

  body("tags.*")
    .optional()
    .isString()
    .withMessage("Each tag must be a string")
    .trim()
    .toLowerCase(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];

export const updateQuestionValidation = [
  body("text")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Question text cannot be empty")
    .isLength({ min: 10 })
    .withMessage("Question text must be at least 10 characters long"),

  body("category")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Category cannot be empty")
    .toLowerCase(),

  body("difficulty")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Difficulty cannot be empty")
    .isIn(["beginner", "intermediate", "advanced", "senior"])
    .withMessage("Invalid difficulty level"),

  body("interviewType")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Interview type cannot be empty")
    .isIn(["technical", "behavioral"])
    .withMessage("Invalid interview type"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),

  body("tags.*")
    .optional()
    .isString()
    .withMessage("Each tag must be a string")
    .trim()
    .toLowerCase(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
];