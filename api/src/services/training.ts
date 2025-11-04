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

type MetricPreference = "lower" | "higher";

function coerceNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const asNum = Number(trimmed);
    return Number.isFinite(asNum) ? asNum : null;
  }
  return null;
}

function normaliseMetricKey(model: string): { key: string; preference: MetricPreference; fallbackKeys: string[] } | null {
  const norm = (model || "").toLowerCase();
  if (norm.includes("estimator")) {
    return {
      key: "mape",
      preference: "lower",
      fallbackKeys: [
        "mape",
        "mean_absolute_percentage_error",
        "meanAbsolutePercentageError",
        "MAPE",
      ],
    };
  }
  if (norm.includes("classifier")) {
    return {
      key: "f1",
      preference: "higher",
      fallbackKeys: ["f1", "f1_score", "macro_f1", "F1"],
    };
  }
  if (norm.includes("parser")) {
    return {
      key: "accuracy",
      preference: "higher",
      fallbackKeys: ["accuracy", "exact_match", "ExactMatch", "ACC"],
    };
  }
  return null;
}

function findNumericMetric(metrics: any, keys: string[]): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  for (const key of keys) {
    if (key in metrics) {
      const value = coerceNumber((metrics as any)[key]);
      if (value != null) return value;
    }
    const camel = key.replace(/[_-](\w)/g, (_, c: string) => c.toUpperCase());
    if (camel in (metrics as any)) {
      const value = coerceNumber((metrics as any)[camel]);
      if (value != null) return value;
    }
  }
  return null;
}

function normaliseKeyName(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .replace(/_/g, "");
}

function findNumericMetricDeep(metrics: any, candidateKeys: string[]): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const candidates = candidateKeys
    .map((key) => normaliseKeyName(key))
    .filter(Boolean);
  if (!candidates.length) return null;

  const stack: any[] = [metrics];
  const seen = new Set<any>();

  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === "object" && !seen.has(item)) stack.push(item);
      }
      continue;
    }

    for (const [rawKey, value] of Object.entries(node as Record<string, any>)) {
      const normalised = normaliseKeyName(rawKey);
      if (
        normalised &&
        candidates.some(
          (candidate) =>
            normalised === candidate ||
            normalised.endsWith(candidate) ||
            normalised.includes(candidate)
        )
      ) {
        const numeric = coerceNumber(value);
        if (numeric != null) return numeric;
      }

      if (value && typeof value === "object" && !seen.has(value)) {
        stack.push(value);
      }
    }
  }

  return null;
}

export function extractKeyMetric(model: string, metrics: any): {
  key: string;
  value: number | null;
  preference: MetricPreference;
} {
  const hint = normaliseMetricKey(model);
  if (hint) {
    const value = findNumericMetric(metrics, hint.fallbackKeys);
    return { key: hint.key, value, preference: hint.preference };
  }

  // Fallback: pick the first numeric metric we find
  if (metrics && typeof metrics === "object") {
    for (const [key, raw] of Object.entries(metrics as Record<string, any>)) {
      const value = coerceNumber(raw);
      if (value != null) {
        return { key, value, preference: "higher" };
      }
    }
  }

  return { key: "metric", value: null, preference: "higher" };
}

export async function logInferenceEvent(opts: {
  tenantId: string;
  model: string;
  modelVersionId: string;
  inputHash: string;
  outputJson: any;
  confidence?: number | null;
  latencyMs?: number | null;
  meta?: Record<string, any> | null;
}) {
  const { tenantId, model, modelVersionId, inputHash } = opts;
  if (!tenantId || !model || !modelVersionId || !inputHash) return;
  const meta = opts.meta && typeof opts.meta === "object" ? opts.meta : null;
  let outputJson: any;
  if (opts.outputJson && typeof opts.outputJson === "object") {
    outputJson = { ...(opts.outputJson as any) };
  } else if (opts.outputJson !== undefined && opts.outputJson !== null) {
    outputJson = { value: opts.outputJson };
  } else {
    outputJson = {};
  }
  if (meta) {
    const existingMeta = outputJson.meta && typeof outputJson.meta === "object" ? outputJson.meta : {};
    outputJson.meta = { ...existingMeta, ...meta };
  }
  try {
    await (prisma as any).inferenceEvent.create({
      data: {
        tenantId,
        model,
        modelVersionId,
        inputHash,
        outputJson,
        confidence: opts.confidence ?? null,
        latencyMs: opts.latencyMs ?? null,
      },
    });
  } catch (e) {
    console.warn("[training] logInferenceEvent failed:", (e as any)?.message || e);
  }
}

