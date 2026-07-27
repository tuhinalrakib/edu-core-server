import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { Course } from "../models/Course";
import { User } from "../models/User";

// @desc    Get instructor overview stats
// @route   GET /api/teacher/stats
// @access  Private/Teacher
export const getTeacherStats = asyncHandler(async (req: any, res: Response) => {
  const courses = await Course.find({ teacher: req.user.id });
  const user = await User.findById(req.user.id);
  res.json({
    success: true,
    stats: {
      totalCourses: courses.length,
      totalStudents: courses.reduce((sum, c) => sum + c.totalStudents, 0),
      revenue: user?.earnings || 4520,
      averageRating: 4.8,
    },
  });
});

// @desc    Get courses created by teacher
// @route   GET /api/teacher/courses
// @access  Private/Teacher
export const getTeacherCourses = asyncHandler(async (req: any, res: Response) => {
  const courses = await Course.find({ teacher: req.user.id });
  res.json({ success: true, courses });
});

// @desc    Create new course by teacher
// @route   POST /api/teacher/courses
// @access  Private/Teacher
export const createTeacherCourse = asyncHandler(async (req: any, res: Response) => {
  const { title, description, category, level, price, thumbnail, sections } = req.body;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);

  const course = await Course.create({
    title,
    slug,
    description,
    category: category || "Programming",
    level: level || "All Levels",
    price: price || 0,
    teacher: req.user.id,
    thumbnail: thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
    sections: sections || [],
    status: "approved",
  });

  res.status(201).json({ success: true, message: "Course created successfully!", course });
});
