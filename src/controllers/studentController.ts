import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Progress } from "../models/Progress";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { invalidateCache } from "../utils/redis";

// @desc    Enroll in a course
// @route   POST /api/student/enroll
// @access  Private/Student
export const enrollInCourse = asyncHandler(async (req: any, res: Response) => {
  const { courseId } = req.body;
  if (!courseId) {
    res.status(400);
    throw new Error("courseId is required");
  }

  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Ensure enrolledCourses array exists
  if (!Array.isArray(user.enrolledCourses)) {
    user.enrolledCourses = [];
  }

  const isAlreadyEnrolled = user.enrolledCourses.some(
    (c: any) => c.toString() === course._id.toString()
  );

  if (!isAlreadyEnrolled) {
    user.enrolledCourses.push(course._id);
    await user.save();
    // Increment course totalStudents count
    await Course.findByIdAndUpdate(course._id, { $inc: { totalStudents: 1 } });
  }

  // Create initial Progress document if doesn't exist
  let progress = await Progress.findOne({ student: req.user.id, course: course._id });
  if (!progress) {
    progress = await Progress.create({
      student: req.user.id,
      course: course._id,
      completedLessons: [],
    });
  }

  // Invalidate Redis caches so all pages get live updated enrolled student count immediately
  try {
    await invalidateCache("courses", `courses:id:${course._id}`, `courses:id:${course.slug}`);
  } catch (cacheErr) {}

  res.json({
    success: true,
    message: "Enrolled successfully",
    isEnrolled: true,
    progress,
  });
});


// @desc    Get student enrolled courses progress
// @route   GET /api/student/courses
// @access  Private/Student
export const getEnrolledCoursesProgress = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id).populate("enrolledCourses");
  const progressList = await Progress.find({ student: req.user.id }).populate("course");
  
  res.json({
    success: true,
    progressList,
    enrolledCourses: user?.enrolledCourses || [],
  });
});

// @desc    Get student progress for a specific course
// @route   GET /api/student/progress/:courseId
// @access  Private/Student
export const getCourseProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId } = req.params;

  let resolvedCourseId: any = courseId;
  let course: any = null;

  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }
  if (course) {
    resolvedCourseId = course._id;
  }

  const user = await User.findById(req.user.id);
  const isEnrolledInUser = user?.enrolledCourses?.some(
    (c: any) => (course && c.toString() === course._id.toString()) || c.toString() === String(courseId)
  ) || false;

  let progress = null;
  if (course) {
    progress = await Progress.findOne({ student: req.user.id, course: course._id });
  }
  if (!progress && mongoose.Types.ObjectId.isValid(resolvedCourseId)) {
    progress = await Progress.findOne({ student: req.user.id, course: resolvedCourseId });
  }

  const isEnrolled = isEnrolledInUser || Boolean(progress);

  res.json({
    success: true,
    isEnrolled,
    progress: progress || { completedLessons: [] },
  });
});

// @desc    Update student lesson completion progress
// @route   POST /api/student/progress
// @access  Private/Student
export const updateLessonProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId, lessonId } = req.body;

  if (!courseId || !lessonId) {
    res.status(400);
    throw new Error("courseId and lessonId are required");
  }

  // Resolve course
  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }

  const targetCourseId = course ? course._id : courseId;

  // Security check: verify if the lesson is locked by future publish date & time
  if (course && Array.isArray(course.sections)) {
    for (const sec of course.sections) {
      if (Array.isArray(sec.lessons)) {
        const foundLesson = sec.lessons.find(
          (l: any) =>
            l._id?.toString() === lessonId ||
            l.id?.toString() === lessonId ||
            l.title === lessonId
        );
        if (foundLesson && foundLesson.unlockAt) {
          const unlockTime = new Date(foundLesson.unlockAt).getTime();
          if (!isNaN(unlockTime) && unlockTime > Date.now()) {
            return res.status(403).json({
              success: false,
              message: "This lesson is scheduled for future release and cannot be marked as complete yet.",
            });
          }
        }
      }
    }
  }

  let progress = null;
  if (mongoose.Types.ObjectId.isValid(targetCourseId)) {
    progress = await Progress.findOne({ student: req.user.id, course: targetCourseId });
  }

  if (!progress) {
    progress = await Progress.create({
      student: req.user.id,
      course: targetCourseId,
      completedLessons: [lessonId],
    });
  } else if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    await progress.save();
  }

  // Also make sure course is in user.enrolledCourses
  if (course) {
    const user = await User.findById(req.user.id);
    if (user && Array.isArray(user.enrolledCourses)) {
      if (!user.enrolledCourses.some((c: any) => c.toString() === course._id.toString())) {
        user.enrolledCourses.push(course._id);
        await user.save();
      }
    }
  }

  res.json({ success: true, progress });
});


