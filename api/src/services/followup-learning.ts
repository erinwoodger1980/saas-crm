// api/src/services/followup-learning.ts
import type { PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 180;
const EMAIL_SAMPLE_LIMIT = 600;
const CALL_SAMPLE_LIMIT = 200;
const EMAIL_FETCH_LIMIT = EMAIL_SAMPLE_LIMIT * 3;
const CALL_FETCH_LIMIT = CALL_SAMPLE_LIMIT * 3;

export type VariantInsight = {
  variant: string;
  sampleSize: number;
  replyRate: number;
  conversionRate: number;
  avgDelayDays: number | null;
  successScore: number;
  lastSentAt: Date | null;
};

export type CallInsight = {
  sampleSize: number;
  avgDelayDays: number | null;
  conversionRate: number | null;
};

export type FollowupInsights = {
  variants: VariantInsight[];
  totalSamples: number;
  lastUpdatedAt: Date | null;
  call: CallInsight;
};

function toPlainObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...parsed };
      }
    } catch {
      // ignore parse errors
    }
  }
  return {};
}

function defaultCallInsight(): CallInsight {
  return {
    sampleSize: 0,
    avgDelayDays: null,
    conversionRate: null,
  };
}

async function getOptedOutTenants(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.tenantSettings.findMany({
    select: { tenantId: true, beta: true },
  });

  const optedOut = new Set<string>();

  for (const row of rows) {
    const beta = toPlainObject(row.beta);
    const aiLearning = toPlainObject(beta.aiFollowupLearning);
    if (aiLearning.crossTenantOptIn === false) {
      optedOut.add(row.tenantId);
    }
  }

  return optedOut;
}

export async function computeFollowupInsights(prisma: PrismaClient): Promise<FollowupInsights> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
  const optedOutTenants = await getOptedOutTenants(prisma);

  const rawEmailLogs = await prisma.followUpLog.findMany({
    where: {
      channel: "email",
      sentAt: { gte: since },
    },
    select: {
      tenantId: true,
      variant: true,
      replied: true,
      converted: true,
      delayDays: true,
      sentAt: true,
    },
    orderBy: { sentAt: "desc" },
    take: EMAIL_FETCH_LIMIT,
  });

  const emailLogs: typeof rawEmailLogs = [];

  for (const log of rawEmailLogs) {
    if (optedOutTenants.has(log.tenantId)) continue;
    emailLogs.push(log);
    if (emailLogs.length >= EMAIL_SAMPLE_LIMIT) break;
  }

  const variantMap = new Map<string, VariantInsight & {
    replies: number;
    conversions: number;
    delayTotal: number;
    delayCount: number;
  }>();

  let latestEmailAt: Date | null = null;

  for (const log of emailLogs) {
    const variant = log.variant || "unknown";
    if (!variantMap.has(variant)) {
      variantMap.set(variant, {
        variant,
        sampleSize: 0,
        replyRate: 0,
        conversionRate: 0,
        avgDelayDays: null,
        successScore: 0,
        lastSentAt: null,
        replies: 0,
        conversions: 0,
        delayTotal: 0,
        delayCount: 0,
      });
    }

    const stats = variantMap.get(variant)!;
    stats.sampleSize += 1;
    if (log.replied) stats.replies += 1;
    if (log.converted) stats.conversions += 1;
    if (typeof log.delayDays === "number" && Number.isFinite(log.delayDays)) {
      stats.delayTotal += Number(log.delayDays);
      stats.delayCount += 1;
    }
    if (!stats.lastSentAt || log.sentAt > stats.lastSentAt) {
      stats.lastSentAt = log.sentAt;
    }
    if (!latestEmailAt || log.sentAt > latestEmailAt) {
      latestEmailAt = log.sentAt;
    }
  }

  const variants: VariantInsight[] = Array.from(variantMap.values()).map((stats) => {
    const replyRate = stats.sampleSize ? stats.replies / stats.sampleSize : 0;
    const conversionRate = stats.sampleSize ? stats.conversions / stats.sampleSize : 0;
    const avgDelayDays = stats.delayCount ? stats.delayTotal / stats.delayCount : null;
    const successScore = stats.sampleSize
      ? (stats.conversions * 2 + stats.replies * 0.6) / stats.sampleSize
      : 0;

    return {
      variant: stats.variant,
      sampleSize: stats.sampleSize,
      replyRate,
      conversionRate,
      avgDelayDays,
      successScore,
      lastSentAt: stats.lastSentAt,
    };
  });

  variants.sort((a, b) => b.successScore - a.successScore);

  const callInsight = await computeCallInsight(prisma, since, optedOutTenants);

  return {
    variants,
    totalSamples: emailLogs.length,
    lastUpdatedAt: latestEmailAt,
    call: callInsight,
  };
}

