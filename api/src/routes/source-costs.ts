// api/src/routes/source-costs.ts
import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const router = Router();

type AuthedReq = Request & { auth?: { tenantId?: string } };
function getAuth(req: AuthedReq) {
  return { tenantId: req.auth?.tenantId as string | undefined };
}

// Accept "YYYY-MM" or "YYYY-MM-DD" or an ISO string; return first day of month (UTC)
function parseMonthToUTC(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const s = input.trim();
  const mOnly = /^(\d{4})-(\d{2})$/;
  const mWithDay = /^(\d{4})-(\d{2})-(\d{2})$/;

  const mo = s.match(mOnly);
  if (mo) {
    const y = Number(mo[1]);
    const m = Number(mo[2]) - 1;
    if (m < 0 || m > 11) return null;
    return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  }

  const md = s.match(mWithDay);
  if (md) {
    const y = Number(md[1]);
    const m = Number(md[2]) - 1;
    if (m < 0 || m > 11) return null;
    return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  }
  return null;
}

/* ----------------------- Schemas ----------------------- */
const listRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const upsertSchema = z.object({
  source: z.string().min(1),
  month: z.string().min(4),
  spend: z.coerce.number().finite().nonnegative().optional().default(0),
  leads: z.coerce.number().int().nonnegative().optional().default(0),
  conversions: z.coerce.number().int().nonnegative().optional().default(0),
  scalable: z.coerce.boolean().optional().default(true),
});

const recalcSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional().default(3),
});

/* ----------------------------------------------------
 * GET /source-costs/sources
 * Lists distinct sources with their latest month metrics
 * and computed CPL/CPS for convenience.
 * ---------------------------------------------------- */
router.get("/sources", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Ordered so first occurrence per source is the latest
    const rows = await prisma.leadSourceCost.findMany({
      where: { tenantId },
      orderBy: [{ source: "asc" }, { month: "desc" }],
    });

    const latestBySource: Record<string, (typeof rows)[number]> = {};
    for (const r of rows) if (!latestBySource[r.source]) latestBySource[r.source] = r;

    const out = Object.values(latestBySource).map((r) => {
      const spend = Number(r.spend || 0);
      const leads = Number(r.leads || 0);
      const conversions = Number(r.conversions || 0);
      return {
        source: r.source,
        month: r.month.toISOString(),
        spend,
        leads,
        conversions,
        cpl: leads ? spend / leads : null,
        cps: conversions ? spend / conversions : null,
      };
    });

    res.json(out);
  } catch (err) {
    console.error("GET /source-costs/sources error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /source-costs?from=YYYY-MM&to=YYYY-MM   (to is exclusive)
 */
router.get("/", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const parsed = listRangeSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "invalid_query" });

    const from = parsed.data.from ? parseMonthToUTC(parsed.data.from) : null;
    const to = parsed.data.to ? parseMonthToUTC(parsed.data.to) : null;

    const where: Prisma.LeadSourceCostWhereInput = { tenantId };
if (from || to) {
  where.month = {};
  if (from) where.month.gte = from;
  if (to)   where.month.lt = to;
}

    const rows = await prisma.leadSourceCost.findMany({
      where,
      orderBy: [{ source: "asc" }, { month: "desc" }],
    });

    res.json(
      rows.map((r) => ({
        ...r,
        month: r.month.toISOString(),
      }))
    );
  } catch (err) {
    console.error("GET /source-costs error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /source-costs
 * body: { source, month, spend, leads, conversions, scalable }
 */
router.post("/", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const parsed = upsertSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const m = parseMonthToUTC(parsed.data.month);
    if (!m) {
      return res.status(400).json({
        error: "invalid_month",
        message: "month must be YYYY-MM or YYYY-MM-DD (or ISO), e.g. 2025-10",
      });
    }

    const data = {
      tenantId,
      source: parsed.data.source,
      month: m,
      spend: parsed.data.spend,
      leads: parsed.data.leads,
      conversions: parsed.data.conversions,
      scalable: parsed.data.scalable,
    };

    // @@unique([tenantId, source, month]) required in Prisma schema
    const row = await prisma.leadSourceCost.upsert({
      where: {
        tenantId_source_month: { tenantId, source: data.source, month: data.month },
      },
      update: data,
      create: data,
    });

    res.json({ ...row, month: row.month.toISOString() });
  } catch (err) {
    console.error("POST /source-costs error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /source-costs/:id
 */
router.delete("/:id", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);

    // Use deleteMany to enforce tenant scoping in a single round-trip
    const result = await prisma.leadSourceCost.deleteMany({
      where: { id, tenantId },
    });

    if (result.count === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /source-costs/:id error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/* ----------------------------------------------------
 * POST /source-costs/recalc  body:{ months?: number }
 * Re-count leads & conversions per source/month from
 * the Leads table and upserts into LeadSourceCost.
 * ---------------------------------------------------- */
router.post("/recalc", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const parsed = recalcSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const months = parsed.data.months;
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
    from.setUTCHours(0, 0, 0, 0);

    const leads = await prisma.lead.findMany({
      where: { tenantId, capturedAt: { gte: from } },
      select: { capturedAt: true, status: true, custom: true },
    });

    const ym = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    const byKey = new Map<
      string,
      { tenantId: string; source: string; month: Date; leads: number; conversions: number }
    >();

    for (const l of leads) {
      const src = (String((l.custom as any)?.source ?? "Unknown")).trim() || "Unknown";
      const d = new Date(l.capturedAt);
      const month = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
      const key = `${src}::${ym(month)}`;
      const v = byKey.get(key) ?? { tenantId, source: src, month, leads: 0, conversions: 0 };
      v.leads += 1;
      if (String(l.status).toUpperCase() === "WON") v.conversions += 1;
      byKey.set(key, v);
    }

    // Batch upserts
    await prisma.$transaction(
      Array.from(byKey.values()).map((v) =>
        prisma.leadSourceCost.upsert({
          where: { tenantId_source_month: { tenantId, source: v.source, month: v.month } },
          update: { leads: v.leads, conversions: v.conversions },
          create: {
            tenantId,
            source: v.source,
            month: v.month,
            spend: 0,
            scalable: true,
            leads: v.leads,
            conversions: v.conversions,
          },
        })
      )
    );

    res.json({ ok: true, months, updated: byKey.size });
  } catch (err) {
    console.error("POST /source-costs/recalc error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;