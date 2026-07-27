import { Router } from "express";
import {
  getAdminStats,
  getAdminTeachers,
  updateTeacherStatus,
  getAdminStudents,
  updateStudentStatus,
  getAdminCourses,
  updateCourseStatus,
  toggleFeaturedCourse,
} from "../controllers/adminController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT, authorizeRoles("admin"));

router.get("/stats", getAdminStats);
router.get("/teachers", getAdminTeachers);
router.patch("/teachers/:id/status", updateTeacherStatus);

router.get("/students", getAdminStudents);
router.patch("/students/:id/status", updateStudentStatus);

router.get("/courses", getAdminCourses);
router.patch("/courses/:id/status", updateCourseStatus);
router.patch("/courses/:id/feature", toggleFeaturedCourse);

export default router;
