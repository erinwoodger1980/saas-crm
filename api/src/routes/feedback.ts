import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// POST /feedback  { feature: string, rating?: number, comment?: string }
router.post("/", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const { feature, rating, comment } = req.body || {};
    if (!feature || typeof feature !== "string") {
      return res.status(400).json({ error: "feature_required" });
    }
    if (rating != null && (isNaN(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "rating_must_be_1_to_5" });
    }

    const row = await prisma.feedback.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId ?? null,
        feature,
        rating: rating ?? null,
        comment: comment ?? null,
      },
      select: {
        id: true, feature: true, rating: true, comment: true,
        createdAt: true, tenantId: true, userId: true,
      },
    });

    res.json({ ok: true, feedback: row });
  } catch (e: any) {
    console.error("[POST /feedback] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /feedback?feature=quoteParserV2&limit=50
router.get("/", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const feature = req.query.feature as string | undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 50), 200));

    const where = { tenantId: auth.tenantId, ...(feature ? { feature } : {}) };
    const items = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, feature: true, rating: true, comment: true,
        createdAt: true, userId: true,
      },
    });

    const avg =
      items.length && items.some(i => i.rating != null)
        ? (items.reduce((s, i) => s + (i.rating ?? 0), 0) /
           items.filter(i => i.rating != null).length)
        : null;

    res.json({ ok: true, count: items.length, averageRating: avg, items });
  } catch (e: any) {
    console.error("[GET /feedback] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;