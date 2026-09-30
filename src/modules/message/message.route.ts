import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./message.controller";
import { upload } from "../../utils/upload";
import { sendMessageController } from "./message.controller";

const router = express.Router();

router.get("/", auth, controller.getMessagesController);

router.patch("/edit", auth, controller.editMessageController);

router.delete("/delete", auth, controller.deleteMessageController);

router.post("/react", auth, controller.reactMessageController);

router.post(
  "/send",
  auth,
  upload.fields([
    { name: "file", maxCount: 10 },
    { name: "files", maxCount: 10 },
    { name: "attachments", maxCount: 10 },
  ]),
  sendMessageController,
);

export default router;
