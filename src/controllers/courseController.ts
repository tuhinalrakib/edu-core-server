import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Course } from "../models/Course";
import { getCache, setCache, invalidateCache } from "../utils/redis";

// @desc    Get all courses with filtering (with Redis Caching)
// @route   GET /api/courses
// @access  Public
export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const { category, level, price, search } = req.query;
  const cacheKey = `courses:list:${category || "all"}:${level || "all"}:${price || "all"}:${search || ""}`;

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  const filter: any = { status: { $in: ["approved", "published", "Approved", "Published"] } };

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
  const responseData = { success: true, count: courses.length, courses };

  // 3. Set Redis Cache with 1-hour expiration
  await setCache(cacheKey, responseData, 3600);

  res.json(responseData);
});

// @desc    Get single course by slug or ID (with Redis Caching)
// @route   GET /api/courses/:identifier
// @access  Public
export const getCourseByIdentifier = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const cacheKey = `courses:id:${identifier}`;

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  let course = await Course.findOne({ slug: identifier }).populate("teacher", "name avatar bio title");
  if (!course) {
    course = await Course.findById(identifier).populate("teacher", "name avatar bio title");
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  const responseData = { success: true, course };

  // 3. Set Redis Cache for specific course ID/slug
  await setCache(cacheKey, responseData, 3600);

  res.json(responseData);
});

// @desc    Create new course (Invalidates Redis Cache)
// @route   POST /api/courses
// @access  Public / Teacher
export const createCourse = asyncHandler(async (req: any, res: Response) => {
  const { title } = req.body;
  if (!title) {
    res.status(400);
    throw new Error("Title is required.");
  }

  const courseData = { ...req.body };

  // Remove temporary frontend string _id (e.g. "course-1785178064484") if not a 24-char ObjectId
  if (courseData._id && !mongoose.Types.ObjectId.isValid(courseData._id)) {
    delete courseData._id;
  }

  // Remove temporary string _id from sections and lessons as well
  if (Array.isArray(courseData.sections)) {
    courseData.sections = courseData.sections.map((sec: any) => {
      const cleanSec = { ...sec };
      if (cleanSec._id && !mongoose.Types.ObjectId.isValid(cleanSec._id)) {
        delete cleanSec._id;
      }
      if (Array.isArray(cleanSec.lessons)) {
        cleanSec.lessons = cleanSec.lessons.map((les: any) => {
          const cleanLes = { ...les };
          if (cleanLes._id && !mongoose.Types.ObjectId.isValid(cleanLes._id)) {
            delete cleanLes._id;
          }
          return cleanLes;
        });
      }
      return cleanSec;
    });
  }

  const slug = courseData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
  const course = await Course.create({
    ...courseData,
    slug,
    teacher: req.user?.id || courseData.teacher || null,
    status: courseData.status || "pending",
  });

  // Invalidate Redis list cache and specific course cache
  try {
    await invalidateCache("courses:list", `courses:id:${course._id}`);
  } catch (e) {}

  res.status(201).json({ success: true, message: "Course created successfully", course });
});

// @desc    Update course status (Invalidates Redis Cache)
// @route   PUT /api/courses/:id/status
// @access  Admin
export const updateCourseStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("Status is required.");
  }

  let course;
  if (mongoose.Types.ObjectId.isValid(id)) {
    course = await Course.findByIdAndUpdate(id, { status }, { new: true });
  } else {
    course = await Course.findOneAndUpdate({ slug: id }, { status }, { new: true });
  }

  // Invalidate Redis list cache
  try {
    await invalidateCache("courses:list", `courses:id:${id}`);
  } catch (e) {}

  res.json({ success: true, message: `Course status updated to ${status}`, course });
});

// @desc    Delete course (Invalidates Redis Cache)
// @route   DELETE /api/courses/:id
// @access  Admin / Teacher
export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (mongoose.Types.ObjectId.isValid(id)) {
    await Course.findByIdAndDelete(id);
  } else {
    await Course.findOneAndDelete({ slug: id });
  }

  // Invalidate Redis list cache
  try {
    await invalidateCache("courses:list", `courses:id:${id}`);
  } catch (e) {}

  res.json({ success: true, message: "Course deleted successfully." });
});
