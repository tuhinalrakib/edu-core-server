import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Assignment, AssignmentSubmission } from "../models/Assignment";
import { Course } from "../models/Course";

// @desc    Get assignments for a course
// @route   GET /api/assignments/course/:courseId
// @access  Private
export const getAssignmentsByCourse = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await Assignment.find({ course: req.params.courseId });
  res.json({ success: true, assignments });
});

// @desc    Get all student submissions for Teacher / Admin review
// @route   GET /api/assignments/submissions
// @access  Private/Teacher/Admin
export const getTeacherSubmissions = asyncHandler(async (req: any, res: Response) => {
  // Clean up any old dummy seed submissions if present
  try {
    await AssignmentSubmission.deleteMany({
      studentName: { $in: ["Alex Rivera", "Jessica Chen", "Marcus Vance"] },
    });
  } catch (e) {}

  let filter: any = {};
  if (req.user && req.user.role === "teacher") {
    const teacherCourses = await Course.find({
      $or: [{ teacher: req.user.id }, { teacher: req.user._id }, { "teacher._id": req.user.id }],
    }).select("_id title");

    if (teacherCourses.length > 0) {
      const courseIds = teacherCourses.map((c) => c._id);
      const courseTitles = teacherCourses.map((c) => c.title);
      filter = {
        $or: [
          { course: { $in: courseIds } },
          { courseTitle: { $in: courseTitles } },
        ],
      };
    }
  }

  const submissions = await AssignmentSubmission.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, submissions });
});


// @desc    Submit an assignment
// @route   POST /api/assignments/submit
// @access  Private/Student
export const submitAssignment = asyncHandler(async (req: any, res: Response) => {
  const {
    assignmentId,
    courseId,
    fileUrl,
    notes,
    assignmentTitle,
    courseTitle,
    fileType,
  } = req.body;

  // Infer file type from URL if not given
  let computedFileType = fileType || "ZIP Archive";
  if (fileUrl) {
    if (fileUrl.includes("github.com") || fileUrl.includes(".zip")) computedFileType = "ZIP Archive";
    else if (fileUrl.includes("figma.com")) computedFileType = "Figma Link";
    else if (fileUrl.includes(".pdf")) computedFileType = "PDF Document";
    else if (fileUrl.includes("drive.google.com")) computedFileType = "Google Drive Link";
    else computedFileType = "Live Project Link";
  }

  // Attempt to find course title if not provided
  let computedCourseTitle = courseTitle;
  if (!computedCourseTitle && courseId) {
    try {
      const c = await Course.findById(courseId);
      if (c) computedCourseTitle = c.title;
    } catch (e) {}
  }

  // Create or update submission
  const submission = await AssignmentSubmission.create({
    assignment: assignmentId || undefined,
    assignmentTitle: assignmentTitle || "Lesson Assignment Project",
    course: courseId || undefined,
    courseTitle: computedCourseTitle || "Enrolled Course",
    student: req.user?._id || req.user?.id,
    studentName: req.user?.name || "Student",
    studentAvatar:
      req.user?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user?.name || "Student")}&background=7c3aed&color=fff&bold=true`,
    studentEmail: req.user?.email || "",
    fileUrl: fileUrl || "https://github.com",
    fileType: computedFileType,
    notes: notes || "",
    status: "pending",
    submittedAt: new Date(),
  });

  res.status(201).json({ success: true, submission });
});

// @desc    Grade an assignment submission
// @route   POST /api/assignments/grade
// @access  Private/Teacher/Admin
export const gradeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { submissionId, grade, feedback } = req.body;

  if (!submissionId) {
    res.status(400);
    throw new Error("Submission ID is required");
  }

  let submission = await AssignmentSubmission.findByIdAndUpdate(
    submissionId,
    { grade: Number(grade), feedback: feedback || "", status: "graded" },
    { new: true }
  );

  if (!submission) {
    // Check if matching by custom field or title
    submission = await AssignmentSubmission.findOneAndUpdate(
      { $or: [{ _id: submissionId }, { assignmentTitle: submissionId }] },
      { grade: Number(grade), feedback: feedback || "", status: "graded" },
      { new: true }
    );
  }

  if (!submission) {
    res.status(404);
    throw new Error("Assignment submission not found");
  }

  res.json({ success: true, submission });
});

// @desc    Get logged in student's assignment submissions
// @route   GET /api/assignments/my-submissions
// @access  Private/Student
export const getMyAssignmentSubmissions = asyncHandler(async (req: any, res: Response) => {
  const submissions = await AssignmentSubmission.find({
    $or: [{ student: req.user?.id }, { student: req.user?._id }],
  }).sort({ createdAt: -1 });

  res.json({ success: true, submissions });
});

// @desc    Delete an assignment submission
// @route   DELETE /api/assignments/submissions/:id
// @access  Private/Teacher/Admin
export const deleteSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await AssignmentSubmission.findByIdAndDelete(id);
  if (!deleted) {
    res.status(404);
    throw new Error("Submission not found");
  }
  res.json({ success: true, message: "Submission deleted successfully" });
});

// @desc    Create a mock/test student submission for testing
// @route   POST /api/assignments/mock-submission
// @access  Private/Teacher/Admin
export const createMockSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { studentName, courseTitle, assignmentTitle, fileType, fileUrl, notes } = req.body;
  const name = studentName || "Alex Rivera";
  const submission = await AssignmentSubmission.create({
    studentName: name,
    studentAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&bold=true`,
    studentEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    courseTitle: courseTitle || "Next.js 15 & React 19 Full-Stack SaaS Masterclass",
    assignmentTitle: assignmentTitle || "Build a Full-Stack E-Commerce API with Express",
    fileType: fileType || "ZIP Archive",
    fileUrl: fileUrl || "https://github.com/alexrivera/express-ecommerce-api.zip",
    notes: notes || "Submitted implementation covering all requirements.",
    status: "pending",
    submittedAt: new Date(),
  });
  res.status(201).json({ success: true, submission });
});



