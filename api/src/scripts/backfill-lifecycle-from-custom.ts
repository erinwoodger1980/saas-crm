import { Prisma } from "@prisma/client";

import prisma from "../db";
import { parseFlexibleDate, toNumberGBP } from "../lib/leads/fieldMap";

type Options = {
  tenant?: string;
  apply: boolean;
  preview: number;
};

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.findIndex((a) => a === flag);
    if (idx === -1) return undefined;
    const next = args[idx + 1];
    return next && !next.startsWith("-") ? next : undefined;
  };

  const tenant = getArg("--tenant") ?? getArg("--tenant-id") ?? getArg("--tenant-slug");
  const apply = args.includes("--apply");
  const previewRaw = getArg("--preview");
  const preview = previewRaw ? Math.max(0, Number(previewRaw) || 0) : 10;

  return { tenant, apply, preview };
}

function parseDateOrUndefined(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : undefined;
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : undefined;
  }
  if (typeof raw === "string") {
    const parsed = parseFlexibleDate(raw);
    return parsed ?? undefined;
  }
  return undefined;
}

function parseMoneyOrUndefined(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string") {
    const parsed = toNumberGBP(raw);
    return parsed == null ? undefined : parsed;
  }
  return undefined;
}

function normalizeKey(key: string): string {
  return (key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function buildNormalizedKeyValueMap(custom: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(custom)) {
    const normalized = normalizeKey(k);
    if (!normalized) continue;
    if (map.has(normalized)) continue;
    map.set(normalized, v);
  }
  return map;
}

function pickCustomValue(
  custom: Record<string, unknown>,
  normalized: Map<string, unknown>,
  keys: string[]
): unknown {
  for (const k of keys) {
    if (k in custom) return custom[k];
    const n = normalizeKey(k);
    if (!n) continue;
    if (normalized.has(n)) return normalized.get(n);
  }
  return undefined;
}

async function resolveTenantId(tenantArg?: string): Promise<{ id: string; slug: string; name: string } | null> {
  if (!tenantArg) return null;

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: tenantArg }, { slug: tenantArg }, { name: tenantArg }],
    },
    select: { id: true, slug: true, name: true },
  });

  return tenant ?? null;
}

