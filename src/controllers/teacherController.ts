import { Request, Response } from "express";
import { Course } from "../models/Course";
import { User } from "../models/User";

export const getTeacherStats = async (req: any, res: Response) => {
  try {
    const courses = await Course.find({ teacher: req.user.id });
    const user = await User.findById(req.user.id);
    return res.json({
      success: true,
      stats: {
        totalCourses: courses.length,
        totalStudents: courses.reduce((sum, c) => sum + c.totalStudents, 0),
        revenue: user?.earnings || 4520,
        averageRating: 4.8,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTeacherCourses = async (req: any, res: Response) => {
  try {
    const courses = await Course.find({ teacher: req.user.id });
    return res.json({ success: true, courses });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTeacherCourse = async (req: any, res: Response) => {
  try {
    const { title, description, category, level, price, thumbnail, sections } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);

    const course = await Course.create({
      title,
      slug,
      description,
      category: category || "Programming",
      level: level || "All Levels",
      price: price || 0,
      teacher: req.user.id,
      thumbnail: thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
      sections: sections || [],
      status: "approved",
    });

    return res.status(201).json({ success: true, message: "Course created successfully!", course });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
