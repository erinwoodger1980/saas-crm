/**
 * Architect Packs API Router
 * 
 * Routes:
 * - POST   /api/architect-packs/upload         - Upload new architect pack (PDF)
 * - GET    /api/architect-packs/:id            - Get architect pack details
 * - POST   /api/architect-packs/:id/analyze    - Trigger AI analysis
 * - GET    /api/architect-packs/:id/openings   - Get detected openings
 * - PATCH  /api/architect-packs/:id/openings   - Update openings
 * - POST   /api/architect-packs/:id/build      - Build products from openings
 * - GET    /api/architect-packs/:id/status     - Get analysis status
 */

import { Router } from 'express';
import { uploadArchitectPack } from './upload.js';
import { analyzeArchitectPack } from './analyze.js';
import { getArchitectPackOpenings, updateArchitectPackOpenings } from './openings.js';
import { buildProductsFromOpenings } from './build.js';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Upload new architect pack
router.post('/upload', uploadArchitectPack);

// Get architect pack details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { prisma } = await import('../../db');
    
    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found'
      });
    }

    // Don't send base64Data in response (too large)
    const { base64Data, ...packWithoutData } = pack;

    return res.json({
      success: true,
      pack: {
        ...packWithoutData,
        hasData: !!base64Data,
        dataSizeBytes: base64Data?.length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching architect pack:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Trigger AI analysis
router.post('/:id/analyze', analyzeArchitectPack);

// Get/update openings
router.get('/:id/openings', getArchitectPackOpenings);
router.patch('/:id/openings', updateArchitectPackOpenings);

// Build products from openings
router.post('/:id/build', buildProductsFromOpenings);

// Get analysis status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { prisma } = await import('../../db');

    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found'
      });
    }

    if (!pack.analyses.length) {
      return res.json({
        success: true,
        status: 'pending',
        message: 'No analysis started yet'
      });
    }

    const analysis = pack.analyses[0];
    const analysisStatus = (analysis.json as any)?.status || 'unknown';

    const openingsCount = await prisma.architectOpening.count({
      where: { analysisId: analysis.id }
    });

    const confirmedCount = await prisma.architectOpening.count({
      where: {
        analysisId: analysis.id,
        userConfirmed: true
      }
    });

    return res.json({
      success: true,
      status: analysisStatus,
      analysis: {
        id: analysis.id,
        pagesAnalyzed: analysis.pagesAnalyzed,
        totalPages: analysis.totalPages,
          processingTimeMs: analysis.processingTime ?? 0,
        modelVersion: analysis.modelVersion,
        openingsFound: openingsCount,
        confirmedOpenings: confirmedCount,
        createdAt: analysis.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching analysis status:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
