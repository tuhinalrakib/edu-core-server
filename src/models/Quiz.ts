import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion {
  _id?: mongoose.Types.ObjectId;
  type: "mcq" | "true_false" | "fill_blank";
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  correctTextAnswer?: string;
  explanation?: string;
}

export interface IQuiz extends Document {
  course: mongoose.Types.ObjectId;
  sectionId?: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passMarkPercentage: number;
  questions: IQuestion[];
}

export interface IQuizSubmission extends Document {
  quiz: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  answers: { questionId: string; selectedOption: number; textAnswer?: string }[];
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  submittedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  type: { type: String, enum: ["mcq", "true_false", "fill_blank"], default: "mcq" },
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswerIndex: { type: Number, default: 0 },
  correctTextAnswer: { type: String },
  explanation: { type: String, default: "" },
});

const QuizSchema = new Schema<IQuiz>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    sectionId: { type: String },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    timeLimitMinutes: { type: Number, default: 15 },
    passMarkPercentage: { type: Number, default: 70 },
    questions: [QuestionSchema],
  },
  { timestamps: true }
);

const QuizSubmissionSchema = new Schema<IQuizSubmission>(
  {
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [{ questionId: String, selectedOption: Number, textAnswer: String }],
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model<IQuiz>("Quiz", QuizSchema);
export const QuizSubmission = mongoose.model<IQuizSubmission>("QuizSubmission", QuizSubmissionSchema);
