import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Progress } from "../models/Progress";
import { Course } from "../models/Course";

// @desc    Get student enrolled courses progress
// @route   GET /api/student/courses
// @access  Private/Student
export const getEnrolledCoursesProgress = asyncHandler(async (req: any, res: Response) => {
  const progressList = await Progress.find({ student: req.user.id }).populate("course");
  res.json({ success: true, progressList });
});

// @desc    Get student progress for a specific course
// @route   GET /api/student/progress/:courseId
// @access  Private/Student
export const getCourseProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId } = req.params;
  const progress = await Progress.findOne({ student: req.user.id, course: courseId });
  res.json({ success: true, progress: progress || { completedLessons: [] } });
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

  // Security check: verify if the lesson is locked by future publish date & time
  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }

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

  let progress = await Progress.findOne({ student: req.user.id, course: courseId });
  if (!progress) {
    progress = await Progress.create({ student: req.user.id, course: courseId, completedLessons: [lessonId] });
  } else if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    await progress.save();
  }
  res.json({ success: true, progress });
});

