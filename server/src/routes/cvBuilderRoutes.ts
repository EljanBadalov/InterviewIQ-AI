import {
  Router,
} from "express";

import {
  protect,
} from "../middleware/authMiddleware";

import {
  generateGeneralImprovedCVController,
  generateImprovedCVController,
} from "../controllers/cvBuilderController";

const routes =
  Router();

/*
 * General career-based improvement.
 * No vacancy selection is required.
 */
routes.post(
  "/cv-builder/general/generate",
  protect,
  generateGeneralImprovedCVController
);

/*
 * Vacancy-specific improvement.
 */
routes.post(
  "/cv-builder/jobs/:jobId/generate",
  protect,
  generateImprovedCVController
);

export default routes;
