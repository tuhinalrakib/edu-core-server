import { Router } from "express";
import { createCheckoutSession, getTransactions, requestWithdrawal } from "../controllers/paymentController";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);
router.post("/checkout-session", createCheckoutSession);
router.get("/transactions", authorizeRoles("admin"), getTransactions);
router.post("/withdraw", authorizeRoles("teacher"), requestWithdrawal);

export default router;
