import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Quiz, QuizSubmission } from "../models/Quiz";

// @desc    Get quizzes for a course
// @route   GET /api/quizzes/course/:courseId
// @access  Private
export const getQuizzesByCourse = asyncHandler(async (req: Request, res: Response) => {
  const quizzes = await Quiz.find({ course: req.params.courseId });
  res.json({ success: true, quizzes });
});

// @desc    Submit a quiz
// @route   POST /api/quizzes/submit
// @access  Private
export const submitQuiz = asyncHandler(async (req: any, res: Response) => {
  const { quizId, courseId, answers } = req.body;
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    res.status(404);
    throw new Error("Quiz not found");
  }

  // Enforce single attempt rule
  const existingSubmission = await QuizSubmission.findOne({
    quiz: quizId,
    student: req.user.id,
  });

  if (existingSubmission) {
    res.status(400);
    throw new Error("You have already completed this quiz. Retakes are strictly disabled.");
  }

  let correctCount = 0;
  quiz.questions.forEach((q) => {
    const studentAns = answers.find((a: any) => a.questionId === q._id?.toString());
    if (studentAns && studentAns.selectedOption === q.correctAnswerIndex) {
      correctCount += 1;
    }
  });

  const total = quiz.questions.length || 1;
  const percentage = Math.round((correctCount / total) * 100);
  const passed = percentage >= quiz.passMarkPercentage;

  const submission = await QuizSubmission.create({
    quiz: quizId,
    course: courseId,
    student: req.user.id,
    answers,
    score: correctCount,
    totalQuestions: total,
    percentage,
    passed,
  });

  res.json({ success: true, submission });
});

// @desc    Get logged in student's quiz submissions
// @route   GET /api/quizzes/my-submissions
// @access  Private/Student
export const getMyQuizSubmissions = asyncHandler(async (req: any, res: Response) => {
  const submissions = await QuizSubmission.find({ student: req.user.id }).populate("quiz course");
  res.json({ success: true, submissions });
});
