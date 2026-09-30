// import { Message } from "./message.model";
// import { Conversation } from "../conversation/conversation.model";
// import { getIO } from "../../socket/socket";
// import { SERVER_EVENTS } from "../../socket/socket.events";

// export const sendMessage = async (
//   senderId: string,
//   conversationId: string,
//   content: string,
//   replyTo?: any,
// ) => {
//   const message = await Message.create({
//     senderId,
//     conversationId,
//     content,
//     replyTo,
//   });

//   await Conversation.findByIdAndUpdate(conversationId, {
//     lastMessage: content,
//     lastMessageAt: new Date(),
//   });

//   // 🔥 SOCKET EMIT (NEW MESSAGE)
//   const io = getIO();

//   io.to(`conversation:${conversationId}`).emit(
//     SERVER_EVENTS.MESSAGE_NEW,
//     message,
//   );

//   // 🔥 DELIVERY EVENT (optional but production ready)
//   io.to(`conversation:${conversationId}`).emit(
//     SERVER_EVENTS.MESSAGE_DELIVERED,
//     {
//       messageId: message._id,
//       conversationId,
//     },
//   );

//   return message;
// };

// export const getMessages = async (
//   conversationId: string,
//   page = 1,
//   limit = 20,
// ) => {
//   const skip = (page - 1) * limit;

//   const messages = await Message.find({ conversationId })
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(limit);

//   return messages.reverse();
// };

// export const editMessage = async (
//   messageId: string,
//   userId: string,
//   content: string,
// ) => {
//   const message = await Message.findById(messageId);

//   if (!message) throw new Error("Message not found");

//   if (message.senderId.toString() !== userId) throw new Error("Not allowed");

//   message.content = content;
//   message.editedAt = new Date();

//   await message.save();

//   // 🔥 SOCKET EMIT
//   const io = getIO();

//   io.to(`conversation:${message.conversationId}`).emit(
//     SERVER_EVENTS.MESSAGE_UPDATED,
//     message,
//   );

//   return message;
// };

// export const deleteMessage = async (messageId: string, userId: string) => {
//   const message = await Message.findById(messageId);

//   if (!message) throw new Error("Message not found");

//   if (message.senderId.toString() !== userId) throw new Error("Not allowed");

//   message.isDeleted = true;
//   message.content = "This message was deleted";

//   await message.save();

//   // 🔥 SOCKET EMIT
//   const io = getIO();

//   io.to(`conversation:${message.conversationId}`).emit(
//     SERVER_EVENTS.MESSAGE_DELETED,
//     {
//       messageId,
//       conversationId: message.conversationId,
//     },
//   );

//   return message;
// };

// export const reactMessage = async (
//   messageId: string,
//   userId: string,
//   emoji: string,
// ) => {
//   const message = await Message.findById(messageId);

//   if (!message) throw new Error("Message not found");

//   const existing = message.reactions.find(
//     (r: any) => r.userId === userId && r.emoji === emoji,
//   );

//   if (existing) {
//     message.reactions = message.reactions.filter(
//       (r: any) => !(r.userId === userId && r.emoji === emoji),
//     );
//   } else {
//     message.reactions.push({ userId, emoji });
//   }

//   await message.save();

//   // 🔥 SOCKET EMIT
//   const io = getIO();

//   io.to(`conversation:${message.conversationId}`).emit(
//     SERVER_EVENTS.MESSAGE_REACTION,
//     message,
//   );

//   return message;
// };

import { Message } from "./message.model";
import { Conversation } from "../conversation/conversation.model";
import { getIO, restrictConversationRoom } from "../../socket/socket";
import { SERVER_EVENTS } from "../../socket/socket.events";
import { ApiError } from "../../utils/ApiError";
import { areFriends } from "../friend/friend.service";

/* ---------------------------
   SOCKET HELPER (CLEAN)
----------------------------*/
const emitToConversation = async (
  conversationId: string,
  event: string,
  data: any,
) => {
  const io = getIO();
  const conversation =
    await Conversation.findById(conversationId).select("participants");
  if (!conversation) return;
  const participantIds = [
    ...new Set(conversation.participants.map((id) => id.toString())),
  ];
  if (participantIds.length === 0) return;
  let target = io.to(`user:${participantIds[0]}`);
  for (const participantId of participantIds.slice(1)) {
    target = target.to(`user:${participantId}`);
  }
  target.emit(event, data);
};

