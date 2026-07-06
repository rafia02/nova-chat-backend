import express from "express";
import * as authController from "./auth.controller";
import { auth } from "../../middleware/auth";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", auth, authController.me);

export default router;
