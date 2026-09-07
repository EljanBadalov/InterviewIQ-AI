import express from "express";
import helmet from "helmet";
import cors from "cors";

import {
  env,
} from "./config/env";

import {
  globalLimiter,
} from "./middleware/rateLimitMiddleware";

import {
  errorHandler,
  notFound,
} from "./middleware/errorMiddleware";

import authRoutes from "./routes/authRoutes";
import questionRoutes from "./routes/questionRoutes";
import interviewRoutes from "./routes/interviewRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import progressRoutes from "./routes/progressRoutes";
import resumeRoutes from "./routes/resumeRoutes";
import bookmarkRoutes from "./routes/bookmarkRoutes";
import jobRoutes from "./routes/jobRoutes";
import cvOptimizationRoutes from "./routes/cvOptimizationRoutes";
import cvBuilderRoutes from "./routes/cvBuilderRoutes";
import resumeProfileRoutes from "./routes/resumeProfileRoutes";
import csRoutes from "./routes/csRoutes";
import csLearningRoutes from "./routes/csLearningRoutes";
import careerAutomationRoutes from "./routes/careerAutomationRoutes";

/* =========================================================
   APP
========================================================= */

const app =
  express();

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet()
);

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = [
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      if (
        !origin ||
        allowedOrigins.includes(
          origin
        )
      ) {
        callback(
          null,
          true
        );

        return;
      }

      callback(
        new Error(
          "CORS policy violation: Access denied"
        )
      );
    },

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    exposedHeaders: [
      "Content-Disposition",
      "X-Resume-Analysis-Id",
      "X-CV-Baseline-Score",
      "X-CV-Generated-Score",
      "X-CV-Improvement",
      "X-CV-Quality-Attempts",
    ],
  })
);

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit:
      "1mb",
  })
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "1mb",
  })
);

/* =========================================================
   GLOBAL API RATE LIMIT
========================================================= */

app.use(
  "/api/v1",
  globalLimiter
);

/* =========================================================
   AUTH
========================================================= */

app.use(
  "/api/v1/auth",
  authRoutes
);

/* =========================================================
   QUESTION ROUTES
========================================================= */

app.use(
  "/api/v1",
  questionRoutes
);

/* =========================================================
   INTERVIEW ROUTES
========================================================= */

app.use(
  "/api/v1",
  interviewRoutes
);

/* =========================================================
   DASHBOARD ROUTES
========================================================= */

app.use(
  "/api/v1",
  dashboardRoutes
);

/* =========================================================
   PROGRESS ROUTES
========================================================= */

app.use(
  "/api/v1",
  progressRoutes
);

/* =========================================================
   RESUME ROUTES
========================================================= */

app.use(
  "/api/v1",
  resumeRoutes
);

/* =========================================================
   BOOKMARK ROUTES
========================================================= */

app.use(
  "/api/v1",
  bookmarkRoutes
);

/* =========================================================
   JOB ROUTES
========================================================= */

app.use(
  "/api/v1",
  jobRoutes
);

/* =========================================================
   CV OPTIMIZATION ROUTES
========================================================= */

app.use(
  "/api/v1",
  cvOptimizationRoutes
);

/* =========================================================
   CV BUILDER ROUTES
========================================================= */

app.use(
  "/api/v1",
  cvBuilderRoutes
);

/* =========================================================
   RESUME PROFILE ROUTES
========================================================= */

app.use(
  "/api/v1",
  resumeProfileRoutes
);

/* =========================================================
   CUSTOMER SERVICE ROUTES
========================================================= */

app.use(
  "/api/v1",
  csRoutes
);

/* =========================================================
   CUSTOMER SERVICE LEARNING ROUTES
========================================================= */

app.use(
  "/api/v1",
  csLearningRoutes
);

/* =========================================================
   CAREER AUTOMATION ROUTES
========================================================= */

app.use(
  "/api/v1/",
  careerAutomationRoutes
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  notFound
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  errorHandler
);

/* =========================================================
   EXPORT
========================================================= */

export default app;