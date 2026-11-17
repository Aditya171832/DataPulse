import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./auth.middleware";

// Available DataPulse roles
export type UserRole = "USER" | "OWNER" | "ADMIN";

// Verify authorization using the current database role.
export const authorize = (...allowedRoles: UserRole[]) => {
  return async (
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

      const user = await prisma.user.findUnique({
        where: {
          id: req.user.userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "User account not found",
        });
        return;
      }

      if (!allowedRoles.includes(user.role as UserRole)) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
        return;
      }

      // Keep the request role synchronized with PostgreSQL.
      req.user.role = user.role;

      next();
    } catch (error) {
      console.error("Role authorization error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to verify user permissions",
      });
    }
  };
};