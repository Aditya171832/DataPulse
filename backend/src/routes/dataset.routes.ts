
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireWorkspace } from "../middleware/workspace.middleware";
import upload from "../config/upload";

import {
  createDataset,
  getMyDatasets,
  getDatasetById,
  deleteDataset,
  uploadDataset,
  downloadDataset,
  profileDataset,
  cleanDataset,
  runEtlPipeline,
  runSparkProcessing,
} from "../controllers/dataset.controller";

import { detectDatasetAnomalies } from "../controllers/anomaly.controller";

const router = Router();

// Verify the user's login and active workspace
router.use(authenticate);
router.use(requireWorkspace);

// Dataset operations
router.post("/upload", upload.single("file"), uploadDataset);
router.post("/", createDataset);
router.get("/", getMyDatasets);

router.get("/:id/download", downloadDataset);
router.post("/:id/profile", profileDataset);
router.post("/:id/clean", cleanDataset);
router.post("/:id/etl", runEtlPipeline);
router.post("/:id/spark", runSparkProcessing);
router.post("/:id/anomaly", detectDatasetAnomalies);

router.get("/:id", getDatasetById);
router.delete("/:id", deleteDataset);

export default router;
