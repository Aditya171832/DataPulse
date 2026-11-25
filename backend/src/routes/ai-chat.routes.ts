import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { requireWorkspace } from "../middleware/workspace.middleware";

import { chatWithDataset } from "../controllers/ai-chat.controller";

import {
  createChatSession,
  getChatSessions,
  getChatSessionById,
  renameChatSession,
  deleteChatSession,
} from "../controllers/chat-session.controller";

const router = Router();

// --------------------------------------------------
// AUTHENTICATION AND WORKSPACE PROTECTION
// --------------------------------------------------

router.use(authenticate);
router.use(requireWorkspace);

// --------------------------------------------------
// AI DATA ASSISTANT
// --------------------------------------------------

router.post("/chat", chatWithDataset);

// --------------------------------------------------
// AI CHAT HISTORY
// --------------------------------------------------

// Create a new conversation
router.post("/sessions", createChatSession);

// Get all conversations
router.get("/sessions", getChatSessions);

// Get conversation with messages
router.get("/sessions/:id", getChatSessionById);

// Rename a conversation
router.patch("/sessions/:id", renameChatSession);

// Delete a conversation
router.delete("/sessions/:id", deleteChatSession);

export default router;