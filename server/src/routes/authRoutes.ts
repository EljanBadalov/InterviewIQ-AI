import express from "express";

import {
  registerValidation,
  loginValidation,
  googleAuthValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} from "../validators/authValidator";

import {
  updateProfileValidation,
  changePasswordValidation,
} from "../validators/profileValidator";

import {
  registerController,
  loginController,
  getProfileController,
  updateProfileController,
  googleAuthController,
  changePasswordController,
  verifyEmailController,
  resendVerificationController,
  forgotPasswordController,
  resetPasswordController,
} from "../controllers/authController";

import {
  validateRequest,
} from "../middleware/validationMiddleware";

import {
  protect,
} from "../middleware/authMiddleware";

import {
  authLimiter,
} from "../middleware/rateLimitMiddleware";

const routes =
  express.Router();

routes.post(
  "/register",
  authLimiter,
  registerValidation,
  validateRequest,
  registerController
);

routes.post(
  "/verify-email",
  authLimiter,
  verifyEmailValidation,
  validateRequest,
  verifyEmailController
);

routes.post(
  "/resend-verification",
  authLimiter,
  resendVerificationValidation,
  validateRequest,
  resendVerificationController
);

routes.post(
  "/login",
  authLimiter,
  loginValidation,
  validateRequest,
  loginController
);

routes.post(
  "/forgot-password",
  authLimiter,
  forgotPasswordValidation,
  validateRequest,
  forgotPasswordController
);

routes.post(
  "/reset-password",
  authLimiter,
  resetPasswordValidation,
  validateRequest,
  resetPasswordController
);

routes.post(
  "/google",
  authLimiter,
  googleAuthValidation,
  validateRequest,
  googleAuthController
);

routes.get(
  "/profile",
  protect,
  getProfileController
);

routes.put(
  "/profile",
  protect,
  updateProfileValidation,
  validateRequest,
  updateProfileController
);

routes.put(
  "/password",
  protect,
  changePasswordValidation,
  validateRequest,
  changePasswordController
);

export default routes;