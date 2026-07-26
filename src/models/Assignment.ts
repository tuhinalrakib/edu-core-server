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
  assignment: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  fileUrl: string;
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
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
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
