import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./conversation.controller";

const router = express.Router();

router.post("/dm", auth, controller.createDMController);

router.post("/group", auth, controller.createGroupController);

router.get("/", auth, controller.getMyConversations);

export default router;