/* ---------------------------
   SEND MESSAGE
----------------------------*/
export const sendMessage = async (
  senderId: string,
  conversationId: string,
  content: string,
  replyTo?: any,
  media?: any,
  clientMessageId?: string,
) => {
  if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (
    !conversation.participants.some(
      (participant) => participant.toString() === senderId,
    )
  ) {
    throw new ApiError(403, "Not a conversation participant");
  }

  const attachments = Array.isArray(media) ? media : media ? [media] : [];
  const messageContent = typeof content === "string" ? content.trim() : "";
  if (messageContent.length > 10_000)
    throw new ApiError(400, "Message is too long");
  if (messageContent.length === 0 && attachments.length === 0) {
    throw new ApiError(400, "A message or attachment is required");
  }
  if (attachments.length > 10)
    throw new ApiError(400, "Maximum 10 attachments per message");
  if (
    clientMessageId &&
    (typeof clientMessageId !== "string" || clientMessageId.length > 128)
  ) {
    throw new ApiError(400, "Invalid client message ID");
  }

  if (clientMessageId) {
    const existing = await Message.findOne({
      conversationId,
      senderId,
      clientMessageId,
    });
    if (existing) {
      if (
        conversation.type === "dm" &&
        (conversation.requestStatus === "rejected" ||
          (conversation.requestStatus === "pending" &&
            conversation.requestedBy?.toString() !== senderId))
      ) {
        throw new ApiError(403, "This conversation is not available");
      }
      return existing;
    }
  }

  let isMessageRequest = false;
  let requestRecipientId: string | undefined;
  if (conversation.type === "dm") {
    const recipientId = conversation.participants
      .find((participant) => participant.toString() !== senderId)
      ?.toString();
    if (!recipientId) throw new ApiError(400, "Invalid direct conversation");

    const friends = await areFriends(senderId, recipientId);
    if (friends) {
      if (conversation.requestStatus !== "normal") {
        conversation.requestStatus = "normal";
        conversation.requestedBy = null;
        await conversation.save();
      }
    } else if (conversation.requestStatus === "rejected") {
      throw new ApiError(403, "This message request was rejected");
    } else if (conversation.requestStatus === "pending") {
      if (conversation.requestedBy?.toString() !== senderId) {
        throw new ApiError(403, "Accept the message request before replying");
      }
      isMessageRequest = true;
      requestRecipientId = recipientId;
    } else {
      const updated = await Conversation.findOneAndUpdate(
        { _id: conversation._id, requestStatus: "normal" },
        { $set: { requestStatus: "pending", requestedBy: senderId } },
        { new: true },
      );
      if (!updated) {
        const latest = await Conversation.findById(conversation._id);
        if (!latest || latest.requestStatus === "rejected") {
          throw new ApiError(403, "This message request was rejected");
        }
        if (
          latest.requestStatus === "pending" &&
          latest.requestedBy?.toString() !== senderId
        ) {
          throw new ApiError(403, "Accept the message request before replying");
        }
        if (latest.requestStatus === "pending") {
          isMessageRequest = true;
          requestRecipientId = recipientId;
        }
      } else {
        isMessageRequest = true;
        requestRecipientId = recipientId;
      }
      if (isMessageRequest) {
        await restrictConversationRoom(conversationId, senderId);
      }
    }
  }

  let message;
  try {
    message = await Message.create({
      senderId,
      conversationId,
      content: messageContent,
      replyTo,
      media: attachments[0]
        ? {
            url: attachments[0].url,
            name: attachments[0].filename ?? attachments[0].name,
            type: attachments[0].type,
          }
        : undefined,
      attachments,
      clientMessageId,
    });
  } catch (error: any) {
    if (error.code !== 11000 || !clientMessageId) throw error;
    const existing = await Message.findOne({
      conversationId,
      senderId,
      clientMessageId,
    });
    if (existing) return existing;
    throw error;
  }

  const preview =
    attachments.length > 0
      ? attachments[0].type === "audio"
        ? "Voice message"
        : "Attachment"
      : messageContent;
  const conversationFilter: Record<string, unknown> = {
    _id: conversationId,
    participants: senderId,
  };
  if (conversation.type === "dm") {
    if (isMessageRequest) {
      conversationFilter.requestStatus = "pending";
      conversationFilter.requestedBy = senderId;
    } else {
      conversationFilter.requestStatus = "normal";
    }
  }
  let updatedConversation;
  try {
    updatedConversation = await Conversation.findOneAndUpdate(
      conversationFilter,
      { $set: { lastMessage: preview, lastMessageAt: new Date() } },
      { new: true },
    );
  } catch (error) {
    await Message.deleteOne({ _id: message._id });
    throw error;
  }
  if (!updatedConversation) {
    await Message.deleteOne({ _id: message._id });
    throw new ApiError(
      403,
      "Conversation access changed; send the message again",
    );
  }

  if (isMessageRequest && requestRecipientId) {
    getIO()
      .to(`user:${requestRecipientId}`)
      .emit(SERVER_EVENTS.MESSAGE_REQUEST_NEW, {
        conversationId,
        message,
        senderId,
      });
  } else {
    const currentConversation =
      await Conversation.findById(conversationId).select("participants");
    const recipientIds =
      currentConversation?.participants
        .map((participant) => participant.toString())
        .filter((participantId) => participantId !== senderId) ?? [];
    const io = getIO();
    const onlineRecipients = await Promise.all(
      recipientIds.map(
        async (recipientId) =>
          (await io.in(`user:${recipientId}`).fetchSockets()).length > 0,
      ),
    );
    if (onlineRecipients.some(Boolean)) {
      message.status = "delivered";
      await message.save();
    }
    await emitToConversation(
      conversationId,
      SERVER_EVENTS.MESSAGE_NEW,
      message,
    );
    if (message.status === "delivered") {
      await emitToConversation(
        conversationId,
        SERVER_EVENTS.MESSAGE_DELIVERED,
        {
          messageId: message._id,
          conversationId,
          status: message.status,
        },
      );
    }
  }

  return message;
};

