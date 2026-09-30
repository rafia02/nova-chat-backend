import { Server } from "socket.io";
import { verifyToken } from "./socket.auth";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./socket.events";
import { addOnlineSocket, removeOnlineSocket } from "./presence";
import { AuthenticatedSocket } from "./socket.types";
import { Conversation } from "../modules/conversation/conversation.model";
import { Message } from "../modules/message/message.model";
import {
  acceptCall,
  endCall,
  handleCallDisconnect,
  initiateCall,
  rejectCall,
  relayCallSignal,
} from "./call.service";

const canAccessConversation = async (
  conversationId: unknown,
  userId: string,
) => {
  if (typeof conversationId !== "string") return false;
  if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) return false;
  return Boolean(
    await Conversation.exists({
      _id: conversationId,
      participants: userId,
      $or: [
        { requestStatus: "normal" },
        { requestStatus: "pending", requestedBy: userId },
      ],
    }),
  );
};

const markMessagesDelivered = async (
  io: Server,
  conversationId: string,
  userId: string,
) => {
  const pendingMessages = await Message.find({
    conversationId,
    senderId: { $ne: userId },
    status: "sent",
  })
    .select("_id")
    .limit(500)
    .lean();
  const deliveredIds: string[] = [];
  for (const message of pendingMessages) {
    const result = await Message.updateOne(
      {
        _id: message._id,
        conversationId,
        senderId: { $ne: userId },
        status: "sent",
      },
      { $set: { status: "delivered" } },
    );
    if (result.modifiedCount > 0) deliveredIds.push(message._id.toString());
  }
  if (deliveredIds.length === 0) return;

  const conversation =
    await Conversation.findById(conversationId).select("participants");
  if (!conversation) return;
  const ids = [
    ...new Set(
      conversation.participants.map((participant) => participant.toString()),
    ),
  ];
  if (ids.length === 0) return;
  let target = io.to(`user:${ids[0]}`);
  for (const participantId of ids.slice(1))
    target = target.to(`user:${participantId}`);
  for (const messageId of deliveredIds) {
    target.emit(SERVER_EVENTS.MESSAGE_DELIVERED, {
      conversationId,
      messageId,
      status: "delivered",
    });
  }
};

export const setupSocket = (io: Server) => {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    const decoded = verifyToken(token);

    if (!decoded) return next(new Error("Unauthorized"));

    socket.userId = decoded.userId;
    next();
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;

    socket.data.userId = userId;
    const becameOnline = addOnlineSocket(userId, socket.id);

    socket.join(`user:${userId}`);

    if (becameOnline) io.emit(SERVER_EVENTS.USER_ONLINE, { userId });

    console.log("User online:", userId);

    // JOIN ROOM
    socket.on(CLIENT_EVENTS.JOIN, async (conversationId: string) => {
      if (await canAccessConversation(conversationId, userId)) {
        socket.join(`conversation:${conversationId}`);
        await markMessagesDelivered(io, conversationId, userId);
      }
    });

    // LEAVE ROOM
    socket.on(CLIENT_EVENTS.LEAVE, (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // TYPING START
    socket.on(CLIENT_EVENTS.TYPING_START, async (conversationId: string) => {
      if (!(await canAccessConversation(conversationId, userId))) return;
      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.TYPING_UPDATE, {
          conversationId,
          userId,
          isTyping: true,
        });
    });

    // TYPING STOP
    socket.on(CLIENT_EVENTS.TYPING_STOP, async (conversationId: string) => {
      if (!(await canAccessConversation(conversationId, userId))) return;
      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.TYPING_UPDATE, {
          conversationId,
          userId,
          isTyping: false,
        });
    });

    // MESSAGE SEEN
    socket.on(CLIENT_EVENTS.MESSAGE_SEEN, async (data: any) => {
      if (!(await canAccessConversation(data?.conversationId, userId))) return;
      const { conversationId } = data;
      const messageIds = Array.isArray(data.messageIds)
        ? data.messageIds
            .filter(
              (id: unknown) =>
                typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id),
            )
            .slice(0, 100)
        : [];
      const seenIds: string[] = [];
      for (const messageId of messageIds) {
        const updated = await Message.findOneAndUpdate(
          {
            _id: messageId,
            conversationId,
            senderId: { $ne: userId },
            status: { $ne: "seen" },
          },
          { $set: { status: "seen" } },
          { new: true },
        );
        if (updated) seenIds.push(messageId);
      }
      if (seenIds.length > 0) {
        const conversation =
          await Conversation.findById(conversationId).select("participants");
        if (conversation) {
          let event = io.to(`user:${userId}`);
          for (const participant of conversation.participants) {
            event = event.to(`user:${participant.toString()}`);
          }
          event.emit(SERVER_EVENTS.MESSAGE_SEEN, {
            conversationId,
            messageIds: seenIds,
            userId,
          });
        }
      }
    });

    const handleCallInitiate = async (data: any, acknowledge: any) => {
      try {
        const call = await initiateCall(io, userId, data);
        if (typeof acknowledge === "function")
          acknowledge({ success: true, data: call });
      } catch (error: any) {
        if (typeof acknowledge === "function") {
          acknowledge({ success: false, message: error.message });
        }
      }
    };
    socket.on(CLIENT_EVENTS.CALL_INITIATE, handleCallInitiate);
    socket.on(CLIENT_EVENTS.CALL_START, handleCallInitiate);

    socket.on(CLIENT_EVENTS.CALL_ACCEPT, async (data, acknowledge) => {
      try {
        const call = await acceptCall(
          io,
          userId,
          data?.callId ?? data?.conversationId,
        );
        if (typeof acknowledge === "function")
          acknowledge({ success: true, data: call });
      } catch (error: any) {
        if (typeof acknowledge === "function")
          acknowledge({ success: false, message: error.message });
      }
    });

    socket.on(CLIENT_EVENTS.CALL_REJECT, async (data, acknowledge) => {
      try {
        const call = await rejectCall(
          io,
          userId,
          data?.callId ?? data?.conversationId,
        );
        if (typeof acknowledge === "function")
          acknowledge({ success: true, data: call });
      } catch (error: any) {
        if (typeof acknowledge === "function")
          acknowledge({ success: false, message: error.message });
      }
    });

    socket.on(CLIENT_EVENTS.CALL_END, async (data, acknowledge) => {
      try {
        const call = await endCall(
          io,
          userId,
          data?.callId ?? data?.conversationId,
        );
        if (typeof acknowledge === "function")
          acknowledge({ success: true, data: call });
      } catch (error: any) {
        if (typeof acknowledge === "function")
          acknowledge({ success: false, message: error.message });
      }
    });

    socket.on(CLIENT_EVENTS.CALL_SIGNAL, async (data, acknowledge) => {
      try {
        await relayCallSignal(io, userId, data);
        if (typeof acknowledge === "function") acknowledge({ success: true });
      } catch (error: any) {
        if (typeof acknowledge === "function")
          acknowledge({ success: false, message: error.message });
      }
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      if (removeOnlineSocket(userId, socket.id)) {
        await handleCallDisconnect(io, userId);
        io.emit(SERVER_EVENTS.USER_OFFLINE, { userId });
      }

      console.log("User offline:", userId);
    });
  });
};
