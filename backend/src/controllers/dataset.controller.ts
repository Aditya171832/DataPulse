
import { Response } from "express";
import path from "path";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

import {
  uploadToS3,
  readDatasetBuffer,
  deleteStoredDataset,
} from "../config/s3";

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const getMlServiceUrl = (): string => {
  return (
    process.env.ML_SERVICE_URL || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
};

const createUniqueFilename = (suffix: string): string => {
  return `${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}-${suffix}`;
};

// Save processed CSV output to AWS S3.
const saveCsvToS3 = async (
  workspaceId: string,
  filename: string,
  csv: string
): Promise<string> => {
  return uploadToS3(
    workspaceId,
    filename,
    Buffer.from(csv, "utf8"),
    "text/csv"
  );
};

// --------------------------------------------------
// CREATE DATASET METADATA
// --------------------------------------------------

export const createDataset = async (
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

    const schema = z.object({
      name: z.string().min(1).max(100),
      originalName: z.string().min(1).max(255),
      fileType: z.string().min(1).max(20),
      fileSize: z.number().int().nonnegative(),
    });

    const validation = schema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid dataset information",
        errors: validation.error.flatten(),
      });
      return;
    }

    const dataset = await prisma.dataset.create({
      data: {
        ...validation.data,
        status: "UPLOADED",
        userId: req.user.userId,
        workspaceId: req.workspace!.id,
      },
    });

    res.status(201).json({
      success: true,
      message: "Dataset created successfully",
      dataset,
    });
  } catch (error) {
    console.error("Create dataset error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create dataset",
    });
  }
};

// --------------------------------------------------
// GET ALL DATASETS OF LOGGED-IN USER
// --------------------------------------------------

export const getMyDatasets = async (
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
      where: {
        workspaceId: req.workspace!.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: datasets.length,
      datasets,
    });
  } catch (error) {
    console.error("Get datasets error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve datasets",
    });
  }
};

// --------------------------------------------------
// GET SINGLE DATASET
// --------------------------------------------------

export const getDatasetById = async (
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

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      dataset,
    });
  } catch (error) {
    console.error("Get dataset error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve dataset",
    });
  }
};

// --------------------------------------------------
// DELETE DATASET
// --------------------------------------------------

export const deleteDataset = async (
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

    if (!req.workspace || !["OWNER", "ADMIN"].includes(req.workspace.role)) {
      res.status(403).json({
        success: false,
        message: "Only workspace owners and admins can delete datasets",
      });
      return;
    }

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    // Delete the stored file first.
    // This supports both S3 objects and older local files.
    if (dataset.storageKey) {
      await deleteStoredDataset(dataset.storageKey);
    }

    await prisma.dataset.delete({
      where: {
        id: dataset.id,
      },
    });

    res.status(200).json({
      success: true,
      message: "Dataset deleted successfully",
    });
  } catch (error) {
    console.error("Delete dataset error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete dataset",
    });
  }
};

// --------------------------------------------------
// UPLOAD DATASET TO AWS S3
// --------------------------------------------------

export const uploadDataset = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let savedStorageKey: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
      return;
    }

    const name =
      typeof req.body.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : req.file.originalname;

    if (name.length > 100) {
      res.status(400).json({
        success: false,
        message: "Dataset name cannot exceed 100 characters",
      });
      return;
    }

    const extension = path
      .extname(req.file.originalname)
      .toLowerCase()
      .replace(".", "");

    const uniqueName = createUniqueFilename(
      `${Date.now()}.${extension}`
    );

    // Upload the file directly to AWS S3.
    savedStorageKey = await uploadToS3(
      req.workspace!.id,
      uniqueName,
      req.file.buffer,
      req.file.mimetype
    );

    const dataset = await prisma.dataset.create({
      data: {
        name,
        originalName: req.file.originalname,
        fileType: extension.toUpperCase(),
        fileSize: req.file.size,
        status: "UPLOADED",
        storageKey: savedStorageKey,
        userId: req.user.userId,
        workspaceId: req.workspace!.id,
      },
    });

    // The database record now owns the S3 object.
    savedStorageKey = null;

    res.status(201).json({
      success: true,
      message: "Dataset uploaded successfully to AWS S3",
      dataset,
    });
  } catch (error) {
    if (savedStorageKey) {
      await deleteStoredDataset(savedStorageKey).catch(
        (cleanupError) => {
          console.error("S3 upload cleanup error:", cleanupError);
        }
      );
    }

    console.error("Upload dataset error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to upload dataset",
    });
  }
};

