import { Router } from "express";
import {
  registerUser,
  verifyEmail,
  loginUser,
  requestLoginOtp,
  verifyLoginOtp,
  getCurrentUser,
} from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.post("/register", registerUser);
router.post("/verify-email", verifyEmail);
router.post("/login", loginUser);
router.post("/send-otp", requestLoginOtp);
router.post("/verify-otp", verifyLoginOtp);
router.get("/me", authenticateJWT, getCurrentUser);

export default router;
