import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./friend.service";

export const sendRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.sendFriendRequest(
      req.user.userId,
      String(req.params.userId),
    );
    res.status(201).json({ success: true, data });
  },
);

export const receivedRequests = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.getFriendRequests(req.user.userId, "received");
    res.json({ success: true, data });
  },
);

export const sentRequests = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.getFriendRequests(req.user.userId, "sent");
    res.json({ success: true, data });
  },
);

export const acceptRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.acceptFriendRequest(
      String(req.params.requestId),
      req.user.userId,
    );
    res.json({ success: true, data });
  },
);

export const rejectRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.rejectFriendRequest(
      String(req.params.requestId),
      req.user.userId,
    );
    res.json({ success: true, data });
  },
);

export const cancelRequest = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.cancelFriendRequest(
      String(req.params.requestId),
      req.user.userId,
    );
    res.json({ success: true, data });
  },
);

export const friends = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.getFriends(req.user.userId);
  res.json({ success: true, data });
});

export const removeFriend = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.removeFriend(
      req.user.userId,
      String(req.params.userId),
    );
    res.json({ success: true, data });
  },
);

export const friendStatus = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.getFriendStatus(
      req.user.userId,
      String(req.params.userId),
    );
    res.json({ success: true, data });
  },
);
