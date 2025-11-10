// api/src/routes/interest.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { normalizeEmail } from "../lib/email";

const router = Router();

/**
 * POST /api/interest
 * Register interest for JoineryAI - pre-launch waitlist
 */
router.post("/", async (req, res) => {
  try {
    const { email, name, company, message } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email) || email;

    // Check if already registered
    const existing = await prisma.interestRegistration.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.json({
        success: true,
        message: "You're already on the waitlist!",
      });
    }

    // Create interest registration
    await prisma.interestRegistration.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        company: company || null,
        message: message || null,
      },
    });

    console.log(`📧 New interest registration: ${normalizedEmail}`);

    res.json({
      success: true,
      message: "Thanks for your interest! We'll be in touch soon.",
    });
  } catch (error: any) {
    console.error("Failed to register interest:", error);
    res.status(500).json({ error: "Failed to register interest" });
  }
});

/**
 * GET /api/interest/count
 * Get count of interest registrations (public)
 */
router.get("/count", async (_req, res) => {
  try {
    const count = await prisma.interestRegistration.count();
    res.json({ count });
  } catch (error: any) {
    console.error("Failed to get interest count:", error);
    res.status(500).json({ error: "Failed to get count" });
  }
});

export default router;
