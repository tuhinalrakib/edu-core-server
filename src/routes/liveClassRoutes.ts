import { Router } from "express";
import {
  createLiveClass,
  getMyLiveClasses,
  getLiveClassesByCourse,
  getLiveClassById,
  updateLiveClassStatus,
  joinLiveClass,
  deleteLiveClass,
} from "../controllers/liveClassController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/course/:courseId", getLiveClassesByCourse);
router.get("/session/:id", getLiveClassById);
router.get("/find/:id", getLiveClassById);

// Protected routes
router.use(authenticateJWT);

router.get("/my/classes", getMyLiveClasses);
router.post("/", authorizeRoles("teacher", "admin"), createLiveClass);
router.put("/:id/status", authorizeRoles("teacher", "admin"), updateLiveClassStatus);
router.post("/:id/join", joinLiveClass);
router.delete("/:id", authorizeRoles("teacher", "admin"), deleteLiveClass);
router.get("/:id", getLiveClassById);

export default router;


