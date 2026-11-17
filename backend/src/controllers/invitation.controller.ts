
import { randomBytes, createHash } from "crypto";
import { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const invitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

const acceptSchema = z.object({
  token: z.string().min(1),
});

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

// POST /api/workspaces/:id/invitations
export const createInvitation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (req.workspace.role !== "OWNER") {
      res.status(403).json({
        success: false,
        message: "Only workspace owners can invite members",
      });
      return;
    }

    const parsed = invitationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
      return;
    }

    const email = parsed.data.email;
    const workspaceId = req.workspace.id;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
      });

      if (membership) {
        res.status(409).json({
          success: false,
          message: "This user is already a workspace member",
        });
        return;
      }
    }

    // Revoke earlier pending invitations for this email.
    await prisma.invitation.updateMany({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    );

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId,
        email,
        role: "MEMBER",
        tokenHash,
        expiresAt,
        invitedById: req.user.userId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Invitation created successfully",
      invitation,
      token,
    });
  } catch (error) {
    console.error("Create invitation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create invitation",
    });
  }
};

// GET /api/workspaces/:id/invitations
export const getInvitations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.workspace || req.workspace.role !== "OWNER") {
      res.status(403).json({
        success: false,
        message: "Only workspace owners can view invitations",
      });
      return;
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        workspaceId: req.workspace.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      count: invitations.length,
      invitations,
    });
  } catch (error) {
    console.error("Get invitations error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch invitations",
    });
  }
};

// POST /api/workspaces/invitations/accept
export const acceptInvitation = async (
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

    const parsed = acceptSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invitation token is required",
      });
      return;
    }

    const tokenHash = hashToken(parsed.data.token);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      res.status(400).json({
        success: false,
        message: "Invitation is invalid or expired",
      });
      return;
    }

    if (
      invitation.email.toLowerCase() !==
      req.user.email.toLowerCase()
    ) {
      res.status(403).json({
        success: false,
        message: "Invitation belongs to another email address",
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          acceptedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new Error("INVITATION_ALREADY_USED");
      }

      const membership = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: req.user!.userId,
          },
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId: req.user!.userId,
          role: "MEMBER",
        },
        update: {},
      });

      return membership;
    });

    res.status(200).json({
      success: true,
      message: "Invitation accepted successfully",
      workspaceId: result.workspaceId,
      role: result.role,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVITATION_ALREADY_USED"
    ) {
      res.status(409).json({
        success: false,
        message: "Invitation has already been used",
      });
      return;
    }

    console.error("Accept invitation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to accept invitation",
    });
  }
};

// DELETE /api/workspaces/:id/invitations/:invitationId
export const revokeInvitation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.workspace || req.workspace.role !== "OWNER") {
      res.status(403).json({
        success: false,
        message: "Only workspace owners can revoke invitations",
      });
      return;
    }

    const result = await prisma.invitation.updateMany({
      where: {
        id: String(req.params.invitationId),
        workspaceId: req.workspace.id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      res.status(404).json({
        success: false,
        message: "Pending invitation not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error) {
    console.error("Revoke invitation error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to revoke invitation",
    });
  }
};
