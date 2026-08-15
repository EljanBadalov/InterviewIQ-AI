import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    const connection = await mongoose.connect(env.MONGO_URI);

    console.log(
      `✅ MongoDB connected successfully: ${connection.connection.host}`
    );
  } catch (error) {
    console.dir(error, { depth: 10 });

    if (error instanceof Error) {
      console.error(
        `❌ MongoDB connection failed: ${error.message}`
      );
    } else {
      console.error(
        "❌ MongoDB connection failed with an unknown error."
      );
    }

    throw error;
  }
};