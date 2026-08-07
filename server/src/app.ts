import express from "express";
import cors from "cors";
import morgan from "morgan";
import healthRoutes from "./routes/healthRoutes";
import {notFound, errorHandler} from "./middleware/errorMiddleware";

const app = express()

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.use('/api/v1', healthRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;