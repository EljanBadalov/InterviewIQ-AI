import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { globalLimiter } from "./middleware/rateLimitMiddleware";
import { errorHandler, notFound } from "./middleware/errorMiddleware";

import authRoutes from "./routes/authRoutes";
import questionRoutes from "./routes/questionRoutes";
import interviewRoutes from "./routes/interviewRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import progressRoutes from "./routes/progressRoutes";
import resumeRoutes from "./routes/resumeRoutes";

const app = express();

app.use(helmet());

// CORS 
const allowedOrigins = [
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Access denied"));
      }
    },
    credentials: true,
  })
);

// Body Parser & Limit
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Global Rate Limiting
app.use("/api/v1", globalLimiter);

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", questionRoutes);
app.use("/api/v1", interviewRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", progressRoutes);
app.use("/api/v1", resumeRoutes);

// 404 & Global Error Handler
app.use(notFound);
app.use(errorHandler);

export default app;