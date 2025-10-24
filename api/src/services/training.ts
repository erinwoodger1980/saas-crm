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
  try {
    return await (prisma as any).trainingInsights.findMany({
      where: { tenantId, ...(module ? { module } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
  } catch (e: any) {
    // Graceful fallback when table doesn't exist in the current DB (e.g. prod before migration)
    const code = e?.code || e?.name;
    if (code === "P2021" || /does not exist/i.test(String(e?.message || ""))) {
      return [];
    }
    throw e;
  }
}

export async function listParams(tenantId: string, module?: ModuleName) {
  try {
    return await (prisma as any).modelOverride.findMany({
      where: { tenantId, ...(module ? { module } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (e: any) {
    const code = e?.code || e?.name;
    if (code === "P2021" || /does not exist/i.test(String(e?.message || ""))) {
      return [];
    }
    throw e;
  }
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
      select: { id: true, userFeedback: true, module: true, inputSummary: true },
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

    // Optional: map lead_classifier thumbs to EmailIngest for learning continuity
    try {
      if (module === "lead_classifier" && typeof (opts.feedback?.isLead) === "boolean") {
        const summary = (existing as any).inputSummary as string | null;
        if (summary && summary.startsWith("email:")) {
          const parts = summary.split(":");
          const provider = parts[1];
          const messageId = parts.slice(2).join(":");

          // Upsert EmailIngest to persist the user label
          await (prisma as any).emailIngest.upsert({
            where: { tenantId_provider_messageId: { tenantId, provider, messageId } },
            update: {
              processedAt: new Date(),
              userLabelIsLead: !!opts.feedback.isLead,
              userLabeledAt: new Date(),
            },
            create: {
              tenantId,
              provider,
              messageId,
              processedAt: new Date(),
              userLabelIsLead: !!opts.feedback.isLead,
              userLabeledAt: new Date(),
            },
          });

          // Also persist/update a training example for this message
          try {
            let subject: string | null = undefined as any;
            let body: string | null = undefined as any;
            let from: string | null = undefined as any;
            let snippet: string | null = undefined as any;

            const em = await (prisma as any).emailMessage.findFirst({
              where: { tenantId, provider, messageId },
              select: { subject: true, bodyText: true, fromEmail: true, snippet: true },
            });
            if (em) {
              subject = em.subject ?? null;
              body = em.bodyText ?? null;
              from = em.fromEmail ?? null;
              snippet = em.snippet ?? null;
            }

            // LeadTrainingExample does not have a composite unique constraint; emulate upsert
            const existingLTE = await (prisma as any).leadTrainingExample.findFirst({
              where: { tenantId, provider, messageId },
              select: { id: true },
            });

            const extracted = {
              subject: subject || undefined,
              snippet: snippet || undefined,
              from: from || undefined,
              body: (body || "").slice(0, 4000),
              reason: opts.feedback.reason || null,
            } as any;

            if (existingLTE?.id) {
              await (prisma as any).leadTrainingExample.update({
                where: { id: existingLTE.id },
                data: {
                  label: opts.feedback.isLead ? "accepted" : "rejected",
                  extracted,
                },
              });
            } else {
              await (prisma as any).leadTrainingExample.create({
                data: {
                  tenantId,
                  provider,
                  messageId,
                  label: opts.feedback.isLead ? "accepted" : "rejected",
                  extracted,
                },
              });
            }
          } catch (e) {
            console.warn("[training] applyFeedback -> training example upsert failed:", (e as any)?.message || e);
          }
        }
      }
    } catch (e) {
      console.warn("[training] applyFeedback -> email ingest mapping failed:", (e as any)?.message || e);
    }

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
