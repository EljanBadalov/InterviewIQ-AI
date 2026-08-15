import {
  body,
} from "express-validator";

export const registerValidation =
  [
    body("fullName")
      .trim()
      .notEmpty()
      .withMessage(
        "Full name is required"
      )
      .isLength({
        min: 2,
        max: 60,
      })
      .withMessage(
        "Full name must be between 2 and 60 characters long"
      ),

    body("email")
      .trim()
      .notEmpty()
      .withMessage(
        "Email is required"
      )
      .isEmail()
      .withMessage(
        "Please enter a valid email address"
      )
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage(
        "Password is required"
      )
      .isLength({
        min: 6,
      })
      .withMessage(
        "Password must be at least 6 characters long"
      ),
  ];

export const loginValidation =
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage(
        "Email is required"
      )
      .isEmail()
      .withMessage(
        "Please enter a valid email address"
      )
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage(
        "Password is required"
      ),
  ];

export const verifyEmailValidation =
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage(
        "Email is required"
      )
      .isEmail()
      .withMessage(
        "Please enter a valid email address"
      )
      .normalizeEmail(),

    body("code")
      .trim()
      .notEmpty()
      .withMessage(
        "Verification code is required"
      )
      .matches(/^\d{6}$/)
      .withMessage(
        "Verification code must be 6 digits"
      ),
  ];

export const resendVerificationValidation =
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage(
        "Email is required"
      )
      .isEmail()
      .withMessage(
        "Please enter a valid email address"
      )
      .normalizeEmail(),
  ];

export const googleAuthValidation =
  [
    body("credential")
      .notEmpty()
      .withMessage(
        "Google credential is required"
      ),
  ];

export const forgotPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(
      "Email is required"
    )
    .isEmail()
    .withMessage(
      "Please enter a valid email address"
    )
    .normalizeEmail(),
];

export const resetPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(
      "Email is required"
    )
    .isEmail()
    .withMessage(
      "Please enter a valid email address"
    )
    .normalizeEmail(),

  body("code")
    .trim()
    .notEmpty()
    .withMessage(
      "Reset code is required"
    )
    .matches(/^\d{6}$/)
    .withMessage(
      "Reset code must be 6 digits"
    ),

  body("newPassword")
    .notEmpty()
    .withMessage(
      "New password is required"
    )
    .isLength({
      min: 6,
    })
    .withMessage(
      "New password must be at least 6 characters long"
    ),

  body("confirmPassword")
    .notEmpty()
    .withMessage(
      "Password confirmation is required"
    )
    .custom(
      (
        value,
        { req }
      ) => {
        if (
          value !==
          req.body.newPassword
        ) {
          throw new Error(
            "Passwords do not match"
          );
        }

        return true;
      }
    ),
];