import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import bcrypt from "bcryptjs";

// @desc    Get all users (with optional role filter)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const role = req.query.role as string;
  const filter: any = {};
  if (role) filter.role = role;

  const users = await User.find(filter)
    .select("-passwordHash")
    .populate("enrolledCourses", "title price thumbnail")
    .sort({ createdAt: -1 });

  res.json({ success: true, count: users.length, users });
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
  const { name, avatar, title, bio, phone, password } = req.body;

  let user = null;
  if (req.user?.id) {
    user = await User.findById(req.user.id);
  }

  if (user) {
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (title !== undefined) (user as any).title = title;
    if (bio !== undefined) (user as any).bio = bio;
    if (phone !== undefined) (user as any).phone = phone;
    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }
    await user.save();
  }

  res.json({
    success: true,
    message: "Profile updated successfully!",
    user: {
      id: user ? user._id : req.user?.id,
      _id: user ? user._id : req.user?.id,
      name: user?.name || name || "Teacher",
      email: user?.email || req.user?.email || "",
      role: user?.role || req.user?.role || "teacher",
      avatar: user?.avatar || avatar || "",
      title: user?.title || title || "",
      bio: user?.bio || bio || "",
      phone: user?.phone || phone || "",
    },
  });
});

// @desc    Update user status (Approved, Pending, Suspended, Rejected)
// @route   PUT /api/users/:id/status
// @access  Private/Admin
export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, studentStatus } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  if (status) user.teacherStatus = status;
  if (studentStatus) user.studentStatus = studentStatus;

  await user.save();

  res.json({
    success: true,
    message: `User status updated to ${status || studentStatus}`,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.teacherStatus || user.studentStatus,
    },
  });
});

// @desc    Create new Teacher account by Admin
// @route   POST /api/users/teacher
// @access  Private/Admin
export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, title, bio, avatar, status } = req.body;

  if (!name || !email) {
    res.status(400);
    throw new Error("Name and Email are required.");
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists.");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password || "12345678", salt);

  const teacher = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "teacher",
    title: title || "Senior Instructor",
    bio: bio || "Professional course instructor on EduCore LMS.",
    avatar: avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    teacherStatus: status || "approved",
    isEmailVerified: true,
  });

  res.status(201).json({
    success: true,
    message: "Teacher account created successfully!",
    teacher: {
      id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      title: teacher.title,
      bio: teacher.bio,
      avatar: teacher.avatar,
      status: teacher.teacherStatus,
      coursesCount: 0,
      studentsCount: 0,
      totalEarnings: 0,
      rating: 5.0,
      joinedDate: new Date().toISOString().split("T")[0],
    },
  });
});

// @desc    Delete User Account
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  await user.deleteOne();
  res.json({ success: true, message: "User account deleted successfully." });
});
