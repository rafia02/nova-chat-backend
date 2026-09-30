import express from "express";
import { auth } from "../../middleware/auth";
import * as controller from "./conversation.controller";
import { upload } from "../../utils/upload";

const router = express.Router();

router.post("/dm", auth, controller.createDMController);

router.post(
  "/group",
  auth,
  upload.single("avatar"),
  controller.createGroupController,
);

router.get("/", auth, controller.getMyConversations);
router.get("/:id", auth, controller.getConversationController);
router.patch(
  "/:id",
  auth,
  upload.single("avatar"),
  controller.updateGroupController,
);
router.post("/:id/members", auth, controller.addGroupMembersController);
router.delete(
  "/:id/members/:userId",
  auth,
  controller.removeGroupMemberController,
);
router.post("/:id/leave", auth, controller.leaveGroupController);

export default router;
