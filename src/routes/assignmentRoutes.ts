import { Router } from "express";
import { Assignment, AssignmentSubmission } from "../models/Assignment";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/course/:courseId", async (req, res) => {
  const assignments = await Assignment.find({ course: req.params.courseId });
  return res.json({ success: true, assignments });
});

router.post("/submit", async (req: any, res) => {
  const { assignmentId, courseId, fileUrl, notes } = req.body;
  const submission = await AssignmentSubmission.create({
    assignment: assignmentId,
    course: courseId,
    student: req.user.id,
    fileUrl,
    notes: notes || "",
  });
  return res.status(201).json({ success: true, submission });
});

router.post("/grade", authorizeRoles("teacher", "admin"), async (req, res) => {
  const { submissionId, grade, feedback } = req.body;
  const submission = await AssignmentSubmission.findByIdAndUpdate(
    submissionId,
    { grade, feedback, status: "graded" },
    { new: true }
  );
  return res.json({ success: true, submission });
});

export default router;
