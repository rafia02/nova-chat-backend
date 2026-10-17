import { Response } from "express";
import * as service from "./conversation.service";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { ApiError } from "../../utils/ApiError";

export const createDMController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const convo = await service.createDM(req.user!.userId, req.body.otherUserId);
    res.json({ success: true, data: convo });
  },
);

export const createGroupController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
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
      if (!req.file.mimetype.startsWith("image/")) {
        throw new ApiError(415, "Group avatar must be an image");
      }
      const uploaded: any = await uploadToCloudinary(req.file.buffer);
      avatar = uploaded.secure_url;
    }
    const convo = await service.createGroup(
      req.user!.userId,
      req.body.name,
      members ?? [],
      avatar,
    );
    res.json({ success: true, data: convo });
  },
);

export const getMyConversations = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const convos = await service.getUserConversations(req.user!.userId);
    res.json({ success: true, data: convos });
  },
);

export const getConversationController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.getConversation(
      String(req.params.id),
      req.user!.userId,
    );
    res.json({ success: true, data });
  },
);

export const updateGroupController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const conversationId = String(req.params.id);
    await service.assertCanUpdateGroup(conversationId, req.user!.userId);
    let avatar = req.body.avatar;
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        throw new ApiError(415, "Group avatar must be an image");
      }
      const uploaded: any = await uploadToCloudinary(req.file.buffer);
      avatar = uploaded.secure_url;
    }
    const data = await service.updateGroup(
      conversationId,
      req.user!.userId,
      {
        name: req.body.name,
        avatar,
      },
    );
    res.json({ success: true, data });
  },
);

export const addGroupMembersController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.addGroupMembers(
      String(req.params.id),
      req.user!.userId,
      req.body.members,
    );
    res.json({ success: true, data });
  },
);

export const removeGroupMemberController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.removeGroupMember(
      String(req.params.id),
      req.user!.userId,
      String(req.params.userId),
    );
    res.json({ success: true, data });
  },
);

export const leaveGroupController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.removeGroupMember(
      String(req.params.id),
      req.user!.userId,
      req.user!.userId,
    );
    res.json({ success: true, data });
  },
);
