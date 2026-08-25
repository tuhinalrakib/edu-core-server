import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Assignment, AssignmentSubmission } from "../models/Assignment";
import { Course } from "../models/Course";

// Initial seed submissions if database is fresh
const SEED_SUBMISSIONS = [
  {
    assignmentTitle: "Build a Full-Stack E-Commerce API with Express",
    courseTitle: "Next.js 15 & React 19 Full-Stack SaaS Masterclass",
    studentName: "Alex Rivera",
    studentAvatar: "https://ui-avatars.com/api/?name=Alex+Rivera&background=7c3aed&color=fff&bold=true",
    studentEmail: "alex.rivera@example.com",
    fileType: "ZIP Archive",
    fileUrl: "https://github.com/alexrivera/express-ecommerce-api.zip",
    notes: "Completed all CRUD endpoints, JWT authentication middleware, and Stripe webhook handling.",
    status: "pending",
    grade: undefined,
    feedback: "",
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    assignmentTitle: "Figma Mobile App Wireframe & Prototyping",
    courseTitle: "UI/UX Design Masterclass 2026",
    studentName: "Jessica Chen",
    studentAvatar: "https://ui-avatars.com/api/?name=Jessica+Chen&background=2563eb&color=fff&bold=true",
    studentEmail: "jessica.chen@example.com",
    fileType: "Figma Link",
    fileUrl: "https://figma.com/file/sample-wireframe-prototype",
    notes: "Designed full design system with 24 mobile screen components and micro-interactions.",
    status: "pending",
    grade: undefined,
    feedback: "",
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    assignmentTitle: "Build a Full-Stack E-Commerce API with Express",
    courseTitle: "Next.js 15 & React 19 Full-Stack SaaS Masterclass",
    studentName: "Marcus Vance",
    studentAvatar: "https://ui-avatars.com/api/?name=Marcus+Vance&background=059669&color=fff&bold=true",
    studentEmail: "marcus.vance@example.com",
    fileType: "PDF Document",
    fileUrl: "https://educore.com/docs/marcus-assignment.pdf",
    notes: "Full architectural report and Postman API collection documentation.",
    status: "graded",
    grade: 95,
    feedback: "Outstanding API architecture and clean TypeScript code structure!",
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

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
  let submissions = await AssignmentSubmission.find().sort({ createdAt: -1 });

  // Auto seed if empty so the teacher has interactive submissions to grade immediately
  if (submissions.length === 0) {
    try {
      await AssignmentSubmission.insertMany(SEED_SUBMISSIONS);
      submissions = await AssignmentSubmission.find().sort({ createdAt: -1 });
    } catch (e) {}
  }

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

