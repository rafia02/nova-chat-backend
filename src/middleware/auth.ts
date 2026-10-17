import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { verifyToken } from "../utils/jwt";
import { User } from "../modules/user/user.model";

export interface AuthRequest extends Request {
  user?: NonNullable<Request["user"]>;
}

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const match = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  let decoded: ReturnType<typeof verifyToken>;
  try {
    decoded = verifyToken(match[1]);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  if (!Types.ObjectId.isValid(decoded.userId)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!(await User.exists({ _id: decoded.userId }))) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  (req as AuthRequest).user = decoded;
  next();
};
