import mongoose, { Schema, Document } from "mongoose";

export interface IAssignment extends Document {
  course: mongoose.Types.ObjectId;
  title: string;
  description: string;
  deadline: Date;
  maxMarks: number;
  rubric: string;
  allowedFileTypes: string[];
}

export interface IAssignmentSubmission extends Document {
  assignment?: mongoose.Types.ObjectId | string;
  assignmentTitle?: string;
  course?: mongoose.Types.ObjectId | string;
  courseTitle?: string;
  student?: mongoose.Types.ObjectId | string;
  studentName?: string;
  studentEmail?: string;
  studentAvatar?: string;
  fileUrl: string;
  fileType?: string;
  notes: string;
  grade?: number;
  feedback?: string;
  status: "pending" | "graded" | "returned";
  submittedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    deadline: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
    rubric: { type: String, default: "" },
    allowedFileTypes: [{ type: String, default: ["pdf", "zip", "docx", "link"] }],
  },
  { timestamps: true }
);

const AssignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    assignment: { type: Schema.Types.Mixed, ref: "Assignment" },
    assignmentTitle: { type: String, default: "Assignment Project" },
    course: { type: Schema.Types.Mixed, ref: "Course" },
    courseTitle: { type: String, default: "Enrolled Course" },
    student: { type: Schema.Types.Mixed, ref: "User" },
    studentName: { type: String, default: "Student" },
    studentEmail: { type: String, default: "" },
    studentAvatar: { type: String, default: "" },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: "ZIP Archive" },
    notes: { type: String, default: "" },
    grade: { type: Number },
    feedback: { type: String, default: "" },
    status: { type: String, enum: ["pending", "graded", "returned"], default: "pending" },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Assignment = mongoose.model<IAssignment>("Assignment", AssignmentSchema);
export const AssignmentSubmission = mongoose.model<IAssignmentSubmission>("AssignmentSubmission", AssignmentSubmissionSchema);
