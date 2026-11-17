
import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// --------------------------------------------------
// ADMIN: GET ALL WORKSPACES
// --------------------------------------------------

export const getAdminWorkspaces = async (
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

    const workspaces = await prisma.workspace.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            datasets: true,
            supportTickets: true,
          },
        },
      },
    });

    const formattedWorkspaces = workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      owner: workspace.owner,
      memberCount: workspace._count.members,
      datasetCount: workspace._count.datasets,
      supportTicketCount: workspace._count.supportTickets,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    }));

    res.status(200).json({
      success: true,
      message: "Workspaces retrieved successfully",
      totalWorkspaces: formattedWorkspaces.length,
      workspaces: formattedWorkspaces,
    });
  } catch (error) {
    console.error("Admin get workspaces error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve workspaces",
    });
  }
};
