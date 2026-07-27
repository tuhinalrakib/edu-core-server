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
// @access  Private/Teacher
export const createCourse = asyncHandler(async (req: any, res: Response) => {
  const { title, description, category, price, level } = req.body;
  if (!title || !description) {
    res.status(400);
    throw new Error("Title and description are required.");
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const course = await Course.create({
    title,
    slug,
    description,
    category: category || "Web Development",
    price: price || 0,
    level: level || "Beginner",
    teacher: req.user.id,
    status: "pending",
  });

  // Invalidate Redis list cache and specific course cache
  await invalidateCache("courses:list", `courses:id:${course._id}`);

  res.status(201).json({ success: true, message: "Course created successfully", course });
});
