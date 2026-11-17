
import { Response } from "express";
import {
  S3Client,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

type ServiceStatus = "ONLINE" | "OFFLINE";

interface HealthService {
  status: ServiceStatus;
  message: string;
  responseTimeMs: number;
}

const checkDatabase = async (): Promise<HealthService> => {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ONLINE",
      message: "PostgreSQL connection successful",
      responseTimeMs: Date.now() - start,
    };
  } catch {
    return {
      status: "OFFLINE",
      message: "PostgreSQL connection failed",
      responseTimeMs: Date.now() - start,
    };
  }
};

const checkMlService = async (): Promise<HealthService> => {
  const start = Date.now();

  const baseUrl = (
    process.env.ML_SERVICE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    return {
      status: response.ok ? "ONLINE" : "OFFLINE",
      message: response.ok
        ? "Python ML service is responding"
        : `ML service returned HTTP ${response.status}`,
      responseTimeMs: Date.now() - start,
    };
  } catch {
    return {
      status: "OFFLINE",
      message: "Python ML service is unavailable",
      responseTimeMs: Date.now() - start,
    };
  }
};

const checkS3 = async (): Promise<HealthService> => {
  const start = Date.now();

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;

  if (!bucket || !region) {
    return {
      status: "OFFLINE",
      message: "AWS S3 configuration is missing",
      responseTimeMs: Date.now() - start,
    };
  }

  const client = new S3Client({
    region,
    maxAttempts: 1,
    requestHandler: undefined,
  });

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: bucket,
      }),
      {
        abortSignal: AbortSignal.timeout(5000),
      }
    );

    return {
      status: "ONLINE",
      message: "AWS S3 bucket is accessible",
      responseTimeMs: Date.now() - start,
    };
  } catch {
    return {
      status: "OFFLINE",
      message: "AWS S3 bucket connectivity check failed",
      responseTimeMs: Date.now() - start,
    };
  } finally {
    client.destroy();
  }
};

// ------------------------------------------
// GET ADMIN SYSTEM HEALTH
// ------------------------------------------

export const getAdminSystemHealth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const [database, mlService, s3] = await Promise.all([
      checkDatabase(),
      checkMlService(),
      checkS3(),
    ]);

    const services = {
      backend: {
        status: "ONLINE" as ServiceStatus,
        message: "Express API is running",
        responseTimeMs: 0,
      },
      database,
      mlService,
      s3,
    };

    const serviceValues = Object.values(services);

    const onlineServices = serviceValues.filter(
      (service) => service.status === "ONLINE"
    ).length;

    res.status(200).json({
      success: true,
      message: "System health retrieved successfully",
      overallStatus:
        onlineServices === serviceValues.length
          ? "HEALTHY"
          : "DEGRADED",
      totalServices: serviceValues.length,
      onlineServices,
      offlineServices: serviceValues.length - onlineServices,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services,
    });
  } catch (error) {
    console.error("Admin system health error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve system health",
    });
  }
};
