import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Course } from "../models/Course";

// @desc    Get all courses with filtering
// @route   GET /api/courses
// @access  Public
export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const { category, level, price, search } = req.query;
  const filter: any = { status: "approved" };

  if (category) filter.category = category;
  if (level) filter.level = level;
  if (price === "free") filter.price = 0;
  if (price === "paid") filter.price = { $gt: 0 };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const courses = await Course.find(filter).populate("teacher", "name avatar title");
  res.json({ success: true, count: courses.length, courses });
});

// @desc    Get single course by slug or ID
// @route   GET /api/courses/:identifier
// @access  Public
export const getCourseByIdentifier = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.params;
  let course = await Course.findOne({ slug: identifier }).populate("teacher", "name avatar bio title");
  if (!course) {
    course = await Course.findById(identifier).populate("teacher", "name avatar bio title");
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  res.json({ success: true, course });
});
