/**
 * Temporary route to self-promote to admin
 * Remove this file after granting admin access
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

router.post("/make-me-admin", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: "admin" },
      select: { id: true, email: true, name: true, role: true }
    });

    res.json({ 
      success: true, 
      message: "You are now an admin! Refresh the page.",
      user: updated 
    });
  } catch (error) {
    console.error("Error making admin:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

export default router;
