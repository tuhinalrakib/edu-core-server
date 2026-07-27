import { Router } from "express";
import {
  registerUser,
  verifyEmail,
  loginUser,
  getCurrentUser,
} from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.post("/register", registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.get("/me", authenticateJWT, getCurrentUser);

export default router;
