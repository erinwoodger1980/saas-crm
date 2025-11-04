import "dotenv/config";

import { Prisma } from "@prisma/client";

import prisma from "../db";

const LOOKBACK_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPSILON = 1e-6;

const rawDelta = Number.parseFloat(process.env.FOLLOWUPS_AB_DELTA_PROMOTE ?? "0.05");
const AUTO_TOGGLE_DELTA = Number.isFinite(rawDelta) ? rawDelta : 0.05;

const rawMinSends = Number.parseInt(process.env.FOLLOWUPS_MIN_SENDS_FOR_TEST ?? "200", 10);
const AUTO_TOGGLE_MIN_SENDS = Number.isFinite(rawMinSends) ? rawMinSends : 200;

const AUTO_TOGGLE_ENABLED = String(process.env.FOLLOWUPS_AUTO_TOGGLE ?? "")
  .trim()
  .toLowerCase() === "true";

type MutableVariantStats = {
  variantKey: string;
  sent: number;
  opens: number;
  replies: number;
  conversions: number;
  totalCostPence: number;
  templateKeys: Set<string>;
  variantNames: Set<string>;
  labels: Set<string>;
};

type VariantSummary = {
  variant: string;
  label: string;
  templateKeys: string[];
  variantNames: string[];
  sent: number;
  opens: number;
  replies: number;
  conversions: number;
  totalCost: number;
  openRate: number;
  replyRate: number;
  conversionRate: number;
  costPerConversion: number | null;
};

type SourceSummary = {
  source: string;
  sent: number;
  opens: number;
  replies: number;
  conversions: number;
  totalCost: number;
  variants: VariantSummary[];
  winner?: {
    variant: string;
    label: string;
    conversionRate: number;
    costPerConversion: number | null;
  };
};

type AutoToggleRecord = {
  source: string;
  losingVariant: string;
  losingLabel: string;
  losingConversionRate: number;
  losingSent: number;
  winnerVariant: string;
  winnerLabel: string;
  winnerConversionRate: number;
  winnerSent: number;
  conversionRateDelta: number;
  templateKeys: string[];
  variantNames: string[];
  status: "pending" | "disabled" | "no_change" | "skipped";
  disabledTemplates?: number;
  reason?: string;
};

type TenantSummary = {
  tenantId: string;
  generatedAt: string;
  lookbackDays: number;
  totals: {
    sent: number;
    opens: number;
    replies: number;
    conversions: number;
    totalCost: number;
  };
  sources: SourceSummary[];
  autoToggles: AutoToggleRecord[];
  config: {
    autoToggleEnabled: boolean;
    deltaThreshold: number;
    minSends: number;
  };
};

type ToggleOperation = {
  tenantId: string;
  record: AutoToggleRecord;
};

function normaliseVariant(raw: string | null | undefined): string {
  return raw ? String(raw).trim().toUpperCase() : "UNKNOWN";
}

function normaliseSource(raw: string | null | undefined): string {
  return raw ? String(raw).trim() || "unspecified" : "unspecified";
}

function asCurrency(pence: number): number {
  return Number((pence / 100).toFixed(2));
}

function asCostPerConversion(totalCostPence: number, conversions: number): number | null {
  if (!conversions) return null;
  return Number(((totalCostPence / conversions) / 100).toFixed(2));
}

function asRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function pickWinner<T extends { conversionRate: number; costPerConversion: number | null }>(
  variants: T[],
): T | undefined {
  return variants.reduce<T | undefined>((best, current) => {
    if (!best) return current;
    if (current.conversionRate > best.conversionRate + EPSILON) return current;
    const conversionDiff = Math.abs(current.conversionRate - best.conversionRate);
    if (conversionDiff <= EPSILON) {
      const currentCost = current.costPerConversion ?? Number.POSITIVE_INFINITY;
      const bestCost = best.costPerConversion ?? Number.POSITIVE_INFINITY;
      if (currentCost + EPSILON < bestCost) {
        return current;
      }
    }
    return best;
  }, undefined);
}

