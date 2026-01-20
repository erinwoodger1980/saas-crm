import prisma from "../db";
import { toNumberGBP } from "../lib/leads/fieldMap";

type Options = {
  tenantId?: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.findIndex((a) => a === flag);
    if (idx === -1) return undefined;
    const next = args[idx + 1];
    return next && !next.startsWith("-") ? next : undefined;
  };

  const tenantId = getArg("--tenant-id");
  const apply = args.includes("--apply");

  return { tenantId, apply };
}

function parseDateOrUndefined(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : undefined;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : undefined;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : undefined;
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

  const baseWhere: any = {
    status: "WON",
    opportunity: { is: null },
  };
  if (opts.tenantId) baseWhere.tenantId = opts.tenantId;

  const groups = await prisma.lead.groupBy({
    by: ["tenantId"],
    where: baseWhere,
    _count: { _all: true },
  });

  const tenantIds = groups.map((g) => g.tenantId);
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, slug: true, name: true },
      })
    : [];
  const tenantById = new Map(tenants.map((t) => [t.id, t] as const));

  const totalCandidates = groups.reduce((sum, g) => sum + g._count._all, 0);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: opts.apply ? "apply" : "dry-run",
        tenants: groups.length,
        candidates: totalCandidates,
        byTenant: groups
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

  if (!groups.length) return;

  const batchSize = 250;
  const summary = {
    created: 0,
    skippedAlreadyExists: 0,
    errors: 0,
  };

  for (const g of groups) {
    const tenantId = g.tenantId;
    const t = tenantById.get(tenantId);
    console.log(
      `\n[backfill-opps] tenant=${t?.slug ?? tenantId} candidates=${g._count._all} mode=${
        opts.apply ? "apply" : "dry-run"
      }`
    );

    const dryRunPreviewLimit = 10;
    let dryRunPreviewPrinted = 0;
    let didPrintDryRunSuppressedLine = false;

    let cursor: { id: string } | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const leads = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          tenantId,
        },
        select: {
          id: true,
          tenantId: true,
          clientId: true,
          clientAccountId: true,
          contactName: true,
          description: true,
          capturedAt: true,
          dateQuoteSent: true,
          quotedValue: true,
          estimatedValue: true,
          custom: true,
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

        const customOrderPlaced = parseDateOrUndefined(custom.dateOrderPlaced);
        const wonAt = customOrderPlaced ?? lead.dateQuoteSent ?? lead.capturedAt ?? new Date();

        const customOrderValueGBP = parseMoneyOrUndefined(custom.orderValueGBP);

        const valueGBP =
          customOrderValueGBP ??
          (lead.quotedValue != null ? Number(lead.quotedValue) : undefined) ??
          (lead.estimatedValue != null ? Number(lead.estimatedValue) : undefined) ??
          null;

        const startDate = parseDateOrUndefined(custom.startDate);
        const deliveryDate = parseDateOrUndefined(custom.deliveryDate);

        const title = lead.contactName || "Project";

        if (!opts.apply) {
          if (dryRunPreviewPrinted < dryRunPreviewLimit) {
            console.log(
              `[dry-run] would-create opportunity leadId=${lead.id} wonAt=${wonAt.toISOString()} valueGBP=${
                valueGBP ?? "null"
              } title=${JSON.stringify(title)}`
            );
            dryRunPreviewPrinted += 1;
          } else if (!didPrintDryRunSuppressedLine) {
            console.log("[dry-run] (additional rows suppressed)");
            didPrintDryRunSuppressedLine = true;
          }
          continue;
        }

        try {
          const created = await prisma.opportunity.create({
            data: {
              tenantId: lead.tenantId,
              leadId: lead.id,
              clientId: lead.clientId ?? null,
              clientAccountId: lead.clientAccountId ?? null,
              title,
              description: lead.description ?? null,
              stage: "WON" as any,
              wonAt,
              valueGBP,
              startDate: startDate ?? null,
              deliveryDate: deliveryDate ?? null,
            },
            select: { id: true },
          });

          // Seed required-by-default workshop process assignments for workshop scheduling.
          const processDefinitions = await prisma.workshopProcessDefinition.findMany({
            where: { tenantId: lead.tenantId, requiredByDefault: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, estimatedHours: true },
          });

          for (const processDef of processDefinitions) {
            try {
              await prisma.projectProcessAssignment.upsert({
                where: {
                  opportunityId_processDefinitionId: {
                    opportunityId: created.id,
                    processDefinitionId: processDef.id,
                  },
                },
                create: {
                  tenantId: lead.tenantId,
                  opportunityId: created.id,
                  processDefinitionId: processDef.id,
                  required: true,
                  estimatedHours: processDef.estimatedHours ?? null,
                  status: "pending",
                },
                update: {},
              });
            } catch (e: any) {
              if (e?.code !== "P2002") {
                console.error("[backfill-opps] process upsert failed", {
                  opportunityId: created.id,
                  processDefinitionId: processDef.id,
                  message: e?.message || e,
                });
              }
            }
          }

          summary.created += 1;
        } catch (e: any) {
          // Unique violation on leadId (idempotency / concurrent writes)
          if (e?.code === "P2002") {
            summary.skippedAlreadyExists += 1;
            continue;
          }
          summary.errors += 1;
          console.error("[backfill-opps] create failed", { leadId: lead.id, message: e?.message || e });
        }
      }
    }
  }

  console.log("\n[backfill-opps] done", JSON.stringify({ ok: true, ...summary }, null, 2));
}

main()
  .catch((e) => {
    console.error("[backfill-opps] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
