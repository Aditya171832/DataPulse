
import { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum([
    "General Question",
    "Dataset Management",
    "Data Processing",
    "AI Insights",
    "Account & Workspace",
    "Technical Issue",
  ]),
  description: z.string().trim().min(10).max(5000),
});

// --------------------------------------------------
// CREATE SUPPORT TICKET
// POST /api/support/tickets
// --------------------------------------------------

export const createSupportTicket = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        success: false,
        message: "Authentication and active workspace required",
      });
      return;
    }

    const parsed = createTicketSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid ticket information",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        subject: parsed.data.subject,
        category: parsed.data.category,
        description: parsed.data.description,
        status: "OPEN",
        priority: "MEDIUM",
        userId: req.user.userId,
        workspaceId: req.workspace.id,
      },
      select: {
        id: true,
        subject: true,
        category: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create support ticket error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create support ticket",
    });
  }
};

// --------------------------------------------------
// GET MY SUPPORT TICKETS
// GET /api/support/tickets
// --------------------------------------------------

export const getMySupportTickets = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        success: false,
        message: "Authentication and active workspace required",
      });
      return;
    }

    const tickets = await prisma.supportTicket.findMany({
      where: {
        userId: req.user.userId,
        workspaceId: req.workspace.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        subject: true,
        category: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    console.error("Get support tickets error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve support tickets",
    });
  }
};

// --------------------------------------------------
// GET SUPPORT TICKET BY ID
// GET /api/support/tickets/:id
// --------------------------------------------------

export const getSupportTicketById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || !req.workspace) {
      res.status(401).json({
        success: false,
        message: "Authentication and active workspace required",
      });
      return;
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: String(req.params.id),
        userId: req.user.userId,
        workspaceId: req.workspace.id,
      },
      select: {
        id: true,
        subject: true,
        category: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("Get support ticket error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve support ticket",
    });
  }
};
