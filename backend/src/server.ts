
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import prisma from "./config/prisma";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import datasetRoutes from "./routes/dataset.routes";
import supportRoutes from "./routes/support.routes";
import workspaceRoutes from "./routes/workspace.routes";

const app = express();

const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/support", supportRoutes);

// Home route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to DataPulse API",
    version: "1.0.0",
  });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DataPulse API is running",
    timestamp: new Date().toISOString(),
  });
});

// Database connection test
app.get("/api/db-check", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully through Prisma",
      database: "datapulse_db",
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`DataPulse API running on http://localhost:${PORT}`);
});
