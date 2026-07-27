import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { Assignment, AssignmentSubmission } from "../models/Assignment";

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private
export const getAssignmentsByCourse = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await Assignment.find({ course: req.params.courseId });
  res.json({ success: true, assignments });
});

// @desc    Submit an assignment
// @route   POST /api/assignments/submit
// @access  Private/Student
export const submitAssignment = asyncHandler(async (req: any, res: Response) => {
  const { assignmentId, courseId, fileUrl, notes } = req.body;
  const submission = await AssignmentSubmission.create({
    assignment: assignmentId,
    course: courseId,
    student: req.user.id,
    fileUrl,
    notes: notes || "",
  });
  res.status(201).json({ success: true, submission });
});

// @desc    Grade an assignment submission
// @route   POST /api/assignments/grade
// @access  Private/Teacher/Admin
export const gradeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { submissionId, grade, feedback } = req.body;
  const submission = await AssignmentSubmission.findByIdAndUpdate(
    submissionId,
    { grade, feedback, status: "graded" },
    { new: true }
  );

  if (!submission) {
    res.status(404);
    throw new Error("Assignment submission not found");
  }

  res.json({ success: true, submission });
});
