import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: Server) => {
  io = server;
};

export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

export const restrictConversationRoom = async (
  conversationId: string,
  allowedUserId?: string,
) => {
  const room = `conversation:${conversationId}`;
  const sockets = await getIO().in(room).fetchSockets();
  await Promise.all(
    sockets
      .filter(
        (socket) => !allowedUserId || socket.data.userId !== allowedUserId,
      )
      .map((socket) => socket.leave(room)),
  );
};
