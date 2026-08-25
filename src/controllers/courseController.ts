import mongoose from "mongoose";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { Progress } from "../models/Progress";
import { getCache, setCache, invalidateCache } from "../utils/redis";

/**
 * Safely parse requester user info from authorization header
 */
function getRequesterInfo(req: Request): { id?: string; role?: string; email?: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "educore_super_secret_jwt_key_2026";
    const decoded = jwt.verify(token, secret) as { id: string; role: string; email: string };
    return decoded;
  } catch (e) {
    return null;
  }
}

/**
 * Helper to sanitize scheduled / drip lessons if current time is before unlockAt
 * and the user is NOT the course owner/admin.
 */
function sanitizeCourseForDrip(rawCourse: any, isTeacherOrAdmin: boolean) {
  if (!rawCourse) return rawCourse;
  if (isTeacherOrAdmin) return rawCourse;

  const c = typeof rawCourse.toObject === "function" ? rawCourse.toObject() : JSON.parse(JSON.stringify(rawCourse));
  const now = Date.now();

  if (Array.isArray(c.sections)) {
    c.sections = c.sections.map((section: any) => {
      if (Array.isArray(section.lessons)) {
        section.lessons = section.lessons.map((lesson: any) => {
          if (lesson.unlockAt) {
            const unlockTimestamp = new Date(lesson.unlockAt).getTime();
            if (!isNaN(unlockTimestamp) && unlockTimestamp > now) {
              // Lesson is locked by scheduled drip release!
              return {
                ...lesson,
                isScheduled: true,
                isLocked: true,
                contentUrl: "", // 100% stripped from backend for security
                videoProvider: lesson.videoProvider || "youtube",
                resources: [], // Strip downloadable resources
                unlockAt: lesson.unlockAt,
              };
            }
          }
          return {
            ...lesson,
            isScheduled: false,
            isLocked: false,
          };
        });
      }
      return section;
    });
  }

  return c;
}

/**
 * Helper to safely resolve teacher ObjectId from any user input format (object, email, or id)
 */
async function resolveTeacherId(teacherInput: any, teacherEmail?: string): Promise<mongoose.Types.ObjectId | null> {
  if (teacherInput && mongoose.Types.ObjectId.isValid(teacherInput)) {
    return new mongoose.Types.ObjectId(teacherInput);
  }

  let emailToLookup = "";
  let nameToUse = "Teacher";
  let avatarToUse = "";

  if (typeof teacherInput === "object" && teacherInput !== null) {
    if (teacherInput._id && mongoose.Types.ObjectId.isValid(teacherInput._id)) {
      return new mongoose.Types.ObjectId(teacherInput._id);
    }
    if (teacherInput.id && mongoose.Types.ObjectId.isValid(teacherInput.id)) {
      return new mongoose.Types.ObjectId(teacherInput.id);
    }
    emailToLookup = teacherInput.email || teacherEmail || "";
    nameToUse = teacherInput.name || "Teacher";
    avatarToUse = teacherInput.avatar || "";
  } else if (typeof teacherInput === "string") {
    emailToLookup = teacherInput;
  }

  if (!emailToLookup && teacherEmail) {
    emailToLookup = teacherEmail;
  }

  if (emailToLookup) {
    let foundUser = await User.findOne({ email: emailToLookup });
    if (foundUser) {
      return foundUser._id as mongoose.Types.ObjectId;
    }
    try {
      foundUser = await User.create({
        name: nameToUse,
        email: emailToLookup,
        password: "TeacherPassword123!",
        role: "teacher",
        avatar: avatarToUse,
        isEmailVerified: true,
      });
      return foundUser._id as mongoose.Types.ObjectId;
    } catch (e) {}
  }

  const teacherUser = await User.findOne({ role: "teacher" });
  if (teacherUser) return teacherUser._id as mongoose.Types.ObjectId;

  const defaultUser = await User.findOne({});
  return defaultUser ? (defaultUser._id as mongoose.Types.ObjectId) : null;
}

