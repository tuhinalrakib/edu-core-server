import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import path from "path";

dotenv.config();

import mongoose from "mongoose";
import dns from "dns";

// Prefer IPv4 resolution order for Node.js DNS lookups
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  // fallback if not supported
}

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import courseRoutes from "./routes/courseRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import quizRoutes from "./routes/quizRoutes";
import assignmentRoutes from "./routes/assignmentRoutes";
import studentRoutes from "./routes/studentRoutes";
import teacherRoutes from "./routes/teacherRoutes";
import adminRoutes from "./routes/adminRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import liveClassRoutes from "./routes/liveClassRoutes";
import { httpLogger, logger } from "./utils/logger";
import "./utils/redis";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

if (!process.env.VERCEL) {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}


// Connect DB Helper with Serverless & Fallback DNS Support
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

// Ensure DB connection is attempted without blocking request execution
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (e) {
    // Non-blocking catch to prevent function invocation crash
  }
  next();
});

// Real-time Express HTTP Request/Response Logging
app.use(httpLogger);

// Root & Health Check Endpoints
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to EduCore LMS Backend API! 🚀",
    version: "1.0.0",
    api: "/api",
    healthCheck: "/health",
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "EduCore LMS REST API Root",
    endpoints: {
      auth: "/api/auth",
      courses: "/api/courses",
      categories: "/api/categories",
      quizzes: "/api/quizzes",
      assignments: "/api/assignments",
      student: "/api/student",
      teacher: "/api/teacher",
      admin: "/api/admin",
      payments: "/api/payments",
      dashboard: "/api/dashboard",
      upload: "/api/upload",
      liveClasses: "/api/live-classes",
      health: "/health",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date(), app: "EduCore LMS Backend API" });
});

// Complete API Route Mapping
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/live-classes", liveClassRoutes);

// 404 Fallback Handler for Unmatched Routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler Middleware (Catches errors passed by express-async-handler)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  logger.error(`[Error] ${req.method} ${req.originalUrl} - ${err.message}`);
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// Socket.io Real-time Notifications & WebRTC Live Streaming
io.on("connection", (socket) => {
  console.log("Client connected to Socket.io:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Register WebRTC signaling handlers
registerLiveSignalingHandlers(io);

export { io };

const PORT = process.env.PORT || 5000;

// Only listen to port when running standalone (not on Vercel Serverless)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    server.listen(PORT, () => {
      logger.info(`EduCore Server running on port ${PORT} (http://localhost:${PORT})`);
    });
  });
}

export default app;
