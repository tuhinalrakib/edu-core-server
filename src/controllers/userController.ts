import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { User } from "../models/User";

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find().select("-passwordHash");
  res.json({ success: true, users });
});

// @desc    Get logged in user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    res.status(404);
    throw new Error("User profile not found.");
  }
  res.json({ success: true, user });
});
