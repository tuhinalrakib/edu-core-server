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

// Auth routes
router.post("/register", registerUser);

// Email verification route
router.post("/verify-email", verifyEmail);

// Login routes
router.post("/login", loginUser);

// OTP routes
router.post("/send-otp", requestLoginOtp);

// Verify OTP route
router.post("/verify-otp", verifyLoginOtp);
router.get("/me", authenticateJWT, getCurrentUser);

export default router;
