import { Request, Response } from "express";
import { Assignment, AssignmentSubmission } from "../models/Assignment";

export const getAssignmentsByCourse = async (req: Request, res: Response) => {
  try {
    const assignments = await Assignment.find({ course: req.params.courseId });
    return res.json({ success: true, assignments });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const submitAssignment = async (req: any, res: Response) => {
  try {
    const { assignmentId, courseId, fileUrl, notes } = req.body;
    const submission = await AssignmentSubmission.create({
      assignment: assignmentId,
      course: courseId,
      student: req.user.id,
      fileUrl,
      notes: notes || "",
    });
    return res.status(201).json({ success: true, submission });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const gradeAssignment = async (req: Request, res: Response) => {
  try {
    const { submissionId, grade, feedback } = req.body;
    const submission = await AssignmentSubmission.findByIdAndUpdate(
      submissionId,
      { grade, feedback, status: "graded" },
      { new: true }
    );
    return res.json({ success: true, submission });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
