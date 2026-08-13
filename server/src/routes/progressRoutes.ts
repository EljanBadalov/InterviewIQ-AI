import { Router } from "express";
import { getProgressController } from "../controllers/progressController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.get("/progress", protect, getProgressController);

export default router;