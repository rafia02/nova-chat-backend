import express from "express";
import * as userController from "./user.controller";
import { auth } from "../../middleware/auth";

const router = express.Router();

router.use(auth);

router.get("/", userController.getUsers);

router.get("/search", userController.searchUsersController);

router.get("/:id", userController.getUser);

router.patch("/me", userController.updateUserProfile);

export default router;
