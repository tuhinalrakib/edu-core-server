import mongoose from "mongoose";
import dns from "dns";
import { logger } from "../utils/logger";

// Prefer IPv4 resolution order for Node.js DNS lookups
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  // fallback if not supported
}

let isConnected = false;

export const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }
  const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb+srv://edu_core:ZjgKFszUg5jYPJJh@cluster0.mr0uen8.mongodb.net/edu_core?appName=Cluster0";

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    logger.info("Connected to MongoDB database successfully.");
  } catch (err: any) {
    if (err.message && (err.message.includes("querySrv") || err.message.includes("ECONNREFUSED"))) {
      try {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        logger.info("Connected to MongoDB database successfully via fallback DNS.");
      } catch (retryErr: any) {
        logger.warn(`MongoDB connection fallback failed: ${retryErr.message}`);
      }
    } else {
      logger.warn(`MongoDB connection failed: ${err.message}`);
    }
  }
};

export default connectDB;
