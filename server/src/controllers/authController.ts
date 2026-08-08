import { type Request, type Response, type NextFunction } from "express";
import { User } from "../models/User"; 
import { generateToken } from "../utils/generateToken";

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    const user = await User.create({
      fullName,
      email,
      password,
    });

    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};