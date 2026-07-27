import { Router } from "express";
import { upload, uploadToCloudinary } from "../utils/cloudinary";
import asyncHandler from "../utils/asyncHandler";

const router = Router();

// POST /api/upload - Upload single file to Cloudinary
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please attach a file under the 'file' key.",
      });
    }

    const folder = req.body.folder || "educore";
    const url = await uploadToCloudinary(req.file.path, folder);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully to Cloudinary!",
      url,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  })
);

export default router;
