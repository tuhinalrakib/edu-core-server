import { Router } from "express";
import { getAllCourses, getCourseByIdentifier } from "../controllers/courseController";

const router = Router();

router.get("/", getAllCourses);
router.get("/:identifier", getCourseByIdentifier);

export default router;
