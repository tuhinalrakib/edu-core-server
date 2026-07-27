import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import { Course } from "../models/Course";
import { getCache, setCache, invalidateCache } from "../utils/redis";

// @desc    Get admin platform stats (with Redis Caching)
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getAdminStats = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "admin:stats";

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  const totalStudents = await User.countDocuments({ role: "student" });
  const totalTeachers = await User.countDocuments({ role: "teacher" });
  const totalCourses = await Course.countDocuments();
  const pendingCourses = await Course.countDocuments({ status: "pending" });

  const responseData = {
    success: true,
    stats: {
      totalStudents,
      totalTeachers,
      totalCourses,
      pendingCourses,
      totalRevenue: 128450,
      todaySales: 2840,
      monthlySales: 38450,
      adminCommission: 25690,
    },
  };

  // 3. Store in Redis Cache (10 minutes TTL)
  await setCache(cacheKey, responseData, 600);

  res.json(responseData);
});

// @desc    Get list of all teachers for admin (with Redis Caching)
// @route   GET /api/admin/teachers
// @access  Private/Admin
export const getAdminTeachers = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "admin:teachers:all";

  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const teachers = await User.find({ role: "teacher" }).select("-passwordHash");
  const responseData = { success: true, teachers };

  await setCache(cacheKey, responseData, 1800);
  res.json(responseData);
});

// @desc    Update teacher status (approved, suspended, rejected) -> Invalidates Redis Cache
// @route   PATCH /api/admin/teachers/:id/status
// @access  Private/Admin
export const updateTeacherStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const teacher = await User.findById(req.params.id);
  if (!teacher || teacher.role !== "teacher") {
    res.status(404);
    throw new Error("Teacher account not found.");
  }

  teacher.teacherStatus = status;
  await teacher.save();

  // Invalidate Redis caches
  await invalidateCache("admin:teachers:all", "admin:stats", `users:id:${req.params.id}`);

  res.json({ success: true, message: `Teacher status updated to ${status}`, teacher });
});

// @desc    Get list of all students for admin (with Redis Caching)
// @route   GET /api/admin/students
// @access  Private/Admin
export const getAdminStudents = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "admin:students:all";

  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const students = await User.find({ role: "student" }).select("-passwordHash");
  const responseData = { success: true, students };

  await setCache(cacheKey, responseData, 1800);
  res.json(responseData);
});

// @desc    Update student status (active, suspended) -> Invalidates Redis Cache
// @route   PATCH /api/admin/students/:id/status
// @access  Private/Admin
export const updateStudentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const student = await User.findById(req.params.id);
  if (!student || student.role !== "student") {
    res.status(404);
    throw new Error("Student account not found.");
  }

  student.studentStatus = status;
  await student.save();

  // Invalidate Redis caches
  await invalidateCache("admin:students:all", "admin:stats", `users:id:${req.params.id}`);

  res.json({ success: true, message: `Student status updated to ${status}`, student });
});

// @desc    Get list of all courses for admin management (with Redis Caching)
// @route   GET /api/admin/courses
// @access  Private/Admin
export const getAdminCourses = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "admin:courses:all";

  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const courses = await Course.find().populate("teacher", "name email");
  const responseData = { success: true, courses };

  await setCache(cacheKey, responseData, 1800);
  res.json(responseData);
});

// @desc    Update course status (published, rejected) -> Invalidates Redis Cache
// @route   PATCH /api/admin/courses/:id/status
// @access  Private/Admin
export const updateCourseStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  course.status = status;
  await course.save();

  // Invalidate Redis caches for admin and public course lists
  await invalidateCache("admin:courses:all", "admin:stats", "courses:list", `courses:id:${req.params.id}`);

  res.json({ success: true, message: `Course status updated to ${status}`, course });
});

// @desc    Toggle featured status for course -> Invalidates Redis Cache
// @route   PATCH /api/admin/courses/:id/feature
// @access  Private/Admin
export const toggleFeaturedCourse = asyncHandler(async (req: Request, res: Response) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  course.isFeatured = !course.isFeatured;
  await course.save();

  // Invalidate Redis caches
  await invalidateCache("admin:courses:all", "courses:list", `courses:id:${req.params.id}`);

  res.json({ success: true, message: `Course featured status set to ${course.isFeatured}`, isFeatured: course.isFeatured });
});
