import mongoose, { Schema, Document } from "mongoose";

export type NotificationType =
  | "enrollment_pending"
  | "enrollment_approved"
  | "enrollment_rejected"
  | "course_pending"
  | "course_approved"
  | "live_class"
  | "system";

export type NotificationRecipientRole = "admin" | "teacher" | "student" | "all";

export interface INotification extends Document {
  recipient?: mongoose.Types.ObjectId;
  recipientRole?: NotificationRecipientRole;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  data?: any;
  isRead: boolean;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["admin", "teacher", "student", "all"],
      default: "all",
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: "system",
    },
    link: {
      type: String,
      default: "",
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