/**
 * Helper to ensure course object has populated teacher details and live enrolled students count
 */
async function enrichCourseWithTeacher(course: any) {
  if (!course) return course;
  let c = course.toObject ? course.toObject() : { ...course };

  // 1. Calculate live enrolled students count from User.enrolledCourses & Progress collections
  try {
    const courseId = c._id;
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      const [userEnrolledCount, progressEnrolled] = await Promise.all([
        User.countDocuments({ enrolledCourses: courseId }),
        Progress.distinct("student", { course: courseId }),
      ]);
      const progressCount = Array.isArray(progressEnrolled) ? progressEnrolled.length : 0;
      const liveEnrolledCount = Math.max(c.totalStudents || 0, userEnrolledCount, progressCount);
      c.totalStudents = liveEnrolledCount;

      // Sync count back to Course collection in background
      Course.updateOne({ _id: courseId }, { $set: { totalStudents: liveEnrolledCount } }).exec().catch(() => {});
    }
  } catch (metricsErr) {}

  let teacherUser: any = null;

  // 2. Try finding teacher by rawTeacherId if valid ObjectId
  let rawTeacherId = c.teacher?._id || (typeof c.teacher === "string" && mongoose.Types.ObjectId.isValid(c.teacher) ? c.teacher : null);
  if (rawTeacherId) {
    teacherUser = await User.findById(rawTeacherId).select("name avatar bio title email").lean();
  }

  // 3. Try by email if teacher not found
  if (!teacherUser && (c.teacherEmail || c.teacher?.email)) {
    teacherUser = await User.findOne({ email: c.teacherEmail || c.teacher?.email }).select("name avatar bio title email").lean();
  }

  // 4. Try finding any teacher user in DB
  if (!teacherUser) {
    teacherUser = await User.findOne({ role: "teacher" }).select("name avatar bio title email").lean();
  }

  // 5. Try admin
  if (!teacherUser) {
    teacherUser = await User.findOne({ role: "admin" }).select("name avatar bio title email").lean();
  }

  if (teacherUser) {
    c.teacher = {
      _id: teacherUser._id,
      name: teacherUser.name,
      avatar: teacherUser.avatar || "",
      bio: teacherUser.bio || "Senior Instructor & Course Creator",
      title: teacherUser.title || "Senior Course Instructor",
      email: teacherUser.email || "",
    };
    c.teacherName = teacherUser.name;
    c.teacherEmail = teacherUser.email;
    return c;
  }

  return c;
}


// @desc    Get all courses with filtering (with Redis Caching)
// @route   GET /api/courses
// @access  Public
export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const { category, level, price, search, status, teacherId, teacherEmail } = req.query;
  const cacheKey = `courses:list:${status || "approved"}:${category || "all"}:${level || "all"}:${price || "all"}:${search || ""}:${teacherId || ""}:${teacherEmail || ""}`;

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData && Array.isArray(cachedData.courses)) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  const filter: any = {};

  if (status) {
    if (status !== "all" && status !== "ALL") {
      filter.status = status;
    }
  } else if (!teacherId && !teacherEmail) {
    // By default for public explore, return approved or published courses
    filter.status = { $in: ["approved", "published", "Approved", "Published"] };
  }

  if (category && category !== "All") filter.category = category;
  if (level && level !== "All") filter.level = level;
  if (price === "free") filter.price = 0;
  if (price === "paid") filter.price = { $gt: 0 };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (teacherId && mongoose.Types.ObjectId.isValid(teacherId as string)) {
    filter.teacher = new mongoose.Types.ObjectId(teacherId as string);
  } else if (teacherEmail) {
    const teacherUser = await User.findOne({ email: teacherEmail });
    if (teacherUser) {
      filter.teacher = teacherUser._id;
    }
  }

  let courses: any[] = [];
  try {
    courses = await Course.find(filter).populate("teacher", "name avatar title email").sort({ createdAt: -1 });
  } catch (populateErr) {
    courses = await Course.find(filter).sort({ createdAt: -1 }).lean();
  }

  // Ensure all courses have resolved teacher details
  const enrichedCourses = await Promise.all(courses.map((c) => enrichCourseWithTeacher(c)));

  const responseData = { success: true, count: enrichedCourses.length, courses: enrichedCourses };

  // 3. Set Redis Cache with 1-hour expiration
  await setCache(cacheKey, responseData, 3600);

  res.json(responseData);
});

