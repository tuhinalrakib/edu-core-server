import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import { Course } from "../models/Course";
import { Progress } from "../models/Progress";
import { User } from "../models/User";

const router = Router();

router.use(authenticateJWT);

router.get("/courses", async (req: any, res) => {
  try {
    const progressList = await Progress.find({ student: req.user.id }).populate("course");
    return res.json({ success: true, progressList });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/progress", async (req: any, res) => {
  try {
    const { courseId, lessonId } = req.body;
    let progress = await Progress.findOne({ student: req.user.id, course: courseId });
    if (!progress) {
      progress = await Progress.create({ student: req.user.id, course: courseId, completedLessons: [lessonId] });
    } else if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
      await progress.save();
    }
    return res.json({ success: true, progress });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
