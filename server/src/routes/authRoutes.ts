import express from "express";
import { registerValidation } from "../validators/authValidator";
import { validateRequest } from "../middleware/validationMiddleware";
import { registerController } from "../controllers/authController";

const routes = express.Router();

routes.post('/register', registerValidation, validateRequest, registerController);

export default routes;