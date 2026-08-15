import {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import bcrypt from "bcryptjs";

import { User } from "../models/User";
import { generateToken } from "../utils/generateToken";
import { verifyGoogleCredential } from "../services/googleAuthService";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/emailService";

const generateVerificationCode =
  (): string => {
    return Math.floor(
      100000 +
      Math.random() *
      900000
    ).toString();
  };

const hashVerificationCode =
  async (
    code: string
  ): Promise<string> => {
    const salt =
      await bcrypt.genSalt(
        10
      );

    return bcrypt.hash(
      code,
      salt
    );
  };

export const registerController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        fullName,
        email,
        password,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const existingUser =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+emailVerificationCode +emailVerificationExpires"
        );

      if (
        existingUser &&
        existingUser.isEmailVerified
      ) {
        res.status(409).json({
          success: false,
          message:
            "Email is already registered",
        });

        return;
      }

      const verificationCode =
        generateVerificationCode();

      const hashedCode =
        await hashVerificationCode(
          verificationCode
        );

      const verificationExpires =
        new Date(
          Date.now() +
          10 *
          60 *
          1000
        );

      let user =
        existingUser;

      if (user) {
        user.fullName =
          fullName.trim();

        user.password =
          password;

        user.authProvider =
          "local";

        user.isEmailVerified =
          false;

        user.emailVerificationCode =
          hashedCode;

        user.emailVerificationExpires =
          verificationExpires;

        await user.save();
      } else {
        user =
          await User.create({
            fullName:
              fullName.trim(),

            email:
              normalizedEmail,

            password,

            authProvider:
              "local",

            role:
              "user",

            isEmailVerified:
              false,

            emailVerificationCode:
              hashedCode,

            emailVerificationExpires:
              verificationExpires,
          });
      }

      try {
        await sendVerificationEmail(
          user.email,
          user.fullName,
          verificationCode
        );
      } catch (emailError) {
        if (
          !existingUser
        ) {
          await User.findByIdAndDelete(
            user._id
          );
        }

        throw emailError;
      }

      res.status(201).json({
        success: true,

        message:
          "Registration successful. Please check your email for the verification code.",

        data: {
          email:
            user.email,

          requiresVerification:
            true,
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const verifyEmailController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        email,
        code,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+emailVerificationCode +emailVerificationExpires"
        );

      if (!user) {
        res.status(404).json({
          success: false,
          message:
            "Account not found",
        });

        return;
      }

      if (
        user.isEmailVerified
      ) {
        res.status(200).json({
          success: true,
          message:
            "Email is already verified",
        });

        return;
      }

      if (
        !user.emailVerificationCode ||
        !user.emailVerificationExpires
      ) {
        res.status(400).json({
          success: false,
          message:
            "No active verification code was found. Please request a new code.",
        });

        return;
      }

      if (
        user.emailVerificationExpires.getTime() <
        Date.now()
      ) {
        res.status(400).json({
          success: false,
          message:
            "Verification code has expired. Please request a new code.",
        });

        return;
      }

      const isCodeValid =
        await bcrypt.compare(
          code,
          user.emailVerificationCode
        );

      if (!isCodeValid) {
        res.status(400).json({
          success: false,
          message:
            "Invalid verification code",
        });

        return;
      }

      user.isEmailVerified =
        true;

      user.emailVerificationCode =
        undefined;

      user.emailVerificationExpires =
        undefined;

      await user.save();

      res.status(200).json({
        success: true,

        message:
          "Email verified successfully. You can now sign in.",
      });
    } catch (error) {
      next(error);
    }
  };

export const resendVerificationController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        email,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+emailVerificationCode +emailVerificationExpires"
        );

      if (!user) {
        res.status(404).json({
          success: false,
          message:
            "Account not found",
        });

        return;
      }

      if (
        user.isEmailVerified
      ) {
        res.status(400).json({
          success: false,
          message:
            "Email is already verified",
        });

        return;
      }

      const verificationCode =
        generateVerificationCode();

      user.emailVerificationCode =
        await hashVerificationCode(
          verificationCode
        );

      user.emailVerificationExpires =
        new Date(
          Date.now() +
          10 *
          60 *
          1000
        );

      await user.save();

      await sendVerificationEmail(
        user.email,
        user.fullName,
        verificationCode
      );

      res.status(200).json({
        success: true,

        message:
          "A new verification code has been sent to your email.",
      });
    } catch (error) {
      next(error);
    }
  };

