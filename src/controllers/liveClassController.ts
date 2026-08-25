import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { LiveClass } from "../models/LiveClass";
import { Course } from "../models/Course";
import { User } from "../models/User";
import { Progress } from "../models/Progress";
import { sendEmail } from "../utils/mailer";

/**
 * Helper to build beautiful HTML email for Live Class Invitation
 */
function buildLiveClassEmail(params: {
  studentName: string;
  courseTitle: string;
  classTitle: string;
  description: string;
  startTime: string;
  durationMinutes: number;
  instructorName: string;
  joinUrl: string;
  isLiveNow?: boolean;
}) {
  const {
    studentName,
    courseTitle,
    classTitle,
    description,
    startTime,
    durationMinutes,
    instructorName,
    joinUrl,
    isLiveNow = false,
  } = params;

  return `
    <div style="background-color: #0b0f19; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff; padding: 40px 20px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #131b2e 0%, #0f172a 100%); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 24px; padding: 40px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        
        <!-- Badge -->
        <div style="display: inline-block; padding: 6px 16px; border-radius: 9999px; background: ${
          isLiveNow ? "rgba(239, 68, 68, 0.2)" : "rgba(168, 85, 247, 0.2)"
        }; border: 1px solid ${isLiveNow ? "#ef4444" : "#a855f7"}; color: ${
    isLiveNow ? "#f87171" : "#c084fc"
  }; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px;">
          ${isLiveNow ? "🔴 CLASS IS LIVE NOW" : "📢 NEW LIVE CLASS SCHEDULED"}
        </div>

        <h1 style="font-size: 26px; font-weight: 900; margin: 0 0 10px 0; color: #ffffff;">
          ${isLiveNow ? "Join Your Live Class Now!" : "Upcoming Live Interactive Class"}
        </h1>

        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px 0; line-height: 1.6;">
          Hello <strong>${studentName}</strong>, your instructor <strong>${instructorName}</strong> has scheduled a live interactive lecture for your enrolled course.
        </p>

        <!-- Details Card -->
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 28px;">
          <div style="font-size: 11px; font-weight: bold; color: #a855f7; text-transform: uppercase; margin-bottom: 4px;">Course</div>
          <div style="font-size: 15px; font-weight: bold; color: #ffffff; margin-bottom: 14px;">${courseTitle}</div>

          <div style="font-size: 11px; font-weight: bold; color: #a855f7; text-transform: uppercase; margin-bottom: 4px;">Session Topic</div>
          <div style="font-size: 16px; font-weight: 800; color: #38bdf8; margin-bottom: 14px;">${classTitle}</div>

          ${
            description
              ? `<div style="font-size: 12px; color: #94a3b8; margin-bottom: 14px; line-height: 1.5;">${description}</div>`
              : ""
          }

          <div style="display: flex; gap: 10px; border-top: 1px solid #334155; padding-top: 12px; font-size: 12px; color: #cbd5e1;">
            <div>🕒 <strong>Start Time:</strong> ${startTime}</div>
            <div style="margin-left: 20px;">⏱️ <strong>Duration:</strong> ${durationMinutes} mins</div>
          </div>
        </div>

        <!-- Call to Action Button -->
        <a href="${joinUrl}" style="display: inline-block; width: 80%; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 28px; border-radius: 14px; box-shadow: 0 10px 25px rgba(124, 58, 237, 0.4); text-align: center;">
          ${isLiveNow ? "🔴 Join Live Classroom Now" : "📅 View Class & Add to Calendar"}
        </a>

        <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
          You can participate via video, audio, text chat, and screen share right from your browser.
        </p>

        <div style="margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 11px; color: #475569;">
          EduCore SaaS LMS • Next-Gen Interactive Learning Platform
        </div>
      </div>
    </div>
  `;
}

