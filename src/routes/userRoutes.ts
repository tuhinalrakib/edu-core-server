import { Router } from "express";
import {
  getAllUsers,
  getUserProfile,
  updateUserProfile,
  updateUserStatus,
  createTeacher,
  deleteUser,
} from "../controllers/userController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/", authorizeRoles("admin"), getAllUsers);
router.get("/profile", getUserProfile);
router.put("/profile", updateUserProfile);

// Admin operations
router.put("/:id/status", authorizeRoles("admin"), updateUserStatus);
router.post("/teacher", authorizeRoles("admin"), createTeacher);
router.delete("/:id", authorizeRoles("admin"), deleteUser);

export default router;
