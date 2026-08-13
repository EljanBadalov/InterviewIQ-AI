import { Router } from "express";
import { getDashboardStatsController } from "../controllers/dashboardController";
import { protect } from "../middleware/authMiddleware";

const routes = Router();

routes.get("/dashboard/stats", protect, getDashboardStatsController);

export default routes;