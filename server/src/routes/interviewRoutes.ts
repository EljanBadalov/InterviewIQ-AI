import { Router } from "express";
import { createInterviewController, submitAnswerController, getInterviewHistoryController, getInterviewByIdController } from "../controllers/interviewController";
import { createInterviewValidation, submitAnswerValidation } from "../validators/interviewValidator";
import { validateRequest } from "../middleware/validationMiddleware";
import { protect } from "../middleware/authMiddleware";

const routes = Router();

routes.post(
    "/interviews",
    protect,
    createInterviewValidation,
    validateRequest,
    createInterviewController
);
routes.post(
    "/interviews/:id/answers",
    protect,
    submitAnswerValidation,
    validateRequest,
    submitAnswerController
);
routes.get(
    "/interviews",
    protect,
    getInterviewHistoryController
);
routes.get("/interviews/:id", protect, getInterviewByIdController);

export default routes;