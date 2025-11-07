import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createGoogleAdsClient } from '../lib/google-ads';
import { createAdsOptimizer } from '../lib/ads-optimizer';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /keywords/:tenantId/report
 * Get comprehensive keyword optimization report
 */
router.get('/:tenantId/report', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const adsClient = createGoogleAdsClient();
    if (!adsClient) {
      return res.status(500).json({ error: 'Google Ads API not configured' });
    }

    const optimizer = createAdsOptimizer(adsClient);
    const report = await optimizer.getOptimizationReport(tenantId);

    res.json(report);
  } catch (error: any) {
    console.error('Failed to generate report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /keywords/:tenantId/suggestions
 * Get keyword suggestions with optional filtering
 */
router.get('/:tenantId/suggestions', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status } = req.query;

    const where: any = { tenantId };
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const suggestions = await prisma.keywordSuggestion.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // pending first
        { conversionRate: 'desc' }, // best performers first
      ],
      include: {
        tenant: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({ suggestions });
  } catch (error: any) {
    console.error('Failed to fetch suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /keywords/:tenantId/suggestions/:id/approve
 * Approve a keyword suggestion
 */
router.patch('/:tenantId/suggestions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { tenantId, id } = req.params;

    const suggestion = await prisma.keywordSuggestion.findFirst({
      where: {
        id,
        tenantId,
        status: 'pending',
      },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found or already processed' });
    }

    const updated = await prisma.keywordSuggestion.update({
      where: { id },
      data: {
        status: 'approved',
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, suggestion: updated });
  } catch (error: any) {
    console.error('Failed to approve suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /keywords/:tenantId/suggestions/:id/reject
 * Reject a keyword suggestion
 */
router.patch('/:tenantId/suggestions/:id/reject', async (req: Request, res: Response) => {
  try {
    const { tenantId, id } = req.params;

    const suggestion = await prisma.keywordSuggestion.findFirst({
      where: {
        id,
        tenantId,
        status: 'pending',
      },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found or already processed' });
    }

    const updated = await prisma.keywordSuggestion.update({
      where: { id },
      data: {
        status: 'rejected',
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, suggestion: updated });
  } catch (error: any) {
    console.error('Failed to reject suggestion:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /keywords/:tenantId/apply
 * Apply all approved suggestions to landing page content
 */
router.post('/:tenantId/apply', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const adsClient = createGoogleAdsClient();
    if (!adsClient) {
      return res.status(500).json({ error: 'Google Ads API not configured' });
    }

    const optimizer = createAdsOptimizer(adsClient);
    const result = await optimizer.applyApprovedSuggestions(tenantId);

    res.json(result);
  } catch (error: any) {
    console.error('Failed to apply suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /keywords/:tenantId/performance
 * Get keyword performance data
 */
router.get('/:tenantId/performance', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = '50', underperformingOnly = 'false' } = req.query;

    const where: any = { tenantId };
    if (underperformingOnly === 'true') {
      where.isUnderperforming = true;
    }

    const performance = await prisma.keywordPerformance.findMany({
      where,
      orderBy: [
        { weekStartDate: 'desc' },
        { conversionRate: 'desc' },
      ],
      take: parseInt(limit as string, 10),
    });

    res.json({ performance });
  } catch (error: any) {
    console.error('Failed to fetch performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /keywords/:tenantId/sync
 * Manually trigger Google Ads sync for a tenant
 */
router.post('/:tenantId/sync', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const adsClient = createGoogleAdsClient();
    if (!adsClient) {
      return res.status(500).json({ error: 'Google Ads API not configured' });
    }

    // Update keyword performance
  const result = await adsClient.updateKeywordPerformance(tenantId);

    if (result.success === false) {
      return res.status(400).json({ error: result.error || 'Sync failed' });
    }

    // Generate suggestions
    const optimizer = createAdsOptimizer(adsClient);
    const suggestions = await optimizer.generateOptimizationSuggestions(tenantId);
    await optimizer.saveSuggestions(tenantId, suggestions);

    res.json({
      success: true,
      keywordCount: result.keywordCount,
      activeKeywordCount: result.activeKeywordCount,
      underperformingCount: result.underperformingCount,
      suggestionsGenerated: suggestions.length,
    });
  } catch (error: any) {
    console.error('Failed to sync keywords:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