async function computeCallInsight(
  prisma: PrismaClient,
  since: Date,
  optedOutTenants: Set<string>,
): Promise<CallInsight> {
  const rawCallLogs = await prisma.followUpLog.findMany({
    where: {
      channel: "phone",
      sentAt: { gte: since },
    },
    select: {
      tenantId: true,
      scheduledFor: true,
      sentAt: true,
      converted: true,
      replied: true,
    },
    orderBy: { sentAt: "desc" },
    take: CALL_FETCH_LIMIT,
  });

  const callLogs: typeof rawCallLogs = [];

  for (const log of rawCallLogs) {
    if (optedOutTenants.has(log.tenantId)) continue;
    callLogs.push(log);
    if (callLogs.length >= CALL_SAMPLE_LIMIT) break;
  }

  if (!callLogs.length) return defaultCallInsight();

  let delayTotal = 0;
  let delayCount = 0;
  let conversionHits = 0;

  for (const log of callLogs) {
    if (log.scheduledFor) {
      const diffMs = log.scheduledFor.getTime() - log.sentAt.getTime();
      if (Number.isFinite(diffMs) && diffMs >= 0) {
        delayTotal += diffMs / DAY_MS;
        delayCount += 1;
      }
    }
    if (log.converted || log.replied) {
      conversionHits += 1;
    }
  }

  return {
    sampleSize: callLogs.length,
    avgDelayDays: delayCount ? delayTotal / delayCount : null,
    conversionRate: callLogs.length ? conversionHits / callLogs.length : null,
  };
}

export function selectVariantFromInsights(
  insights: FollowupInsights,
  lastVariant?: string | null,
): string {
  const candidates = insights.variants.filter((v) => v.variant === "A" || v.variant === "B");

  if (!candidates.length) {
    if (lastVariant === "A") return "B";
    if (lastVariant === "B") return "A";
    return "A";
  }

  const total = candidates.reduce((sum, v) => sum + v.sampleSize, 0) || 1;
  let bestVariant = candidates[0].variant;
  let bestScore = -Infinity;

  for (const stats of candidates) {
    const explorationBonus = Math.sqrt((2 * Math.log(total + 1)) / (stats.sampleSize + 1));
    const combined = stats.successScore + explorationBonus;
    if (combined > bestScore) {
      bestScore = combined;
      bestVariant = stats.variant;
    }
  }

  // Gentle nudging to keep some A/B exploration if scores are tied.
  if (
    candidates.length === 2 &&
    Math.abs(candidates[0].successScore - candidates[1].successScore) < 0.01 &&
    lastVariant &&
    lastVariant !== bestVariant
  ) {
    return lastVariant;
  }

  return bestVariant;
}

export function buildLearningSummary(insights: FollowupInsights): string {
  if (!insights.variants.length) {
    return "Not enough data yet. We’ll learn from every follow-up you send.";
  }

  const leader = insights.variants[0];
  const replyPct = leader.replyRate ? Math.round(leader.replyRate * 100) : 0;
  const conversionPct = leader.conversionRate ? Math.round(leader.conversionRate * 100) : 0;
  const samples = leader.sampleSize;

  return `Variant ${leader.variant} is leading with a ${replyPct}% reply rate (${conversionPct}% converted) across ${samples} recent sends.`;
}
