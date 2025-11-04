// api/src/routes/ml-status.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { extractKeyMetric } from "../services/training";

const router = Router();

router.get("/", async (req: any, res) => {
  const tenantId = req.auth?.tenantId as string | undefined;
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [productionModels, trainingRuns, supplierGroups, totalEstimates, labelledCount, wonCount, lostCount, inferenceCounts, recentEstimates] =
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
          orderBy: { _count: { _all: "desc" } },
          take: 10,
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
        prisma.estimate.findMany({
          where: { tenantId, actualAcceptedPrice: { not: null } },
          select: { estimatedTotal: true, actualAcceptedPrice: true },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
      ]);

    const [parsedCount7d, estimatesCount7d, inferenceCount7d] = inferenceCounts;

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
    }));

    const supplierCounts = supplierGroups.map((group) => ({
      supplier: group.supplier || "Unknown",
      count: group._count._all,
    }));

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
      },
    });
  } catch (e: any) {
    console.error("[ml/status] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