async function main() {
  const opts = parseArgs(process.argv);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run this script");
  }
  try {
    const parsed = new URL(databaseUrl);
    if (!parsed.hostname) {
      throw new Error("DATABASE_URL has no hostname");
    }
  } catch (e: any) {
    throw new Error(
      `Invalid DATABASE_URL (cannot parse / missing hostname). ` +
        `Set DATABASE_URL to the target DB (e.g. export from STAGING_DATABASE_URL/PROD_DATABASE_URL as in scripts/update-staging.sh). ` +
        `(${e?.message || e})`
    );
  }

  const tenant = await resolveTenantId(opts.tenant);
  const tenantId = tenant?.id;

  const where: Prisma.LeadWhereInput = {
    ...(tenantId ? { tenantId } : {}),
    custom: { not: Prisma.DbNull },
    OR: [
      { dateQuoteSent: null },
      { quotedValue: null },
      { opportunity: { is: { wonAt: null } } },
      { opportunity: { is: { valueGBP: null } } },
      { opportunity: { is: null } },
    ],
  };

  const candidatesByTenant = await prisma.lead.groupBy({
    by: ["tenantId"],
    where,
    _count: { _all: true },
  });

  const candidateTenantIds = candidatesByTenant.map((g) => g.tenantId);
  const tenants = candidateTenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: candidateTenantIds } },
        select: { id: true, slug: true, name: true },
      })
    : [];
  const tenantById = new Map(tenants.map((t) => [t.id, t] as const));

  const totalCandidates = candidatesByTenant.reduce((sum, g) => sum + g._count._all, 0);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: opts.apply ? "apply" : "dry-run",
        tenantFilter: tenant ? { id: tenant.id, slug: tenant.slug, name: tenant.name } : null,
        tenants: candidatesByTenant.length,
        candidates: totalCandidates,
        byTenant: candidatesByTenant
          .sort((a, b) => b._count._all - a._count._all)
          .map((g) => {
            const t = tenantById.get(g.tenantId);
            return {
              tenantId: g.tenantId,
              tenantSlug: t?.slug ?? null,
              tenantName: t?.name ?? null,
              candidates: g._count._all,
            };
          }),
      },
      null,
      2
    )
  );

  if (!candidatesByTenant.length) return;

  const summary = {
    updatedLeadDateQuoteSent: 0,
    updatedLeadQuotedValue: 0,
    updatedOpportunityWonAt: 0,
    updatedOpportunityValueGBP: 0,
    missingOpportunityButHasOrderData: 0,
    skippedNoLegacyData: 0,
    errors: 0,
  };

  const quoteDateKeys = [
    "dateQuoteSent",
    "date_quote_sent",
    "date quote sent",
    "quoteSentDate",
    "quote_sent_date",
    "quote sent date",
  ];

  const quotedValueKeys = [
    "quotedValue",
    "quoted_value",
    "quoteValue",
    "quote_value",
    "quoted value",
    "quote value",
    "valueQuoted",
  ];

  const orderDateKeys = [
    "dateOrderPlaced",
    "date_order_placed",
    "date order placed",
    "orderDate",
    "order_date",
    "wonAt",
  ];

  const orderValueKeys = [
    "orderValueGBP",
    "order_value_gbp",
    "orderValue",
    "order_value",
    "valueGBP",
    "value_gbp",
    "contractValue",
  ];

  const batchSize = 250;

  for (const g of candidatesByTenant) {
    const t = tenantById.get(g.tenantId);
    console.log(
      `\n[backfill-lifecycle] tenant=${t?.slug ?? g.tenantId} candidates=${g._count._all} mode=${
        opts.apply ? "apply" : "dry-run"
      }`
    );

    let cursor: { id: string } | undefined;
    let previewPrinted = 0;
    let didPrintSuppressed = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const leads = await prisma.lead.findMany({
        where: { ...where, tenantId: g.tenantId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          contactName: true,
          custom: true,
          dateQuoteSent: true,
          quotedValue: true,
          opportunity: {
            select: {
              id: true,
              wonAt: true,
              valueGBP: true,
            },
          },
        },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });

      if (!leads.length) break;
      cursor = { id: leads[leads.length - 1].id };

      for (const lead of leads) {
        const custom =
          lead.custom && typeof lead.custom === "object" && !Array.isArray(lead.custom)
            ? (lead.custom as Record<string, unknown>)
            : {};

        const normalized = buildNormalizedKeyValueMap(custom);

        const legacyQuoteDate = parseDateOrUndefined(pickCustomValue(custom, normalized, quoteDateKeys));
        const legacyQuotedValue = parseMoneyOrUndefined(pickCustomValue(custom, normalized, quotedValueKeys));

        const legacyOrderDate = parseDateOrUndefined(pickCustomValue(custom, normalized, orderDateKeys));
        const legacyOrderValue = parseMoneyOrUndefined(pickCustomValue(custom, normalized, orderValueKeys));

        const wantsLeadQuoteDate = lead.dateQuoteSent == null && legacyQuoteDate != null;
        const wantsLeadQuotedValue = lead.quotedValue == null && legacyQuotedValue != null;

        const opp = lead.opportunity;
        const wantsOppWonAt = opp != null && opp.wonAt == null && legacyOrderDate != null;
        const wantsOppValue = opp != null && opp.valueGBP == null && legacyOrderValue != null;

        const hasAnyLegacyData =
          legacyQuoteDate != null || legacyQuotedValue != null || legacyOrderDate != null || legacyOrderValue != null;

        if (!hasAnyLegacyData) {
          summary.skippedNoLegacyData += 1;
          continue;
        }

        if (opp == null && (legacyOrderDate != null || legacyOrderValue != null)) {
          summary.missingOpportunityButHasOrderData += 1;
        }

        if (!wantsLeadQuoteDate && !wantsLeadQuotedValue && !wantsOppWonAt && !wantsOppValue) {
          continue;
        }

        if (!opts.apply) {
          if (previewPrinted < opts.preview) {
            console.log(
              `[dry-run] leadId=${lead.id} ` +
                `setLead.dateQuoteSent=${wantsLeadQuoteDate ? legacyQuoteDate?.toISOString() : "(no)"} ` +
                `setLead.quotedValue=${wantsLeadQuotedValue ? legacyQuotedValue : "(no)"} ` +
                `setOpp.wonAt=${wantsOppWonAt ? legacyOrderDate?.toISOString() : "(no)"} ` +
                `setOpp.valueGBP=${wantsOppValue ? legacyOrderValue : "(no)"} ` +
                `status=${lead.status} name=${JSON.stringify(lead.contactName || "")}`
            );
            previewPrinted += 1;
          } else if (!didPrintSuppressed) {
            console.log("[dry-run] (additional rows suppressed)");
            didPrintSuppressed = true;
          }
          continue;
        }

        try {
          if (wantsLeadQuoteDate || wantsLeadQuotedValue) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                ...(wantsLeadQuoteDate ? { dateQuoteSent: legacyQuoteDate! } : {}),
                ...(wantsLeadQuotedValue ? { quotedValue: legacyQuotedValue! } : {}),
              },
              select: { id: true },
            });

            if (wantsLeadQuoteDate) summary.updatedLeadDateQuoteSent += 1;
            if (wantsLeadQuotedValue) summary.updatedLeadQuotedValue += 1;
          }

          if (opp != null && (wantsOppWonAt || wantsOppValue)) {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: {
                ...(wantsOppWonAt ? { wonAt: legacyOrderDate! } : {}),
                ...(wantsOppValue ? { valueGBP: legacyOrderValue! } : {}),
              },
              select: { id: true },
            });

            if (wantsOppWonAt) summary.updatedOpportunityWonAt += 1;
            if (wantsOppValue) summary.updatedOpportunityValueGBP += 1;
          }
        } catch (e: any) {
          summary.errors += 1;
          console.error("[backfill-lifecycle] update failed", {
            leadId: lead.id,
            opportunityId: lead.opportunity?.id ?? null,
            message: e?.message || e,
          });
        }
      }
    }
  }

  console.log("\n[backfill-lifecycle] done", JSON.stringify({ ok: true, ...summary }, null, 2));

  if (!opts.apply && summary.missingOpportunityButHasOrderData > 0) {
    console.log(
      `\n[backfill-lifecycle] note: ${summary.missingOpportunityButHasOrderData} leads had legacy order data in lead.custom but no Opportunity. ` +
        `This script does not create Opportunities; use backfill:opportunities-from-won-leads (or create manually) if needed.`
    );
  }
}

main()
  .catch((e) => {
    console.error("[backfill-lifecycle] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
