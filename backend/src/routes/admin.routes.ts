
import { Router, Response } from "express";

import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";

import { authorize } from "../middleware/role.middleware";

import {
  getAllUsers,
  getUserById,
  updateUserRole,
} from "../controllers/admin.controller";

import {
  getAdminSupportTickets,
  updateAdminSupportTicketStatus,
} from "../controllers/admin-support.controller";

import { getAdminWorkspaces } from "../controllers/admin-workspace.controller";
import { getAdminDatasets } from "../controllers/admin-dataset.controller";
import { getAdminSystemHealth } from "../controllers/admin-health.controller";
const router = Router();

// ADMIN-ONLY TEST ENDPOINT
router.get(
  "/test",
  authenticate,
  authorize("ADMIN"),
  (req: AuthRequest, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Welcome Admin! You have access to this resource.",
      user: req.user,
    });
  }
);

// GET ALL USERS
router.get(
  "/users",
  authenticate,
  authorize("ADMIN"),
  getAllUsers
);

// GET USER BY ID
router.get(
  "/users/:id",
  authenticate,
  authorize("ADMIN"),
  getUserById
);

// UPDATE USER ROLE
router.put(
  "/users/:id/role",
  authenticate,
  authorize("ADMIN"),
  updateUserRole
);
// GET ALL WORKSPACES — ADMIN ONLY
router.get(
  "/workspaces",
  authenticate,
  authorize("ADMIN"),
  getAdminWorkspaces
);
// GET ALL DATASETS — ADMIN ONLY
router.get(
  "/datasets",
  authenticate,
  authorize("ADMIN"),
  getAdminDatasets
);
// Admin Support Ticket Management
router.get(
  "/support-tickets",
  authenticate,
  authorize("ADMIN"),
  getAdminSupportTickets
);

router.put(
  "/support-tickets/:id/status",
  authenticate,
  authorize("ADMIN"),
  updateAdminSupportTicketStatus
);

router.get(
  "/system-health",
  authenticate,
  authorize("ADMIN"),
  getAdminSystemHealth
);



export default router;
