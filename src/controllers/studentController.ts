import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Progress } from "../models/Progress";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { invalidateCache } from "../utils/redis";

// @desc    Enroll in a course
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
    course = await Course.findOne({ title: courseId });
  }
  if (!course) {
    const timestampMatch = String(courseId).match(/\d{10,}/);
    if (timestampMatch) {
      course = await Course.findOne({ slug: { $regex: timestampMatch[0], $options: "i" } });
    }
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
    (c: any) =>
      c.toString() === course._id.toString() ||
      (c._id && c._id.toString() === course._id.toString()) ||
      c.toString() === course.slug
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
    await invalidateCache("courses", `courses:id:${course._id}`, `courses:id:${course.slug}`, "admin:stats");
  } catch (cacheErr) {}

  const enrolledCourseIds = Array.from(
    new Set([
      ...user.enrolledCourses.map((c: any) => (c._id ? c._id.toString() : c.toString())),
      course._id.toString(),
      ...(course.slug ? [course.slug] : []),
    ])
  );

  res.json({
    success: true,
    message: "Enrolled successfully",
    isEnrolled: true,
    progress,
    enrolledCourses: user.enrolledCourses,
    enrolledCourseIds,
  });
});


// @desc    Get student enrolled courses progress
// @route   GET /api/student/courses
// @access  Private/Student
export const getEnrolledCoursesProgress = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id);
  const progressList = await Progress.find({ student: req.user.id }).populate("course");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (!Array.isArray(user.enrolledCourses)) {
    user.enrolledCourses = [];
  }

  // Bidirectional sync: If user has progress in any course, ensure it is in user.enrolledCourses
  let userUpdated = false;
  for (const prog of progressList) {
    const pCourseId = prog.course?._id || prog.course;
    if (pCourseId) {
      const alreadyHas = user.enrolledCourses.some(
        (c: any) => c.toString() === pCourseId.toString()
      );
      if (!alreadyHas) {
        user.enrolledCourses.push(pCourseId);
        userUpdated = true;
      }
    }
  }

  if (userUpdated) {
    await user.save();
  }

  await user.populate("enrolledCourses");

  const enrolledCourseIdsSet = new Set<string>();
  (user.enrolledCourses || []).forEach((c: any) => {
    if (typeof c === "object" && c !== null) {
      if (c._id) enrolledCourseIdsSet.add(c._id.toString());
      if (c.slug) enrolledCourseIdsSet.add(c.slug);
    } else if (c) {
      enrolledCourseIdsSet.add(c.toString());
    }
  });

  progressList.forEach((p: any) => {
    if (p.course) {
      if (typeof p.course === "object") {
        if (p.course._id) enrolledCourseIdsSet.add(p.course._id.toString());
        if (p.course.slug) enrolledCourseIdsSet.add(p.course.slug);
      } else {
        enrolledCourseIdsSet.add(p.course.toString());
      }
    }
  });

  res.json({
    success: true,
    progressList,
    enrolledCourses: user?.enrolledCourses || [],
    enrolledCourseIds: Array.from(enrolledCourseIdsSet),
  });
});

// @desc    Get student progress for a specific course
// @route   GET /api/student/progress/:courseId
// @access  Private/Student
export const getCourseProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId } = req.params;

  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }
  if (!course) {
    course = await Course.findOne({ title: courseId });
  }
  if (!course) {
    const timestampMatch = String(courseId).match(/\d{10,}/);
    if (timestampMatch) {
      course = await Course.findOne({ slug: { $regex: timestampMatch[0], $options: "i" } });
    }
  }

  const targetCourseId = course ? course._id : courseId;
  const user = await User.findById(req.user.id);
  const isEnrolledInUser = user?.enrolledCourses?.some(
    (c: any) =>
      (course && c.toString() === course._id.toString()) ||
      c.toString() === String(courseId) ||
      (course?.slug && c.toString() === course.slug)
  ) || false;

  let progress = null;
  if (course) {
    progress = await Progress.findOne({ student: req.user.id, course: course._id });
  }
  if (!progress && mongoose.Types.ObjectId.isValid(targetCourseId)) {
    progress = await Progress.findOne({ student: req.user.id, course: targetCourseId });
  }

  const isEnrolled = isEnrolledInUser || Boolean(progress);

  // Sync back to user if progress existed
  if (isEnrolled && user && course) {
    if (!Array.isArray(user.enrolledCourses)) user.enrolledCourses = [];
    const alreadyInUser = user.enrolledCourses.some(
      (c: any) => c.toString() === course._id.toString()
    );
    if (!alreadyInUser) {
      user.enrolledCourses.push(course._id);
      await user.save();
    }
  }

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


