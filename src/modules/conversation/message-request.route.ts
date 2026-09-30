import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./message-request.controller";

const router = express.Router();

router.use(auth);
router.get("/", controller.received);
router.get("/sent", controller.sent);
router.patch("/:conversationId/accept", controller.accept);
router.patch("/:conversationId/reject", controller.reject);

export default router;
