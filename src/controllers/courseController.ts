import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Course } from "../models/Course";
import { User } from "../models/User";
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

  // 2. Fetch from MongoDB on Cache Miss (Allow all active courses)
  const filter: any = { status: { $nin: ["archived", "Archived"] } };

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

  let finalTeacher = req.user?.id || req.user?._id || courseData.teacher;

  // If teacher is an object or string, attempt to link with existing MongoDB User by email if valid ObjectId is missing
  if (typeof finalTeacher === "object" && finalTeacher !== null) {
    if (finalTeacher._id && mongoose.Types.ObjectId.isValid(finalTeacher._id)) {
      finalTeacher = finalTeacher._id;
    } else if (finalTeacher.id && mongoose.Types.ObjectId.isValid(finalTeacher.id)) {
      finalTeacher = finalTeacher.id;
    } else if (finalTeacher.email || courseData.teacherEmail) {
      const emailToLookup = finalTeacher.email || courseData.teacherEmail;
      const foundUser = await User.findOne({ email: emailToLookup });
      if (foundUser) {
        finalTeacher = foundUser._id;
      }
    }
  } else if (typeof finalTeacher === "string" && !mongoose.Types.ObjectId.isValid(finalTeacher)) {
    const foundUser = await User.findOne({ email: finalTeacher });
    if (foundUser) {
      finalTeacher = foundUser._id;
    }
  }

  const slug = courseData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
  const course = await Course.create({
    ...courseData,
    slug,
    teacher: finalTeacher || courseData.teacher || null,
    status: courseData.status || "approved",
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

// @desc    Update existing course details
// @route   PUT /api/courses/:id
// @access  Teacher / Admin
export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  let course;
  if (mongoose.Types.ObjectId.isValid(id)) {
    course = await Course.findByIdAndUpdate(id, updateData, { new: true });
  } else {
    course = await Course.findOneAndUpdate({ slug: id }, updateData, { new: true });
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  try {
    await invalidateCache("courses:list", `courses:id:${id}`, `courses:id:${course.slug}`);
  } catch (e) {}

  res.json({ success: true, message: "Course updated successfully.", course });
});
