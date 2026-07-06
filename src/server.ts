import http from "http";
import { Server } from "socket.io";

import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

import { initSocket } from "./socket/socket";

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
    },
  });

  initSocket(io);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on ${env.PORT}`);
  });
};

startServer();
