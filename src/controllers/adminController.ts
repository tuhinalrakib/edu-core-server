import mongoose from "mongoose";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/User";
import { Course } from "../models/Course";
import { Enrollment } from "../models/Enrollment";
import { sendDbNotification } from "./notificationController";
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
  const totalEnrollments = await Enrollment.countDocuments();
  const pendingEnrollments = await Enrollment.countDocuments({ status: "pending" });

  const responseData = {
    success: true,
    stats: {
      totalStudents,
      totalTeachers,
      totalCourses,
      pendingCourses,
      totalEnrollments,
      pendingEnrollments,
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

  const courses = await Course.find().populate("teacher", "name email avatar").sort({ createdAt: -1 });
  const responseData = { success: true, courses };

  await setCache(cacheKey, responseData, 1800);
  res.json(responseData);
});

// @desc    Update course status (published, rejected, draft) -> Invalidates Redis Cache
// @route   PATCH /api/admin/courses/:id/status
// @access  Private/Admin
export const updateCourseStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const id = req.params.id;
  
  let course;
  if (mongoose.Types.ObjectId.isValid(id)) {
    course = await Course.findById(id);
  } else {
    course = await Course.findOne({ slug: id });
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  course.status = status;
  await course.save();

  // Invalidate Redis caches for admin and public course lists
  await invalidateCache("admin:courses:all", "admin:stats", "courses", "courses:list", `courses:id:${id}`, `courses:id:${course._id}`, `courses:id:${course.slug}`);

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

// @desc    Get all student course enrollments for admin approval (with filters & search)
// @route   GET /api/admin/enrollments
// @access  Private/Admin
export const getAdminEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const { status, search } = req.query;

  const filter: any = {};
  if (status && status !== "all") {
    filter.status = status;
  }

  let enrollments = await Enrollment.find(filter)
    .populate("student", "name email avatar phone")
    .populate("course", "title slug thumbnail price category")
    .populate("teacher", "name email avatar")
    .sort({ createdAt: -1 })
    .lean();

  if (search) {
    const searchLower = String(search).toLowerCase();
    enrollments = enrollments.filter((en: any) => {
      const studentName = en.student?.name?.toLowerCase() || "";
      const studentEmail = en.student?.email?.toLowerCase() || "";
      const courseTitle = en.course?.title?.toLowerCase() || "";
      const teacherName = en.teacher?.name?.toLowerCase() || "";
      return (
        studentName.includes(searchLower) ||
        studentEmail.includes(searchLower) ||
        courseTitle.includes(searchLower) ||
        teacherName.includes(searchLower)
      );
    });
  }

  const total = await Enrollment.countDocuments();
  const pending = await Enrollment.countDocuments({ status: "pending" });
  const approved = await Enrollment.countDocuments({ status: "approved" });
  const rejected = await Enrollment.countDocuments({ status: "rejected" });

  res.json({
    success: true,
    enrollments,
    counts: {
      total,
      pending,
      approved,
      rejected,
    },
  });
});

// @desc    Approve student course enrollment -> grants course video access & notifies student & teacher
// @route   PATCH /api/admin/enrollments/:id/approve
// @access  Private/Admin
export const approveEnrollment = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const enrollment = await Enrollment.findById(id)
    .populate("course", "title slug totalStudents")
    .populate("student", "name email enrolledCourses")
    .populate("teacher", "name email");

  if (!enrollment) {
    res.status(404);
    throw new Error("Enrollment record not found.");
  }

  const wasAlreadyApproved = enrollment.status === "approved";

  enrollment.status = "approved";
  enrollment.approvedAt = new Date();
  enrollment.adminActionBy = req.user?.id;
  await enrollment.save();

  // 1. Add course to student's user document
  const studentUser = await User.findById(enrollment.student?._id || enrollment.student);
  if (studentUser) {
    if (!Array.isArray(studentUser.enrolledCourses)) {
      studentUser.enrolledCourses = [];
    }
    const courseIdStr = (enrollment.course?._id || enrollment.course).toString();
    const alreadyPresent = studentUser.enrolledCourses.some(
      (c: any) => c.toString() === courseIdStr || (c._id && c._id.toString() === courseIdStr)
    );
    if (!alreadyPresent) {
      studentUser.enrolledCourses.push(enrollment.course._id || enrollment.course);
      await studentUser.save();
    }
  }

  // 2. Increment Course totalStudents if not previously counted
  if (!wasAlreadyApproved) {
    await Course.findByIdAndUpdate(enrollment.course?._id || enrollment.course, {
      $inc: { totalStudents: 1 },
    });
  }

  const courseTitle = (enrollment.course as any)?.title || "the course";
  const studentName = (enrollment.student as any)?.name || "Student";
  const courseSlug = (enrollment.course as any)?.slug || enrollment.course?._id;

  // 3. Send Notification in DB to Student
  await sendDbNotification({
    recipient: enrollment.student?._id || enrollment.student,
    recipientRole: "student",
    title: "Enrollment Approved! 🎉",
    message: `Your enrollment in "${courseTitle}" has been approved by the admin. All lectures and videos are now unlocked!`,
    type: "enrollment_approved",
    link: `/student/learn/${courseSlug}`,
    data: {
      enrollmentId: enrollment._id,
      courseId: enrollment.course?._id || enrollment.course,
      courseTitle,
    },
  });

  // 4. Send Notification in DB to Teacher
  if (enrollment.teacher) {
    await sendDbNotification({
      recipient: enrollment.teacher?._id || enrollment.teacher,
      recipientRole: "teacher",
      title: "Student Access Approved 🎓",
      message: `Admin approved ${studentName}'s enrollment in your course "${courseTitle}".`,
      type: "enrollment_approved",
      link: "/teacher/dashboard?tab=students",
      data: {
        enrollmentId: enrollment._id,
        courseId: enrollment.course?._id || enrollment.course,
        studentId: enrollment.student?._id || enrollment.student,
        studentName,
        courseTitle,
      },
    });
  }

  // Invalidate Redis caches
  try {
    await invalidateCache(
      "admin:stats",
      "admin:courses:all",
      `courses:id:${enrollment.course?._id || enrollment.course}`,
      `courses:id:${courseSlug}`
    );
  } catch (e) {}

  res.json({
    success: true,
    message: `Enrollment for ${studentName} approved successfully! Full course access is unlocked.`,
    enrollment,
  });
});

