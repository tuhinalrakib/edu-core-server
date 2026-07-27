import { Router } from "express";
import {
  getAdminStats,
  getAdminTeachers,
  getAdminStudents,
  getAdminCourses,
} from "../controllers/adminController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT, authorizeRoles("admin"));

router.get("/stats", getAdminStats);
router.get("/teachers", getAdminTeachers);
router.get("/students", getAdminStudents);
router.get("/courses", getAdminCourses);

export default router;
