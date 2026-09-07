import {
    Router,
} from "express";

import {
    protect,
} from "../middleware/authMiddleware";

import {
    optimizeCVForJobController,
} from "../controllers/cvOptimizationController";

const routes =
    Router();

routes.get(
    "/cv-optimization/jobs/:jobId",
    protect,
    optimizeCVForJobController
);

export default routes;