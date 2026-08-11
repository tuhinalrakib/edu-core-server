import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import path from "path";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dxkmkskvy",
  api_key: process.env.CLOUDINARY_API_KEY || "683616221747714",
  api_secret: process.env.CLOUDINARY_API_SECRET || "VX8OFXnLhD1a5H2y90JSW9Qo61g",
});

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max limit
});

export const uploadToCloudinary = async (filePath: string, folder = "educore") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto",
      timeout: 60000,
    });

    // Remove local file after successful upload to Cloudinary
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return result.secure_url;
  } catch (error: any) {
    const errObj = error?.error || error;
    const errMsg = errObj?.message || error?.message || (typeof error === "string" ? error : "Cloudinary request timeout or connection failed");
    console.error("Cloudinary upload error:", errMsg);

    // Fallback: If Cloudinary fails (e.g. timeout / network block), serve uploaded file locally from /uploads
    if (fs.existsSync(filePath)) {
      const fileName = path.basename(filePath);
      const port = process.env.PORT || 5000;
      const localUrl = `http://localhost:${port}/uploads/${fileName}`;
      console.warn(`[Upload Fallback] Cloudinary failed/timed out. Serving file locally: ${localUrl}`);
      return localUrl;
    }

    throw new Error(errMsg);
  }
};

export { cloudinary };

