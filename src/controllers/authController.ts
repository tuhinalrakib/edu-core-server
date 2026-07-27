import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { sendEmail } from "../utils/mailer";

const JWT_SECRET = process.env.JWT_SECRET || "educore_super_secret_jwt_key_2026";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "educore_super_secret_refresh_jwt_key_2026";

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required.");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error("Email is already registered.");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const userRole = role === "teacher" || role === "admin" ? role : "student";
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: userRole,
    isEmailVerified: false,
    teacherStatus: userRole === "teacher" ? "approved" : undefined,
  });

  // Send real verification email via Brevo
  const verifyLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/verify-email?email=${encodeURIComponent(email)}&role=${userRole}`;
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 16px;">
      <h2 style="color: #c084fc; text-align: center;">Welcome to EduCore LMS! 🚀</h2>
      <p style="color: #cbd5e1; font-size: 14px;">Hi <strong>${name}</strong>,</p>
      <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyLink}" 
           style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 12px; display: inline-block;">
          Verify Email Account
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">Or copy and paste this link in your browser:<br/><span style="color: #a855f7;">${verifyLink}</span></p>
    </div>
  `;

  await sendEmail(email, "Verify Your EduCore LMS Account", emailHtml);

  res.status(201).json({
    success: true,
    message: "Registration successful! Please check your email to verify your account.",
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
  });
});

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  user.isEmailVerified = true;
  await user.save();

  res.json({
    success: true,
    message: "Email verified successfully! You can now log in.",
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  if (!user.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: "Email is not verified. Please verify your email before logging in.",
      requiresVerification: true,
    });
    return;
  }

  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });

  res.json({
    success: true,
    message: "Login successful!",
    token,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      earnings: user.earnings,
    },
  });
});

// Helper: Generate Premium Professional OTP Email Template
const generateOtpEmailHtml = (userName: string, otpCode: string): string => {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 0; background-color: #090d16; border-radius: 24px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); padding: 36px 32px; text-align: center; border-bottom: 1px solid #334155;">
        <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 12px 16px; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 8px 16px rgba(124, 58, 237, 0.3);">
          <span style="font-size: 24px; color: #ffffff;">🔐</span>
        </div>
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">EduCore SaaS LMS</h1>
        <p style="color: #a78bfa; font-size: 13px; margin: 6px 0 0 0; font-weight: 600;">Two-Factor Security Verification</p>
      </div>

      <div style="padding: 36px 32px; text-align: center;">
        <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">Your Security One-Time Passcode</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
          Hi <strong>${userName}</strong>,<br/>Use the 6-digit passcode below to securely authenticate your login request:
        </p>

        <div style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%); border: 2px dashed #7c3aed; border-radius: 20px; padding: 24px; margin: 0 auto 28px auto; max-width: 340px;">
          <span style="color: #a855f7; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 8px;">Login OTP Passcode</span>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; color: #ffffff; letter-spacing: 10px; padding-left: 10px;">
            ${otpCode}
          </div>
          <span style="color: #f43f5e; font-size: 11px; font-weight: 600; display: block; margin-top: 10px;">⏰ Passcode expires in 5 minutes</span>
        </div>

        <div style="background-color: #0f172a; border-radius: 14px; padding: 16px; border: 1px solid #1e293b; text-align: left; margin-bottom: 24px;">
          <p style="color: #cbd5e1; font-size: 12px; margin: 0; line-height: 1.5;">
            🔒 <strong>Security Warning:</strong> Never share this code with anyone. EduCore support staff will never ask for your OTP. If you did not request this login code, please secure your account immediately.
          </p>
        </div>
      </div>

      <div style="background-color: #060911; padding: 20px 32px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="color: #64748b; font-size: 11px; margin: 0;">
          © 2026 EduCore LMS Platform. All rights reserved. • Automated System Notification
        </p>
      </div>
    </div>
  `;
};

// @desc    Generate & send login OTP to user email
// @route   POST /api/auth/send-otp
// @access  Public
export const requestLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(400);
    throw new Error("Invalid email or password.");
  }

  if (!user.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: "Email is not verified. Please verify your email before logging in.",
      requiresVerification: true,
    });
    return;
  }

  // Generate 6-digit random OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

  user.otpCode = otpCode;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  // Send real OTP email using Brevo / SMTP
  const emailHtml = generateOtpEmailHtml(user.name, otpCode);
  await sendEmail(email, `${otpCode} is your EduCore Login Security Passcode 🔐`, emailHtml);

  res.json({
    success: true,
    message: "Security OTP code sent successfully to your email address.",
    email: user.email,
  });
});

// @desc    Verify login OTP & issue token
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP code are required.");
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(400);
    throw new Error("Invalid request or user not found.");
  }

  if (!user.otpCode || !user.otpExpiresAt) {
    res.status(400);
    throw new Error("No active OTP request found. Please request a new code.");
  }

  if (new Date() > new Date(user.otpExpiresAt)) {
    res.status(400);
    throw new Error("OTP passcode has expired. Please request a new code.");
  }

  if (user.otpCode !== otp.trim()) {
    res.status(400);
    throw new Error("Invalid OTP passcode. Please check your email and try again.");
  }

  // Clear OTP fields upon successful verification
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });

  res.json({
    success: true,
    message: "OTP Verification successful! Logging in...",
    token,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      earnings: user.earnings,
    },
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  res.json({ success: true, user });
});
