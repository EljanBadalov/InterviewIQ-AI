import express from "express";
import { registerValidation, loginValidation } from "../validators/authValidator";
import { updateProfileValidation } from "../validators/profileValidator"
import { validateRequest } from "../middleware/validationMiddleware";
import { registerController, loginController, getProfileController, updateProfileController } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";
import { authLimiter } from "../middleware/rateLimitMiddleware";

const routes = express.Router();

routes.post('/register', authLimiter, registerValidation, validateRequest, registerController);
routes.post('/login', authLimiter, loginValidation, validateRequest, loginController);
routes.get("/profile", protect, getProfileController);
routes.put(
    "/profile",
    protect,
    updateProfileValidation,
    validateRequest,
    updateProfileController
);
export default routes;