import { Router } from "express";
import {
  getTeacherStats,
  getTeacherCourses,
  createTeacherCourse,
} from "../controllers/teacherController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT, authorizeRoles("teacher", "admin"));

router.get("/stats", getTeacherStats);
router.get("/courses", getTeacherCourses);
router.post("/courses", createTeacherCourse);

export default router;
