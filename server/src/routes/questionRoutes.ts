import { Router } from "express";
import { createQuestionController, getQuestionByIdController, getQuestionsController, updateQuestionController, deleteQuestionController } from "../controllers/questionController";
import { createQuestionValidation, updateQuestionValidation } from "../validators/questionValidator";
import { validateRequest } from "../middleware/validationMiddleware";
import { protect, authorize } from "../middleware/authMiddleware";

const routes = Router();

routes.get('/questions', protect, getQuestionsController);
routes.get('/questions/:id', protect, getQuestionByIdController)
routes.post(
  "/questions",
  protect,
  authorize("admin"),
  createQuestionValidation,
  validateRequest,
  createQuestionController
);
routes.put(
  "/questions/:id",
  protect,
  authorize("admin"),
  updateQuestionValidation,
  validateRequest,
  updateQuestionController
);
routes.delete(
  "/questions/:id",
  protect,
  authorize("admin"),
  deleteQuestionController
);

export default routes;