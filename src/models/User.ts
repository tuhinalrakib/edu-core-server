import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "admin" | "teacher" | "student";
export type TeacherStatus = "pending" | "approved" | "rejected" | "suspended";
export type StudentStatus = "active" | "suspended";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  title?: string;
  phone?: string;
  isEmailVerified: boolean;
  teacherStatus?: TeacherStatus;
  studentStatus?: StudentStatus;
  earnings: number;
  withdrawBalance: number;
  enrolledCourses: mongoose.Types.ObjectId[];
  wishlist: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], default: "student" },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    title: { type: String, default: "" },
    phone: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: true },
    teacherStatus: { type: String, enum: ["pending", "approved", "rejected", "suspended"], default: "approved" },
    studentStatus: { type: String, enum: ["active", "suspended"], default: "active" },
    earnings: { type: Number, default: 0 },
    withdrawBalance: { type: Number, default: 0 },
    enrolledCourses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
