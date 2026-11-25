import { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// --------------------------------------------------
// VALIDATION SCHEMAS
// --------------------------------------------------

const createSessionSchema = z.object({
  datasetId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
});

const renameSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title cannot exceed 120 characters"),
});

const sessionIdSchema = z.string().uuid();

// --------------------------------------------------
// HELPER: AUTHENTICATED CONVERSATION SCOPE
// --------------------------------------------------

function getSessionScope(
  req: AuthRequest,
  res: Response
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });

    return null;
  }

  if (!req.workspace) {
    res.status(403).json({
      success: false,
      message: "Workspace access required",
    });

    return null;
  }

  return {
    userId: req.user.userId,
    workspaceId: req.workspace.id,
  };
}

// --------------------------------------------------
// CREATE NEW CHAT SESSION
// POST /api/ai/sessions
// --------------------------------------------------

export const createChatSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const scope = getSessionScope(req, res);

    if (!scope) return;

    const validation = createSessionSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid chat session request",
        errors: validation.error.issues,
      });

      return;
    }

    const { datasetId, title } = validation.data;

    // Verify that the selected dataset belongs
    // to the active workspace.

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        workspaceId: scope.workspaceId,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        fileSize: true,
        storageKey: true,
      },
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });

      return;
    }

    if (
      !dataset.originalName
        .toLowerCase()
        .endsWith(".csv")
    ) {
      res.status(400).json({
        success: false,
        message: "AI Assistant supports CSV datasets only",
      });

      return;
    }

    if (!dataset.storageKey || dataset.fileSize <= 0) {
      res.status(400).json({
        success: false,
        message: "Dataset file is not available",
      });

      return;
    }

    if (dataset.fileSize > 20 * 1024 * 1024) {
      res.status(413).json({
        success: false,
        message: "Dataset exceeds the 20 MB limit",
      });

      return;
    }

    // Create a conversation.

    const session = await prisma.chatSession.create({
      data: {
        title: title || "New Conversation",
        userId: scope.userId,
        workspaceId: scope.workspaceId,
        datasetId: dataset.id,
      },
      include: {
        dataset: {
          select: {
            id: true,
            name: true,
            originalName: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Chat session created successfully",
      session,
    });
  } catch (error) {
    console.error(
      "Create chat session error:",
      error instanceof Error ? error.name : "Unknown"
    );

    res.status(500).json({
      success: false,
      message: "Unable to create chat session",
    });
  }
};

// --------------------------------------------------
// GET ALL CHAT SESSIONS
// GET /api/ai/sessions
// --------------------------------------------------

export const getChatSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const scope = getSessionScope(req, res);

    if (!scope) return;

    const pagination = z.object({
      page: z.coerce.number().int().min(1).max(10000)
        .default(1),
      limit: z.coerce.number().int().min(1).max(100)
        .default(30),
    }).safeParse(req.query);

    if (!pagination.success) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });

      return;
    }

    const { page, limit } = pagination.data;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where: scope,
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          dataset: {
            select: {
              id: true,
              name: true,
              originalName: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      prisma.chatSession.count({
        where: scope,
      }),
    ]);

    res.status(200).json({
      success: true,
      count: sessions.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sessions,
    });
  } catch (error) {
    console.error(
      "Get chat sessions error:",
      error instanceof Error ? error.name : "Unknown"
    );

    res.status(500).json({
      success: false,
      message: "Unable to retrieve chat sessions",
    });
  }
};

// --------------------------------------------------
// GET A SINGLE CHAT SESSION WITH MESSAGES
// GET /api/ai/sessions/:id
// --------------------------------------------------

export const getChatSessionById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const scope = getSessionScope(req, res);

    if (!scope) return;

    const validation = sessionIdSchema.safeParse(
      req.params.id
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid chat session ID",
      });

      return;
    }

    const sessionId = validation.data;

    const session = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        ...scope,
      },
      include: {
        dataset: {
          select: {
            id: true,
            name: true,
            originalName: true,
            fileType: true,
            fileSize: true,
          },
        },
        messages: {
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: 100,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: "Chat session not found",
      });

      return;
    }

    res.status(200).json({
      success: true,
      session: {
        ...session,
        messages: session.messages.reverse(),
      },
      hasOlderMessages:
        session._count.messages > session.messages.length,
    });
  } catch (error) {
    console.error(
      "Get chat session error:",
      error instanceof Error ? error.name : "Unknown"
    );

    res.status(500).json({
      success: false,
      message: "Unable to retrieve chat session",
    });
  }
};

// --------------------------------------------------
// RENAME CHAT SESSION
// PATCH /api/ai/sessions/:id
// --------------------------------------------------

export const renameChatSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const scope = getSessionScope(req, res);

    if (!scope) return;

    const idValidation = sessionIdSchema.safeParse(
      req.params.id
    );

    if (!idValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid chat session ID",
      });

      return;
    }

    const validation = renameSessionSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid conversation title",
        errors: validation.error.issues,
      });

      return;
    }

    const updated = await prisma.chatSession.updateMany({
      where: {
        id: idValidation.data,
        ...scope,
      },
      data: {
        title: validation.data.title,
      },
    });

    if (updated.count === 0) {
      res.status(404).json({
        success: false,
        message: "Chat session not found",
      });

      return;
    }

    res.status(200).json({
      success: true,
      message: "Conversation renamed successfully",
      session: {
        id: idValidation.data,
        title: validation.data.title,
      },
    });
  } catch (error) {
    console.error(
      "Rename chat session error:",
      error instanceof Error ? error.name : "Unknown"
    );

    res.status(500).json({
      success: false,
      message: "Unable to rename chat session",
    });
  }
};

// --------------------------------------------------
// DELETE CHAT SESSION
// DELETE /api/ai/sessions/:id
// --------------------------------------------------

export const deleteChatSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const scope = getSessionScope(req, res);

    if (!scope) return;

    const validation = sessionIdSchema.safeParse(
      req.params.id
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid chat session ID",
      });

      return;
    }

    // Chat messages are automatically deleted
    // because of the Prisma Cascade relation.

    const deleted = await prisma.chatSession.deleteMany({
      where: {
        id: validation.data,
        ...scope,
      },
    });

    if (deleted.count === 0) {
      res.status(404).json({
        success: false,
        message: "Chat session not found",
      });

      return;
    }

    res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete chat session error:",
      error instanceof Error ? error.name : "Unknown"
    );

    res.status(500).json({
      success: false,
      message: "Unable to delete chat session",
    });
  }
};