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
import { getIO } from "../../socket/socket";
import { SERVER_EVENTS } from "../../socket/socket.events";

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

  // 🔥 NEW MESSAGE
  emitToConversation(conversationId, SERVER_EVENTS.MESSAGE_NEW, message);

  // 🔥 DELIVERY EVENT
  emitToConversation(conversationId, SERVER_EVENTS.MESSAGE_DELIVERED, {
    messageId: message._id,
    conversationId,
  });

  return message;
};

/* ---------------------------
   GET MESSAGES
----------------------------*/
export const getMessages = async (
  conversationId: string,
  page = 1,
  limit = 20,
) => {
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

  if (!message) throw new Error("Message not found");

  if (message.senderId.toString() !== userId) throw new Error("Not allowed");

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

  if (!message) throw new Error("Message not found");

  if (message.senderId.toString() !== userId) throw new Error("Not allowed");

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

  if (!message) throw new Error("Message not found");

  const existing = message.reactions.find(
    (r: any) => r.userId === userId && r.emoji === emoji,
  );

  if (existing) {
    message.reactions = message.reactions.filter(
      (r: any) => !(r.userId === userId && r.emoji === emoji),
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
