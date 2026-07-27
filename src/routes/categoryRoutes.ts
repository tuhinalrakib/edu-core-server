import { Router } from "express";
import {
  getCategories,
  createCategory,
  deleteCategory,
  getTags,
  createTag,
  deleteTag,
} from "../controllers/categoryController";

const router = Router();

// Categories endpoints
router.get("/", getCategories);
router.post("/", createCategory);
router.delete("/:id", deleteCategory);

// Tags endpoints
router.get("/tags", getTags);
router.post("/tags", createTag);
router.delete("/tags/:id", deleteTag);

export default router;