// @desc    Reject / Deny student course enrollment -> denies video access & cancels enrollment
// @route   PATCH /api/admin/enrollments/:id/reject
// @access  Private/Admin
export const rejectEnrollment = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const enrollment = await Enrollment.findById(id)
    .populate("course", "title slug totalStudents")
    .populate("student", "name email enrolledCourses")
    .populate("teacher", "name email");

  if (!enrollment) {
    res.status(404);
    throw new Error("Enrollment record not found.");
  }

  const wasApproved = enrollment.status === "approved";

  enrollment.status = "rejected";
  enrollment.adminActionBy = req.user?.id;
  if (reason) enrollment.adminNotes = reason;
  await enrollment.save();

  // 1. Remove course from student's active enrolledCourses
  const studentUser = await User.findById(enrollment.student?._id || enrollment.student);
  if (studentUser && Array.isArray(studentUser.enrolledCourses)) {
    const courseIdStr = (enrollment.course?._id || enrollment.course).toString();
    studentUser.enrolledCourses = studentUser.enrolledCourses.filter(
      (c: any) => c.toString() !== courseIdStr && (!c._id || c._id.toString() !== courseIdStr)
    );
    await studentUser.save();
  }

  // 2. If it was previously counted, decrement course totalStudents
  if (wasApproved) {
    await Course.findByIdAndUpdate(enrollment.course?._id || enrollment.course, {
      $inc: { totalStudents: -1 },
    });
  }

  const courseTitle = (enrollment.course as any)?.title || "the course";
  const studentName = (enrollment.student as any)?.name || "Student";

  // 3. Send Notification in DB to Student
  await sendDbNotification({
    recipient: enrollment.student?._id || enrollment.student,
    recipientRole: "student",
    title: "Enrollment Not Approved ⚠️",
    message: `Your enrollment request for "${courseTitle}" was declined by platform administration.${reason ? ` Reason: ${reason}` : ""}`,
    type: "enrollment_rejected",
    link: "/student/dashboard",
    data: {
      enrollmentId: enrollment._id,
      courseId: enrollment.course?._id || enrollment.course,
      courseTitle,
      reason,
    },
  });

  // 4. Send Notification in DB to Course Teacher
  if (enrollment.teacher) {
    await sendDbNotification({
      recipient: enrollment.teacher?._id || enrollment.teacher,
      recipientRole: "teacher",
      title: "Enrollment Denied / Cancelled ❌",
      message: `Enrollment for "${courseTitle}" by ${studentName} was declined by admin.`,
      type: "enrollment_rejected",
      link: "/teacher/dashboard?tab=students",
      data: {
        enrollmentId: enrollment._id,
        courseId: enrollment.course?._id || enrollment.course,
        studentId: enrollment.student?._id || enrollment.student,
        studentName,
        courseTitle,
      },
    });
  }

  // Invalidate Redis caches
  try {
    await invalidateCache(
      "admin:stats",
      "admin:courses:all",
      `courses:id:${enrollment.course?._id || enrollment.course}`,
      `courses:id:${(enrollment.course as any)?.slug}`
    );
  } catch (e) {}

  res.json({
    success: true,
    message: `Enrollment for ${studentName} has been declined. Access denied.`,
    enrollment,
  });
});

