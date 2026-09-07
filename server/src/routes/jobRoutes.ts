import { Router } from "express";

import {
  getJobs,
  getJobById,
  getJobMatch,
} from "../controllers/jobController";

import { protect } from "../middleware/authMiddleware";

const routes = Router();

routes.get(
  "/jobs",
  protect,
  getJobs
);

routes.get(
  "/jobs/:jobId/match",
  protect,
  getJobMatch
);

routes.get(
  "/jobs/:jobId",
  protect,
  getJobById
);

export default routes;