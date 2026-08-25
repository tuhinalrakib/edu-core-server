import mongoose, { Schema, Document } from "mongoose";

export type LiveClassStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface ILiveClass extends Document {
  title: string;
  description: string;
  course: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  teacherName: string;
  teacherAvatar?: string;
  scheduledStartTime: Date;
  durationMinutes: number;
  roomName: string;
  meetingUrl: string;
  status: LiveClassStatus;
  enrolledStudentsNotified: boolean;
  liveNotified: boolean;
  attendees: {
    student: mongoose.Types.ObjectId;
    studentName?: string;
    studentEmail?: string;
    joinedAt: Date;
  }[];
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LiveClassSchema = new Schema<ILiveClass>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherName: { type: String, default: "Instructor" },
    teacherAvatar: { type: String, default: "" },
    scheduledStartTime: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    roomName: { type: String, required: true },
    meetingUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["scheduled", "live", "completed", "cancelled"],
      default: "scheduled",
    },
    enrolledStudentsNotified: { type: Boolean, default: false },
    liveNotified: { type: Boolean, default: false },
    attendees: [
      {
        student: { type: Schema.Types.ObjectId, ref: "User" },
        studentName: { type: String },
        studentEmail: { type: String },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    recordingUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export const LiveClass = mongoose.model<ILiveClass>("LiveClass", LiveClassSchema);