// @desc    Get single course by slug or ID (with Redis Caching & Drip Protection)
// @route   GET /api/courses/:identifier
// @access  Public
export const getCourseByIdentifier = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.params;
  const cacheKey = `courses:id:${identifier}`;
  const requester = getRequesterInfo(req);

  // 1. Check Redis Cache first (Cache Hit)
  let course: any = null;
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData && cachedData.course?.teacher && typeof cachedData.course.teacher === "object" && cachedData.course.teacher.name && !/^[0-9a-fA-F]{24}$/.test(cachedData.course.teacher.name)) {
    course = cachedData.course;
  }

  // 2. Fetch from MongoDB on Cache Miss
  if (!course) {
    try {
      course = await Course.findOne({ slug: identifier }).populate("teacher", "name avatar bio title email");
      if (!course && mongoose.Types.ObjectId.isValid(identifier)) {
        course = await Course.findById(identifier).populate("teacher", "name avatar bio title email");
      }
    } catch (populateErr) {
      course = await Course.findOne({ slug: identifier }).lean();
      if (!course && mongoose.Types.ObjectId.isValid(identifier)) {
        course = await Course.findById(identifier).lean();
      }
    }

    if (!course) {
      res.status(404);
      throw new Error("Course not found.");
    }

    // Enrich teacher if it was just an ObjectId
    course = await enrichCourseWithTeacher(course);

    // 3. Set Redis Cache for specific raw course ID/slug
    await setCache(cacheKey, { success: true, course }, 3600);
  }

  // Determine if requester is the teacher of this course or an admin
  const teacherIdStr = course.teacher?._id?.toString() || course.teacher?.id?.toString() || course.teacher?.toString() || "";
  const isTeacherOrAdmin = Boolean(
    requester &&
    (requester.role === "admin" || (requester.id && teacherIdStr && requester.id === teacherIdStr))
  );

  const safeCourse = sanitizeCourseForDrip(course, isTeacherOrAdmin);

  res.json({ success: true, course: safeCourse });
});

// @desc    Create new course (Invalidates Redis Cache)
// @route   POST /api/courses
// @access  Public / Teacher
export const createCourse = asyncHandler(async (req: any, res: Response) => {
  const { title } = req.body;
  if (!title) {
    res.status(400);
    throw new Error("Title is required.");
  }

  const courseData = { ...req.body };

  // Remove temporary frontend string _id if not a 24-char ObjectId
  if (courseData._id && !mongoose.Types.ObjectId.isValid(courseData._id)) {
    delete courseData._id;
  }

  // Remove temporary string _id from sections and lessons as well
  if (Array.isArray(courseData.sections)) {
    courseData.sections = courseData.sections.map((sec: any) => {
      const cleanSec = { ...sec };
      if (cleanSec._id && !mongoose.Types.ObjectId.isValid(cleanSec._id)) {
        delete cleanSec._id;
      }
      if (Array.isArray(cleanSec.lessons)) {
        cleanSec.lessons = cleanSec.lessons.map((les: any) => {
          const cleanLes = { ...les };
          if (cleanLes._id && !mongoose.Types.ObjectId.isValid(cleanLes._id)) {
            delete cleanLes._id;
          }
          return cleanLes;
        });
      }
      return cleanSec;
    });
  }

  const resolvedTeacher = await resolveTeacherId(req.user?.id || req.user?._id || courseData.teacher, courseData.teacherEmail);
  const slug = courseData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();

  const course = await Course.create({
    ...courseData,
    slug,
    teacher: resolvedTeacher,
    status: courseData.status || "pending",
  });

  // Invalidate Redis list cache and specific course cache
  try {
    await invalidateCache("courses", `courses:id:${course._id}`, `courses:id:${course.slug}`);
  } catch (e) {}

  res.status(201).json({ success: true, message: "Course created successfully", course });
});