/* ---------------------------
   GET MESSAGES
----------------------------*/
export const getMessages = async (
  userId: string,
  conversationId: string,
  page = 1,
  limit = 20,
) => {
  if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (
    !conversation.participants.some(
      (participant) => participant.toString() === userId,
    )
  ) {
    throw new ApiError(403, "Not a conversation participant");
  }
  if (conversation.requestStatus === "rejected") {
    throw new ApiError(
      403,
      "Messages are unavailable because the request was rejected",
    );
  }

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const skip = (safePage - 1) * safeLimit;

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);

  return messages.reverse();
};

/* ---------------------------
   EDIT MESSAGE
----------------------------*/
export const editMessage = async (
  messageId: string,
  userId: string,
  content: string,
) => {
  const message = await Message.findById(messageId);

  if (!message) throw new ApiError(404, "Message not found");

  if (message.senderId.toString() !== userId)
    throw new ApiError(403, "Not allowed");
  await assertMessageAccess(message.conversationId.toString(), userId);

  message.content = content;
  message.editedAt = new Date();

  await message.save();

  await emitAuthorizedMessageEvent(
    message.conversationId.toString(),
    SERVER_EVENTS.MESSAGE_UPDATED,
    message,
  );

  return message;
};

/* ---------------------------
   DELETE MESSAGE
----------------------------*/
export const deleteMessage = async (messageId: string, userId: string) => {
  const message = await Message.findById(messageId);

  if (!message) throw new ApiError(404, "Message not found");

  if (message.senderId.toString() !== userId)
    throw new ApiError(403, "Not allowed");
  await assertMessageAccess(message.conversationId.toString(), userId);

  message.isDeleted = true;
  message.content = "This message was deleted";

  await message.save();

  await emitAuthorizedMessageEvent(
    message.conversationId.toString(),
    SERVER_EVENTS.MESSAGE_DELETED,
    {
      messageId,
      conversationId: message.conversationId,
    },
  );

  return message;
};

/* ---------------------------
   REACT MESSAGE
----------------------------*/
export const reactMessage = async (
  messageId: string,
  userId: string,
  emoji: string,
) => {
  const message = await Message.findById(messageId);

  if (!message) throw new ApiError(404, "Message not found");
  await assertMessageAccess(message.conversationId.toString(), userId);

  if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > 32) {
    throw new ApiError(400, "Invalid reaction emoji");
  }
  const reactionMatch = {
    $and: [
      { $eq: ["$$reaction.userId", userId] },
      { $eq: ["$$reaction.emoji", emoji] },
    ],
  };
  await Message.updateOne({ _id: messageId }, [
    {
      $set: {
        reactions: {
          $let: {
            vars: {
              matches: {
                $filter: {
                  input: { $ifNull: ["$reactions", []] },
                  as: "reaction",
                  cond: reactionMatch,
                },
              },
            },
            in: {
              $cond: [
                { $gt: [{ $size: "$$matches" }, 0] },
                {
                  $filter: {
                    input: { $ifNull: ["$reactions", []] },
                    as: "reaction",
                    cond: { $not: [reactionMatch] },
                  },
                },
                {
                  $concatArrays: [
                    { $ifNull: ["$reactions", []] },
                    [{ userId, emoji }],
                  ],
                },
              ],
            },
          },
        },
      },
    },
  ]);
  const updatedMessage = await Message.findById(messageId);
  if (!updatedMessage) throw new ApiError(404, "Message not found");

  await emitAuthorizedMessageEvent(
    message.conversationId.toString(),
    SERVER_EVENTS.MESSAGE_REACTION,
    updatedMessage,
  );

  return updatedMessage;
};

const assertMessageAccess = async (conversationId: string, userId: string) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (
    !conversation.participants.some(
      (participant) => participant.toString() === userId,
    )
  ) {
    throw new ApiError(403, "Not a conversation participant");
  }
  if (
    conversation.requestStatus === "rejected" ||
    (conversation.requestStatus === "pending" &&
      conversation.requestedBy?.toString() !== userId)
  ) {
    throw new ApiError(403, "This conversation is not available");
  }
  return conversation;
};

const emitAuthorizedMessageEvent = async (
  conversationId: string,
  event: string,
  payload: any,
) => {
  const conversation = await Conversation.findById(conversationId);
  if (conversation?.type === "dm" && conversation.requestStatus !== "normal") {
    if (conversation.requestStatus === "pending" && conversation.requestedBy) {
      getIO()
        .to(`user:${conversation.requestedBy.toString()}`)
        .emit(event, payload);
    }
    return;
  }
  await emitToConversation(conversationId, event, payload);
};