export async function recordTrainingOutcome(opts: {
  tenantId?: string | null;
  model: string;
  status: string;
  datasetHash?: string | null;
  metrics?: any;
  modelLabel?: string | null;
  datasetSize?: number | null;
}) {
  const model = String(opts.model || "unknown");
  const status = String(opts.status || "unknown");
  const datasetHash = String(opts.datasetHash || "unknown");
  const metrics = (opts.metrics && typeof opts.metrics === "object") ? opts.metrics : {};
  const label = String(opts.modelLabel || new Date().toISOString());
  const datasetSize = typeof opts.datasetSize === "number" && Number.isFinite(opts.datasetSize)
    ? opts.datasetSize
    : coerceNumber((metrics as any)?.dataset_size ?? (metrics as any)?.samples ?? null);

  let modelVersion: any = null;
  try {
    const existing = await (prisma as any).modelVersion.findFirst({ where: { model, label } });
    if (existing) {
      modelVersion = await (prisma as any).modelVersion.update({
        where: { id: existing.id },
        data: { metricsJson: metrics, datasetHash },
      });
    } else {
      modelVersion = await (prisma as any).modelVersion.create({
        data: {
          model,
          label,
          metricsJson: metrics,
          datasetHash,
        },
      });
    }
  } catch (e) {
    console.warn("[training] recordTrainingOutcome:modelVersion failed:", (e as any)?.message || e);
  }

  const keyMetric = extractKeyMetric(model, metrics);
  const minSamples = (() => {
    const primary = Number(process.env.ML_MIN_SAMPLES);
    if (Number.isFinite(primary) && primary > 0) return primary;
    const legacy = Number(process.env.ML_PROMOTION_MIN_DATASET);
    if (Number.isFinite(legacy) && legacy > 0) return legacy;
    return 200;
  })();
  const promotionDelta = (() => {
    const raw = Number(process.env.ML_PROMOTION_DELTA);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 0.02;
  })();
  const maxRegression = (() => {
    const raw = Number(process.env.ML_MAX_REGRESSION);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 0.01;
  })();
  const requireHumanApproval = (() => {
    const raw = process.env.ML_REQUIRE_HUMAN_APPROVAL;
    return raw ? /^(1|true|yes|on)$/i.test(raw) : false;
  })();

  let promoted = false;
  let awaitingApproval = false;
  let improvementValue: number | null = null;
  let regressionValue: number | null = null;

  if (modelVersion && status.toLowerCase() === "succeeded") {
    const datasetEnough = (datasetSize ?? 0) >= minSamples;
    if (!datasetEnough && modelVersion.awaitingApproval) {
      try {
        modelVersion = await (prisma as any).modelVersion.update({
          where: { id: modelVersion.id },
          data: { awaitingApproval: false },
        });
      } catch (e) {
        console.warn(
          "[training] recordTrainingOutcome:clearAwaiting failed:",
          (e as any)?.message || e
        );
      }
    }

    if (datasetEnough && keyMetric.value != null) {
      try {
        const currentProd = await (prisma as any).modelVersion.findFirst({
          where: { model, isProduction: true },
        });

        let improvementPass = false;
        if (!currentProd || currentProd.id === modelVersion.id) {
          improvementPass = true;
        } else {
          const currentMetric = extractKeyMetric(model, currentProd.metricsJson as any);
          if (currentMetric.value != null) {
            if (keyMetric.preference === "lower") {
              improvementValue = currentMetric.value - keyMetric.value;
            } else {
              improvementValue = keyMetric.value - currentMetric.value;
            }
            improvementPass = (improvementValue ?? -Infinity) >= promotionDelta;
          } else {
            improvementPass = true;
          }
        }

        regressionValue = findNumericMetricDeep(metrics, [
          "backtest_regression",
          "holdout_regression",
          "backtest_degradation",
          "holdout_degradation",
          "regression",
          "degradation",
          "backtest_drop",
          "holdout_drop",
        ]);
        const regressionPass = regressionValue == null || regressionValue <= maxRegression;

        if (improvementPass && regressionPass) {
          if (requireHumanApproval) {
            try {
              modelVersion = await (prisma as any).modelVersion.update({
                where: { id: modelVersion.id },
                data: { awaitingApproval: true, approvedAt: null, approvedById: null },
              });
            } catch (e) {
              console.warn(
                "[training] recordTrainingOutcome:awaitingApproval failed:",
                (e as any)?.message || e
              );
            }
          } else {
            try {
              await (prisma as any).modelVersion.updateMany({
                where: { model, isProduction: true, NOT: { id: modelVersion.id } },
                data: { isProduction: false },
              });
              modelVersion = await (prisma as any).modelVersion.update({
                where: { id: modelVersion.id },
                data: { isProduction: true, awaitingApproval: false },
              });
              promoted = true;
            } catch (e) {
              console.warn(
                "[training] recordTrainingOutcome:promotion failed:",
                (e as any)?.message || e
              );
            }
          }
        } else if (modelVersion.awaitingApproval) {
          try {
            modelVersion = await (prisma as any).modelVersion.update({
              where: { id: modelVersion.id },
              data: { awaitingApproval: false },
            });
          } catch (e) {
            console.warn(
              "[training] recordTrainingOutcome:clearAwaiting failed:",
              (e as any)?.message || e
            );
          }
        }
      } catch (e) {
        console.warn(
          "[training] recordTrainingOutcome:evaluation failed:",
          (e as any)?.message || e
        );
      }
    }
  }

  awaitingApproval = !!modelVersion?.awaitingApproval;

  try {
    await (prisma as any).trainingRun.create({
      data: {
        tenantId: opts.tenantId ?? null,
        model,
        datasetHash,
        metricsJson: metrics,
        status,
        modelVersionId: modelVersion?.id ?? null,
      },
    });
  } catch (e) {
    console.warn("[training] recordTrainingOutcome:trainingRun failed:", (e as any)?.message || e);
  }

  return {
    modelVersionId: modelVersion?.id ?? null,
    promoted,
    awaitingApproval,
    keyMetric,
    datasetSize: datasetSize ?? null,
    improvement: improvementValue,
    regression: regressionValue,
  } as const;
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

    const moduleName = (opts.module as any) || existing.module || "unknown";
    await logEvent({
      tenantId,
      module: moduleName,
      kind: "FEEDBACK",
      payload: { insightId, feedback: opts.feedback },
      actorId: opts.actorId ?? null,
    });

    // Optional: map lead_classifier thumbs to EmailIngest for learning continuity
    try {
      if (moduleName === "lead_classifier" && typeof (opts.feedback?.isLead) === "boolean") {
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

            // Forward feedback to ML service for immediate learning
            try {
              if (process.env.ML_URL) {
                const mlPayload = {
                  tenantId,
                  emailId: summary, // email:provider:messageId format
                  provider,
                  messageId,
                  isLead: !!opts.feedback.isLead,
                  subject: subject || undefined,
                  fromEmail: from || undefined,
                  snippet: snippet || undefined,
                  confidence: existing.confidence || undefined,
                  reason: opts.feedback.reason || undefined
                };

                const mlResponse = await fetch(`${process.env.ML_URL}/lead-classifier/feedback`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(mlPayload),
                });

                if (mlResponse.ok) {
                  console.log("[training] ML service feedback sent successfully");
                } else {
                  console.warn("[training] ML service feedback failed:", await mlResponse.text());
                }
              }
            } catch (e) {
              console.warn("[training] ML service feedback error:", (e as any)?.message || e);
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

export async function retrainModel(opts: { tenantId: string; module: ModuleName; actorId?: string | null; insightIds?: string[] }) {
  // No-op placeholder; enqueue async retraining job here. If insightIds provided,
  // constrain examples to the selected insights for targeted retraining.
  await logEvent({
    tenantId: opts.tenantId,
    module: opts.module,
    kind: "RETRAIN",
    payload: { selectionSize: Array.isArray(opts.insightIds) ? opts.insightIds.length : 0, insightIds: opts.insightIds ?? [] },
    actorId: opts.actorId,
  });
  return { ok: true } as const;
}
