// api/src/routes/marketing-roi.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function parsePeriod(period: unknown): Date | null {
  if (typeof period !== "string") return null;
  const trimmed = period.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 0 || month > 11) return null;

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function addOneMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

type QueryRow = {
  source: string | null;
  leads: bigint | number | null;
  wins: bigint | number | null;
  avg_job_value: any;
  total_job_value: any;
  spend_pence: bigint | number | null;
  followup_cost_pence: bigint | number | null;
};

router.get("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const periodStart = parsePeriod(req.query.period);
    if (!periodStart) {
      return res.status(400).json({
        error: "invalid_period",
        message: "period must be in YYYY-MM format",
      });
    }
    const periodEnd = addOneMonth(periodStart);

    const rows = await prisma.$queryRaw<QueryRow[]>`
      WITH lead_data AS (
        SELECT
          COALESCE(NULLIF(TRIM((l."custom" ->> 'source')), ''), 'Unknown') AS source,
          COUNT(*)::bigint AS leads
        FROM "Lead" l
        WHERE l."tenantId" = ${tenantId}
          AND l."capturedAt" >= ${periodStart}
          AND l."capturedAt" < ${periodEnd}
        GROUP BY 1
      ),
      quote_data AS (
        SELECT
          COALESCE(NULLIF(TRIM((l."custom" ->> 'source')), ''), 'Unknown') AS source,
          COUNT(*)::bigint AS wins,
          AVG(COALESCE(q."totalGBP", 0)) AS avg_job_value,
          SUM(COALESCE(q."totalGBP", 0)) AS total_job_value
        FROM "Quote" q
        LEFT JOIN "Lead" l ON l.id = q."leadId"
        WHERE q."tenantId" = ${tenantId}
          AND q."status" = 'ACCEPTED'
          AND COALESCE(q."updatedAt", q."createdAt") >= ${periodStart}
          AND COALESCE(q."updatedAt", q."createdAt") < ${periodEnd}
        GROUP BY 1
      ),
      followup_data AS (
        SELECT
          COALESCE(NULLIF(TRIM(fe."source"), ''), 'Unknown') AS source,
          SUM(COALESCE(fe."costPence", 0))::bigint AS followup_cost_pence
        FROM "FollowUpEvent" fe
        WHERE fe."tenantId" = ${tenantId}
          AND COALESCE(fe."sentAt", fe."scheduledAt") >= ${periodStart}
          AND COALESCE(fe."sentAt", fe."scheduledAt") < ${periodEnd}
        GROUP BY 1
      ),
      spend_data AS (
        SELECT
          COALESCE(NULLIF(TRIM(ss."source"), ''), 'Unknown') AS source,
          SUM(COALESCE(ss."spendPence", 0))::bigint AS spend_pence
        FROM "SourceSpend" ss
        WHERE ss."tenantId" = ${tenantId}
          AND ss."periodEnd" > ${periodStart}
          AND ss."periodStart" < ${periodEnd}
        GROUP BY 1
      ),
      all_sources AS (
        SELECT source FROM lead_data
        UNION
        SELECT source FROM quote_data
        UNION
        SELECT source FROM followup_data
        UNION
        SELECT source FROM spend_data
      )
      SELECT
        s.source,
        COALESCE(ld.leads, 0)::bigint AS leads,
        COALESCE(qd.wins, 0)::bigint AS wins,
        qd.avg_job_value,
        qd.total_job_value,
        COALESCE(sd.spend_pence, 0)::bigint AS spend_pence,
        COALESCE(fd.followup_cost_pence, 0)::bigint AS followup_cost_pence
      FROM all_sources s
      LEFT JOIN lead_data ld ON ld.source = s.source
      LEFT JOIN quote_data qd ON qd.source = s.source
      LEFT JOIN followup_data fd ON fd.source = s.source
      LEFT JOIN spend_data sd ON sd.source = s.source
      ORDER BY s.source;
    `;

    const results = rows.map((row) => {
      const source = row.source ?? "Unknown";
      const leads = Number(row.leads ?? 0);
      const wins = Number(row.wins ?? 0);
      const avgJobValueRaw = row.avg_job_value != null ? Number(row.avg_job_value) : null;
      const totalJobValue = row.total_job_value != null ? Number(row.total_job_value) : 0;
      const spend = Number(row.spend_pence ?? 0) / 100;
      const followupCost = Number(row.followup_cost_pence ?? 0) / 100;
      const totalCost = spend + followupCost;

      const costPerWin = wins > 0 ? totalCost / wins : null;
      const conversionRate = leads > 0 ? wins / leads : null;
      const roi = totalCost > 0 ? (totalJobValue - totalCost) / totalCost : null;

      return {
        source,
        leads,
        wins,
        avgJobValue: avgJobValueRaw,
        spend,
        followupCost,
        costPerWin,
        conversionRate,
        roi,
      };
    });

    res.json(results);
  } catch (err) {
    console.error("GET /marketing/roi failed", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