// --------------------------------------------------
// DOWNLOAD DATASET FROM S3 OR LOCAL STORAGE
// --------------------------------------------------

export const downloadDataset = async (
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

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
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

    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    res.attachment(dataset.originalName);
    res.send(fileBuffer);
  } catch (error) {
    console.error("Download dataset error:", error);

    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "NoSuchKey") {
      res.status(404).json({
        success: false,
        message: "Dataset file not found in storage",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to download dataset",
    });
  }
};

// --------------------------------------------------
// PROFILE DATASET USING PYTHON ML SERVICE
// --------------------------------------------------

export const profileDataset = async (
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

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    if (dataset.fileType.toUpperCase() !== "CSV") {
      res.status(400).json({
        success: false,
        message: "Only CSV files can be profiled",
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

    // Read from S3 or legacy local storage.
    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: "text/csv",
      }),
      dataset.originalName
    );

    const mlResponse = await fetch(
      `${getMlServiceUrl()}/api/profile/csv`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(120000),
      }
    );

    const result: unknown = await mlResponse.json().catch(() => null);

    if (!mlResponse.ok) {
      res.status(502).json({
        success: false,
        message: "Python profiling service failed",
        details: result,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Dataset profiled successfully",
      profile: result,
    });
  } catch (error) {
    console.error("Profile dataset error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to profile dataset",
    });
  }
};

// --------------------------------------------------
// CLEAN DATASET USING PYTHON ML SERVICE
// --------------------------------------------------

export const cleanDataset = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let savedStorageKey: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    if (dataset.fileType.toUpperCase() !== "CSV") {
      res.status(400).json({
        success: false,
        message: "Only CSV files can be cleaned",
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

    const removeDuplicates =
      String(req.query.remove_duplicates ?? "true");

    const trimWhitespace =
      String(req.query.trim_whitespace ?? "true");

    const standardizeColumns =
      String(req.query.standardize_columns ?? "true");

    const missingStrategy =
      String(req.query.missing_strategy ?? "fill_mean");

    if (
      !["true", "false"].includes(removeDuplicates) ||
      !["true", "false"].includes(trimWhitespace) ||
      !["true", "false"].includes(standardizeColumns) ||
      !["none", "drop_rows", "fill_mean", "fill_median", "fill_mode"].includes(
        missingStrategy
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid cleaning parameters",
      });
      return;
    }

    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: "text/csv",
      }),
      dataset.originalName
    );

    const params = new URLSearchParams({
      remove_duplicates: removeDuplicates,
      trim_whitespace: trimWhitespace,
      standardize_columns: standardizeColumns,
      missing_strategy: missingStrategy,
    });

    const mlResponse = await fetch(
      `${getMlServiceUrl()}/api/clean/csv?${params.toString()}`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(120000),
      }
    );

    const cleanResult: unknown = await mlResponse
      .json()
      .catch(() => null);

    if (!mlResponse.ok) {
      res.status(502).json({
        success: false,
        message: "Python cleaning service failed",
        details: cleanResult,
      });
      return;
    }

    if (
      !cleanResult ||
      typeof cleanResult !== "object" ||
      !("cleaned_csv" in cleanResult) ||
      typeof cleanResult.cleaned_csv !== "string" ||
      !("cleaning_summary" in cleanResult) ||
      !cleanResult.cleaning_summary ||
      !("cleaned_columns" in cleanResult) ||
      !Array.isArray(cleanResult.cleaned_columns)
    ) {
      res.status(502).json({
        success: false,
        message: "Invalid response from Python cleaning service",
      });
      return;
    }

    const cleanedCsv = cleanResult.cleaned_csv;
    const cleanedColumns = cleanResult.cleaned_columns;

    if (!cleanedCsv.trim()) {
      res.status(502).json({
        success: false,
        message: "Cleaning service returned an empty CSV",
      });
      return;
    }

    const uniqueName = createUniqueFilename("cleaned.csv");

    // Save the cleaned output to S3.
    savedStorageKey = await saveCsvToS3(
      req.workspace!.id,
      uniqueName,
      cleanedCsv
    );

    const cleanedDataset = await prisma.dataset.create({
      data: {
        name: `${dataset.name.slice(0, 90)} (Cleaned)`,
        originalName: `cleaned-${dataset.originalName}`.slice(0, 255),
        fileType: "CSV",
        fileSize: Buffer.byteLength(cleanedCsv, "utf8"),
        status: "CLEANED",
        storageKey: savedStorageKey,
        userId: req.user.userId,
        workspaceId: req.workspace!.id,
      },
    });

    savedStorageKey = null;

    res.status(201).json({
      success: true,
      message: "Dataset cleaned successfully",
      originalDataset: {
        id: dataset.id,
        name: dataset.name,
      },
      cleanedDataset,
      cleaningSummary: cleanResult.cleaning_summary,
      cleanedColumns,
    });
  } catch (error) {
    if (savedStorageKey) {
      await deleteStoredDataset(savedStorageKey).catch(
        (cleanupError) => {
          console.error("Cleaned file cleanup error:", cleanupError);
        }
      );
    }

    console.error("Clean dataset error:", error);

    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "NoSuchKey") {
      res.status(404).json({
        success: false,
        message: "Dataset file not found in storage",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to clean dataset",
    });
  }
};

