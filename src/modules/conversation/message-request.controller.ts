import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./message-request.service";

export const received = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await service.getMessageRequests(req.user.userId);
    res.json({ success: true, data });
  },
);

export const sent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.getMessageRequests(req.user.userId, true);
  res.json({ success: true, data });
});

export const accept = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.acceptMessageRequest(
    String(req.params.conversationId),
    req.user.userId,
  );
  res.json({ success: true, data });
});

export const reject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.rejectMessageRequest(
    String(req.params.conversationId),
    req.user.userId,
  );
  res.json({ success: true, data });
});
