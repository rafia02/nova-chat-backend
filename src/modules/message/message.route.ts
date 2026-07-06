import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./message.controller";
import { upload } from "../../utils/upload";
import { sendMessageController } from "./message.controller";

const router = express.Router();

router.post("/send", auth, controller.sendMessageController);

router.get("/", auth, controller.getMessagesController);

router.patch("/edit", auth, controller.editMessageController);

router.delete("/delete", auth, controller.deleteMessageController);

router.post("/react", auth, controller.reactMessageController);

router.post("/send", upload.single("file"), sendMessageController);

export default router;
