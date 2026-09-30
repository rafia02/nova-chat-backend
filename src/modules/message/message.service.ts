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
const emitToConversation = (
  conversationId: string,
  event: string,
  data: any,
) => {
  const io = getIO();
  io.to(`conversation:${conversationId}`).emit(event, data);
};

/* ---------------------------
   SEND MESSAGE
----------------------------*/
export const sendMessage = async (
  senderId: string,
  conversationId: string,
  content: string,
  replyTo?: any,
  media?: any, // 🔥 future support (image/video/file)
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

  const message = await Message.create({
    senderId,
    conversationId,
    content,
    replyTo,
    media,
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: media ? "📎 Media" : content,
    lastMessageAt: new Date(),
  });

  if (isMessageRequest && requestRecipientId) {
    getIO()
      .to(`user:${requestRecipientId}`)
      .emit(SERVER_EVENTS.MESSAGE_REQUEST_NEW, {
        conversationId,
        message,
        senderId,
      });
  } else {
    emitToConversation(conversationId, SERVER_EVENTS.MESSAGE_NEW, message);
    emitToConversation(conversationId, SERVER_EVENTS.MESSAGE_DELIVERED, {
      messageId: message._id,
      conversationId,
    });
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
  if (
    conversation.requestStatus === "rejected" ||
    (conversation.requestStatus === "pending" &&
      conversation.requestedBy?.toString() !== userId)
  ) {
    throw new ApiError(
      403,
      "Messages are unavailable until the request is accepted",
    );
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

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

  emitToConversation(
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

  emitToConversation(
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

  const existing = message.reactions.find(
    (r: any) => r.userId === userId && r.emoji === emoji,
  );

  if (existing) {
    message.set(
      "reactions",
      message.reactions.filter(
        (r: any) => !(r.userId === userId && r.emoji === emoji),
      ),
    );
  } else {
    message.reactions.push({ userId, emoji });
  }

  await message.save();

  emitToConversation(
    message.conversationId.toString(),
    SERVER_EVENTS.MESSAGE_REACTION,
    message,
  );

  return message;
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
};
