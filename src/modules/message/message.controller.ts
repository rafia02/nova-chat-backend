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
    const { conversationId, content, replyTo } = req.body;

    let media;

    // 📎 FILE UPLOAD HANDLING
    if (req.file) {
      const result: any = await uploadToCloudinary(req.file.buffer);

      media = {
        url: result.secure_url,
        name: result.original_filename || req.file.originalname,
        type: req.file.mimetype.startsWith("image")
          ? "image"
          : req.file.mimetype.startsWith("video")
            ? "video"
            : req.file.mimetype.startsWith("audio")
              ? "audio"
              : "file",
      };
    }

    // 💬 SEND MESSAGE (UPDATED SERVICE CALL)
    const message = await sendMessage(
      req.user.userId,
      conversationId,
      content,
      replyTo,
      media, // 🔥 IMPORTANT: NEW PARAM ADDED
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
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
