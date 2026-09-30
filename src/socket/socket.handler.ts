import { Server } from "socket.io";
import { verifyToken } from "./socket.auth";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./socket.events";
import { onlineUsers } from "./presence";
import { AuthenticatedSocket } from "./socket.types";
import { Conversation } from "../modules/conversation/conversation.model";

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
    onlineUsers.set(userId, socket.id);

    socket.join(`user:${userId}`);

    io.emit(SERVER_EVENTS.USER_ONLINE, { userId });

    console.log("User online:", userId);

    // JOIN ROOM
    socket.on(CLIENT_EVENTS.JOIN, async (conversationId: string) => {
      if (await canAccessConversation(conversationId, userId)) {
        socket.join(`conversation:${conversationId}`);
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
      const { conversationId, messageIds } = data;

      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.MESSAGE_SEEN, {
          conversationId,
          messageIds,
          userId,
        });
    });

    socket.on("call:start", async ({ conversationId, type }) => {
      if (!(await canAccessConversation(conversationId, userId))) return;
      socket.to(`conversation:${conversationId}`).emit("call:incoming", {
        from: userId,
        type,
      });
    });

    socket.on("call:accept", async ({ conversationId }) => {
      if (!(await canAccessConversation(conversationId, userId))) return;
      socket.to(`conversation:${conversationId}`).emit("call:accepted", {
        userId,
      });
    });

    socket.on("call:end", async ({ conversationId }) => {
      if (!(await canAccessConversation(conversationId, userId))) return;
      io.to(`conversation:${conversationId}`).emit("call:ended", {
        userId,
      });
    });

    socket.on("call:signal", async (data) => {
      if (!(await canAccessConversation(data?.conversationId, userId))) return;
      socket
        .to(`conversation:${data.conversationId}`)
        .emit("call:signal", data);
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      onlineUsers.delete(userId);

      io.emit(SERVER_EVENTS.USER_OFFLINE, { userId });

      console.log("User offline:", userId);
    });
  });
};
