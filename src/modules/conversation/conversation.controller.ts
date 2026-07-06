import { Request, Response } from "express";
import * as service from "./conversation.service";
import { AuthRequest } from "../../middleware/auth";

export const createDMController = async (req: AuthRequest, res: Response) => {
  try {
    const convo = await service.createDM(req.user.userId, req.body.otherUserId);

    res.json({
      success: true,
      data: convo,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const createGroupController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const convo = await service.createGroup(
      req.user.userId,
      req.body.name,
      req.body.members,
    );

    res.json({
      success: true,
      data: convo,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getMyConversations = async (req: AuthRequest, res: Response) => {
  try {
    const convos = await service.getUserConversations(req.user.userId);

    res.json({
      success: true,
      data: convos,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
