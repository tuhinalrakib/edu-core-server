import { Router } from "express";
import {
  getAssignmentsByCourse,
  submitAssignment,
  gradeAssignment,
  getMyAssignmentSubmissions,
} from "../controllers/assignmentController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/my-submissions", getMyAssignmentSubmissions);
router.get("/course/:courseId", getAssignmentsByCourse);
router.post("/submit", submitAssignment);
router.post("/grade", authorizeRoles("teacher", "admin"), gradeAssignment);

export default router;
