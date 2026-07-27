import { Request, Response } from "express";
import { User } from "../models/User";
import { Course } from "../models/Course";

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalCourses = await Course.countDocuments();
    return res.json({
      success: true,
      stats: { totalStudents, totalTeachers, totalCourses, totalRevenue: 38450, adminCommission: 7690 },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminTeachers = async (req: Request, res: Response) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-passwordHash");
    return res.json({ success: true, teachers });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminStudents = async (req: Request, res: Response) => {
  try {
    const students = await User.find({ role: "student" }).select("-passwordHash");
    return res.json({ success: true, students });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminCourses = async (req: Request, res: Response) => {
  try {
    const courses = await Course.find().populate("teacher", "name email");
    return res.json({ success: true, courses });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
