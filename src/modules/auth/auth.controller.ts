import { Request, Response } from "express";
import * as authService from "./auth.service";
import { AuthRequest } from "../../middleware/auth";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { asyncHandler } from "../../utils/asyncHandler";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);
  res.json({ success: true, message: "Login successful", data: result });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
});
