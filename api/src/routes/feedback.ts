import { Router } from "express";
import { FeedbackStatus } from "@prisma/client";
import { prisma } from "../prisma";

const router = Router();

const FEEDBACK_SELECT = {
  id: true,
  tenantId: true,
  feature: true,
  rating: true,
  comment: true,
  sourceUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  resolvedById: true,
  userId: true,
  user: {
    select: { id: true, email: true, name: true },
  },
  resolvedBy: {
    select: { id: true, email: true, name: true },
  },
} as const;

function sanitizeFeature(feature: string): string {
  const trimmed = feature.trim();
  if (!trimmed) return "unknown";
  return trimmed.slice(0, 100);
}

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

// POST /feedback  { feature: string, rating?: number, comment?: string, sourceUrl?: string }
router.post("/", async (req: any, res) => {
  try {
    const auth = req.auth;
    // Debug: log incoming auth and body for visibility in server logs (safe-ish info)
    console.debug("[POST /feedback] auth:", auth ? { tenantId: auth.tenantId, userId: auth.userId } : null);
    console.debug("[POST /feedback] body:", req.body);
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const { feature, rating, comment, sourceUrl } = req.body || {};
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
        feature: sanitizeFeature(feature),
        rating: rating ?? null,
        comment: comment ? String(comment).slice(0, 5000) : null,
        sourceUrl: sanitizeUrl(sourceUrl),
        status: FeedbackStatus.OPEN,
      },
      select: FEEDBACK_SELECT,
    });

    res.json({ ok: true, feedback: row });
  } catch (e: any) {
    console.error("[POST /feedback] failed:", e?.message || e, e?.stack || "no stack");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /feedback?feature=quoteParserV2&limit=50&status=OPEN
router.get("/", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const feature = req.query.feature as string | undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 50), 200));

    const statusParam = (req.query.status as string | undefined)?.toUpperCase();
    const status =
      statusParam && Object.values(FeedbackStatus).includes(statusParam as FeedbackStatus)
        ? (statusParam as FeedbackStatus)
        : undefined;

    const where = {
      tenantId: auth.tenantId,
      ...(feature ? { feature } : {}),
      ...(status ? { status } : {}),
    };
    const items = await prisma.feedback.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
      select: FEEDBACK_SELECT,
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

// PATCH /feedback/:id { status: "RESOLVED" | "OPEN" }
router.patch("/:id", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id_required" });

    const statusRaw = (req.body?.status as string | undefined)?.toUpperCase();
    if (!statusRaw || !Object.values(FeedbackStatus).includes(statusRaw as FeedbackStatus)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    const feedback = await prisma.feedback.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!feedback) {
      return res.status(404).json({ error: "not_found" });
    }

    const nextStatus = statusRaw as FeedbackStatus;
    const data: any = { status: nextStatus };
    if (nextStatus === FeedbackStatus.RESOLVED) {
      data.resolvedAt = new Date();
      data.resolvedById = auth.userId ?? null;
    } else {
      data.resolvedAt = null;
      data.resolvedById = null;
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data,
      select: FEEDBACK_SELECT,
    });

    res.json({ ok: true, feedback: updated });
  } catch (e: any) {
    console.error("[PATCH /feedback/:id] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;