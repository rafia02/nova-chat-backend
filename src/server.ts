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
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  initSocket(io);
  setupSocket(io);

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(env.PORT, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  console.log(`Server running on port ${env.PORT}`);
};

startServer().catch((error: unknown) => {
  console.error("Server startup failed:", error);
  process.exitCode = 1;
});
