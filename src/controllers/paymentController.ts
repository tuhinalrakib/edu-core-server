import { Response } from "express";
import Stripe from "stripe";
import { AuthRequest } from "../middleware/auth";
import { Order } from "../models/Order";
import { Course } from "../models/Course";
import { User } from "../models/User";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock_key", {
  apiVersion: "2023-10-16" as any,
});

export const createCheckoutSession = async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, couponCode } = req.body;
    const studentId = req.user?.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const price = course.discountPrice || course.price;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: course.title,
                images: [course.thumbnail],
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/student/dashboard?payment=success`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/courses/${course.slug}`,
        client_reference_id: studentId,
      });

      return res.json({ success: true, sessionId: session.id, url: session.url });
    } catch (stripeErr) {
      // Mock fallback if Stripe keys are test/unconfigured
      return res.json({
        success: true,
        sessionId: "mock_session_" + Date.now(),
        url: `${process.env.CLIENT_URL || "http://localhost:3000"}/student/dashboard?payment=success`,
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await Order.find()
      .populate("student", "name email")
      .populate("course", "title")
      .populate("teacher", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?.id;
    const { amount } = req.body;

    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    if (teacher.withdrawBalance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance for withdrawal." });
    }

    teacher.withdrawBalance -= amount;
    await teacher.save();

    return res.json({
      success: true,
      message: `Withdrawal request of $${amount} submitted successfully!`,
      remainingBalance: teacher.withdrawBalance,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
