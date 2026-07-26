import { Router } from "express";
import { User } from "../models/User";
import { Course } from "../models/Course";
import { Order } from "../models/Order";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/summary", async (req: any, res) => {
  const role = req.user.role;
  if (role === "admin") {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalCourses = await Course.countDocuments();
    const orders = await Order.find({ paymentStatus: "completed" });
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

    return res.json({
      success: true,
      data: { totalStudents, totalTeachers, totalCourses, totalRevenue },
    });
  } else if (role === "teacher") {
    const courses = await Course.find({ teacher: req.user.id });
    const totalStudents = courses.reduce((sum, c) => sum + c.totalStudents, 0);
    return res.json({
      success: true,
      data: { totalCourses: courses.length, totalStudents, revenue: 4520 },
    });
  } else {
    return res.json({
      success: true,
      data: { enrolledCourses: 3, completedLessons: 12, xp: 3250 },
    });
  }
});

export default router;
