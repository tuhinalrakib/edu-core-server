import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { Category } from "../models/Category";
import { Tag } from "../models/Tag";
import { getCache, setCache, invalidateCache } from "../utils/redis";

// Helper: Seed Default Categories if MongoDB table is empty
const defaultCategories = [
  { name: "Web Development", slug: "web-development", count: 42 },
  { name: "DevOps & Cloud", slug: "devops-cloud", count: 18 },
  { name: "UI/UX Design", slug: "ui-ux-design", count: 25 },
  { name: "Data Science & AI", slug: "data-science-ai", count: 31 },
];

// Helper: Seed Default Tags if MongoDB table is empty
const defaultTags = ["React", "Next.js", "TypeScript", "Docker", "Python", "Figma", "AWS", "GraphQL"];

// @desc    Get all categories (with Redis Caching)
// @route   GET /api/categories
// @access  Public
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "categories:all";

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  let categories = await Category.find().sort({ createdAt: -1 });
  if (categories.length === 0) {
    try {
      categories = await Category.insertMany(defaultCategories);
    } catch (e) {
      categories = defaultCategories as any;
    }
  }

  const responseData = { success: true, categories };

  // 3. Store in Redis Cache
  await setCache(cacheKey, responseData, 3600);

  res.json(responseData);
});

// @desc    Create new category (Invalidates Redis Cache)
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Category name is required.");
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  const existing = await Category.findOne({ $or: [{ name: name.trim() }, { slug }] });
  if (existing) {
    res.status(400);
    throw new Error("Category already exists.");
  }

  const category = await Category.create({
    name: name.trim(),
    slug,
    count: 0,
  });

  // Invalidate Redis list and category caches
  await invalidateCache("categories:all", `categories:id:${category._id}`);

  res.status(201).json({ success: true, message: "Category created successfully", category });
});

// @desc    Delete category (Invalidates Redis Cache)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await Category.findByIdAndDelete(id);

  // Invalidate Redis list and category caches
  await invalidateCache("categories:all", `categories:id:${id}`);

  res.json({ success: true, message: "Category deleted successfully", id });
});

// @desc    Get all tags (with Redis Caching)
// @route   GET /api/categories/tags
// @access  Public
export const getTags = asyncHandler(async (req: Request, res: Response) => {
  const cacheKey = "tags:all";

  // 1. Check Redis Cache first (Cache Hit)
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  // 2. Fetch from MongoDB on Cache Miss
  let tags = await Tag.find().sort({ createdAt: -1 });
  if (tags.length === 0) {
    try {
      const tagDocs = defaultTags.map((name) => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      }));
      tags = await Tag.insertMany(tagDocs);
    } catch (e) {
      tags = defaultTags.map((name, idx) => ({
        _id: "tag-" + idx,
        name,
        slug: name.toLowerCase(),
      })) as any;
    }
  }

  const responseData = { success: true, tags };

  // 3. Store in Redis Cache
  await setCache(cacheKey, responseData, 3600);

  res.json(responseData);
});

// @desc    Create new tag (Invalidates Redis Cache)
// @route   POST /api/categories/tags
// @access  Private/Admin
export const createTag = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Tag name is required.");
  }

  const cleanName = name.trim().replace(/^#/, "");
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const existing = await Tag.findOne({ $or: [{ name: cleanName }, { slug }] });
  if (existing) {
    res.status(400);
    throw new Error("Tag already exists.");
  }

  const tag = await Tag.create({
    name: cleanName,
    slug,
  });

  // Invalidate Redis list and tag caches
  await invalidateCache("tags:all", `tags:id:${tag._id}`);

  res.status(201).json({ success: true, message: "Tag created successfully", tag });
});

// @desc    Delete tag (Invalidates Redis Cache)
// @route   DELETE /api/categories/tags/:id
// @access  Private/Admin
export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await Tag.findByIdAndDelete(id);

  // Invalidate Redis list and tag caches
  await invalidateCache("tags:all", `tags:id:${id}`);

  res.json({ success: true, message: "Tag deleted successfully", id });
});
