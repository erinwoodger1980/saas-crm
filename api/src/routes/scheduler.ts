// api/src/routes/scheduler.ts
import { Router } from "express";
import { triggerDailyDigestNow } from "../services/scheduler";
import { sendDailyTaskDigest } from "../services/task-digest";

const router = Router();

/**
 * POST /scheduler/trigger-daily-digest
 * Manually trigger daily digest for all users (for testing)
 */
router.post("/trigger-daily-digest", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // Optional: restrict to admin users only
    const user = await (req as any).prisma?.user.findUnique({
      where: { id: auth.userId },
      select: { role: true },
    });

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return res.status(403).json({ error: "forbidden" });
    }

    console.log(`[scheduler] Manual trigger by user ${auth.userId}`);
    
    // Run in background
    triggerDailyDigestNow()
      .then(() => console.log("[scheduler] Manual trigger completed"))
      .catch((err) => console.error("[scheduler] Manual trigger error:", err));

    res.json({
      ok: true,
      message: "Daily digest job triggered. Check logs for progress.",
    });
  } catch (error: any) {
    console.error("[scheduler] Error triggering digest:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /scheduler/send-digest-to-user
 * Send digest to a specific user (for testing)
 */
router.post("/send-digest-to-user", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const targetUserId = req.body?.userId || auth.userId;

    console.log(`[scheduler] Sending digest to user ${targetUserId}`);
    await sendDailyTaskDigest(targetUserId);

    res.json({
      ok: true,
      message: `Daily digest sent to user ${targetUserId}`,
    });
  } catch (error: any) {
    console.error("[scheduler] Error sending digest:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

export default router;
