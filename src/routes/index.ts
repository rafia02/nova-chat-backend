import express from "express";
import authRoutes from "../modules/auth/auth.route";
import userRoutes from "../modules/user/user.route";
import conversationRoutes from "../modules/conversation/conversation.route";
import messageRoutes from "../modules/message/message.route";
import friendRoutes from "../modules/friend/friend.route";
import messageRequestRoutes from "../modules/conversation/message-request.route";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/conversations", conversationRoutes);
router.use("/messages", messageRoutes);
router.use("/", friendRoutes);
router.use("/message-requests", messageRequestRoutes);

export default router;
