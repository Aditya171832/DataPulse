import { Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { readDatasetBuffer } from "../config/s3";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const MAX_QUESTION_LENGTH = 1000;

const ML_REQUEST_TIMEOUT = 180000;

// --------------------------------------------------
// REQUEST VALIDATION
// --------------------------------------------------

const aiChatSchema = z.object({
  datasetId: z.string().uuid(),

  sessionId: z.string().uuid().optional(),

  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty")
    .max(
      MAX_QUESTION_LENGTH,
      "Question cannot exceed 1000 characters"
    ),
});

// --------------------------------------------------
// ML SERVICE RESPONSE VALIDATION
// --------------------------------------------------

const mlResultSchema = z.object({
  success: z.literal(true),

  question: z.string(),

  answer: z.string(),

  query_plan: z.record(
    z.string(),
    z.unknown()
  ),

  result: z.unknown(),

  chart: z.unknown(),
});

// --------------------------------------------------
// ML SERVICE URL
// --------------------------------------------------

const getMlServiceUrl = (): string => {
  return (
    process.env.ML_SERVICE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
};

// --------------------------------------------------
// GENERATE CONVERSATION TITLE
// --------------------------------------------------

const generateSessionTitle = (
  question: string
): string => {
  const cleanedQuestion = question
    .trim()
    .replace(/\s+/g, " ");

  if (cleanedQuestion.length <= 60) {
    return cleanedQuestion;
  }

  return `${cleanedQuestion.slice(0, 57)}...`;
};

// --------------------------------------------------
// CONVERT RESPONSE DATA TO PRISMA JSON
// --------------------------------------------------

const toPrismaJson = (
  value: unknown
): Prisma.InputJsonValue |
   Prisma.NullableJsonNullValueInput => {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }

  return JSON.parse(
    JSON.stringify(value)
  ) as Prisma.InputJsonValue;
};

// --------------------------------------------------
// CUSTOM SESSION ACCESS ERROR
// --------------------------------------------------

class SessionUnavailableError extends Error {
  constructor() {
    super("Chat session is no longer available");
    this.name = "SessionUnavailableError";
  }
}

// --------------------------------------------------
// AI CHAT CONTROLLER
// --------------------------------------------------

export const chatWithDataset = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // ----------------------------------------------
    // VERIFY AUTHENTICATION
    // ----------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // ----------------------------------------------
    // VERIFY ACTIVE WORKSPACE
    // ----------------------------------------------

    if (!req.workspace) {
      res.status(403).json({
        success: false,
        message: "Workspace access required",
      });

      return;
    }

    const userId = req.user.userId;

    const workspaceId = req.workspace.id;

    // ----------------------------------------------
    // VALIDATE REQUEST BODY
    // ----------------------------------------------

    const validation = aiChatSchema.safeParse(
      req.body
    );

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid AI chat request",

        errors: validation.error.issues.map(
          (issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })
        ),
      });

      return;
    }

    const {
      datasetId,
      sessionId,
      question,
    } = validation.data;

    // ----------------------------------------------
    // FIND AUTHORIZED DATASET
    // ----------------------------------------------

    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        workspaceId,
      },

      select: {
        id: true,
        name: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        storageKey: true,
        workspaceId: true,
      },
    });

    // ----------------------------------------------
    // VERIFY DATASET EXISTS
    // ----------------------------------------------

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: "Dataset not found",
      });

      return;
    }

    // ----------------------------------------------
    // VERIFY EXISTING CHAT SESSION
    // ----------------------------------------------

    if (sessionId) {
      const existingSession =
        await prisma.chatSession.findFirst({
          where: {
            id: sessionId,
            userId,
            workspaceId,
          },

          select: {
            id: true,
            datasetId: true,
          },
        });

      if (!existingSession) {
        res.status(404).json({
          success: false,
          message: "Chat session not found",
        });

        return;
      }

      // A conversation belongs to one dataset.

      if (existingSession.datasetId !== datasetId) {
        res.status(400).json({
          success: false,

          message:
            "This conversation belongs to a different or unavailable dataset",
        });

        return;
      }
    }

    // ----------------------------------------------
    // VERIFY CSV FILE FORMAT
    // ----------------------------------------------

    const originalName = dataset.originalName;

    if (
      !originalName.toLowerCase().endsWith(".csv")
    ) {
      res.status(400).json({
        success: false,

        message:
          "AI Assistant currently supports CSV datasets only",
      });

      return;
    }

    // ----------------------------------------------
    // VERIFY STORAGE KEY
    // ----------------------------------------------

    if (!dataset.storageKey) {
      res.status(400).json({
        success: false,

        message:
          "Dataset file is not available",
      });

      return;
    }

    // ----------------------------------------------
    // VERIFY DATASET SIZE
    // ----------------------------------------------

    if (dataset.fileSize > MAX_FILE_SIZE) {
      res.status(413).json({
        success: false,

        message:
          "Dataset exceeds the AI Assistant 20 MB limit",
      });

      return;
    }

    // ----------------------------------------------
    // READ DATASET FROM AWS S3 OR LOCAL STORAGE
    // ----------------------------------------------

    const fileBuffer = await readDatasetBuffer(
      dataset.storageKey
    );

    if (fileBuffer.length === 0) {
      res.status(400).json({
        success: false,
        message: "Dataset file is empty",
      });

      return;
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      res.status(413).json({
        success: false,

        message:
          "Dataset exceeds the AI Assistant 20 MB limit",
      });

      return;
    }

    // ----------------------------------------------
    // CREATE MULTIPART FORM DATA
    // ----------------------------------------------

    const formData = new FormData();

    const fileBytes = new Uint8Array(
      fileBuffer
    );

    const fileBlob = new Blob(
      [fileBytes],
      {
        type: "text/csv",
      }
    );

    formData.append(
      "file",
      fileBlob,
      originalName
    );

    formData.append(
      "question",
      question
    );

    // ----------------------------------------------
    // CONNECT TO FASTAPI AI SERVICE
    // ----------------------------------------------

    const mlServiceUrl = getMlServiceUrl();

    let mlResponse: Awaited<
      ReturnType<typeof fetch>
    >;

    try {
      mlResponse = await fetch(
        `${mlServiceUrl}/api/ai/chat`,

        {
          method: "POST",

          body: formData,

          signal: AbortSignal.timeout(
            ML_REQUEST_TIMEOUT
          ),
        }
      );
    } catch (error) {
      console.error(
        "AI service connection failed:",

        error instanceof Error
          ? error.name
          : "Unknown error"
      );

      const timedOut =
        error instanceof Error &&
        (
          error.name === "TimeoutError" ||
          error.name === "AbortError"
        );

      res.status(timedOut ? 504 : 503).json({
        success: false,

        message: timedOut
          ? "AI request timed out. Please try again."
          : "AI service is temporarily unavailable",
      });

      return;
    }

    // ----------------------------------------------
    // HANDLE ML SERVICE ERRORS
    // ----------------------------------------------

    if (!mlResponse.ok) {
      console.warn(
        "AI service returned status:",
        mlResponse.status
      );

      const allowedStatuses = [
        400,
        413,
        429,
        503,
        504,
      ];

      const statusCode = allowedStatuses.includes(
        mlResponse.status
      )
        ? mlResponse.status
        : 502;

      const errorMessages: Record<number, string> = {
        400:
          "Unable to analyze this dataset or question",

        413:
          "Dataset exceeds the supported size limit",

        429:
          "AI service rate limit reached. Please try again later.",

        503:
          "AI service is temporarily unavailable",

        504:
          "AI request timed out. Please try again.",

        502:
          "Unable to complete the AI request",
      };

      res.status(statusCode).json({
        success: false,

        message: errorMessages[statusCode],
      });

      return;
    }

    // ----------------------------------------------
    // VALIDATE ML SERVICE RESPONSE
    // ----------------------------------------------

    let mlResult: unknown;

    try {
      mlResult = await mlResponse.json();
    } catch {
      res.status(502).json({
        success: false,

        message:
          "Invalid JSON received from AI service",
      });

      return;
    }

    const parsedResult =
      mlResultSchema.safeParse(mlResult);

    if (!parsedResult.success) {
      res.status(502).json({
        success: false,

        message:
          "Invalid response received from AI service",
      });

      return;
    }

    const aiResult = parsedResult.data;

    // ----------------------------------------------
    // SAVE CONVERSATION USING DATABASE TRANSACTION
    // ----------------------------------------------

    const savedConversation =
      await prisma.$transaction(async (tx) => {

        // Recheck membership after AI processing.

        const membership =
          await tx.workspaceMember.findFirst({
            where: {
              userId,
              workspaceId,
            },

            select: {
              id: true,
            },
          });

        if (!membership) {
          throw new SessionUnavailableError();
        }

        // Recheck dataset availability.

        const availableDataset =
          await tx.dataset.findFirst({
            where: {
              id: datasetId,
              workspaceId,
            },

            select: {
              id: true,
            },
          });

        if (!availableDataset) {
          throw new SessionUnavailableError();
        }

        // ------------------------------------------
        // FIND OR CREATE CHAT SESSION
        // ------------------------------------------

        let activeSessionId: string;

        if (sessionId) {

          // Update the existing session and verify
          // ownership and dataset access again.

          const updatedSession =
            await tx.chatSession.updateMany({
              where: {
                id: sessionId,
                userId,
                workspaceId,
                datasetId,
              },

              data: {
                updatedAt: new Date(),
              },
            });

          if (updatedSession.count !== 1) {
            throw new SessionUnavailableError();
          }

          activeSessionId = sessionId;

          // Generate a title for an empty session.

          const messageCount =
            await tx.chatMessage.count({
              where: {
                sessionId: activeSessionId,
              },
            });

          if (messageCount === 0) {
            await tx.chatSession.updateMany({
              where: {
                id: activeSessionId,
                userId,
                workspaceId,

                title: "New Conversation",
              },

              data: {
                title: generateSessionTitle(question),
              },
            });
          }
        } else {

          // Create a new conversation automatically.

          const newSession =
            await tx.chatSession.create({
              data: {
                title: generateSessionTitle(question),

                userId,
                workspaceId,
                datasetId,
              },
            });

          activeSessionId = newSession.id;
        }

        // ------------------------------------------
        // SAVE USER QUESTION
        // ------------------------------------------

        const userMessage =
          await tx.chatMessage.create({
            data: {
              sessionId: activeSessionId,

              role: "USER",

              content: question,
            },
          });

        // ------------------------------------------
        // SAVE AI ASSISTANT RESPONSE
        // ------------------------------------------

        const assistantMessage =
          await tx.chatMessage.create({
            data: {
              sessionId: activeSessionId,

              role: "ASSISTANT",

              content: aiResult.answer,

              queryPlan: toPrismaJson(
                aiResult.query_plan
              ),

              result: toPrismaJson(
                aiResult.result
              ),

              chart: toPrismaJson(
                aiResult.chart
              ),

              // Keep the assistant message after
              // the corresponding user message.

              createdAt: new Date(
                Math.max(
                  Date.now(),
                  userMessage.createdAt.getTime() + 1
                )
              ),
            },
          });

        // ------------------------------------------
        // UPDATE SESSION TIMESTAMP
        // ------------------------------------------

        const session =
          await tx.chatSession.update({
            where: {
              id: activeSessionId,
            },

            data: {
              updatedAt: assistantMessage.createdAt,
            },

            select: {
              id: true,
              title: true,
              datasetId: true,
              createdAt: true,
              updatedAt: true,

              _count: {
                select: {
                  messages: true,
                },
              },
            },
          });

        return {
          session,
          userMessage,
          assistantMessage,
        };
      });

    // ----------------------------------------------
    // RETURN FINAL AI CHAT RESPONSE
    // ----------------------------------------------

    res.status(200).json({
      success: true,

      message:
        "Dataset analyzed and conversation saved successfully",

      // Persistent conversation information.

      sessionId: savedConversation.session.id,

      session: savedConversation.session,

      userMessageId:
        savedConversation.userMessage.id,

      assistantMessageId:
        savedConversation.assistantMessage.id,

      // Existing dataset information.

      dataset: {
        id: dataset.id,

        name: dataset.name,

        originalName: dataset.originalName,

        fileType: dataset.fileType,

        fileSize: dataset.fileSize,
      },

      // Existing AI response information.

      question,

      answer: aiResult.answer,

      query_plan: aiResult.query_plan,

      result: aiResult.result,

      chart: aiResult.chart,
    });

  } catch (error) {

    // ----------------------------------------------
    // HANDLE SESSION ACCESS ERRORS
    // ----------------------------------------------

    if (error instanceof SessionUnavailableError) {
      res.status(404).json({
        success: false,

        message:
          "Conversation or dataset is no longer available",
      });

      return;
    }

    // ----------------------------------------------
    // HANDLE UNEXPECTED ERRORS
    // ----------------------------------------------

    console.error(
      "AI chat controller error:",

      error instanceof Error
        ? error.name
        : "Unknown error"
    );

    res.status(500).json({
      success: false,

      message:
        "Unable to analyze the dataset or save the conversation",
    });
  }
};