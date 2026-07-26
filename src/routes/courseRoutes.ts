import { Router } from "express";
import { Course } from "../models/Course";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { category, level, price, search } = req.query;
    const filter: any = { status: "approved" };

    if (category) filter.category = category;
    if (level) filter.level = level;
    if (price === "free") filter.price = 0;
    if (price === "paid") filter.price = { $gt: 0 };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const courses = await Course.find(filter).populate("teacher", "name avatar title");
    return res.json({ success: true, count: courses.length, courses });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    let course = await Course.findOne({ slug: identifier }).populate("teacher", "name avatar bio title");
    if (!course) {
      course = await Course.findById(identifier).populate("teacher", "name avatar bio title");
    }

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    return res.json({ success: true, course });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
