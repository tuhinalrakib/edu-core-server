import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { User } from "../models/User";
import { Course } from "../models/Course";

// @desc    Get admin platform stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getAdminStats = asyncHandler(async (req: Request, res: Response) => {
  const totalStudents = await User.countDocuments({ role: "student" });
  const totalTeachers = await User.countDocuments({ role: "teacher" });
  const totalCourses = await Course.countDocuments();
  res.json({
    success: true,
    stats: { totalStudents, totalTeachers, totalCourses, totalRevenue: 38450, adminCommission: 7690 },
  });
});

// @desc    Get list of all teachers for admin
// @route   GET /api/admin/teachers
// @access  Private/Admin
export const getAdminTeachers = asyncHandler(async (req: Request, res: Response) => {
  const teachers = await User.find({ role: "teacher" }).select("-passwordHash");
  res.json({ success: true, teachers });
});

// @desc    Get list of all students for admin
// @route   GET /api/admin/students
// @access  Private/Admin
export const getAdminStudents = asyncHandler(async (req: Request, res: Response) => {
  const students = await User.find({ role: "student" }).select("-passwordHash");
  res.json({ success: true, students });
});

// @desc    Get list of all courses for admin management
// @route   GET /api/admin/courses
// @access  Private/Admin
export const getAdminCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await Course.find().populate("teacher", "name email");
  res.json({ success: true, courses });
});
