import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createServer, Server } from "node:http";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/nova-chat-test";
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString("hex");
process.env.CORS_ORIGIN = "http://localhost:3000,http://localhost:5173";
process.env.CLOUD_NAME = "";
process.env.CLOUD_API_KEY = "";
process.env.CLOUD_API_SECRET = "";

const app = require("../app").default;
const { generateToken, verifyToken } = require("../utils/jwt");
const messageService = require("../modules/message/message.service");
const { uploadToCloudinary } = require("../utils/cloudinary");
const server: Server = createServer(app);
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind test HTTP server"));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health route responds successfully", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "NovaChat API Running",
  });
});

test("protected user routes reject missing and invalid bearer tokens", async () => {
  const missing = await fetch(`${baseUrl}/api/users`);
  const invalid = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: "Bearer invalid-token" },
  });
  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
});

test("registration rejects missing credentials", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
});

test("JWT signatures are verified and malformed tokens rejected", () => {
  const token = generateToken("507f1f77bcf86cd799439011");
  assert.equal(verifyToken(token).userId, "507f1f77bcf86cd799439011");
  assert.throws(() => verifyToken("invalid-token"));
});

test("message history rejects an invalid conversation ID before database access", async () => {
  await assert.rejects(
    () => messageService.getMessages("507f1f77bcf86cd799439011", "invalid"),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
});

test("uploads fail explicitly when Cloudinary credentials are missing", async () => {
  await assert.rejects(
    () => uploadToCloudinary(Buffer.from("test")),
    (error: { statusCode?: number; message?: string }) =>
      error.statusCode === 503 &&
      error.message?.includes("CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET"),
  );
});

test("CORS allows configured origins and rejects unconfigured origins", async () => {
  const allowed = await fetch(baseUrl, {
    headers: { Origin: "http://localhost:3000" },
  });
  const denied = await fetch(baseUrl, {
    headers: { Origin: "https://not-allowed.example" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  assert.equal(denied.status, 403);
});

test("unknown routes return the standard not-found response", async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).success, false);
});
