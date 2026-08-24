import { Router } from "express";
import { getQuizzesByCourse, submitQuiz, getMyQuizSubmissions } from "../controllers/quizController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/my-submissions", getMyQuizSubmissions);
router.get("/course/:courseId", getQuizzesByCourse);
router.post("/submit", submitQuiz);

export default router;
