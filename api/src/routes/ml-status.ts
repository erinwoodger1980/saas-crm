// api/src/routes/ml-status.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { extractKeyMetric } from "../services/training";
import { mlBootstrap } from "../env";

const SERVICE_HEALTH_TIMEOUT_MS = 2000;

async function resolveServiceHealth(): Promise<"online" | "degraded" | "offline"> {
  const target = mlBootstrap.resolvedMlUrl?.trim();
  if (!target) return "offline";

  const url = target.endsWith("/") ? `${target}health` : `${target}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVICE_HEALTH_TIMEOUT_MS);

  try {
    const started = Date.now();
    const res = await fetch(url, { method: "GET", signal: controller.signal }).catch((err) => {
      // fetch will throw for abort/connection issues which we treat as offline
      throw err;
    });
    const duration = Date.now() - started;
    if (duration > SERVICE_HEALTH_TIMEOUT_MS) return "degraded";
    if (res.status >= 500) return "degraded";
    if (res.status !== 200) return "degraded";
    return "online";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

const router = Router();

router.get("/", async (req: any, res) => {
  const scopeRaw = typeof req.query?.scope === "string" ? req.query.scope : Array.isArray(req.query?.scope) ? req.query.scope[0] : "";
  const scope = String(scopeRaw || "").toLowerCase();
  const { mlUrlHost, isProdMlHost, warning } = mlBootstrap;

  if (scope === "global") {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const parseSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const productionModels = await prisma.modelVersion.findMany({ where: { isProduction: true }, orderBy: { createdAt: "desc" } });
      const seen = new Set<string>();
      const models = productionModels
        .filter((m) => {
          if (seen.has(m.model)) return false;
          seen.add(m.model);
          return true;
        })
        .map((m) => ({
          id: m.id,
          model: m.model,
          label: m.label,
          datasetHash: m.datasetHash,
          createdAt: m.createdAt,
          metrics: m.metricsJson,
          keyMetric: extractKeyMetric(m.model, m.metricsJson as any),
        }));

      const [parsedSupplierLines, estimates, inferenceEvents, parseEvents7d, parseFallback7d, parseErrors7d] =
        await Promise.all([
          prisma.parsedSupplierLine.count({ where: { createdAt: { gte: since } } }),
          prisma.estimate.count({ where: { createdAt: { gte: since } } }),
          prisma.inferenceEvent.count({ where: { createdAt: { gte: since } } }),
          prisma.inferenceEvent.count({
            where: { model: "supplier_parser", createdAt: { gte: parseSince } },
          }),
          prisma.inferenceEvent.count({
            where: {
              model: "supplier_parser",
              createdAt: { gte: parseSince },
              outputJson: { path: ["meta", "fallbackUsed"], equals: true },
            },
          }),
          prisma.inferenceEvent.count({
            where: {
              model: "supplier_parser",
              createdAt: { gte: parseSince },
              outputJson: { path: ["meta", "status"], equals: "error" },
            },
          }),
        ]);

      const parseFallbackRatio7d = parseEvents7d > 0 ? parseFallback7d / parseEvents7d : 0;
      const parseErrorRate7d = parseEvents7d > 0 ? parseErrors7d / parseEvents7d : 0;

      return res.json({
        ok: true,
        scope: "global",
        models,
        counts: {
          since: since.toISOString(),
          parsedSupplierLines,
          estimates,
          inferenceEvents,
        },
        parseFallbackRatio7d,
        parseErrorRate7d,
        mlUrlHost,
        isProdMlHost,
        warning,
      });
    } catch (e: any) {
      console.error("[ml/status global] failed:", e?.message || e);
      return res.status(500).json({ error: "internal_error" });
    }
  }

  const tenantId = req.auth?.tenantId as string | undefined;
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const samplesSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const estimatorModel = "supplier_estimator";

    const [
      productionModels,
      trainingRuns,
      supplierGroupsRaw,
      totalEstimates,
      labelledCount,
      wonCount,
      lostCount,
      inferenceCounts,
      parseEventCounts,
      recentEstimates,
      estimatorLastRun,
      estimatorProduction,
      recentSampleCount,
      recentParsedQuoteIds,
      serviceHealth,
    ] =
      await Promise.all([
        prisma.modelVersion.findMany({ where: { isProduction: true }, orderBy: { createdAt: "desc" } }),
        prisma.trainingRun.findMany({
          where: { OR: [{ tenantId }, { tenantId: null }] },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.parsedSupplierLine.groupBy({
          by: ["supplier"],
          where: { tenantId },
          _count: { _all: true },
        }),
        prisma.estimate.count({ where: { tenantId } }),
        prisma.estimate.count({ where: { tenantId, actualAcceptedPrice: { not: null } } }),
        prisma.estimate.count({ where: { tenantId, outcome: "won" } }),
        prisma.estimate.count({ where: { tenantId, outcome: "lost" } }),
        Promise.all([
          prisma.parsedSupplierLine.count({ where: { tenantId, createdAt: { gte: since } } }),
          prisma.estimate.count({ where: { tenantId, createdAt: { gte: since } } }),
          prisma.inferenceEvent.count({ where: { tenantId, createdAt: { gte: since } } }),
        ]),
        Promise.all([
          prisma.inferenceEvent.count({
            where: { tenantId, model: "supplier_parser", createdAt: { gte: since } },
          }),
          prisma.inferenceEvent.count({
            where: {
              tenantId,
              model: "supplier_parser",
              createdAt: { gte: since },
              outputJson: { path: ["meta", "fallbackUsed"], equals: true },
            },
          }),
          prisma.inferenceEvent.count({
            where: {
              tenantId,
              model: "supplier_parser",
              createdAt: { gte: since },
              outputJson: { path: ["meta", "status"], equals: "error" },
            },
          }),
        ]),
        prisma.estimate.findMany({
          where: { tenantId, actualAcceptedPrice: { not: null } },
          select: { estimatedTotal: true, actualAcceptedPrice: true },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
        prisma.trainingRun.findFirst({
          where: { OR: [{ tenantId }, { tenantId: null }], model: estimatorModel },
          orderBy: { createdAt: "desc" },
        }),
        prisma.modelVersion.findFirst({
          where: { model: estimatorModel, isProduction: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.mLTrainingSample.count({
          where: {
            tenantId,
            OR: [
              { createdAt: { gte: samplesSince } },
              { quotedAt: { gte: samplesSince } },
            ],
            sourceType: { in: ["client_quote", "supplier_quote"] },
          },
        }),
        prisma.parsedSupplierLine.findMany({
          where: { tenantId, createdAt: { gte: samplesSince } },
          distinct: ["quoteId"],
          select: { quoteId: true },
        }),
        resolveServiceHealth(),
      ]);

    const [parsedCount7d, estimatesCount7d, inferenceCount7d] = inferenceCounts;
    const [parseEvents7d, parseFallback7d, parseErrors7d] = parseEventCounts;

    const parseFallbackRatio7d = parseEvents7d > 0 ? parseFallback7d / parseEvents7d : 0;
    const parseErrorRate7d = parseEvents7d > 0 ? parseErrors7d / parseEvents7d : 0;

    const mapeValues = recentEstimates
      .map((row) => {
        const estimated = Number(row.estimatedTotal ?? 0);
        const actual = Number(row.actualAcceptedPrice ?? 0);
        if (!actual || !Number.isFinite(actual)) return null;
        const diff = Math.abs(actual - estimated);
        if (!Number.isFinite(diff)) return null;
        return actual !== 0 ? diff / Math.abs(actual) : null;
      })
      .filter((v): v is number => v != null && Number.isFinite(v));

    const averageMape = mapeValues.length ? mapeValues.reduce((sum, v) => sum + v, 0) / mapeValues.length : null;

    const models = productionModels.map((m) => ({
      id: m.id,
      model: m.model,
      label: m.label,
      datasetHash: m.datasetHash,
      createdAt: m.createdAt,
      metrics: m.metricsJson,
      keyMetric: extractKeyMetric(m.model, m.metricsJson as any),
    }));

    const runs = trainingRuns.map((run) => ({
      id: run.id,
      tenantId: run.tenantId,
      model: run.model,
      status: run.status,
      createdAt: run.createdAt,
      metrics: run.metricsJson,
      modelVersionId: run.modelVersionId,
      datasetHash: run.datasetHash,
      datasetCount: (run as any).datasetCount ?? null,
      startedAt: (run as any).startedAt ?? null,
      finishedAt: (run as any).finishedAt ?? null,
    }));

    const uniqueParsedQuoteIds = new Set(
      recentParsedQuoteIds
        .map((row) => row.quoteId)
        .filter((quoteId): quoteId is string => typeof quoteId === "string" && quoteId.length > 0),
    );
    const recentSamples14d = recentSampleCount + uniqueParsedQuoteIds.size;

    const toNumber = (value: any): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const deriveConfidence = (metrics: any): number | null => {
      if (!metrics || typeof metrics !== "object") return null;
      const mape = toNumber((metrics as any).mape ?? (metrics as any).MAPE ?? null);
      if (mape != null) {
        const clamped = Math.min(1, Math.max(0, mape));
        return Math.max(0, Math.min(1, 1 - clamped));
      }
      const accuracy = toNumber((metrics as any).accuracy ?? (metrics as any).f1 ?? null);
      if (accuracy != null) {
        return Math.max(0, Math.min(1, accuracy));
      }
      return null;
    };

    const estimatorProd = estimatorProduction || productionModels.find((m) => m.model === estimatorModel) || null;
    const estimatorMetricsSource = estimatorProd?.metricsJson || estimatorLastRun?.metricsJson || null;
    const estimatorConfidence = deriveConfidence(estimatorMetricsSource);

    const finishedAt = (estimatorLastRun as any)?.finishedAt || null;

    const normalizedServiceHealth = warning
      ? serviceHealth === "offline"
        ? "offline"
        : "degraded"
      : serviceHealth;

    const estimator = {
      recentSamples14d,
      lastTrainingRun: estimatorLastRun
        ? {
            id: estimatorLastRun.id,
            status: estimatorLastRun.status,
            datasetCount: (estimatorLastRun as any).datasetCount ?? null,
            modelVersionId: estimatorLastRun.modelVersionId ?? null,
            finishedAt: finishedAt
              ? new Date(finishedAt as any).toISOString()
              : estimatorLastRun.createdAt.toISOString(),
            metrics: (estimatorLastRun.metricsJson as any) ?? null,
          }
        : undefined,
      productionModel: estimatorProd
        ? {
            id: estimatorProd.id,
            version: estimatorProd.versionId ?? estimatorProd.label ?? null,
            metrics: (estimatorProd.metricsJson as any) ?? null,
            createdAt: estimatorProd.createdAt ? estimatorProd.createdAt.toISOString() : null,
          }
        : undefined,
      modelConfidence: estimatorConfidence,
      serviceHealth: normalizedServiceHealth,
    } as const;

    const supplierCounts = supplierGroupsRaw
      .map((group) => ({
        supplier: group.supplier || "Unknown",
        count: group._count?._all ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      ok: true,
      models,
      trainingRuns: runs,
      suppliers: supplierCounts,
      estimates: {
        total: totalEstimates,
        withActual: labelledCount,
        won: wonCount,
        lost: lostCount,
        averageMape,
      },
      inferenceActivity: {
        since: since.toISOString(),
        parsedSupplierLines: parsedCount7d,
        estimates: estimatesCount7d,
        inferenceEvents: inferenceCount7d,
        parseFallbackRatio7d,
        parseErrorRate7d,
      },
      parseFallbackRatio7d,
      parseErrorRate7d,
      mlUrlHost,
      isProdMlHost,
      warning,
      estimator,
      recentSamples14d,
      lastTrainingRun: estimator.lastTrainingRun ?? null,
      productionModel: estimator.productionModel ?? null,
      modelConfidence: estimator.modelConfidence,
    });
  } catch (e: any) {
    console.error("[ml/status] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