export const loginController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        email,
        password,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password"
        );

      if (!user) {
        res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });

        return;
      }

      const isMatch =
        await user.comparePassword(
          password
        );

      if (!isMatch) {
        res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });

        return;
      }

      if (
        user.authProvider ===
        "local" &&
        !user.isEmailVerified
      ) {
        res.status(403).json({
          success: false,

          message:
            "Please verify your email before signing in.",

          data: {
            requiresVerification:
              true,

            email:
              user.email,
          },
        });

        return;
      }

      const token =
        generateToken(
          user._id.toString()
        );

      res.status(200).json({
        success: true,
        message:
          "Login successful",

        data: {
          token,

          user: {
            id: user._id,
            fullName:
              user.fullName,
            email:
              user.email,
            role:
              user.role,
            avatar:
              user.avatar,
            authProvider:
              user.authProvider,
            isEmailVerified:
              user.isEmailVerified,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const getProfileController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        res.status(404).json({
          success: false,
          message:
            "User not found",
        });

        return;
      }

      res.status(200).json({
        success: true,

        data: {
          id: user._id,
          fullName:
            user.fullName,
          email:
            user.email,
          role:
            user.role,
          avatar:
            user.avatar,
          authProvider:
            user.authProvider,
          isEmailVerified:
            user.isEmailVerified,
          createdAt:
            user.createdAt,
          updatedAt:
            user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const updateProfileController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const {
        fullName,
        email,
      } = req.body;

      const user =
        await User.findById(
          req.user._id
        );

      if (!user) {
        res.status(404).json({
          success: false,
          message:
            "User not found",
        });

        return;
      }

      if (
        fullName !== undefined
      ) {
        user.fullName =
          fullName.trim();
      }

      if (
        email !== undefined
      ) {
        const normalizedEmail =
          email
            .trim()
            .toLowerCase();

        if (
          normalizedEmail !==
          user.email
        ) {
          const emailExists =
            await User.findOne({
              email:
                normalizedEmail,

              _id: {
                $ne:
                  user._id,
              },
            });

          if (emailExists) {
            res.status(409).json({
              success: false,
              message:
                "Email is already in use",
            });

            return;
          }

          user.email =
            normalizedEmail;

          if (
            user.authProvider ===
            "local"
          ) {
            user.isEmailVerified =
              false;

            const verificationCode =
              generateVerificationCode();

            user.emailVerificationCode =
              await hashVerificationCode(
                verificationCode
              );

            user.emailVerificationExpires =
              new Date(
                Date.now() +
                10 *
                60 *
                1000
              );

            await user.save();

            await sendVerificationEmail(
              user.email,
              user.fullName,
              verificationCode
            );

            res.status(200).json({
              success: true,

              message:
                "Profile updated. Please verify your new email address.",

              data: {
                requiresVerification:
                  true,

                user: {
                  id: user._id,
                  fullName:
                    user.fullName,
                  email:
                    user.email,
                  role:
                    user.role,
                  avatar:
                    user.avatar,
                  authProvider:
                    user.authProvider,
                  isEmailVerified:
                    user.isEmailVerified,
                  createdAt:
                    user.createdAt,
                  updatedAt:
                    user.updatedAt,
                },
              },
            });

            return;
          }
        }
      }

      await user.save();

      res.status(200).json({
        success: true,

        message:
          "Profile updated successfully",

        data: {
          requiresVerification:
            false,

          user: {
            id: user._id,
            fullName:
              user.fullName,
            email:
              user.email,
            role:
              user.role,
            avatar:
              user.avatar,
            authProvider:
              user.authProvider,
            isEmailVerified:
              user.isEmailVerified,
            createdAt:
              user.createdAt,
            updatedAt:
              user.updatedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

export const changePasswordController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (
        !req.user ||
        !req.user._id
      ) {
        res.status(401).json({
          success: false,
          message:
            "Not authorized",
        });

        return;
      }

      const {
        currentPassword,
        newPassword,
      } = req.body;

      const user =
        await User.findById(
          req.user._id
        ).select(
          "+password"
        );

      if (!user) {
        res.status(404).json({
          success: false,
          message:
            "User not found",
        });

        return;
      }

      if (
        user.authProvider ===
        "google" &&
        !user.password
      ) {
        res.status(400).json({
          success: false,
          message:
            "Password changes are not available for Google-only accounts",
        });

        return;
      }

      if (!user.password) {
        res.status(400).json({
          success: false,
          message:
            "This account does not have a local password",
        });

        return;
      }

      const passwordMatches =
        await user.comparePassword(
          currentPassword
        );

      if (!passwordMatches) {
        res.status(401).json({
          success: false,
          message:
            "Current password is incorrect",
        });

        return;
      }

      const samePassword =
        await user.comparePassword(
          newPassword
        );

      if (samePassword) {
        res.status(400).json({
          success: false,
          message:
            "New password must be different from your current password",
        });

        return;
      }

      user.password =
        newPassword;

      await user.save();

      res.status(200).json({
        success: true,
        message:
          "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  };

export const googleAuthController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        credential,
      } = req.body;

      const googleUser =
        await verifyGoogleCredential(
          credential
        );

      let user =
        await User.findOne({
          googleId:
            googleUser.sub,
        });

      if (!user) {
        user =
          await User.findOne({
            email:
              googleUser.email,
          });

        if (user) {
          user.googleId =
            googleUser.sub;

          user.isEmailVerified =
            true;

          if (
            !user.avatar &&
            googleUser.picture
          ) {
            user.avatar =
              googleUser.picture;
          }

          await user.save();
        } else {
          const newUserData: {
            fullName: string;
            email: string;
            googleId: string;
            authProvider: "google";
            role: "user";
            isEmailVerified: boolean;
            avatar?: string;
          } = {
            fullName:
              googleUser.name,

            email:
              googleUser.email,

            googleId:
              googleUser.sub,

            authProvider:
              "google",

            role:
              "user",

            isEmailVerified:
              true,
          };

          if (
            googleUser.picture
          ) {
            newUserData.avatar =
              googleUser.picture;
          }

          user =
            await User.create(
              newUserData
            );
        }
      }

      const token =
        generateToken(
          user._id.toString()
        );

      res.status(200).json({
        success: true,

        message:
          "Google authentication successful",

        data: {
          token,

          user: {
            id: user._id,
            fullName:
              user.fullName,
            email:
              user.email,
            role:
              user.role,
            avatar:
              user.avatar,
            authProvider:
              user.authProvider,
            isEmailVerified:
              user.isEmailVerified,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };


export const forgotPasswordController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        email,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+passwordResetCode +passwordResetExpires"
        );

      if (!user) {
        res.status(200).json({
          success: true,
          message:
            "If an account exists with this email, a password reset code has been sent.",
        });

        return;
      }

      if (
        user.authProvider ===
        "google" &&
        !user.password
      ) {
        res.status(400).json({
          success: false,
          message:
            "This account uses Google sign-in and does not have a local password.",
        });

        return;
      }

      const resetCode =
        generateVerificationCode();

      user.passwordResetCode =
        await hashVerificationCode(
          resetCode
        );

      user.passwordResetExpires =
        new Date(
          Date.now() +
          10 *
          60 *
          1000
        );

      await user.save();

      try {
        await sendPasswordResetEmail(
          user.email,
          user.fullName,
          resetCode
        );
      } catch (emailError) {
        user.passwordResetCode =
          undefined;

        user.passwordResetExpires =
          undefined;

        await user.save();

        throw emailError;
      }

      res.status(200).json({
        success: true,

        message:
          "If an account exists with this email, a password reset code has been sent.",
      });
    } catch (error) {
      next(error);
    }
  };

export const resetPasswordController =
  async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        email,
        code,
        newPassword,
      } = req.body;

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password +passwordResetCode +passwordResetExpires"
        );

      if (
        !user ||
        !user.passwordResetCode ||
        !user.passwordResetExpires
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid or expired password reset request.",
        });

        return;
      }

      if (
        user.passwordResetExpires.getTime() <
        Date.now()
      ) {
        user.passwordResetCode =
          undefined;

        user.passwordResetExpires =
          undefined;

        await user.save();

        res.status(400).json({
          success: false,
          message:
            "Password reset code has expired. Please request a new code.",
        });

        return;
      }

      const isCodeValid =
        await bcrypt.compare(
          code,
          user.passwordResetCode
        );

      if (!isCodeValid) {
        res.status(400).json({
          success: false,
          message:
            "Invalid password reset code.",
        });

        return;
      }

      if (
        user.password
      ) {
        const samePassword =
          await user.comparePassword(
            newPassword
          );

        if (
          samePassword
        ) {
          res.status(400).json({
            success: false,
            message:
              "New password must be different from your current password.",
          });

          return;
        }
      }

      user.password =
        newPassword;

      user.passwordResetCode =
        undefined;

      user.passwordResetExpires =
        undefined;

      await user.save();

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully.",
      });
    } catch (error) {
      next(error);
    }
  };