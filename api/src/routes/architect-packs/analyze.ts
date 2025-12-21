/**
 * API Endpoint: POST /api/architect-packs/:id/analyze
 * 
 * Trigger AI analysis of uploaded architect pack
 * 
 * Request params:
 * - id: string (architect pack ID)
 * 
 * Request body:
 * - modelVersion?: string (AI model version to use, defaults to 'gpt-4-vision-preview')
 * - forceReanalyze?: boolean (ignore cache and re-run analysis)
 * 
 * Response:
 * - analysisId: string
 * - status: 'processing' | 'complete' | 'error'
 * - pagesAnalyzed: number
 * - totalPages: number
 * - openingsFound: number
 * - processingTimeMs: number
 * - cached: boolean
 */

import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { prisma } from '../../db';

const DEFAULT_MODEL_VERSION = 'gpt-4-vision-preview';

export async function analyzeArchitectPack(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { modelVersion = DEFAULT_MODEL_VERSION, forceReanalyze = false } = req.body;
    const tenantId = req.auth?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No tenant ID found'
      });
    }

    // Fetch architect pack
    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        analyses: {
          where: {
            modelVersion
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found or access denied'
      });
    }

    // Check for existing analysis (cache)
    if (!forceReanalyze && pack.analyses.length > 0) {
      const existingAnalysis = pack.analyses[0];
      
      // Count openings
      const openingsCount = await prisma.architectOpening.count({
        where: { analysisId: existingAnalysis.id }
      });

      return res.json({
        success: true,
        cached: true,
        analysis: {
          analysisId: existingAnalysis.id,
          status: 'complete',
          pagesAnalyzed: existingAnalysis.pagesAnalyzed,
          totalPages: existingAnalysis.totalPages,
          openingsFound: openingsCount,
          processingTimeMs: existingAnalysis.processingTime ?? 0,
          createdAt: existingAnalysis.createdAt.toISOString()
        }
      });
    }

    // Start background analysis job
    // In production, this would use a queue (Bull, BullMQ, etc.)
    // For now, we'll create a pending analysis record and process async
    
    const analysis = await prisma.architectPackAnalysis.create({
      data: {
        packId: pack.id,
        modelVersion,
        json: { status: 'processing' },
        pagesAnalyzed: 0,
        totalPages: 0,
        processingTime: 0
      }
    });

    // Trigger async processing (would be queued in production)
    // For now, return immediately with processing status
    processArchitectPackAsync(pack.id, analysis.id, modelVersion)
      .catch(error => {
        console.error('Background analysis error:', error);
        // Update analysis with error status
        prisma.architectPackAnalysis.update({
          where: { id: analysis.id },
          data: {
            json: {
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }).catch(console.error);
      });

    return res.status(202).json({
      success: true,
      cached: false,
      analysis: {
        analysisId: analysis.id,
        status: 'processing',
        pagesAnalyzed: 0,
        totalPages: 0,
        openingsFound: 0,
        processingTimeMs: 0
      }
    });

  } catch (error) {
    console.error('Error starting architect pack analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error starting analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Background async processing function
 * In production, this would be a separate queue worker
 */
async function processArchitectPackAsync(
  packId: string,
  analysisId: string,
  modelVersion: string
): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch pack with data
    const pack = await prisma.architectPack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      throw new Error('Pack not found');
    }

    // Import services (dynamic to avoid circular deps)
    const { parsePDF } = await import('../../services/pdf-parser');
    const { analyzeArchitecturalDrawings } = await import('../../services/ai-analyzer');

    // 1. Parse PDF to extract pages
    console.log(`Parsing PDF for pack ${packId}...`);
    if (!pack.base64Data) {
      throw new Error('Pack has no file data');
    }

    const parseResult = await parsePDF(pack.base64Data);
    console.log(`Parsed ${parseResult.pages.length} pages`);

    // 2. Analyze pages with AI
    console.log(`Analyzing pages with ${modelVersion}...`);
    const analysisResult = await analyzeArchitecturalDrawings(
      parseResult.pages,
      pack.tenantId,
      modelVersion
    );
    console.log(`Found ${analysisResult.openings.length} openings`);

    // 3. Save openings to database
    if (analysisResult.openings.length > 0) {
      await prisma.architectOpening.createMany({
        data: analysisResult.openings.map(opening => ({
          analysisId,
          type: opening.type,
          widthMm: opening.widthMm,
          heightMm: opening.heightMm,
          locationHint: opening.locationHint,
          pageNumber: opening.pageNumber,
          notes: opening.notes,
          sillHeight: opening.sillHeight,
          glazingType: opening.glazingType,
          frameType: opening.frameType,
          confidence: opening.confidence,
          userConfirmed: false,
          userModified: false
        }))
      });
    }

    const processingTimeMs = Date.now() - startTime;

    // 4. Update analysis with results
    const analysisJson: Prisma.InputJsonValue = {
      status: 'complete',
      openings: analysisResult.openings as unknown as Prisma.JsonArray,
      metadata: {
        ...analysisResult.metadata,
        pdfInfo: parseResult.metadata.pdfInfo
      }
    };

    await prisma.architectPackAnalysis.update({
      where: { id: analysisId },
      data: {
        json: analysisJson,
        pagesAnalyzed: analysisResult.metadata.pagesAnalyzed,
        totalPages: parseResult.metadata.totalPages,
        processingTime: processingTimeMs
      }
    });

    console.log(`Analysis complete for pack ${packId} in ${processingTimeMs}ms`);

  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }
}
