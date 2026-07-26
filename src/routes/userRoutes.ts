import { Router } from "express";
import { User } from "../models/User";
import { authenticateJWT, authorizeRoles } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT);

router.get("/", authorizeRoles("admin"), async (req, res) => {
  const users = await User.find().select("-passwordHash");
  return res.json({ success: true, users });
});

router.get("/profile", async (req: any, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  return res.json({ success: true, user });
});

export default router;
