import { Router } from "express";
import { analyzeResumeController } from "../controllers/resumeController";
import { uploadResume } from "../middleware/uploadMiddleware";
import { protect } from "../middleware/authMiddleware";

const routes = Router();

routes.post(
  "/resume/analyze",
  protect,
  uploadResume.single("resume"),
  analyzeResumeController
);

export default routes;