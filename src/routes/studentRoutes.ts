import { Router } from "express";
import {
  enrollInCourse,
  getEnrolledCoursesProgress,
  getCourseProgress,
  updateLessonProgress,
} from "../controllers/studentController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.post("/enroll", enrollInCourse);
router.get("/courses", getEnrolledCoursesProgress);
router.get("/progress/:courseId", getCourseProgress);
router.post("/progress", updateLessonProgress);

export default router;


