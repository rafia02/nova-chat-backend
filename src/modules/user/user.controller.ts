import { Request, Response } from "express";
import * as userService from "./user.service";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();
  res.json({ success: true, data: users });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(String(req.params.id));
  res.json({ success: true, data: user });
});

export const updateUserProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = await userService.updateUser(req.user!.userId, req.body);
    res.json({ success: true, message: "Profile updated", data: user });
  },
);

export const searchUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query.q;
    const users = await userService.searchUsers(
      typeof query === "string" ? query : "",
    );
    res.json({ success: true, data: users });
  },
);
