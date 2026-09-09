import mongoose, { Schema, Document } from "mongoose";

export type EnrollmentStatus = "pending" | "approved" | "rejected";

export interface IEnrollment extends Document {
  student: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  status: EnrollmentStatus;
  enrolledAt: Date;
  approvedAt?: Date;
  adminActionBy?: mongoose.Types.ObjectId;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
    },
    adminActionBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    adminNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound index to quickly find a student's enrollment in a course
EnrollmentSchema.index({ student: 1, course: 1 });

export const Enrollment = mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);
