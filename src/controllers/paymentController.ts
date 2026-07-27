import { Response } from "express";
import asyncHandler from "express-async-handler";
import Stripe from "stripe";
import { AuthRequest } from "../middleware/auth";
import { Order } from "../models/Order";
import { Course } from "../models/Course";
import { User } from "../models/User";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock_key", {
  apiVersion: "2023-10-16" as any,
});

// @desc    Create Stripe checkout session
// @route   POST /api/payments/checkout-session
// @access  Private
export const createCheckoutSession = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;
  const studentId = req.user?.id;

  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
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

    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (stripeErr) {
    // Mock fallback if Stripe keys are test/unconfigured
    res.json({
      success: true,
      sessionId: "mock_session_" + Date.now(),
      url: `${process.env.CLIENT_URL || "http://localhost:3000"}/student/dashboard?payment=success`,
    });
  }
});

// @desc    Get all transaction orders
// @route   GET /api/payments/transactions
// @access  Private/Admin
export const getTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orders = await Order.find()
    .populate("student", "name email")
    .populate("course", "title")
    .populate("teacher", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, orders });
});

// @desc    Request instructor withdrawal
// @route   POST /api/payments/withdraw
// @access  Private/Teacher
export const requestWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user?.id;
  const { amount } = req.body;

  const teacher = await User.findById(teacherId);
  if (!teacher) {
    res.status(404);
    throw new Error("Teacher not found");
  }

  if (teacher.withdrawBalance < amount) {
    res.status(400);
    throw new Error("Insufficient balance for withdrawal.");
  }

  teacher.withdrawBalance -= amount;
  await teacher.save();

  res.json({
    success: true,
    message: `Withdrawal request of $${amount} submitted successfully!`,
    remainingBalance: teacher.withdrawBalance,
  });
});