// --------------------------------------------------
// EXECUTE ETL PIPELINE USING PYTHON ML SERVICE
// --------------------------------------------------

export const runEtlPipeline = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let savedStorageKey: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    if (dataset.fileType.toUpperCase() !== "CSV") {
      res.status(400).json({
        success: false,
        message: "Only CSV datasets are supported for ETL",
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

    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: "text/csv",
      }),
      dataset.originalName
    );

    let mlResponse: globalThis.Response;

    try {
      mlResponse = await fetch(
        `${getMlServiceUrl()}/api/etl/csv`,
        {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(120000),
        }
      );
    } catch (error) {
      console.error("ETL service connection error:", error);

      res.status(503).json({
        success: false,
        message: "Python ML service is unavailable",
      });
      return;
    }

    const etlResult: unknown = await mlResponse
      .json()
      .catch(() => null);

    if (!mlResponse.ok) {
      res.status(502).json({
        success: false,
        message: "Python ETL service could not process the dataset",
        details: etlResult,
      });
      return;
    }

    if (
      !etlResult ||
      typeof etlResult !== "object" ||
      !("output_csv" in etlResult) ||
      typeof etlResult.output_csv !== "string" ||
      !("pipeline" in etlResult) ||
      !etlResult.pipeline ||
      typeof etlResult.pipeline !== "object" ||
      !("extract" in etlResult.pipeline) ||
      !("transform" in etlResult.pipeline) ||
      !("load" in etlResult.pipeline) ||
      !("columns" in etlResult) ||
      !Array.isArray(etlResult.columns)
    ) {
      res.status(502).json({
        success: false,
        message: "Invalid response from Python ETL service",
      });
      return;
    }

    const outputCsv = etlResult.output_csv;
    const etlSummary = etlResult.pipeline;
    const outputColumns = etlResult.columns;

    if (!outputCsv.trim()) {
      res.status(502).json({
        success: false,
        message: "ETL service returned an empty CSV file",
      });
      return;
    }

    const uniqueName = createUniqueFilename("etl.csv");

    // Save the ETL output to S3.
    savedStorageKey = await saveCsvToS3(
      req.workspace!.id,
      uniqueName,
      outputCsv
    );

    const etlDataset = await prisma.dataset.create({
      data: {
        name: `${dataset.name.slice(0, 90)} (ETL)`,
        originalName: `etl-${dataset.originalName}`.slice(0, 255),
        fileType: "CSV",
        fileSize: Buffer.byteLength(outputCsv, "utf8"),
        status: "ETL_COMPLETED",
        storageKey: savedStorageKey,
        userId: req.user.userId,
        workspaceId: req.workspace!.id,
      },
    });

    savedStorageKey = null;

    res.status(201).json({
      success: true,
      message: "ETL pipeline executed and dataset saved successfully",
      originalDataset: {
        id: dataset.id,
        name: dataset.name,
        originalName: dataset.originalName,
      },
      etlDataset,
      pipeline: etlSummary,
      columns: outputColumns,
    });
  } catch (error) {
    if (savedStorageKey) {
      await deleteStoredDataset(savedStorageKey).catch(
        (cleanupError) => {
          console.error("ETL file cleanup error:", cleanupError);
        }
      );
    }

    console.error("ETL pipeline error:", error);

    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "NoSuchKey") {
      res.status(404).json({
        success: false,
        message: "Dataset file not found in storage",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to execute ETL pipeline",
    });
  }
};

