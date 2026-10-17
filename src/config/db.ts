import mongoose from "mongoose";
import { env } from "./env";

export const connectDB = async () => {
  try {
    await mongoose.connect(env.DATABASE_URL);

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection failed");
    throw error;
  }
};
