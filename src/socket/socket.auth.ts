import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      userId: string;
    };
  } catch (err) {
    return null;
  }
};
