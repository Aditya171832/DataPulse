
import { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ------------------------------------------
// GET ALL SUPPORT TICKETS
// ------------------------------------------

export const getAdminSupportTickets = async (
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

    const tickets = await prisma.supportTicket.findMany({
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const openTickets = tickets.filter(
      (ticket) => ticket.status === "OPEN"
    ).length;

    const inProgressTickets = tickets.filter(
      (ticket) => ticket.status === "IN_PROGRESS"
    ).length;

    const resolvedTickets = tickets.filter(
      (ticket) => ticket.status === "RESOLVED"
    ).length;

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved successfully",
      totalTickets: tickets.length,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      tickets,
    });
  } catch (error) {
    console.error("Admin support tickets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve support tickets",
    });
  }
};

// ------------------------------------------
// UPDATE SUPPORT TICKET STATUS
// ------------------------------------------

const updateTicketSchema = z.object({
  status: z.enum([
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ]),
});

export const updateAdminSupportTicketStatus = async (
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

    const parsed = updateTicketSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
      return;
    }

    const ticketId = req.params.id;

    if (typeof ticketId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
      return;
    }

    const existingTicket = await prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },
    });

    if (!existingTicket) {
      res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
      return;
    }

    const ticket = await prisma.supportTicket.update({
      where: {
        id: ticketId,
      },
      data: {
        status: parsed.data.status,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Support ticket status updated successfully",
      ticket,
    });
  } catch (error) {
    console.error("Admin update ticket error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update support ticket",
    });
  }
};