// @desc    Update course status (Invalidates Redis Cache)
// @route   PUT /api/courses/:id/status
// @access  Admin
export const updateCourseStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400);
    throw new Error("Status is required.");
  }

  let course;
  if (mongoose.Types.ObjectId.isValid(id)) {
    course = await Course.findByIdAndUpdate(id, { status }, { new: true });
  } else {
    course = await Course.findOneAndUpdate({ slug: id }, { status }, { new: true });
  }

  // Invalidate Redis list cache
  try {
    await invalidateCache("courses", `courses:id:${id}`);
  } catch (e) {}

  res.json({ success: true, message: `Course status updated to ${status}`, course });
});

// @desc    Delete course (Invalidates Redis Cache)
// @route   DELETE /api/courses/:id
// @access  Admin / Teacher
export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (mongoose.Types.ObjectId.isValid(id)) {
    await Course.findByIdAndDelete(id);
  } else {
    await Course.findOneAndDelete({ slug: id });
  }

  // Invalidate Redis list cache
  try {
    await invalidateCache("courses", `courses:id:${id}`);
  } catch (e) {}

  res.json({ success: true, message: "Course deleted successfully." });
});

// @desc    Update existing course details
// @route   PUT /api/courses/:id
// @access  Teacher / Admin
export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Remove immutable fields
  delete updateData._id;
  delete updateData.id;

  // Resolve teacher ObjectId safely
  if (updateData.teacher || updateData.teacherEmail) {
    updateData.teacher = await resolveTeacherId(updateData.teacher, updateData.teacherEmail);
  }

  // Sanitize sections and lessons IDs
  if (Array.isArray(updateData.sections)) {
    updateData.sections = updateData.sections.map((sec: any) => {
      const cleanSec = { ...sec };
      if (cleanSec._id && !mongoose.Types.ObjectId.isValid(cleanSec._id)) {
        delete cleanSec._id;
      }
      if (Array.isArray(cleanSec.lessons)) {
        cleanSec.lessons = cleanSec.lessons.map((les: any) => {
          const cleanLes = { ...les };
          if (cleanLes._id && !mongoose.Types.ObjectId.isValid(cleanLes._id)) {
            delete cleanLes._id;
          }
          return cleanLes;
        });
      }
      return cleanSec;
    });
  }

  let course;
  if (mongoose.Types.ObjectId.isValid(id)) {
    course = await Course.findByIdAndUpdate(id, updateData, { new: true });
  } else {
    // 1. Try finding by exact slug
    course = await Course.findOneAndUpdate({ slug: id }, updateData, { new: true });

    // 2. If not found and id is a temporary string like "course-1786389463895", try matching slug timestamp
    if (!course) {
      const timestampMatch = id.match(/\d+/);
      if (timestampMatch) {
        course = await Course.findOneAndUpdate(
          { slug: { $regex: timestampMatch[0], $options: "i" } },
          updateData,
          { new: true }
        );
      }
    }

    // 3. If still not found, try matching by exact course title
    if (!course && updateData.title) {
      course = await Course.findOneAndUpdate(
        { title: updateData.title },
        updateData,
        { new: true }
      );
    }
  }

  // 4. Fallback: If not found in database (e.g. was only in browser localStorage), create it
  if (!course) {
    const slug =
      updateData.slug ||
      (updateData.title
        ? updateData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now()
        : `course-${Date.now()}`);

    course = await Course.create({
      ...updateData,
      slug,
      status: updateData.status || "pending",
    });
  }

  try {
    await invalidateCache("courses", `courses:id:${id}`, `courses:id:${course.slug}`, `courses:id:${course._id}`);
  } catch (e) {}

  res.json({ success: true, message: "Course updated successfully.", course });
});