async function main() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
  const events = await prisma.followUpEvent.findMany({
    where: { sentAt: { gte: since } },
    select: {
      tenantId: true,
      source: true,
      variant: true,
      templateKey: true,
      openedAt: true,
      repliedAt: true,
      convertedAt: true,
      costPence: true,
    },
  });

  if (!events.length) {
    console.log("[followups:analyse] No follow-up events found in the lookback window.");
    return;
  }

  const aggregated = new Map<string, Map<string, Map<string, MutableVariantStats>>>();

  for (const event of events) {
    const tenantId = event.tenantId;
    if (!tenantId) continue;

    const source = normaliseSource(event.source);
    const variantKey = normaliseVariant(event.variant ?? event.templateKey);

    if (!aggregated.has(tenantId)) {
      aggregated.set(tenantId, new Map());
    }
    const bySource = aggregated.get(tenantId)!;
    if (!bySource.has(source)) {
      bySource.set(source, new Map());
    }
    const byVariant = bySource.get(source)!;

    if (!byVariant.has(variantKey)) {
      byVariant.set(variantKey, {
        variantKey,
        sent: 0,
        opens: 0,
        replies: 0,
        conversions: 0,
        totalCostPence: 0,
        templateKeys: new Set<string>(),
        variantNames: new Set<string>(),
        labels: new Set<string>(),
      });
    }

    const stats = byVariant.get(variantKey)!;
    stats.sent += 1;
    if (event.openedAt) stats.opens += 1;
    if (event.repliedAt) stats.replies += 1;
    if (event.convertedAt) stats.conversions += 1;
    if (typeof event.costPence === "number" && Number.isFinite(event.costPence)) {
      stats.totalCostPence += event.costPence;
    }
    if (event.templateKey) stats.templateKeys.add(event.templateKey);
    if (event.variant) stats.variantNames.add(event.variant);
    const label = (event.variant ?? event.templateKey ?? "").trim();
    if (label) stats.labels.add(label);
  }

  const tenantSummaries: TenantSummary[] = [];
  const toggleOperations: ToggleOperation[] = [];

  for (const [tenantId, sourceMap] of aggregated.entries()) {
    const sources: SourceSummary[] = [];
    const autoToggles: AutoToggleRecord[] = [];

    let tenantSent = 0;
    let tenantOpens = 0;
    let tenantReplies = 0;
    let tenantConversions = 0;
    let tenantCostPence = 0;

    for (const [source, variantMap] of sourceMap.entries()) {
      const variantStatsList = Array.from(variantMap.values());
      if (!variantStatsList.length) continue;

      const variantSummaries: VariantSummary[] = variantStatsList.map((stats) => {
        const label = Array.from(stats.labels)[0] ?? stats.variantKey;
        const sent = stats.sent;
        const opens = stats.opens;
        const replies = stats.replies;
        const conversions = stats.conversions;
        const openRate = asRate(opens, sent);
        const replyRate = asRate(replies, sent);
        const conversionRate = asRate(conversions, sent);
        const costPerConversion = asCostPerConversion(stats.totalCostPence, conversions);
        return {
          variant: stats.variantKey,
          label,
          templateKeys: Array.from(stats.templateKeys),
          variantNames: Array.from(stats.variantNames),
          sent,
          opens,
          replies,
          conversions,
          totalCost: asCurrency(stats.totalCostPence),
          openRate,
          replyRate,
          conversionRate,
          costPerConversion,
        };
      });

      const sourceTotals = variantStatsList.reduce(
        (acc, stats) => {
          acc.sent += stats.sent;
          acc.opens += stats.opens;
          acc.replies += stats.replies;
          acc.conversions += stats.conversions;
          acc.totalCostPence += stats.totalCostPence;
          return acc;
        },
        { sent: 0, opens: 0, replies: 0, conversions: 0, totalCostPence: 0 },
      );

      tenantSent += sourceTotals.sent;
      tenantOpens += sourceTotals.opens;
      tenantReplies += sourceTotals.replies;
      tenantConversions += sourceTotals.conversions;
      tenantCostPence += sourceTotals.totalCostPence;

      const winner = pickWinner(variantSummaries);

      const sourceSummary: SourceSummary = {
        source,
        sent: sourceTotals.sent,
        opens: sourceTotals.opens,
        replies: sourceTotals.replies,
        conversions: sourceTotals.conversions,
        totalCost: asCurrency(sourceTotals.totalCostPence),
        variants: variantSummaries,
      };

      if (winner) {
        sourceSummary.winner = {
          variant: winner.variant,
          label: winner.label,
          conversionRate: winner.conversionRate,
          costPerConversion: winner.costPerConversion,
        };
      }

      if (AUTO_TOGGLE_ENABLED && winner && variantSummaries.length > 1) {
        for (const variant of variantSummaries) {
          if (variant.variant === winner.variant) continue;
          if (variant.sent < AUTO_TOGGLE_MIN_SENDS) continue;
          if (winner.sent < AUTO_TOGGLE_MIN_SENDS) continue;

          const delta = winner.conversionRate - variant.conversionRate;
          if (delta + EPSILON < AUTO_TOGGLE_DELTA) continue;

          const record: AutoToggleRecord = {
            source,
            losingVariant: variant.variant,
            losingLabel: variant.label,
            losingConversionRate: variant.conversionRate,
            losingSent: variant.sent,
            winnerVariant: winner.variant,
            winnerLabel: winner.label,
            winnerConversionRate: winner.conversionRate,
            winnerSent: winner.sent,
            conversionRateDelta: Number(delta.toFixed(4)),
            templateKeys: variant.templateKeys,
            variantNames: variant.variantNames,
            status: "pending",
          };

          autoToggles.push(record);
          toggleOperations.push({ tenantId, record });
        }
      }

      sources.push(sourceSummary);
    }

    const tenantSummary: TenantSummary = {
      tenantId,
      generatedAt: new Date().toISOString(),
      lookbackDays: LOOKBACK_DAYS,
      totals: {
        sent: tenantSent,
        opens: tenantOpens,
        replies: tenantReplies,
        conversions: tenantConversions,
        totalCost: asCurrency(tenantCostPence),
      },
      sources,
      autoToggles,
      config: {
        autoToggleEnabled: AUTO_TOGGLE_ENABLED,
        deltaThreshold: AUTO_TOGGLE_DELTA,
        minSends: AUTO_TOGGLE_MIN_SENDS,
      },
    };

    tenantSummaries.push(tenantSummary);
  }

  if (AUTO_TOGGLE_ENABLED && toggleOperations.length) {
    for (const op of toggleOperations) {
      const uniqueTemplateKeys = Array.from(new Set(op.record.templateKeys.filter(Boolean)));
      const uniqueVariantNames = Array.from(new Set(op.record.variantNames.filter(Boolean)));

      const where: Prisma.FollowUpTemplateWhereInput = {
        tenantId: op.tenantId,
        isActive: true,
      };

      if (uniqueTemplateKeys.length && uniqueVariantNames.length) {
        where.OR = [
          { key: { in: uniqueTemplateKeys } },
          { variant: { in: uniqueVariantNames } },
        ];
      } else if (uniqueTemplateKeys.length) {
        where.key = { in: uniqueTemplateKeys };
      } else if (uniqueVariantNames.length) {
        where.variant = { in: uniqueVariantNames };
      } else {
        op.record.status = "skipped";
        op.record.reason = "no_template_identifiers";
        continue;
      }

      try {
        const result = await prisma.followUpTemplate.updateMany({
          where,
          data: { isActive: false },
        });
        op.record.disabledTemplates = result.count;
        if (result.count > 0) {
          op.record.status = "disabled";
          console.log(
            `[followups:analyse] Disabled ${result.count} template(s) for tenant ${op.tenantId} variant ${op.record.losingVariant} (${op.record.losingLabel}).`,
          );
        } else {
          op.record.status = "no_change";
          op.record.reason = "already_disabled_or_missing";
        }
      } catch (error) {
        op.record.status = "skipped";
        op.record.reason = (error as Error).message || "update_failed";
        console.error(
          `[followups:analyse] Failed to disable templates for tenant ${op.tenantId}:`,
          error,
        );
      }
    }
  }

  for (const summary of tenantSummaries) {
    const allVariants = summary.sources.flatMap((source) =>
      source.variants.map((variant) => ({ ...variant, source: source.source })),
    );
    const bestVariant = pickWinner(allVariants);

    try {
      await prisma.trainingInsights.create({
        data: {
          tenantId: summary.tenantId,
          module: "followups_ab_test",
          inputSummary: `followups:analysis:${LOOKBACK_DAYS}d`,
          decision: bestVariant ? `${bestVariant.variant}@${bestVariant.source}` : null,
          confidence: bestVariant?.conversionRate ?? null,
          userFeedback: summary,
        },
      });
    } catch (error) {
      console.error(
        `[followups:analyse] Failed to write TrainingInsights for tenant ${summary.tenantId}:`,
        error,
      );
    }
  }

  console.log(
    `[followups:analyse] Processed ${events.length} events across ${tenantSummaries.length} tenant(s).`,
  );
}

main()
  .catch((error) => {
    console.error("[followups:analyse]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
