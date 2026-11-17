
import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { requireWorkspace } from "../middleware/workspace.middleware";

import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketById,
} from "../controllers/support.controller";

const router = Router();

// Require authentication and active workspace
router.use(authenticate);
router.use(requireWorkspace);

// Create support ticket
router.post("/tickets", createSupportTicket);

// Get tickets created by the logged-in user
router.get("/tickets", getMySupportTickets);

// Get a specific support ticket
router.get("/tickets/:id", getSupportTicketById);

export default router;
