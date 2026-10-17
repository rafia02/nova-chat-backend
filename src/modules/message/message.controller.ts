import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { uploadToCloudinary } from "../../utils/cloudinary";
import * as service from "./message.service";

const uploadedFiles = (req: AuthRequest): Express.Multer.File[] => {
  if (req.file) return [req.file];
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
};

export const sendMessageController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId, content, replyTo, clientMessageId } = req.body;
    if (typeof conversationId !== "string") {
      throw new ApiError(400, "Conversation ID is required");
    }
    await service.assertCanSendMessage(conversationId, req.user!.userId);

    const files = uploadedFiles(req);
    if (files.length > 10) {
      throw new ApiError(400, "Maximum 10 attachments per message");
    }
    const idempotencyKey = req.get("Idempotency-Key") || clientMessageId;
    const attachments = await Promise.all(
      files.map(async (file) => {
        const result: any = await uploadToCloudinary(file.buffer);
        const type = file.mimetype.startsWith("image/")
          ? "image"
          : file.mimetype.startsWith("video/")
            ? "video"
            : file.mimetype.startsWith("audio/")
              ? "audio"
              : "file";
        return {
          url: result.secure_url,
          filename: file.originalname,
          mimeType: file.mimetype,
          size: Number(result.bytes) || file.size,
          type,
          publicId: result.public_id,
        };
      }),
    );

    const message = await service.sendMessage(
      req.user!.userId,
      conversationId,
      content,
      replyTo,
      attachments,
      idempotencyKey,
    );
    res.status(201).json({ success: true, data: message });
  },
);

export const getMessagesController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { conversationId, page, limit } = req.query;
    if (typeof conversationId !== "string") {
      throw new ApiError(400, "Conversation ID is required");
    }
    const parsedPage = page === undefined ? 1 : Number(page);
    const parsedLimit = limit === undefined ? 20 : Number(limit);
    if (
      !Number.isInteger(parsedPage) ||
      parsedPage < 1 ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 100
    ) {
      throw new ApiError(400, "Page must be positive and limit must be 1 to 100");
    }
    const messages = await service.getMessages(
      req.user!.userId,
      conversationId,
      parsedPage,
      parsedLimit,
    );
    res.json({ success: true, data: messages });
  },
);

export const editMessageController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { messageId, content } = req.body;
    const message = await service.editMessage(
      messageId,
      req.user!.userId,
      content,
    );
    res.json({ success: true, data: message });
  },
);

export const deleteMessageController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.body;
    const message = await service.deleteMessage(messageId, req.user!.userId);
    res.json({ success: true, data: message });
  },
);

export const reactMessageController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { messageId, emoji } = req.body;
    const message = await service.reactMessage(
      messageId,
      req.user!.userId,
      emoji,
    );
    res.json({ success: true, data: message });
  },
);
