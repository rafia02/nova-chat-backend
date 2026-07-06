import { Request, Response } from "express";
import * as userService from "./user.service";
import { AuthRequest } from "../../middleware/auth";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();

    res.json({
      success: true,
      data: users,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      data: user,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.updateUser(req.user.userId, req.body);

    res.json({
      success: true,
      message: "Profile updated",
      data: user,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const searchUsersController = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    const users = await userService.searchUsers(query);

    res.json({
      success: true,
      data: users,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
