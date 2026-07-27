import { Router } from "express";
import { getAllUsers, getUserProfile } from "../controllers/userController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/", authorizeRoles("admin"), getAllUsers);
router.get("/profile", getUserProfile);

export default router;
