import http from "http";
import { Server } from "socket.io";

import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

import { initSocket } from "./socket/socket";
import { setupSocket } from "./socket/socket.handler";
import { cleanupCallsAfterRestart } from "./socket/call.service";

const startServer = async () => {
  await connectDB();
  await cleanupCallsAfterRestart();

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
    },
  });

  initSocket(io);
  setupSocket(io);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Server running on ${env.PORT}`);
  });
};

startServer();
