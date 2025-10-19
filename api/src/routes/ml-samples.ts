// api/src/routes/ml-samples.ts
import { Router } from "express";
import { prisma } from "../db";

// Optional: define which fields are safe to expose
const SAMPLE_SELECT = {
  id: true,
  tenantId: true,
  messageId: true,
  attachmentId: true,
  url: true,
  filename: true,
  quotedAt: true,
  textChars: true,
  currency: true,
  estimatedTotal: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
  // If you added these in your schema:
  notes: true,
  label: true,
} as const;

const router = Router();

/**
 * GET /internal/ml/samples
 * Query params:
 *   - limit?: number (default 25, max 100)
 *   - cursor?: string (opaque ID cursor; returns items before this ID by createdAt desc)
 *   - q?: string (search filename/subject/url/messageId/attachmentId)
 *   - after?: ISO date (filter quotedAt >= after)
 *   - before?: ISO date (filter quotedAt <= before)
 */
router.get("/samples", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 25), 100));
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

    const after = typeof req.query.after === "string" ? new Date(req.query.after) : undefined;
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;

    const where: any = { tenantId };
    // Date filters on quotedAt (if present)
    if (after || before) {
      where.quotedAt = {};
      if (after && !isNaN(after.getTime())) where.quotedAt.gte = after;
      if (before && !isNaN(before.getTime())) where.quotedAt.lte = before;
    }

    // Simple broad search (tune to your schema)
    if (q) {
      where.OR = [
        { filename: { contains: q, mode: "insensitive" } },
        { url: { contains: q, mode: "insensitive" } },
        { messageId: { contains: q, mode: "insensitive" } },
        { attachmentId: { contains: q, mode: "insensitive" } },
      ];
    }

    // Cursor pagination by createdAt desc / id desc
    const take = limit + 1;
    const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const items = await prisma.mLTrainingSample.findMany({
      where,
      select: SAMPLE_SELECT,
      orderBy,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items[items.length - 1];
      nextCursor = nextItem.id;
      items.pop();
    }

    return res.json({ ok: true, count: items.length, nextCursor, items });
  } catch (e: any) {
    console.error("[ml-samples] list failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /internal/ml/samples/:id
 * Body can include a subset of { notes?: string, label?: string }
 * (Make sure these fields exist in your Prisma model before using.)
 */
router.patch("/samples/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = req.params.id;
    const { notes, label } = req.body ?? {};

    const data: any = {};
    if (typeof notes === "string") data.notes = notes;
    if (typeof label === "string") data.label = label;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "no_updates" });
    }

    const updated = await prisma.mLTrainingSample.update({
      where: { id },
      data,
      select: SAMPLE_SELECT,
    });

    // enforce tenant ownership
    if (updated.tenantId !== tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    return res.json({ ok: true, sample: updated });
  } catch (e: any) {
    console.error("[ml-samples] patch failed:", e?.message || e);
    if (e?.code === "P2025") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /internal/ml/samples/:id
 */
router.delete("/samples/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // fetch first to verify tenant
    const existing = await prisma.mLTrainingSample.findUnique({
      where: { id: req.params.id },
      select: { id: true, tenantId: true },
    });
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.tenantId !== tenantId) return res.status(403).json({ error: "forbidden" });

    await prisma.mLTrainingSample.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ml-samples] delete failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;