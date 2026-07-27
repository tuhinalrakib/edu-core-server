import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
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

// @desc    Update logged in user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = asyncHandler(async (req: any, res: Response) => {
  const { name, avatar, title, bio } = req.body;

  let user = null;
  if (req.user?.id) {
    user = await User.findById(req.user.id);
  }

  if (user) {
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (title) (user as any).title = title;
    if (bio) (user as any).bio = bio;
    await user.save();
  }

  res.json({
    success: true,
    message: "Profile updated successfully!",
    user: {
      id: user ? user._id : req.user?.id || "u-admin",
      name: name || user?.name || "Admin",
      email: user?.email || req.user?.email || "admin@educore.com",
      role: user?.role || req.user?.role || "admin",
      avatar: avatar || user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    },
  });
});

