import express from "express";
import * as userController from "./user.controller";
import { auth } from "../../middleware/auth";

const router = express.Router();

router.get("/", userController.getUsers);

router.get("/search", userController.searchUsersController);

router.get("/:id", userController.getUser);

router.patch("/me", auth, userController.updateUserProfile);

export default router;
