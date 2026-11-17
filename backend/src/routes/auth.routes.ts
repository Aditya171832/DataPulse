
import { Router } from "express";

import {
  register,
  login,
  getMe,
} from "../controllers/auth.controller";

import {
  updateProfile,
  changePassword,
} from "../controllers/settings.controller";

import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// --------------------------------------------
// PUBLIC AUTHENTICATION ROUTES
// --------------------------------------------

// Register new user
router.post("/register", register);

// Login user
router.post("/login", login);

// --------------------------------------------
// PROTECTED AUTHENTICATION ROUTES
// --------------------------------------------

// Get currently logged-in user
router.get("/me", authenticate, getMe);

// Update user profile
router.patch("/profile", authenticate, updateProfile);

// Change account password
router.patch("/password", authenticate, changePassword);

export default router;
