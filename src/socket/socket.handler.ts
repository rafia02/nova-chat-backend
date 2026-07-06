import { Server } from "socket.io";
import { verifyToken } from "./socket.auth";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./socket.events";
import { onlineUsers } from "./presence";
import { AuthenticatedSocket } from "./socket.types";

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

    onlineUsers.set(userId, socket.id);

    socket.join(`user:${userId}`);

    io.emit(SERVER_EVENTS.USER_ONLINE, { userId });

    console.log("User online:", userId);

    // JOIN ROOM
    socket.on(CLIENT_EVENTS.JOIN, (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // LEAVE ROOM
    socket.on(CLIENT_EVENTS.LEAVE, (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // TYPING START
    socket.on(CLIENT_EVENTS.TYPING_START, (conversationId: string) => {
      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.TYPING_UPDATE, {
          conversationId,
          userId,
          isTyping: true,
        });
    });

    // TYPING STOP
    socket.on(CLIENT_EVENTS.TYPING_STOP, (conversationId: string) => {
      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.TYPING_UPDATE, {
          conversationId,
          userId,
          isTyping: false,
        });
    });

    // MESSAGE SEEN
    socket.on(CLIENT_EVENTS.MESSAGE_SEEN, (data: any) => {
      const { conversationId, messageIds } = data;

      socket
        .to(`conversation:${conversationId}`)
        .emit(SERVER_EVENTS.MESSAGE_SEEN, {
          conversationId,
          messageIds,
          userId,
        });
    });

    socket.on("call:start", ({ conversationId, type }) => {
      socket.to(`conversation:${conversationId}`).emit("call:incoming", {
        from: userId,
        type,
      });
    });

    socket.on("call:accept", ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit("call:accepted", {
        userId,
      });
    });

    socket.on("call:end", ({ conversationId }) => {
      io.to(`conversation:${conversationId}`).emit("call:ended", {
        userId,
      });
    });

    socket.on("call:signal", (data) => {
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
