import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Progress } from "../models/Progress";

// @desc    Get student enrolled courses progress
// @route   GET /api/student/courses
// @access  Private/Student
export const getEnrolledCoursesProgress = asyncHandler(async (req: any, res: Response) => {
  const progressList = await Progress.find({ student: req.user.id }).populate("course");
  res.json({ success: true, progressList });
});

// @desc    Update student lesson completion progress
// @route   POST /api/student/progress
// @access  Private/Student
export const updateLessonProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId, lessonId } = req.body;
  let progress = await Progress.findOne({ student: req.user.id, course: courseId });
  if (!progress) {
    progress = await Progress.create({ student: req.user.id, course: courseId, completedLessons: [lessonId] });
  } else if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    await progress.save();
  }
  res.json({ success: true, progress });
});