// @desc    Schedule / Create a new live class
// @route   POST /api/live-classes
// @access  Private (Teacher / Admin)
export const createLiveClass = asyncHandler(async (req: any, res: Response) => {
  const { courseId, title, description, scheduledStartTime, durationMinutes, customMeetingUrl } = req.body;

  if (!courseId || !title || !scheduledStartTime) {
    res.status(400);
    throw new Error("Course ID, class title, and scheduled start time are required.");
  }

  // 1. Resolve Course
  let course: any = null;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId).populate("teacher", "name email avatar");
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId }).populate("teacher", "name email avatar");
  }

  if (!course) {
    res.status(404);
    throw new Error("Course not found.");
  }

  const teacherUser = await User.findById(req.user.id);
  const teacherName = teacherUser?.name || course.teacher?.name || "Instructor";
  const teacherAvatar = teacherUser?.avatar || course.teacher?.avatar || "";

  // 2. Generate secure native WebRTC room name and meeting URL
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const roomName = `educore-live-${cleanTitle}-${Date.now().toString(36)}`;
  const meetingUrl = customMeetingUrl || `/live/${roomName}`;

  const liveClass = await LiveClass.create({
    title,
    description: description || "",
    course: course._id,
    teacher: req.user.id,
    teacherName,
    teacherAvatar,
    scheduledStartTime: new Date(scheduledStartTime),
    durationMinutes: Number(durationMinutes) || 60,
    roomName,
    meetingUrl,
    status: "scheduled",
    enrolledStudentsNotified: false,
    liveNotified: false,
    attendees: [],
  });

  // 3. Find all enrolled students and registered students to send automatic notification emails
  try {
    const courseIdList = [course._id];
    if (course.slug) courseIdList.push(course.slug as any);

    const [enrolledUsers, progressDocs, allStudents] = await Promise.all([
      User.find({
        $or: [
          { enrolledCourses: { $in: [course._id, course._id.toString(), course.slug] } },
          { role: "student" },
        ],
      }).select("name email"),
      Progress.find({ course: { $in: [course._id, course._id.toString()] } }).populate("student", "name email"),
      User.find({ role: "student" }).select("name email"),
    ]);

    const recipientMap = new Map<string, string>();

    enrolledUsers.forEach((u: any) => {
      if (u.email) recipientMap.set(u.email.toLowerCase().trim(), u.name || "Student");
    });

    progressDocs.forEach((p: any) => {
      if (p.student && p.student.email) {
        recipientMap.set(p.student.email.toLowerCase().trim(), p.student.name || "Student");
      }
    });

    allStudents.forEach((s: any) => {
      if (s.email) {
        recipientMap.set(s.email.toLowerCase().trim(), s.name || "Student");
      }
    });

    const defaultEmail = process.env.DEFAULT_FROM_EMAIL || "eng.tuhin77@gmail.com";
    if (defaultEmail) {
      recipientMap.set(defaultEmail.toLowerCase().trim(), "Tuhin Al Rakib");
    }

    const clientBaseUrl = process.env.CLIENT_URL || "http://localhost:3000";
    const joinUrl = `${clientBaseUrl}/live/${liveClass._id}`;
    const formattedStartTime = new Date(scheduledStartTime).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log(`[LiveClass] Dispatching emails to ${recipientMap.size} recipients for: "${title}"`);

    // Send email to all recipients and await delivery
    const emailPromises = Array.from(recipientMap.entries()).map(([email, name]) => {
      const emailHtml = buildLiveClassEmail({
        studentName: name,
        courseTitle: course.title,
        classTitle: title,
        description: description || "",
        startTime: formattedStartTime,
        durationMinutes: Number(durationMinutes) || 60,
        instructorName: teacherName,
        joinUrl,
        isLiveNow: false,
      });

      return sendEmail(email, `📢 Live Class Scheduled: ${course.title} - ${title}`, emailHtml)
        .then((res) => {
          console.log(`[LiveClass] Email successfully dispatched to ${email}: ${res}`);
          return res;
        })
        .catch((err) => {
          console.warn(`[LiveClass] Failed to email student ${email}:`, err);
        });
    });

    await Promise.allSettled(emailPromises);

    liveClass.enrolledStudentsNotified = true;
    await liveClass.save();
  } catch (notifyErr) {
    console.error("Error dispatching live class emails:", notifyErr);
  }

  res.status(201).json({
    success: true,
    message: "Live class scheduled successfully! Enrolled students have been notified.",
    liveClass,
  });
});


// @desc    Get live classes relevant to current logged-in user (Teacher, Student, Admin)
// @route   GET /api/live-classes/my-classes
// @access  Private
export const getMyLiveClasses = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  let query: any = { status: { $ne: "cancelled" } };

  if (userRole === "teacher") {
    // If teacher, return their classes or all non-cancelled sessions
    query = {
      $or: [
        { teacher: userId },
        { status: { $in: ["live", "scheduled"] } },
      ],
    };
  }

  const liveClasses = await LiveClass.find(query)
    .populate("course", "title slug thumbnail category level")
    .populate("teacher", "name avatar title email")
    .sort({ scheduledStartTime: 1 });

  res.json({
    success: true,
    count: liveClasses.length,
    liveClasses,
  });
});


// @desc    Get all live classes for a specific course

// @route   GET /api/live-classes/course/:courseId
// @access  Public / Enrolled
export const getLiveClassesByCourse = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = req.params;

  let resolvedCourseId: any = courseId;
  let course: any = null;

  if (mongoose.Types.ObjectId.isValid(courseId)) {
    course = await Course.findById(courseId);
  }
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }
  if (course) {
    resolvedCourseId = course._id;
  }

  const liveClasses = await LiveClass.find({
    course: resolvedCourseId,
    status: { $ne: "cancelled" },
  })
    .populate("teacher", "name avatar title")
    .sort({ scheduledStartTime: 1 });

  res.json({
    success: true,
    count: liveClasses.length,
    liveClasses,
  });
});

