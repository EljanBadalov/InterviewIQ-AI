import {
  Router,
} from "express";

import {
  analyzeResumeController,
  deleteResumeAnalysisController,
  getResumeAnalysisController,
  getResumeFileController,
  getResumeHistoryController,
} from "../controllers/resumeController";

import {
  uploadResume,
} from "../middleware/uploadMiddleware";

import {
  protect,
} from "../middleware/authMiddleware";

const routes =
  Router();
  
routes.post(
  "/resume/analyze",
  protect,
  uploadResume.single(
    "resume"
  ),
  analyzeResumeController
);

routes.get(
  "/resume/history",
  protect,
  getResumeHistoryController
);

routes.get(
  "/resume/:analysisId/file",
  protect,
  getResumeFileController
);

routes.get(
  "/resume/:analysisId",
  protect,
  getResumeAnalysisController
);

routes.delete(
  "/resume/:analysisId",
  protect,
  deleteResumeAnalysisController
);

export default routes;