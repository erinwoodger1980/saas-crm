import { Router } from "express";
import { FeedbackStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { sendFeedbackNotification } from "../services/email-notification";

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

function featureFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = (u.pathname || "/").replace(/\/$/, "") || "/";
    const slug = path === "/" ? "home" : path.slice(1);
    const cleaned = slug
      .toLowerCase()
      .replace(/[^a-z0-9\-\/]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\-|\-$/g, "");
    return cleaned || "unknown";
  } catch {
    return null;
  }
}

/** Ensure Feedback enum/table exist in DB (idempotent best-effort).
 *  This is a safety net for live environments where migration may lag.
 */
async function ensureFeedbackSchema() {
  // Check if table exists
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "Feedback" LIMIT 1`);
    return; // exists
  } catch (e: any) {
    const msg = e?.message || String(e);
    // fall through to attempt creation when relation missing
    if (!/does not exist|invalid reference|undefined table|42P01|P2021/i.test(msg)) {
      // Different error; do not try to create schema.
      throw e;
    }
  }

  // Create enum type if missing, then table and indexes. These DDL statements are idempotent.
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackStatus') THEN
          CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN','RESOLVED');
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Feedback" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "userId" TEXT,
        "feature" TEXT NOT NULL,
        "rating" INTEGER,
        "comment" TEXT,
        "sourceUrl" TEXT,
        "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
        "resolvedAt" TIMESTAMP,
        "resolvedById" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // FKs (best-effort; may fail if already exist)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL; END;

        BEGIN
          ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL; END;

        BEGIN
          ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedById_fkey"
            FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL; END;
      END $$;
    `);

    // Indexes
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        BEGIN
          CREATE INDEX IF NOT EXISTS "Feedback_tenantId_feature_createdAt_idx"
            ON "Feedback" ("tenantId", "feature", "createdAt");
        EXCEPTION WHEN duplicate_table THEN NULL; END;

        BEGIN
          CREATE INDEX IF NOT EXISTS "Feedback_tenantId_status_createdAt_idx"
            ON "Feedback" ("tenantId", "status", "createdAt");
        EXCEPTION WHEN duplicate_table THEN NULL; END;
      END $$;
    `);
  } catch (e) {
    // Last resort: swallow to let caller handle the original request outcome
    console.warn("[feedback] ensureFeedbackSchema failed:", (e as any)?.message || e);
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
    let featureFinal: string | null = typeof feature === "string" ? feature : null;
    if (!featureFinal) {
      // Derive from provided sourceUrl or Referer header as a best-effort fallback
      const referer = (req.headers["referer"] as string | undefined) || undefined;
      featureFinal = featureFromUrl(sourceUrl as string | undefined) || featureFromUrl(referer) || null;
    }
    if (!featureFinal) {
      return res.status(400).json({ error: "feature_required" });
    }
    if (rating != null && (isNaN(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "rating_must_be_1_to_5" });
    }

    let row;
    try {
      row = await prisma.feedback.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId ?? null,
          feature: sanitizeFeature(featureFinal),
          rating: rating ?? null,
          comment: comment ? String(comment).slice(0, 5000) : null,
          sourceUrl: sanitizeUrl(sourceUrl),
          status: FeedbackStatus.OPEN,
        },
        select: FEEDBACK_SELECT,
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      // If table is missing in live DB, create it on the fly and retry once
      if (/does not exist|relation .* feedback|P2021|42P01/i.test(msg)) {
        await ensureFeedbackSchema();
        row = await prisma.feedback.create({
          data: {
            tenantId: auth.tenantId,
            userId: auth.userId ?? null,
            feature: sanitizeFeature(featureFinal),
            rating: rating ?? null,
            comment: comment ? String(comment).slice(0, 5000) : null,
            sourceUrl: sanitizeUrl(sourceUrl),
            status: FeedbackStatus.OPEN,
          },
          select: FEEDBACK_SELECT,
        });
      } else {
        throw e;
      }
    }

    // Send email notification to admin (non-blocking)
    (async () => {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: auth.tenantId },
          select: { name: true },
        });

        await sendFeedbackNotification({
          tenantName: tenant?.name || auth.tenantId,
          tenantId: auth.tenantId,
          userName: row.user?.name || undefined,
          userEmail: row.user?.email || undefined,
          feature: row.feature,
          rating: row.rating || undefined,
          comment: row.comment || undefined,
          sourceUrl: row.sourceUrl || undefined,
          createdAt: row.createdAt,
        });
      } catch (emailError) {
        console.error("[feedback] Failed to send email notification:", emailError);
        // Don't fail the request if email fails
      }
    })();

    res.json({ ok: true, feedback: row });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = e?.code || e?.name;
    console.error("[POST /feedback] failed:", msg);
    // If it still fails after ensure, surface as unavailable to UI
    if (code === "P2021" || /does not exist|42P01/i.test(msg)) {
      return res.status(503).json({ error: "feedback_unavailable" });
    }
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /feedback?feature=quoteParserV2&limit=50&status=OPEN
router.get("/", async (req: any, res) => {
  try {
    const auth = req.auth;
    console.debug("[GET /feedback] auth:", auth ? { tenantId: auth.tenantId, userId: auth.userId } : null);
    console.debug("[GET /feedback] query:", req.query);
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
    const msg = e?.message || String(e);
    const code = e?.code || e?.name;
    console.error("[GET /feedback] failed:", msg);
    if (code === "P2021" || /does not exist/i.test(msg)) {
      return res.json({ ok: true, count: 0, averageRating: null, items: [] });
    }
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
    if (nextStatus === FeedbackStatus.COMPLETED) {
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
    const msg = e?.message || String(e);
    const code = e?.code || e?.name;
    console.error("[PATCH /feedback/:id] failed:", msg);
    if (code === "P2021" || /does not exist/i.test(msg)) {
      return res.status(404).json({ error: "not_found" });
    }
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /feedback/:id/response { approved: true | false }
router.post("/:id/response", async (req: any, res) => {
  try {
    const auth = req.auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id_required" });

    const approved = req.body?.approved;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: "approved_required" });
    }

    const feedback = await prisma.feedback.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!feedback) {
      return res.status(404).json({ error: "not_found" });
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        userResponseApproved: approved,
        userResponseAt: new Date(),
      },
      select: FEEDBACK_SELECT,
    });

    res.json({ ok: true, feedback: updated });
  } catch (e: any) {
    const msg = e?.message || String(e);
    const code = e?.code || e?.name;
    console.error("[POST /feedback/:id/response] failed:", msg);
    if (code === "P2021" || /does not exist/i.test(msg)) {
      return res.status(404).json({ error: "not_found" });
    }
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;