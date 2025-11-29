import { Router } from 'express';
import { prisma } from '../prisma';

const analyticsPublicRouter = Router();

// POST /public/analytics/events — public ingestion (no auth)
analyticsPublicRouter.post('/events', async (req, res) => {
  const { tenantId, type, source, utm, stepIndex, timestamp } = req.body || {};
  if (!tenantId || !type) return res.status(400).json({ error: 'tenantId and type are required' });

  try {
    await prisma.analyticsEvent.create({
      data: {
        tenantId,
        type,
        source,
        utm: utm ? utm : undefined,
        stepIndex: typeof stepIndex === 'number' ? stepIndex : undefined,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });
    return res.json({ ok: true });
  } catch (e: any) {
    // Gracefully degrade if table not migrated yet
    if (e?.code === 'P2021') {
      return res.status(202).json({ ok: false, warning: 'analytics_table_missing' });
    }
    return res.status(500).json({ error: e?.message || 'failed_to_ingest' });
  }
});

export default analyticsPublicRouter;
