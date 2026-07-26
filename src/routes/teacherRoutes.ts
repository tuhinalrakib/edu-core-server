import { Router } from "express";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";
import { Course } from "../models/Course";
import { User } from "../models/User";

const router = Router();

router.use(authenticateJWT, authorizeRoles("teacher", "admin"));

router.get("/stats", async (req: any, res) => {
  try {
    const courses = await Course.find({ teacher: req.user.id });
    const user = await User.findById(req.user.id);
    return res.json({
      success: true,
      stats: {
        totalCourses: courses.length,
        totalStudents: courses.reduce((sum, c) => sum + c.totalStudents, 0),
        revenue: user?.earnings || 4520,
        averageRating: 4.8,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/courses", async (req: any, res) => {
  try {
    const courses = await Course.find({ teacher: req.user.id });
    return res.json({ success: true, courses });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/courses", async (req: any, res) => {
  try {
    const { title, description, category, level, price, thumbnail, sections } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);

    const course = await Course.create({
      title,
      slug,
      description,
      category: category || "Programming",
      level: level || "All Levels",
      price: price || 0,
      teacher: req.user.id,
      thumbnail: thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
      sections: sections || [],
      status: "approved",
    });

    return res.status(201).json({ success: true, message: "Course created successfully!", course });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
