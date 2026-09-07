import {
  Router,
} from "express";

import {
  protect,
} from "../middleware/authMiddleware";

import {
  getResumeProfileCompletenessController,
  updateResumeProfileController,
} from "../controllers/resumeProfileController";

const router =
  Router();

/*
 * Check what information is missing.
 *
 * Also automatically creates an empty ResumeProfile
 * if the user has never uploaded a CV.
 */

router.get(
  "/resume-profile/completeness",
  protect,
  getResumeProfileCompletenessController
);

/*
 * Save information entered by the user.
 *
 * Supports both:
 *
 * - filling missing fields from an uploaded CV
 * - creating a CV completely from scratch
 */

router.put(
  "/resume-profile",
  protect,
  updateResumeProfileController
);

export default router;