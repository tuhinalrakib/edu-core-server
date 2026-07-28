import { Router } from "express";
import { upload, uploadToCloudinary } from "../utils/cloudinary";
import { uploadToVimeo } from "../utils/vimeo";
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

    const provider = req.body.provider;
    if (provider === "vimeo") {
      const url = await uploadToVimeo(req.file.path, req.body.title || req.file.originalname);
      return res.status(200).json({
        success: true,
        message: "File uploaded successfully to Vimeo!",
        url,
        provider: "vimeo",
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    }

    const folder = req.body.folder || "educore";
    const url = await uploadToCloudinary(req.file.path, folder);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully to Cloudinary!",
      url,
      provider: "cloudinary",
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  })
);

// POST /api/upload/vimeo - Direct endpoint for Vimeo uploads
router.post(
  "/vimeo",
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please attach a file under the 'file' key.",
      });
    }

    const url = await uploadToVimeo(req.file.path, req.body.title || req.file.originalname);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully to Vimeo!",
      url,
      provider: "vimeo",
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  })
);

export default router;
