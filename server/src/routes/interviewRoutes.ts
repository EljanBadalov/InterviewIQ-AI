import {
  Router,
} from "express";

import {
  startInterviewController,
  submitInterviewAnswerController,
  getInterviewController,
  getInterviewsController,
  deleteInterviewController,
} from "../controllers/interviewController";

import {
  protect,
} from "../middleware/authMiddleware";

const router =
  Router();

/* =========================================
   ALL INTERVIEW ROUTES REQUIRE AUTH
========================================= */

router.use(protect);

/* =========================================
   INTERVIEWS
========================================= */

/*
  POST /api/v1/interviews

  Start new interview.
  Questions are randomly selected here.
*/

router.post(
  "/interviews",
  startInterviewController
);

/*
  GET /api/v1/interviews

  User interview history.
*/

router.get(
  "/interviews",
  getInterviewsController
);

/*
  GET /api/v1/interviews/:id

  Load/resume one interview.
*/

router.get(
  "/interviews/:id",
  getInterviewController
);

/*
  POST /api/v1/interviews/:id/answers

  Submit answer.
  Gemini MUST evaluate it.
  Same response contains nextQuestion.
*/

router.post(
  "/interviews/:id/answers",
  submitInterviewAnswerController
);

/*
  DELETE /api/v1/interviews/:id
*/

router.delete(
  "/interviews/:id",
  deleteInterviewController
);

export default router;