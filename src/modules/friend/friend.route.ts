import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./friend.controller";

const router = express.Router();

router.post("/friend-requests/:userId", auth, controller.sendRequest);
router.get("/friend-requests/received", auth, controller.receivedRequests);
router.get("/friend-requests/sent", auth, controller.sentRequests);
router.patch(
  "/friend-requests/:requestId/accept",
  auth,
  controller.acceptRequest,
);
router.patch(
  "/friend-requests/:requestId/reject",
  auth,
  controller.rejectRequest,
);
router.delete("/friend-requests/:requestId", auth, controller.cancelRequest);
router.get("/friends", auth, controller.friends);
router.get("/friends/:userId/status", auth, controller.friendStatus);
router.delete("/friends/:userId", auth, controller.removeFriend);

export default router;
