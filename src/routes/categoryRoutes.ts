import { Router } from "express";

const router = Router();

const CATEGORIES = [
  { id: "1", name: "Programming", slug: "programming", count: 140 },
  { id: "2", name: "Design", slug: "design", count: 95 },
  { id: "3", name: "Marketing", slug: "marketing", count: 75 },
  { id: "4", name: "Business", slug: "business", count: 110 },
  { id: "5", name: "AI", slug: "ai", count: 80 },
  { id: "6", name: "Data Science", slug: "data-science", count: 65 },
  { id: "7", name: "Cyber Security", slug: "cyber-security", count: 50 },
  { id: "8", name: "Photography", slug: "photography", count: 40 },
];

router.get("/", (req, res) => {
  return res.json({ success: true, categories: CATEGORIES });
});

export default router;
