import express from "express";
import cors from "cors";
import morgan from "morgan";
import healthRoutes from "./routes/healthRoutes";
import {notFound, errorHandler} from "./middleware/errorMiddleware";
import authRoutes from "./routes/authRoutes"
import questionRoutes from "./routes/questionRoutes"
import interviewRoutes from "./routes/interviewRoutes"

const app = express()

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', questionRoutes);
app.use("/api/v1", interviewRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;