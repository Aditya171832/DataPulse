
import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// --------------------------------------------------
// ADMIN: GET ALL DATASETS
// --------------------------------------------------

export const getAdminDatasets = async (
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

    const datasets = await prisma.dataset.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const totalStorageBytes = datasets.reduce(
      (total, dataset) => total + dataset.fileSize,
      0
    );

    const processedStatuses = [
      "CLEANED",
      "ETL_COMPLETED",
      "SPARK_COMPLETED",
    ];

    const processedDatasets = datasets.filter((dataset) =>
      processedStatuses.includes(dataset.status)
    ).length;

    res.status(200).json({
      success: true,
      message: "Datasets retrieved successfully",
      totalDatasets: datasets.length,
      totalStorageBytes,
      processedDatasets,
      datasets: datasets.map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        originalName: dataset.originalName,
        fileType: dataset.fileType,
        fileSize: dataset.fileSize,
        status: dataset.status,
        owner: dataset.user,
        workspace: dataset.workspace,
        createdAt: dataset.createdAt,
        updatedAt: dataset.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Admin get datasets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve datasets",
    });
  }
};
