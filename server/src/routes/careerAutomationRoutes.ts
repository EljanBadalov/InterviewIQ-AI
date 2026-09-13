import {
  Router,
} from "express";

import {
  createAutomation,
  generateDailyPlan,
  getAutomation,
  getAutomationSummary,
  getCareerFields,
  refreshAutomationProgress,
  replanAutomation,
  updateAutomationStatus,
  updateTaskStatus,
  updateJobPreferences,
} from "../controllers/careerAutomationController";

import {
  protect,
} from "../middleware/authMiddleware";

/* =========================================================
   ROUTER
========================================================= */

const router =
  Router();

/* =========================================================
   AUTHENTICATION

   Every Career Automation endpoint belongs to the currently
   authenticated user.

   The controller reads the user ID from:
   req.user._id

   Therefore all routes below must pass through protect.
========================================================= */

router.use(
  protect
);

/* =========================================================
   CAREER AUTOMATION
========================================================= */

/*
 * CREATE / INITIALIZE AUTOMATION
 *
 * POST /api/v1/career-automation
 *
 * Creates the user's career automation or rebuilds the
 * existing automation using the new career goal.
 *
 * Example body:
 *
 * {
 *   "targetRole": "Frontend Developer",
 *   "careerGoal": "Get a Frontend Developer job within 3 months",
 *   "roadmapDurationDays": 90,
 *   "activeResumeId": "...",
 *
 *   "jobPreferences": {
 *     "targetRoles": [
 *       "Frontend Developer",
 *       "React Developer"
 *     ],
 *
 *     "locations": [
 *       "Boston, MA",
 *       "Remote"
 *     ],
 *
 *     "workModes": [
 *       "remote",
 *       "hybrid"
 *     ],
 *
 *     "experienceLevels": [
 *       "entry",
 *       "junior"
 *     ],
 *
 *     "minimumMatchScore": 65,
 *     "dailyApplicationTarget": 3,
 *     "notifyOnNewMatches": true,
 *     "notificationMatchThreshold": 75
 *   },
 *
 *   "settings": {
 *     "automationEnabled": true,
 *     "dailyTasksEnabled": true,
 *     "jobSearchEnabled": true,
 *     "interviewPrepEnabled": true,
 *     "learningTasksEnabled": true,
 *     "cvTasksEnabled": true,
 *     "portfolioTasksEnabled": true,
 *     "automaticReplanningEnabled": true,
 *     "maxDailyTasks": 5,
 *     "preferredDailyMinutes": 90,
 *     "timezone": "America/New_York"
 *   }
 * }
 */

router.post(
  "/career-automation/",
  createAutomation
);

/*
 * GET FULL AUTOMATION
 *
 * GET /api/v1/career-automation
 *
 * Returns:
 * - career goal
 * - roadmap
 * - all tasks
 * - settings
 * - job preferences
 * - tracked job matches
 * - progress
 */

router.get(
  "/career-automation/",
  getAutomation
);

/* =========================================================
   CAREER FIELDS
========================================================= */

/*
 * GET ACTIVE CAREER FIELDS
 *
 * GET /api/v1/career-automation/fields
 *
 * Returns only active career fields from MongoDB.
 * Used by frontend dropdowns.
 */

router.get(
  "/career-automation/fields",
  getCareerFields
);

/* =========================================================
   JOB SEARCH PREFERENCES
========================================================= */

/*
 * UPDATE JOB SEARCH PREFERENCES
 *
 * PATCH /api/v1/career-automation/job-preferences
 *
 * This endpoint allows the user to explicitly choose which
 * role / vacancy type InterviewIQ should search for.
 *
 * Example body:
 *
 * {
 *   "targetRole": "React Developer",
 *   "locations": [
 *     "Boston, MA"
 *   ],
 *   "workModes": [
 *     "remote",
 *     "hybrid"
 *   ],
 *   "employmentTypes": [
 *     "full_time",
 *     "contract"
 *   ],
 *   "experienceLevels": [
 *     "entry",
 *     "junior"
 *   ],
 *   "minimumMatchScore": 65,
 *   "dailyApplicationTarget": 3,
 *   "notifyOnNewMatches": true,
 *   "notificationMatchThreshold": 75
 * }
 *
 * targetRole becomes the primary role used by the
 * external job search and matching system.
 */

router.patch(
  "/career-automation/job-preferences",
  updateJobPreferences
);

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

/*
 * GET AUTOMATION SUMMARY
 *
 * GET /api/v1/career-automation/summary
 *
 * Optional:
 *
 * ?date=2026-09-07
 *
 * Designed primarily for the Career Automation dashboard.
 */

router.get(
  "/career-automation/summary",
  getAutomationSummary
);

/* =========================================================
   DAILY PLAN
========================================================= */

/*
 * GENERATE / LOAD DAILY CAREER PLAN
 *
 * POST /api/v1/career-automation/daily-plan
 *
 * Example:
 *
 * {
 *   "date": "2026-09-07",
 *   "force": false
 * }
 *
 * If tasks already exist for that day, the service returns
 * the existing tasks unless force=true.
 *
 * Older unfinished tasks can also be carried forward.
 */

router.post(
  "/career-automation/daily-plan",
  generateDailyPlan
);

/* =========================================================
   ROADMAP REPLANNING
========================================================= */

/*
 * REPLAN CAREER AUTOMATION
 *
 * POST /api/v1/career-automation/replan
 *
 * Example:
 *
 * {
 *   "reason": "I completed React and TypeScript and want my plan updated.",
 *   "preserveCompletedTasks": true
 * }
 *
 * Uses the latest:
 * - CV context
 * - job matching
 * - interview context
 * - progress
 *
 * to create updated next steps.
 */

router.post(
  "/career-automation/replan",
  replanAutomation
);

/* =========================================================
   PROGRESS REFRESH
========================================================= */

/*
 * REFRESH CAREER PROGRESS
 *
 * POST /api/v1/career-automation/progress/refresh
 *
 * Refreshes:
 * - readiness
 * - CV progress
 * - interview progress
 * - automation task progress
 */

router.post(
  "/career-automation/progress/refresh",
  refreshAutomationProgress
);

/* =========================================================
   AUTOMATION STATUS
========================================================= */

/*
 * UPDATE AUTOMATION STATUS
 *
 * PATCH /api/v1/career-automation/status
 *
 * Body:
 *
 * {
 *   "status": "paused"
 * }
 *
 * Supported:
 * - active
 * - paused
 * - completed
 * - archived
 */

router.patch(
  "/career-automation/status",
  updateAutomationStatus
);

/* =========================================================
   TASKS
========================================================= */

/*
 * UPDATE DAILY TASK STATUS
 *
 * PATCH /api/v1/career-automation/tasks/:taskId
 *
 * Example:
 *
 * {
 *   "status": "completed"
 * }
 *
 * Supported:
 * - pending
 * - in_progress
 * - completed
 * - skipped
 */

router.patch(
  "/career-automation/tasks/:taskId",
  updateTaskStatus
);

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default router;