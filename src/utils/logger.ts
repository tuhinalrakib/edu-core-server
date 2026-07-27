import winston from "winston";
import { Request, Response, NextFunction } from "express";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom Log Format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] [${level}]: ${stack || message}`;
});

// Create Winston Logger Instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "HH:mm:ss" }),
        printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)
      ),
    }),
  ],
});

// Express Real-time HTTP Request/Response Logger Middleware
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    let statusSymbol = "ℹ️";
    if (statusCode >= 200 && statusCode < 300) statusSymbol = "✅";
    else if (statusCode >= 300 && statusCode < 400) statusSymbol = "🔄";
    else if (statusCode >= 400 && statusCode < 500) statusSymbol = "⚠️";
    else if (statusCode >= 500) statusSymbol = "❌";

    const logMessage = `${statusSymbol} ${method} ${originalUrl} -> ${statusCode} (${responseTime}ms) - IP: ${ip || "127.0.0.1"}`;

    if (statusCode >= 500) {
      logger.error(logMessage);
    } else if (statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }
  });

  next();
};
