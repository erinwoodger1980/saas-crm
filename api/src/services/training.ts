import { prisma } from "../prisma";

type ModuleName = "lead_classifier" | "quote_builder" | "estimator" | "sales_assistant" | string;

export async function logInsight(opts: {
  tenantId: string;
  module: ModuleName;
  inputSummary?: string | null;
  decision?: string | null;
  confidence?: number | null;
  userFeedback?: any;
}) {
  const { tenantId, module } = opts;
  if (!tenantId || !module) return;
  try {
  await (prisma as any).trainingInsights.create({
      data: {
        tenantId,
        module,
        inputSummary: opts.inputSummary ?? null,
        decision: opts.decision ?? null,
        confidence: opts.confidence ?? null,
        userFeedback: opts.userFeedback ?? undefined,
      },
    });
  } catch (e) {
    console.warn("[training] logInsight failed:", (e as any)?.message || e);
  }
}

export async function logEvent(opts: {
  tenantId: string;
  module: ModuleName;
  kind: "FEEDBACK" | "RETRAIN" | "RESET" | "PARAM_CHANGE" | string;
  payload: any;
  actorId?: string | null;
}) {
  const { tenantId, module, kind } = opts;
  if (!tenantId || !module || !kind) return;
  try {
  await (prisma as any).trainingEvent.create({
      data: {
        tenantId,
        module,
        kind,
        payload: opts.payload ?? {},
        actorId: opts.actorId ?? null,
      },
    });
  } catch (e) {
    console.warn("[training] logEvent failed:", (e as any)?.message || e);
  }
}

export async function setParam(opts: {
  tenantId: string;
  module: ModuleName;
  key: string;
  value: any;
  reason?: string | null;
  actorId?: string | null;
}) {
  const { tenantId, module, key } = opts;
  if (!tenantId || !module || !key) return;
  try {
  await (prisma as any).modelOverride.create({
      data: {
        tenantId,
        module,
        key,
        value: opts.value,
        reason: opts.reason ?? null,
        createdById: opts.actorId ?? null,
      },
    });
  } catch (e) {
    console.warn("[training] setParam failed:", (e as any)?.message || e);
  }
}

export async function getInsights(tenantId: string, module?: ModuleName, limit = 100) {
  return (prisma as any).trainingInsights.findMany({
    where: { tenantId, ...(module ? { module } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

export async function listParams(tenantId: string, module?: ModuleName) {
  return (prisma as any).modelOverride.findMany({
    where: { tenantId, ...(module ? { module } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function applyFeedback(opts: {
  tenantId: string;
  insightId: string;
  feedback: any;
  module?: ModuleName;
  actorId?: string | null;
}) {
  const { tenantId, insightId } = opts;
  if (!tenantId || !insightId) return { ok: false as const, error: "invalid_input" };
  try {
    const existing = await (prisma as any).trainingInsights.findFirst({
      where: { id: insightId, tenantId },
      select: { id: true, userFeedback: true, module: true },
    });
    if (!existing) return { ok: false as const, error: "not_found" };

    const merged = { ...(existing.userFeedback || {}), ...(opts.feedback || {}) };
    await (prisma as any).trainingInsights.update({
      where: { id: insightId },
      data: { userFeedback: merged },
    });

    const module = (opts.module as any) || existing.module || "unknown";
    await logEvent({
      tenantId,
      module,
      kind: "FEEDBACK",
      payload: { insightId, feedback: opts.feedback },
      actorId: opts.actorId ?? null,
    });

    return { ok: true as const };
  } catch (e) {
    console.warn("[training] applyFeedback failed:", (e as any)?.message || e);
    return { ok: false as const, error: "internal_error" };
  }
}

export async function resetModel(opts: { tenantId: string; module: ModuleName; actorId?: string | null }) {
  // No-op placeholder; real implementation would clear adapters/caches per tenant
  await logEvent({ tenantId: opts.tenantId, module: opts.module, kind: "RESET", payload: {}, actorId: opts.actorId });
  return { ok: true } as const;
}

export async function retrainModel(opts: { tenantId: string; module: ModuleName; actorId?: string | null }) {
  // No-op placeholder; enqueue async retraining job here
  await logEvent({ tenantId: opts.tenantId, module: opts.module, kind: "RETRAIN", payload: {}, actorId: opts.actorId });
  return { ok: true } as const;
}
