import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import courseRoutes from "./courseRoutes";
import categoryRoutes from "./categoryRoutes";
import quizRoutes from "./quizRoutes";
import assignmentRoutes from "./assignmentRoutes";
import studentRoutes from "./studentRoutes";
import teacherRoutes from "./teacherRoutes";
import adminRoutes from "./adminRoutes";
import paymentRoutes from "./paymentRoutes";
import dashboardRoutes from "./dashboardRoutes";
import uploadRoutes from "./uploadRoutes";
import liveClassRoutes from "./liveClassRoutes";
import notificationRoutes from "./notificationRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/courses", courseRoutes);
router.use("/categories", categoryRoutes);
router.use("/quizzes", quizRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/student", studentRoutes);
router.use("/teacher", teacherRoutes);
router.use("/admin", adminRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/upload", uploadRoutes);
router.use("/live-classes", liveClassRoutes);
router.use("/notifications", notificationRoutes);


export default router;