import { Router } from "express";
import {
  getEnrolledCoursesProgress,
  updateLessonProgress,
} from "../controllers/studentController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/courses", getEnrolledCoursesProgress);
router.post("/progress", updateLessonProgress);

export default router;
