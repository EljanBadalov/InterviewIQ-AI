import {
  Router,
} from "express";

import {
  getJobs,
  getJobById,
  getJobMatch,
  refreshExternalJobs,
  getExternalJobMatches,
} from "../controllers/jobController";

import {
  protect,
} from "../middleware/authMiddleware";

const routes =
  Router();

/* =========================================================
   JOBS
========================================================= */

/**
 * Get all jobs.
 *
 * Jobs are ranked against the authenticated user's
 * latest analyzed CV when one exists.
 *
 * GET /jobs
 */
routes.get(
  "/jobs",
  protect,
  getJobs
);

/* =========================================================
   EXTERNAL JOBS
========================================================= */

/**
 * Fetch fresh real vacancies from external providers
 * such as Adzuna.
 *
 * The backend:
 *
 * 1. Finds user's Career Automation profile
 * 2. Determines target role/preferences
 * 3. Fetches external vacancies
 * 4. Saves/updates them in MongoDB
 * 5. Calculates CV/job match
 * 6. Stores matching jobs in CareerAutomation.jobMatches
 *
 * POST /jobs/external/refresh
 */
routes.post(
  "/jobs/external/refresh",
  protect,
  refreshExternalJobs
);

/**
 * Return real external vacancies matched
 * to the user's Career Automation profile.
 *
 * GET /jobs/external/matches
 */
routes.get(
  "/jobs/external/matches",
  protect,
  getExternalJobMatches
);

/* =========================================================
   JOB MATCH
========================================================= */

/**
 * Calculate detailed CV match for one job.
 *
 * IMPORTANT:
 * This route must be before /jobs/:jobId
 * so Express does not interpret "external"
 * as a jobId.
 *
 * GET /jobs/:jobId/match
 */
routes.get(
  "/jobs/:jobId/match",
  protect,
  getJobMatch
);

/* =========================================================
   SINGLE JOB
========================================================= */

/**
 * Get one job with personalized CV match.
 *
 * GET /jobs/:jobId
 */
routes.get(
  "/jobs/:jobId",
  protect,
  getJobById
);

export default routes;