import { Router } from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
  clearAllNotifications,
} from "../controllers/notificationController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/", getNotifications);
router.patch("/:id/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);
router.delete("/clear-all", clearAllNotifications);
router.delete("/clear-read", clearReadNotifications);
router.delete("/:id", deleteNotification);

export default router;
