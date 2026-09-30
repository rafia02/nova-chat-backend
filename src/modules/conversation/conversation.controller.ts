import { Request, Response } from "express";
import * as service from "./conversation.service";
import { AuthRequest } from "../../middleware/auth";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { ApiError } from "../../utils/ApiError";

export const createDMController = async (req: AuthRequest, res: Response) => {
  try {
    const convo = await service.createDM(req.user.userId, req.body.otherUserId);

    res.json({
      success: true,
      data: convo,
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
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
    let members = req.body.members;
    if (typeof members === "string") {
      try {
        members = JSON.parse(members);
      } catch {
        throw new ApiError(400, "Members must be a JSON array");
      }
    }
    let avatar = req.body.avatar;
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/"))
        throw new ApiError(415, "Group avatar must be an image");
      const uploaded: any = await uploadToCloudinary(req.file.buffer);
      avatar = uploaded.secure_url;
    }
    const convo = await service.createGroup(
      req.user.userId,
      req.body.name,
      members ?? [],
      avatar,
    );

    res.json({
      success: true,
      data: convo,
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
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
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getConversationController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await service.getConversation(
      String(req.params.id),
      req.user.userId,
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};

export const updateGroupController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    let avatar = req.body.avatar;
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/"))
        throw new ApiError(415, "Group avatar must be an image");
      const uploaded: any = await uploadToCloudinary(req.file.buffer);
      avatar = uploaded.secure_url;
    }
    const data = await service.updateGroup(
      String(req.params.id),
      req.user.userId,
      {
        name: req.body.name,
        avatar,
      },
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};

export const addGroupMembersController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await service.addGroupMembers(
      String(req.params.id),
      req.user.userId,
      req.body.members,
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};

export const removeGroupMemberController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await service.removeGroupMember(
      String(req.params.id),
      req.user.userId,
      String(req.params.userId),
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};

export const leaveGroupController = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.removeGroupMember(
      String(req.params.id),
      req.user.userId,
      req.user.userId,
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
};
