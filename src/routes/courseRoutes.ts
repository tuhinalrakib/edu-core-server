import { Router } from "express";
import {
  getAllCourses,
  getCourseByIdentifier,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse,
} from "../controllers/courseController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.get("/", getAllCourses);
router.get("/:identifier", getCourseByIdentifier);
router.post("/", createCourse);
router.put("/:id", updateCourse);
router.put("/:id/status", authenticateJWT, authorizeRoles("admin"), updateCourseStatus);
router.delete("/:id", deleteCourse);

export default router;
