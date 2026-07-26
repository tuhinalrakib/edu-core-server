import { Router } from "express";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";
import { User } from "../models/User";
import { Course } from "../models/Course";

const router = Router();

router.use(authenticateJWT, authorizeRoles("admin"));

router.get("/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalCourses = await Course.countDocuments();
    return res.json({
      success: true,
      stats: { totalStudents, totalTeachers, totalCourses, totalRevenue: 38450, adminCommission: 7690 },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/teachers", async (req, res) => {
  const teachers = await User.find({ role: "teacher" }).select("-passwordHash");
  return res.json({ success: true, teachers });
});

router.get("/students", async (req, res) => {
  const students = await User.find({ role: "student" }).select("-passwordHash");
  return res.json({ success: true, students });
});

router.get("/courses", async (req, res) => {
  const courses = await Course.find().populate("teacher", "name email");
  return res.json({ success: true, courses });
});

export default router;
