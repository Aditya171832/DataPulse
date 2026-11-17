
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/prisma";

// Allowed user roles
const roleSchema = z.object({
  role: z.enum(["USER", "OWNER", "ADMIN"]),
});

// GET ALL USERS (ADMIN ONLY)
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET USER BY ID (ADMIN ONLY)
export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE USER ROLE (ADMIN ONLY)
export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    // Validate requested role
    const result = roleSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Invalid role. Allowed roles are USER, OWNER, ADMIN.",
      });
      return;
    }

    const newRole = result.data.role;

    // Update role safely using a database transaction
    const transactionResult = await prisma.$transaction(
      async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { id },
        });

        if (!existingUser) {
          return { status: "NOT_FOUND" as const };
        }

        // Protect the last ADMIN account
        if (
          existingUser.role === "ADMIN" &&
          newRole !== "ADMIN"
        ) {
          const adminCount = await tx.user.count({
            where: { role: "ADMIN" },
          });

          if (adminCount <= 1) {
            return { status: "LAST_ADMIN" as const };
          }
        }

        const updatedUser = await tx.user.update({
          where: { id },
          data: { role: newRole },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            updatedAt: true,
          },
        });

        return {
          status: "UPDATED" as const,
          user: updatedUser,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (transactionResult.status === "NOT_FOUND") {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (transactionResult.status === "LAST_ADMIN") {
      res.status(409).json({
        success: false,
        message: "Cannot change the role of the last ADMIN account",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user: transactionResult.user,
    });
  } catch (error) {
    console.error("Update user role error:", error);

    // Concurrent transaction conflict
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      res.status(409).json({
        success: false,
        message: "Concurrent role update detected. Please try again.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
