import { body } from "express-validator";

export const createInterviewValidation = [
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .toLowerCase(),

  body("difficulty")
    .trim()
    .notEmpty()
    .withMessage("Difficulty level is required")
    .isIn(["beginner", "intermediate", "advanced", "senior"])
    .withMessage("Invalid difficulty level"),

  body("interviewType")
    .trim()
    .notEmpty()
    .withMessage("Interview type is required")
    .isIn(["technical", "behavioral"])
    .withMessage("Invalid interview type"),
];

export const submitAnswerValidation = [
  body("answerText")
    .trim()
    .notEmpty()
    .withMessage("Answer text is required")
    .isLength({ min: 2 })
    .withMessage("Answer text must be at least 2 characters long"),
];