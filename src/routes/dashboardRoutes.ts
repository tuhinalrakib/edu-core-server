import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboardController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/summary", getDashboardSummary);

export default router;
