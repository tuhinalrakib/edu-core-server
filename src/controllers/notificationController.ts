import { Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { Notification } from "../models/Notification";
import { io } from "../server";

/**
 * Helper to emit real-time socket events for notifications
 */
export async function sendDbNotification({
  recipient,
  recipientRole = "all",
  title,
  message,
  type = "system",
  link = "",
  data = {},
}: {
  recipient?: any;
  recipientRole?: "admin" | "teacher" | "student" | "all";
  title: string;
  message: string;
  type?: string;
  link?: string;
  data?: any;
}) {
  try {
    const notif = await Notification.create({
      recipient: recipient && mongoose.Types.ObjectId.isValid(String(recipient)) ? recipient : undefined,
      recipientRole,
      title,
      message,
      type,
      link,
      data,
    });

    if (io) {
      if (recipient) {
        io.to(String(recipient)).emit("new_notification", notif);
      }
      if (recipientRole === "admin") {
        io.to("admin_room").emit("new_notification", notif);
      }
      io.emit("broadcast_notification", notif);
    }

    return notif;
  } catch (err) {
    console.error("Failed to persist notification:", err);
    return null;
  }
}

// @desc    Get user notifications from DB
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    res.status(401);
    throw new Error("Unauthorized");
  }

  const queryConditions: any[] = [];

  if (mongoose.Types.ObjectId.isValid(userId)) {
    queryConditions.push({ recipient: new mongoose.Types.ObjectId(userId) });
  }

  if (userRole === "admin") {
    queryConditions.push({ recipientRole: "admin" });
  } else if (userRole === "teacher") {
    queryConditions.push({ recipientRole: "teacher" });
  } else if (userRole === "student") {
    queryConditions.push({ recipientRole: "student" });
  }

  queryConditions.push({ recipientRole: "all" });

  const { includeRead } = req.query;

  const notifications = await Notification.find({ $or: queryConditions })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;

  const processed = notifications
    .map((n: any) => {
      const isMarkedRead =
        n.isRead ||
        (userObjectId && Array.isArray(n.readBy) && n.readBy.some((id: any) => id.toString() === userId));
      return {
        ...n,
        isRead: Boolean(isMarkedRead),
      };
    })
    // Filter out seen / read notifications by default unless includeRead === "true"
    .filter((n: any) => (includeRead === "true" ? true : !n.isRead));

  res.json({
    success: true,
    notifications: processed,
    unreadCount: processed.length,
  });
});

// @desc    Mark single notification as read (and delete/archive seen notification)
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markNotificationRead = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid notification ID");
  }

  const notif = await Notification.findById(id);
  if (!notif) {
    res.status(404);
    throw new Error("Notification not found");
  }

  notif.isRead = true;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    if (!notif.readBy) notif.readBy = [];
    if (!notif.readBy.some((rid) => rid.toString() === userId)) {
      notif.readBy.push(new mongoose.Types.ObjectId(userId));
    }
  }

  await notif.save();
  res.json({ success: true, message: "Notification marked as read", notification: notif });
});

// @desc    Mark all notifications as read for current user
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllNotificationsRead = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const queryConditions: any[] = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    queryConditions.push({ recipient: new mongoose.Types.ObjectId(userId) });
  }
  if (userRole === "admin") {
    queryConditions.push({ recipientRole: "admin" });
  } else if (userRole === "teacher") {
    queryConditions.push({ recipientRole: "teacher" });
  } else if (userRole === "student") {
    queryConditions.push({ recipientRole: "student" });
  }
  queryConditions.push({ recipientRole: "all" });

  await Notification.updateMany(
    { $or: queryConditions },
    { $set: { isRead: true } }
  );

  res.json({ success: true, message: "All notifications marked as read" });
});

// @desc    Delete single notification from database
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid notification ID");
  }

  const notif = await Notification.findById(id);
  if (!notif) {
    res.status(404);
    throw new Error("Notification not found");
  }

  await Notification.findByIdAndDelete(id);
  res.json({ success: true, message: "Notification deleted successfully" });
});

// @desc    Delete all read / seen notifications for current user
// @route   DELETE /api/notifications/clear-read
// @access  Private
export const clearReadNotifications = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const queryConditions: any[] = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    queryConditions.push({ recipient: new mongoose.Types.ObjectId(userId) });
  }
  if (userRole === "admin") {
    queryConditions.push({ recipientRole: "admin" });
  } else if (userRole === "teacher") {
    queryConditions.push({ recipientRole: "teacher" });
  } else if (userRole === "student") {
    queryConditions.push({ recipientRole: "student" });
  }
  queryConditions.push({ recipientRole: "all" });

  const deleteFilter: any = {
    $and: [
      { $or: queryConditions },
      {
        $or: [
          { isRead: true },
          ...(userId && mongoose.Types.ObjectId.isValid(userId) ? [{ readBy: new mongoose.Types.ObjectId(userId) }] : [])
        ]
      }
    ]
  };

  const result = await Notification.deleteMany(deleteFilter);
  res.json({ success: true, message: "Seen notifications deleted", deletedCount: result.deletedCount });
});

// @desc    Clear / Delete all notifications for current user
// @route   DELETE /api/notifications/clear-all
// @access  Private
export const clearAllNotifications = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const queryConditions: any[] = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    queryConditions.push({ recipient: new mongoose.Types.ObjectId(userId) });
  }
  if (userRole === "admin") {
    queryConditions.push({ recipientRole: "admin" });
  } else if (userRole === "teacher") {
    queryConditions.push({ recipientRole: "teacher" });
  } else if (userRole === "student") {
    queryConditions.push({ recipientRole: "student" });
  }
  queryConditions.push({ recipientRole: "all" });

  const result = await Notification.deleteMany({ $or: queryConditions });
  res.json({ success: true, message: "All notifications cleared", deletedCount: result.deletedCount });
});
