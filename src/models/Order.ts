import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  orderId: string;
  student: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  amount: number;
  discountAmount: number;
  adminCommission: number;
  teacherEarning: number;
  paymentMethod: string;
  paymentStatus: "completed" | "pending" | "refunded";
  stripePaymentIntentId?: string;
  couponCode?: string;
  createdAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    adminCommission: { type: Number, required: true },
    teacherEarning: { type: Number, required: true },
    paymentMethod: { type: String, default: "stripe" },
    paymentStatus: { type: String, enum: ["completed", "pending", "refunded"], default: "completed" },
    stripePaymentIntentId: { type: String, default: "" },
    couponCode: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
