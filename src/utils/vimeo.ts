import fs from "fs";

let VimeoClient: any = null;
try {
  // Safely attempt to load vimeo SDK if installed
  const vimeoModule = require("vimeo");
  VimeoClient = vimeoModule.Vimeo || vimeoModule;
} catch (e) {
  VimeoClient = null;
}

const clientId = process.env.VIMEO_CLIENT_ID || "";
const clientSecret = process.env.VIMEO_CLIENT_SECRET || "";
const accessToken = process.env.VIMEO_ACCESS_TOKEN || "";

let vimeoInstance: any = null;

if (VimeoClient && clientId && clientSecret && accessToken) {
  try {
    vimeoInstance = new VimeoClient(clientId, clientSecret, accessToken);
  } catch (err) {
    vimeoInstance = null;
  }
}

export const uploadToVimeo = async (filePath: string, videoName = "EduCore Lesson Video"): Promise<string> => {
  if (!vimeoInstance) {
    // Cleanup temporary local file
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }
    throw new Error(
      "Vimeo package or API credentials (VIMEO_CLIENT_ID, VIMEO_CLIENT_SECRET, VIMEO_ACCESS_TOKEN) are missing in server."
    );
  }

  return new Promise((resolve, reject) => {
    vimeoInstance.upload(
      filePath,
      {
        name: videoName,
        description: "Uploaded via EduCore LMS Teacher Dashboard",
        privacy: { view: "anybody" },
      },
      (uri: string) => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }
        const videoId = uri.split("/").pop();
        const vimeoUrl = `https://vimeo.com/${videoId}`;
        resolve(vimeoUrl);
      },
      (bytesUploaded: number, bytesTotal: number) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(`Vimeo Uploading: ${percentage}%`);
      },
      (error: any) => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {}
        }
        console.error("Vimeo upload error:", error);
        reject(new Error(error?.message || "Failed to upload video to Vimeo."));
      }
    );
  });
};
