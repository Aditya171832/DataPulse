
import { Response } from "express";

import prisma from "../config/prisma";
import { readDatasetBuffer } from "../config/s3";
import { AuthRequest } from "../middleware/auth.middleware";

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const getMlServiceUrl = (): string => {
  return (
    process.env.ML_SERVICE_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
};

// --------------------------------------------------
// AI/ML ANOMALY DETECTION USING ISOLATION FOREST
// --------------------------------------------------

export const detectDatasetAnomalies = async (
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

    if (!req.workspace) {
      res.status(400).json({
        success: false,
        message: "No active workspace selected",
      });
      return;
    }

    // Validate contamination parameter.
    const contamination = Number(req.query.contamination ?? 0.1);

    if (
      !Number.isFinite(contamination) ||
      contamination < 0.01 ||
      contamination > 0.5
    ) {
      res.status(400).json({
        success: false,
        message: "Contamination must be between 0.01 and 0.5",
      });
      return;
    }

    // Find dataset belonging to the active workspace.
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    // Only CSV files are supported.
    if (dataset.fileType.toUpperCase() !== "CSV") {
      res.status(400).json({
        success: false,
        message: "Only CSV datasets are supported for anomaly detection",
      });
      return;
    }

    if (!dataset.storageKey) {
      res.status(404).json({
        success: false,
        message: "Dataset file not found",
      });
      return;
    }

    // Read CSV from AWS S3 or legacy local storage.
    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    // Prepare multipart request.
    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: "text/csv",
      }),
      dataset.originalName
    );

    // Send CSV to Python ML service.
    let anomalyResponse: globalThis.Response;

    try {
      anomalyResponse = await fetch(
        `${getMlServiceUrl()}/api/anomaly/detect?contamination=${contamination}`,
        {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(120000),
        }
      );
    } catch (error) {
      console.error("Anomaly service connection error:", error);

      res.status(503).json({
        success: false,
        message: "Python anomaly detection service is unavailable",
      });
      return;
    }

    const anomalyResult: unknown = await anomalyResponse
      .json()
      .catch(() => null);

    // --------------------------------------------------
    // HANDLE PYTHON ML SERVICE ERRORS
    // --------------------------------------------------

    if (!anomalyResponse.ok) {
      console.error(
        "Python anomaly detection error:",
        anomalyResponse.status,
        anomalyResult
      );

      let errorMessage =
        "Anomaly detection service could not process the dataset";

      if (anomalyResult && typeof anomalyResult === "object") {
        const result = anomalyResult as {
          detail?: unknown;
          message?: unknown;
        };

        if (typeof result.detail === "string") {
          errorMessage = result.detail;
        } else if (typeof result.message === "string") {
          errorMessage = result.message;
        }
      }

      res.status(
        anomalyResponse.status === 400 ? 400 : 502
      ).json({
        success: false,
        message: errorMessage,
        details: anomalyResult,
      });

      return;
    }

    // --------------------------------------------------
    // VALIDATE PYTHON SERVICE RESPONSE
    // --------------------------------------------------

    if (
      !anomalyResult ||
      typeof anomalyResult !== "object" ||
      !("success" in anomalyResult) ||
      anomalyResult.success !== true ||
      !("algorithm" in anomalyResult) ||
      typeof anomalyResult.algorithm !== "string" ||
      !("total_rows" in anomalyResult) ||
      typeof anomalyResult.total_rows !== "number" ||
      !("anomaly_count" in anomalyResult) ||
      typeof anomalyResult.anomaly_count !== "number" ||
      !("normal_count" in anomalyResult) ||
      typeof anomalyResult.normal_count !== "number" ||
      !("numeric_columns_analyzed" in anomalyResult) ||
      !Array.isArray(anomalyResult.numeric_columns_analyzed) ||
      !("anomalies" in anomalyResult) ||
      !Array.isArray(anomalyResult.anomalies)
    ) {
      res.status(502).json({
        success: false,
        message: "Invalid response from anomaly detection service",
      });
      return;
    }

    // --------------------------------------------------
    // RETURN SUCCESSFUL ANOMALY ANALYSIS
    // --------------------------------------------------

    res.status(200).json({
      success: true,
      message: "Anomaly detection completed successfully",
      dataset: {
        id: dataset.id,
        name: dataset.name,
        originalName: dataset.originalName,
      },
      analysis: anomalyResult,
    });
  } catch (error) {
    console.error("Anomaly detection error:", error);

    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      res.status(404).json({
        success: false,
        message: "Dataset file not found in storage",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to execute anomaly detection",
    });
  }
};
