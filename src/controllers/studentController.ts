import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Progress } from "../models/Progress";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { Enrollment } from "../models/Enrollment";
import { sendDbNotification } from "./notificationController";
import { invalidateCache } from "../utils/redis";

// @desc    Enroll in a course (Creates pending enrollment awaiting admin approval)
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

  // Resolve teacher ObjectId
  const teacherId = course.teacher?._id || course.teacher;

  // Check if enrollment already exists in database
  let enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: course._id,
  });

  let isNewRequest = false;

  if (enrollment) {
    if (enrollment.status === "approved") {
      return res.json({
        success: true,
        message: "You are already enrolled and approved in this course.",
        isEnrolled: true,
        isApproved: true,
        status: "approved",
        enrollment,
      });
    }

    if (enrollment.status === "pending") {
      return res.json({
        success: true,
        message: "Your enrollment request has already been submitted and is awaiting admin approval.",
        isEnrolled: true,
        isApproved: false,
        status: "pending",
        enrollment,
      });
    }

    if (enrollment.status === "rejected") {
      // Re-apply: update status to pending
      enrollment.status = "pending";
      enrollment.enrolledAt = new Date();
      await enrollment.save();
      isNewRequest = true;
    }
  } else {
    // Create new pending enrollment
    enrollment = await Enrollment.create({
      student: req.user.id,
      course: course._id,
      teacher: teacherId || req.user.id,
      status: "pending",
      enrolledAt: new Date(),
    });
    isNewRequest = true;
  }

  // If a new pending request was created/re-applied, dispatch DB notifications
  if (isNewRequest) {
    // 1. Notify Admins in Database
    await sendDbNotification({
      recipientRole: "admin",
      title: "New Student Enrollment ⏳",
      message: `${user.name} has enrolled in "${course.title}". Waiting for admin approval.`,
      type: "enrollment_pending",
      link: "/admin/dashboard?tab=enrollments",
      data: {
        enrollmentId: enrollment._id,
        courseId: course._id,
        courseTitle: course.title,
        studentId: user._id,
        studentName: user.name,
        studentEmail: user.email,
      },
    });

    // 2. Notify Course Teacher in Database
    if (teacherId && mongoose.Types.ObjectId.isValid(String(teacherId))) {
      await sendDbNotification({
        recipient: teacherId,
        recipientRole: "teacher",
        title: "New Student Enrolled (Pending Approval) 📚",
        message: `${user.name} enrolled in your course "${course.title}". Currently awaiting admin approval.`,
        type: "enrollment_pending",
        link: "/teacher/dashboard?tab=students",
        data: {
          enrollmentId: enrollment._id,
          courseId: course._id,
          courseTitle: course.title,
          studentId: user._id,
          studentName: user.name,
        },
      });
    }

    // Invalidate Redis caches so stats and notifications refresh
    try {
      await invalidateCache("admin:stats", "admin:courses:all", `courses:id:${course._id}`, `courses:id:${course.slug}`);
    } catch (cacheErr) {}
  }

  res.json({
    success: true,
    message: "Enrollment request submitted! Course video access will be unlocked once approved by an administrator.",
    isEnrolled: true,
    isApproved: false,
    status: "pending",
    enrollment,
  });
});

// @desc    Get student enrolled courses progress (includes enrollment approval status)
// @route   GET /api/student/courses
// @access  Private/Student
export const getEnrolledCoursesProgress = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Fetch all enrollments for this student
  const enrollments = await Enrollment.find({ student: req.user.id })
    .populate("course")
    .populate("teacher", "name email avatar")
    .sort({ createdAt: -1 });

  const progressList = await Progress.find({ student: req.user.id }).populate("course");

  const approvedCourseIdsSet = new Set<string>();
  const pendingCourseIdsSet = new Set<string>();

  enrollments.forEach((en: any) => {
    const cId = en.course?._id?.toString() || en.course?.toString();
    const cSlug = en.course?.slug;
    if (en.status === "approved") {
      if (cId) approvedCourseIdsSet.add(cId);
      if (cSlug) approvedCourseIdsSet.add(cSlug);
    } else if (en.status === "pending") {
      if (cId) pendingCourseIdsSet.add(cId);
      if (cSlug) pendingCourseIdsSet.add(cSlug);
    }
  });

  // Ensure user's enrolledCourses in DB only contains approved courses
  const approvedObjectIds = enrollments
    .filter((e) => e.status === "approved" && e.course)
    .map((e: any) => e.course._id || e.course);

  if (approvedObjectIds.length > 0) {
    user.enrolledCourses = approvedObjectIds;
    await user.save();
  }

  res.json({
    success: true,
    enrollments,
    progressList,
    enrolledCourseIds: Array.from(approvedCourseIdsSet),
    pendingCourseIds: Array.from(pendingCourseIdsSet),
  });
});

// @desc    Get student progress for a specific course (enforces admin approval check)
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

  // Check enrollment status in DB
  let enrollment = null;
  if (mongoose.Types.ObjectId.isValid(targetCourseId)) {
    enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: targetCourseId,
    });
  }

  const isEnrolled = Boolean(enrollment);
  const isApproved = Boolean(enrollment && enrollment.status === "approved");
  const enrollmentStatus = enrollment ? enrollment.status : "not_enrolled";

  let progress = null;
  if (isApproved && course) {
    progress = await Progress.findOne({ student: req.user.id, course: course._id });
  }

  res.json({
    success: true,
    isEnrolled,
    isApproved,
    enrollmentStatus,
    progress: progress || { completedLessons: [] },
  });
});

// @desc    Update student lesson completion progress (Strictly blocked if not approved)
// @route   POST /api/student/progress
// @access  Private/Student
export const updateLessonProgress = asyncHandler(async (req: any, res: Response) => {
  const { courseId, lessonId } = req.body;

  if (!courseId || !lessonId) {
    res.status(400);
    throw new Error("courseId and lessonId are required");
  }

  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }

  const targetCourseId = course ? course._id : courseId;

  // STRICT SECURITY CHECK: verify student's enrollment is approved by admin!
  const enrollment = await Enrollment.findOne({
    student: req.user.id,
    course: targetCourseId,
  });

  if (!enrollment || enrollment.status !== "approved") {
    return res.status(403).json({
      success: false,
      message: "Access Denied: Your enrollment is pending admin approval. You cannot mark lessons as complete.",
    });
  }

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

  let progress = await Progress.findOne({ student: req.user.id, course: targetCourseId });

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

  res.json({ success: true, progress });
});
