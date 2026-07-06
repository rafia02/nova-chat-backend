import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: Server) => {
  io = server;
};

export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};
