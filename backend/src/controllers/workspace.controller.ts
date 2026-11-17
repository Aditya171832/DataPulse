
import { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

// GET /api/workspaces
export const getMyWorkspaces = async (
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

    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: req.user.userId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
                datasets: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    const workspaces = memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role,
    }));

    res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    console.error("Get workspaces error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch workspaces",
    });
  }
};

// POST /api/workspaces
export const createWorkspace = async (
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

    const parsed = createWorkspaceSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Workspace name must contain 2 to 100 characters",
      });
      return;
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        ownerId: req.user.userId,
        members: {
          create: {
            userId: req.user.userId,
            role: "OWNER",
          },
        },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      workspace: {
        ...workspace,
        role: "OWNER",
      },
    });
  } catch (error) {
    console.error("Create workspace error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create workspace",
    });
  }
};

// GET /api/workspaces/:id/members
export const getWorkspaceMembers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        success: false,
        message: "Workspace authentication required",
      });
      return;
    }

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: req.workspace.id,
      },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    res.status(200).json({
      success: true,
      count: members.length,
      members,
    });
  } catch (error) {
    console.error("Get workspace members error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch workspace members",
    });
  }
};