// @desc    Get single live class by ID
// @route   GET /api/live-classes/:id
// @access  Public / Private
export const getLiveClassById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const liveClass = await LiveClass.findById(id)
    .populate("course", "title slug thumbnail description teacher")
    .populate("teacher", "name avatar title bio email");

  if (!liveClass) {
    res.status(404);
    throw new Error("Live class session not found.");
  }

  res.json({
    success: true,
    liveClass,
  });
});

// @desc    Update live class status (e.g. start class, end class)
// @route   PUT /api/live-classes/:id/status
// @access  Private (Teacher / Admin)
export const updateLiveClassStatus = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["scheduled", "live", "completed", "cancelled"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status. Must be scheduled, live, completed, or cancelled.");
  }

  const liveClass = await LiveClass.findById(id).populate("course", "title slug");
  if (!liveClass) {
    res.status(404);
    throw new Error("Live class not found.");
  }

  const previousStatus = liveClass.status;
  liveClass.status = status;

  // When class goes LIVE, send instant LIVE NOW email alert to enrolled students
  if (status === "live" && previousStatus !== "live" && !liveClass.liveNotified) {
    try {
      const courseId = liveClass.course?._id || liveClass.course;
      const [enrolledUsers, progressDocs, allStudents] = await Promise.all([
        User.find({
          $or: [
            { enrolledCourses: { $in: [courseId, courseId.toString()] } },
            { role: "student" },
          ],
        }).select("name email"),
        Progress.find({ course: { $in: [courseId, courseId.toString()] } }).populate("student", "name email"),
        User.find({ role: "student" }).select("name email"),
      ]);

      const recipientMap = new Map<string, string>();
      enrolledUsers.forEach((u: any) => {
        if (u.email) recipientMap.set(u.email.toLowerCase().trim(), u.name || "Student");
      });
      progressDocs.forEach((p: any) => {
        if (p.student && p.student.email) {
          recipientMap.set(p.student.email.toLowerCase().trim(), p.student.name || "Student");
        }
      });
      allStudents.forEach((s: any) => {
        if (s.email) {
          recipientMap.set(s.email.toLowerCase().trim(), s.name || "Student");
        }
      });

      const defaultEmail = process.env.DEFAULT_FROM_EMAIL || "eng.tuhin77@gmail.com";
      if (defaultEmail) {
        recipientMap.set(defaultEmail.toLowerCase().trim(), "Tuhin Al Rakib");
      }

      const clientBaseUrl = process.env.CLIENT_URL || "http://localhost:3000";
      const joinUrl = `${clientBaseUrl}/live/${liveClass._id}`;
      const formattedStartTime = new Date().toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });

      const liveEmailPromises = Array.from(recipientMap.entries()).map(([email, name]) => {
        const emailHtml = buildLiveClassEmail({
          studentName: name,
          courseTitle: (liveClass.course as any)?.title || "Enrolled Course",
          classTitle: liveClass.title,
          description: liveClass.description || "",
          startTime: `Started at ${formattedStartTime} (NOW)`,
          durationMinutes: liveClass.durationMinutes,
          instructorName: liveClass.teacherName,
          joinUrl,
          isLiveNow: true,
        });

        return sendEmail(email, `🔴 LIVE NOW: ${liveClass.title} has started!`, emailHtml);
      });

      await Promise.allSettled(liveEmailPromises);
      liveClass.liveNotified = true;
    } catch (e) {
      console.error("Live alert dispatch error:", e);
    }
  }


  await liveClass.save();

  res.json({
    success: true,
    message: `Live class status updated to ${status}`,
    liveClass,
  });
});

// @desc    Register attendance when student joins live room
// @route   POST /api/live-classes/:id/join
// @access  Private / Student
export const joinLiveClass = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const studentId = req.user.id;

  const liveClass = await LiveClass.findById(id);
  if (!liveClass) {
    res.status(404);
    throw new Error("Live class session not found.");
  }

  const studentUser = await User.findById(studentId);

  // Check if already registered
  const alreadyJoined = liveClass.attendees.some(
    (a) => a.student?.toString() === studentId.toString()
  );

  if (!alreadyJoined) {
    liveClass.attendees.push({
      student: studentId,
      studentName: studentUser?.name || "Student",
      studentEmail: studentUser?.email || "",
      joinedAt: new Date(),
    });
    await liveClass.save();
  }

  res.json({
    success: true,
    message: "Attendance recorded successfully.",
    attendeesCount: liveClass.attendees.length,
  });
});

// @desc    Delete / Cancel a live class
// @route   DELETE /api/live-classes/:id
// @access  Private (Teacher / Admin)
export const deleteLiveClass = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const liveClass = await LiveClass.findById(id);
  if (!liveClass) {
    res.status(404);
    throw new Error("Live class not found.");
  }

  await LiveClass.findByIdAndDelete(id);

  res.json({
    success: true,
    message: "Live class session deleted successfully.",
  });
});
