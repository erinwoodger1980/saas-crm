/**
 * API Endpoint: GET/PATCH /api/architect-packs/:id/openings
 * 
 * GET: Fetch all openings detected in an architect pack analysis
 * PATCH: Update opening details (user edits)
 * 
 * GET Response:
 * - openings: Array of opening objects
 * - totalCount: number
 * - confirmedCount: number
 * 
 * PATCH Request body:
 * - openings: Array of opening updates
 *   - id: string (opening ID)
 *   - type?: string
 *   - widthMm?: number
 *   - heightMm?: number
 *   - locationHint?: string
 *   - userConfirmed?: boolean
 * 
 * PATCH Response:
 * - updatedCount: number
 * - openings: Array of updated opening objects
 */

import { Request, Response } from 'express';
import { prisma } from '../../db';

export async function getArchitectPackOpenings(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tenantId = req.auth?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No tenant ID found'
      });
    }

    // Fetch architect pack with latest analysis
    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            openings: {
              orderBy: [
                { pageNumber: 'asc' },
                { confidence: 'desc' }
              ],
              include: {
                quoteLine: {
                  select: {
                    id: true,
                    description: true,
                    qty: true,
                    unitPrice: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found or access denied'
      });
    }

    if (!pack.analyses.length) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found for this architect pack'
      });
    }

    const analysis = pack.analyses[0];
    const openings = analysis.openings;

    const confirmedCount = openings.filter((o: any) => o.userConfirmed).length;

    return res.json({
      success: true,
      data: {
        analysisId: analysis.id,
        openings: openings.map((opening: any) => ({
          id: opening.id,
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
          userConfirmed: opening.userConfirmed,
          userModified: opening.userModified,
          quoteLineId: opening.quoteLineId,
          quoteLine: opening.quoteLine,
          createdAt: opening.createdAt.toISOString(),
          updatedAt: opening.updatedAt.toISOString()
        })),
        totalCount: openings.length,
        confirmedCount
      }
    });

  } catch (error) {
    console.error('Error fetching architect pack openings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error fetching openings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function updateArchitectPackOpenings(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { openings: updates } = req.body;
    const tenantId = req.auth?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No tenant ID found'
      });
    }

    // Validate request body
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: openings array required'
      });
    }

    // Verify pack ownership
    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found or access denied'
      });
    }

    // Update openings in transaction
    const updatedOpenings = await prisma.$transaction(
      updates.map(update => {
        const { id: openingId, ...data } = update;

        // Filter out undefined values and prepare update data
        const updateData: any = {};
        
        if (data.type !== undefined) updateData.type = data.type;
        if (data.widthMm !== undefined) updateData.widthMm = data.widthMm;
        if (data.heightMm !== undefined) updateData.heightMm = data.heightMm;
        if (data.locationHint !== undefined) updateData.locationHint = data.locationHint;
        if (data.sillHeight !== undefined) updateData.sillHeight = data.sillHeight;
        if (data.glazingType !== undefined) updateData.glazingType = data.glazingType;
        if (data.frameType !== undefined) updateData.frameType = data.frameType;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.userConfirmed !== undefined) updateData.userConfirmed = data.userConfirmed;

        // Mark as user modified if any field changed
        const hasChanges = Object.keys(updateData).length > 0;
        if (hasChanges && !updateData.userConfirmed) {
          updateData.userModified = true;
        }

        return prisma.architectOpening.update({
          where: { id: openingId },
          data: updateData,
          include: {
            quoteLine: {
              select: {
                id: true,
                description: true,
                qty: true,
                unitPrice: true
              }
            }
          }
        });
      })
    );

    return res.json({
      success: true,
      data: {
        updatedCount: updatedOpenings.length,
        openings: updatedOpenings.map((opening: any) => ({
          id: opening.id,
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
          userConfirmed: opening.userConfirmed,
          userModified: opening.userModified,
          quoteLineId: opening.quoteLineId,
          quoteLine: opening.quoteLine,
          updatedAt: opening.updatedAt.toISOString()
        }))
      }
    });

  } catch (error) {
    console.error('Error updating architect pack openings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error updating openings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
