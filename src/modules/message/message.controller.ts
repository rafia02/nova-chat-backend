import { Request, Response } from "express";
import * as service from "./message.service";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { sendMessage } from "./message.service";

// export const sendMessageController = async (req: any, res: Response) => {
//   const { conversationId, content, replyTo } = req.body;

//   const message = await service.sendMessage(
//     req.user.userId,
//     conversationId,
//     content,
//     replyTo,
//   );

//   res.json({
//     success: true,
//     data: message,
//   });
// };

export const sendMessageController = async (req: any, res: any) => {
  try {
    const { conversationId, content, replyTo, clientMessageId } = req.body;
    const idempotencyKey = req.get("Idempotency-Key") || clientMessageId;
    const uploadedFiles: Express.Multer.File[] = req.file
      ? [req.file]
      : Array.isArray(req.files)
        ? req.files
        : (Object.values(req.files ?? {}).flat() as Express.Multer.File[]);
    if (uploadedFiles.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maximum 10 attachments per message",
      });
    }

    const attachments = await Promise.all(
      uploadedFiles.map(async (file) => {
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

    const message = await sendMessage(
      req.user.userId,
      conversationId,
      content,
      replyTo,
      attachments,
      idempotencyKey,
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err: any) {
    const statusCode =
      err.statusCode ||
      (err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err.code === "LIMIT_FILE_COUNT" ||
            err.code === "LIMIT_UNEXPECTED_FILE"
          ? 400
          : 500);
    return res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
};

export const getMessagesController = async (req: Request, res: Response) => {
  const { conversationId, page, limit } = req.query;

  const messages = await service.getMessages(
    (req as any).user.userId,
    conversationId as string,
    Number(page) || 1,
    Number(limit) || 20,
  );

  res.json({
    success: true,
    data: messages,
  });
};

export const editMessageController = async (req: any, res: Response) => {
  const { messageId, content } = req.body;

  const message = await service.editMessage(
    messageId,
    req.user.userId,
    content,
  );

  res.json({
    success: true,
    data: message,
  });
};

export const deleteMessageController = async (req: any, res: Response) => {
  const { messageId } = req.body;

  const message = await service.deleteMessage(messageId, req.user.userId);

  res.json({
    success: true,
    data: message,
  });
};

export const reactMessageController = async (req: any, res: Response) => {
  const { messageId, emoji } = req.body;

  const message = await service.reactMessage(messageId, req.user.userId, emoji);

  res.json({
    success: true,
    data: message,
  });
};
