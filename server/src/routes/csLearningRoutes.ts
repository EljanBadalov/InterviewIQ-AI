import {
  Router,
} from "express";

import {
  approveCandidate,
  disableCandidate,
  exportLearningCandidates,
  getLearningCandidate,
  getLearningCandidates,
  getLearningExportInfo,
  rejectCandidate,
  resetCandidate,
} from "../controllers/csLearningController";

/* =========================================================
   ROUTER
========================================================= */

const router =
  Router();

/* =========================================================
   LIST LEARNING CANDIDATES
========================================================= */

router.get(
  "/cs/learning/candidates",
  getLearningCandidates
);

/* =========================================================
   GET ONE LEARNING CANDIDATE
========================================================= */

router.get(
  "/cs/learning/candidates/:id",
  getLearningCandidate
);

/* =========================================================
   APPROVE
========================================================= */

router.patch(
  "/cs/learning/candidates/:id/approve",
  approveCandidate
);

/* =========================================================
   REJECT
========================================================= */

router.patch(
  "/cs/learning/candidates/:id/reject",
  rejectCandidate
);

/* =========================================================
   DISABLE
========================================================= */

router.patch(
  "/cs/learning/candidates/:id/disable",
  disableCandidate
);

/* =========================================================
   RESET TO CANDIDATE
========================================================= */

router.patch(
  "/cs/learning/candidates/:id/reset",
  resetCandidate
);

router.post(
  "/cs/learning/export",
  exportLearningCandidates
);

/* =========================================================
   EXPORT STATUS
========================================================= */

router.get(
  "/cs/learning/export/status",
  getLearningExportInfo
);

/* =========================================================
   EXPORT
========================================================= */

export default router;