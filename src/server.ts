import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import path from "path";

dotenv.config();

import { connectDB } from "./config/db";

import indexRoutes from "./routes/index";
import { registerLiveSignalingHandlers } from "./sockets/liveSignaling";
import { httpLogger, logger } from "./utils/logger";
import "./utils/redis";

const app = express();
const server = http.createServer(app);

let io: any = {
  on: () => {},
  to: () => ({ emit: () => {} }),
  in: () => ({ emit: () => {} }),
  emit: () => {},
};

app.use(cors());
app.use(express.json());

if (!process.env.VERCEL) {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}


export { connectDB };

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
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to EduCore LMS Backend API! 🚀",
    version: "1.0.0",
    api: "/api",
    healthCheck: "/health",
  });
});

// API Root Endpoint with Available Routes
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

// Health Check Endpoint for Monitoring & Load Balancers
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date(), app: "EduCore LMS Backend API" });
});

// Complete API Route Mapping
app.use("/api", indexRoutes);

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

// Socket.io Real-time Notifications & WebRTC Live Streaming (Only in Standalone Server mode)
if (!process.env.VERCEL) {
  const socketIo = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  socketIo.on("connection", (socket) => {
    console.log("Client connected to Socket.io:", socket.id);

    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined room`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  registerLiveSignalingHandlers(socketIo);
  io = socketIo;
}

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
