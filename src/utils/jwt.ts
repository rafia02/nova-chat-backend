import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const generateToken = (userId: string) => {
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string) => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (
    typeof decoded !== "object" ||
    typeof decoded.userId !== "string" ||
    !/^[0-9a-fA-F]{24}$/.test(decoded.userId)
  ) {
    throw new Error("Invalid token payload");
  }
  return { userId: decoded.userId };
};