// --------------------------------------------------
// EXECUTE APACHE SPARK PROCESSING
// --------------------------------------------------

export const runSparkProcessing = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let savedStorageKey: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: String(req.params.id),
        workspaceId: req.workspace!.id,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });
      return;
    }

    if (dataset.fileType.toUpperCase() !== "CSV") {
      res.status(400).json({
        success: false,
        message: "Only CSV datasets are supported for Spark processing",
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

    // Read the original CSV from S3 or legacy local storage.
    const fileBuffer = await readDatasetBuffer(dataset.storageKey);

    const formData = new FormData();

    formData.append(
      "file",
      new Blob([new Uint8Array(fileBuffer)], {
        type: "text/csv",
      }),
      dataset.originalName
    );

    let sparkResponse: globalThis.Response;

    try {
      sparkResponse = await fetch(
        `${getMlServiceUrl()}/api/spark/csv`,
        {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(180000),
        }
      );
    } catch (error) {
      console.error("Spark service connection error:", error);

      res.status(503).json({
        success: false,
        message: "Python Spark service is unavailable",
      });
      return;
    }

    const sparkResult: unknown = await sparkResponse
      .json()
      .catch(() => null);

    if (!sparkResponse.ok) {
      res.status(502).json({
        success: false,
        message: "Spark service could not process the dataset",
        details: sparkResult,
      });
      return;
    }

    if (
      !sparkResult ||
      typeof sparkResult !== "object" ||
      !("cleaned_csv" in sparkResult) ||
      typeof sparkResult.cleaned_csv !== "string" ||
      !("rows_processed" in sparkResult) ||
      typeof sparkResult.rows_processed !== "number" ||
      !Number.isFinite(sparkResult.rows_processed) ||
      !("processing_engine" in sparkResult) ||
      typeof sparkResult.processing_engine !== "string"
    ) {
      res.status(502).json({
        success: false,
        message: "Invalid response from Spark service",
      });
      return;
    }

    const outputCsv = sparkResult.cleaned_csv;

    if (!outputCsv.trim()) {
      res.status(502).json({
        success: false,
        message: "Spark service returned an empty CSV file",
      });
      return;
    }

    const uniqueName = createUniqueFilename("spark.csv");

    // Save the Spark output to S3.
    savedStorageKey = await saveCsvToS3(
      req.workspace!.id,
      uniqueName,
      outputCsv
    );

    const sparkDataset = await prisma.dataset.create({
      data: {
        name: `${dataset.name.slice(0, 85)} (Spark)`,
        originalName: `spark-${dataset.originalName}`.slice(0, 255),
        fileType: "CSV",
        fileSize: Buffer.byteLength(outputCsv, "utf8"),
        status: "SPARK_COMPLETED",
        storageKey: savedStorageKey,
        userId: req.user.userId,
        workspaceId: req.workspace!.id,
      },
    });

    savedStorageKey = null;

    res.status(201).json({
      success: true,
      message: "Apache Spark processing completed successfully",
      originalDataset: {
        id: dataset.id,
        name: dataset.name,
        originalName: dataset.originalName,
      },
      sparkDataset,
      processing: {
        engine: sparkResult.processing_engine,
        rowsProcessed: sparkResult.rows_processed,
      },
    });
  } catch (error) {
    if (savedStorageKey) {
      await deleteStoredDataset(savedStorageKey).catch(
        (cleanupError) => {
          console.error("Spark file cleanup error:", cleanupError);
        }
      );
    }

    console.error("Spark processing error:", error);

    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "NoSuchKey") {
      res.status(404).json({
        success: false,
        message: "Dataset file not found in storage",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to execute Spark processing",
    });
  }
};
