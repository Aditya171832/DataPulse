
import { Router, Response, NextFunction } from "express";

import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";

import { requireWorkspace } from "../middleware/workspace.middleware";

import {
  getMyWorkspaces,
  createWorkspace,
  getWorkspaceMembers,
} from "../controllers/workspace.controller";

import {
  createInvitation,
  getInvitations,
  acceptInvitation,
  revokeInvitation,
} from "../controllers/invitation.controller";

const router = Router();

// All workspace routes require JWT authentication.
router.use(authenticate);

// ---------------------------------------------
// WORKSPACE MANAGEMENT
// ---------------------------------------------

// List workspaces belonging to logged-in user.
router.get("/", getMyWorkspaces);

// Create a workspace.
router.post("/", createWorkspace);

// ---------------------------------------------
// INVITATION ACCEPTANCE
// ---------------------------------------------

// Accept an invitation using its token.
// This does not require existing membership.
router.post("/invitations/accept", acceptInvitation);

// ---------------------------------------------
// WORKSPACE AUTHORIZATION
// ---------------------------------------------

const verifyWorkspaceId = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.params.id !== req.workspace?.id) {
    res.status(403).json({
      success: false,
      message: "Workspace ID does not match the active workspace",
    });
    return;
  }

  next();
};

// Validate membership and workspace ID for all
// workspace-specific operations below.
router.use("/:id", requireWorkspace, verifyWorkspaceId);

// ---------------------------------------------
// TEAM MEMBERS
// ---------------------------------------------

router.get("/:id/members", getWorkspaceMembers);

// ---------------------------------------------
// TEAM INVITATIONS
// ---------------------------------------------

// Create invitation (OWNER only).
router.post("/:id/invitations", createInvitation);

// View pending invitations (OWNER only).
router.get("/:id/invitations", getInvitations);

// Revoke an invitation (OWNER only).
router.delete(
  "/:id/invitations/:invitationId",
  revokeInvitation
);

export default router;
