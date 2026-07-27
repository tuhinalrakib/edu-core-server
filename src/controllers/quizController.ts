import { Request, Response } from "express";
import { Quiz, QuizSubmission } from "../models/Quiz";

export const getQuizzesByCourse = async (req: Request, res: Response) => {
  try {
    const quizzes = await Quiz.find({ course: req.params.courseId });
    return res.json({ success: true, quizzes });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const submitQuiz = async (req: any, res: Response) => {
  try {
    const { quizId, courseId, answers } = req.body;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: "Quiz not found" });

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

    return res.json({ success: true, submission });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
