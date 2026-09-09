import { Router } from "express";
import {
  getTeacherStats,
  getTeacherCourses,
  createTeacherCourse,
  getTeacherEnrollments,
} from "../controllers/teacherController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT, authorizeRoles("teacher", "admin"));

router.get("/stats", getTeacherStats);
router.get("/courses", getTeacherCourses);
router.post("/courses", createTeacherCourse);
router.get("/enrollments", getTeacherEnrollments);

export default router;

