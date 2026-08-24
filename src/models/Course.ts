import mongoose, { Schema, Document } from "mongoose";

export type LessonType = "video" | "pdf" | "audio" | "attachment";
export type VideoProvider = "cloudinary" | "youtube" | "gdrive" | "googledrive" | "vimeo" | "mp4";
export type CourseStatus = "draft" | "pending" | "approved" | "rejected" | "archived";

export interface ILesson {
  _id?: mongoose.Types.ObjectId;
  title: string;
  type: LessonType;
  videoProvider?: VideoProvider;
  contentUrl: string;
  durationMinutes?: number;
  description: string;
  isFreePreview: boolean;
  unlockAt?: string;
  resources?: { title: string; fileUrl: string }[];
}

export interface ISection {
  _id?: mongoose.Types.ObjectId;
  title: string;
  lessons: ILesson[];
}

export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  level: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  language: string;
  price: number;
  discountPrice?: number;
  teacher: any;
  thumbnail: string;
  previewVideo?: string;
  status: CourseStatus;
  isFeatured: boolean;
  sections: ISection[];
  totalLessons: number;
  totalDurationMinutes: number;
  averageRating: number;
  totalReviews: number;
  totalStudents: number;
  requirements: string[];
  learningOutcomes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<any>(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ["video", "pdf", "audio", "attachment", "quiz", "assignment"],
      default: "video",
    },
    videoProvider: {
      type: String,
      enum: ["cloudinary", "youtube", "gdrive", "googledrive", "vimeo", "mp4"],
      default: "youtube",
    },
    contentUrl: { type: String, default: "" },
    durationMinutes: { type: Number, default: 0 },
    description: { type: String, default: "" },
    isFreePreview: { type: Boolean, default: false },
    unlockAt: { type: String, default: "" },
    resources: [Schema.Types.Mixed],
    quiz: { type: Schema.Types.Mixed },
    quizParams: { type: Schema.Types.Mixed },
    assignment: { type: Schema.Types.Mixed },
    assignmentParams: { type: Schema.Types.Mixed },
  },
  { strict: false, _id: true }
);

const SectionSchema = new Schema<any>(
  {
    title: { type: String, required: true },
    lessons: [LessonSchema],
  },
  { strict: false, _id: true }
);

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    category: { type: String, required: true, default: "Web Development" },
    tags: [{ type: String }],
    level: { type: String, default: "All Levels" },
    language: { type: String, default: "English" },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number },
    teacher: { type: Schema.Types.Mixed, ref: "User", required: false },
    thumbnail: { type: String, default: "" },
    previewVideo: { type: String, default: "" },
    status: { type: String, default: "pending" },
    isFeatured: { type: Boolean, default: false },
    sections: [SectionSchema],
    totalLessons: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
    averageRating: { type: Number, default: 4.8 },
    totalReviews: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    requirements: [{ type: String }],
    learningOutcomes: [{ type: String }],
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
