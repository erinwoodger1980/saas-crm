// api/src/routes/follow-up-rules.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

// Get all follow-up rules for tenant
router.get("/", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rules = await prisma.followUpRule.findMany({
      where: { tenantId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    return res.json({ ok: true, rules });
  } catch (e: any) {
    console.error("[follow-up-rules] GET failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Create new follow-up rule
router.post("/", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const {
      trigger,
      delayDays,
      taskTitle,
      emailSubject,
      emailBodyTemplate,
      contextTemplate,
      priority,
      autoSchedule,
      isActive,
    } = req.body;

    if (!trigger || typeof delayDays !== "number") {
      return res.status(400).json({ error: "trigger and delayDays required" });
    }

    const rule = await prisma.followUpRule.create({
      data: {
        tenantId,
        trigger,
        delayDays,
        taskTitle: taskTitle || `Follow up: ${trigger}`,
        emailSubject: emailSubject || "Following up on our conversation",
        emailBodyTemplate: emailBodyTemplate || null,
        contextTemplate: contextTemplate || null,
        priority: priority || 2,
        autoSchedule: autoSchedule ?? true,
        isActive: isActive ?? true,
      },
    });

    return res.json({ ok: true, rule });
  } catch (e: any) {
    console.error("[follow-up-rules] POST failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Update follow-up rule
router.patch("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rule = await prisma.followUpRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule || rule.tenantId !== tenantId) {
      return res.status(404).json({ error: "rule_not_found" });
    }

    const {
      trigger,
      delayDays,
      taskTitle,
      emailSubject,
      emailBodyTemplate,
      contextTemplate,
      priority,
      autoSchedule,
      isActive,
    } = req.body;

    const updated = await prisma.followUpRule.update({
      where: { id: rule.id },
      data: {
        ...(trigger && { trigger }),
        ...(typeof delayDays === "number" && { delayDays }),
        ...(taskTitle && { taskTitle }),
        ...(emailSubject && { emailSubject }),
        ...(emailBodyTemplate !== undefined && { emailBodyTemplate }),
        ...(contextTemplate !== undefined && { contextTemplate }),
        ...(typeof priority === "number" && { priority }),
        ...(typeof autoSchedule === "boolean" && { autoSchedule }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
    });

    return res.json({ ok: true, rule: updated });
  } catch (e: any) {
    console.error("[follow-up-rules] PATCH failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Delete follow-up rule
router.delete("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rule = await prisma.followUpRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule || rule.tenantId !== tenantId) {
      return res.status(404).json({ error: "rule_not_found" });
    }

    await prisma.followUpRule.delete({
      where: { id: rule.id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[follow-up-rules] DELETE failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Toggle rule active status
router.post("/:id/toggle", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rule = await prisma.followUpRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule || rule.tenantId !== tenantId) {
      return res.status(404).json({ error: "rule_not_found" });
    }

    const updated = await prisma.followUpRule.update({
      where: { id: rule.id },
      data: { isActive: !rule.isActive },
    });

    return res.json({ ok: true, rule: updated });
  } catch (e: any) {
    console.error("[follow-up-rules] toggle failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Get follow-up analytics
router.get("/analytics", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Count by trigger type
    const byTrigger = await prisma.followUpHistory.groupBy({
      by: ["ruleId"],
      where: { tenantId },
      _count: { id: true },
    });

    // Response metrics
    const histories = await prisma.followUpHistory.findMany({
      where: {
        tenantId,
        sentAt: { not: null },
      },
      select: {
        responded: true,
        responseTime: true,
        converted: true,
        userEdited: true,
        editDistance: true,
      },
    });

    const total = histories.length;
    const responded = histories.filter((h) => h.responded).length;
    const converted = histories.filter((h) => h.converted).length;
    const avgResponseTime = histories
      .filter((h) => h.responseTime)
      .reduce((sum, h) => sum + (h.responseTime || 0), 0) / (responded || 1);
    const avgEditDistance = histories
      .filter((h) => h.editDistance)
      .reduce((sum, h) => sum + (h.editDistance || 0), 0) / total || 0;

    return res.json({
      ok: true,
      analytics: {
        totalSent: total,
        responseRate: total > 0 ? (responded / total) * 100 : 0,
        conversionRate: total > 0 ? (converted / total) * 100 : 0,
        avgResponseTimeMinutes: Math.round(avgResponseTime),
        avgEditDistance: Math.round(avgEditDistance),
        byTrigger: byTrigger.map((item) => ({
          ruleId: item.ruleId,
          count: item._count.id,
        })),
      },
    });
  } catch (e: any) {
    console.error("[follow-up-rules] analytics failed:", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

export default router;
