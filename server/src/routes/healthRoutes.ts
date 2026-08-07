import express from "express";
import healthController from "../controllers/healthController";

const routes = express.Router();

routes.get('/health', healthController);


export default routes;