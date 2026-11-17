
import { Response, NextFunction } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "./auth.middleware";

export const requireWorkspace = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const requestedWorkspaceId = req.get("x-workspace-id");

    let membership;

    if (requestedWorkspaceId) {
      membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: requestedWorkspaceId,
          userId: req.user.userId,
        },
        select: {
          workspaceId: true,
          role: true,
        },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
        return;
      }
    } else {
      const memberships = await prisma.workspaceMember.findMany({
        where: {
          userId: req.user.userId,
        },
        select: {
          workspaceId: true,
          role: true,
        },
        take: 2,
      });

      if (memberships.length === 0) {
        res.status(403).json({
          success: false,
          message: "You do not belong to a workspace",
        });
        return;
      }

      if (memberships.length > 1) {
        res.status(400).json({
          success: false,
          message: "Please select an active workspace",
        });
        return;
      }

      membership = memberships[0];
    }

    req.workspace = {
      id: membership.workspaceId,
      role: membership.role,
    };

    next();
  } catch (error) {
    console.error("Workspace authorization error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify workspace access",
    });
  }
};
