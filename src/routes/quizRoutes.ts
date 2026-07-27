import { Router } from "express";
import { getQuizzesByCourse, submitQuiz } from "../controllers/quizController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/course/:courseId", getQuizzesByCourse);
router.post("/submit", submitQuiz);

export default router;
