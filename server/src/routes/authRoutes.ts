import express from "express";
import { registerValidation, loginValidation } from "../validators/authValidator";
import { validateRequest } from "../middleware/validationMiddleware";
import { registerController, loginController, getProfileController } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const routes = express.Router();

routes.post('/register', registerValidation, validateRequest, registerController);
routes.post('/login', loginValidation, validateRequest, loginController);
routes.get("/profile", protect, getProfileController);

export default routes;