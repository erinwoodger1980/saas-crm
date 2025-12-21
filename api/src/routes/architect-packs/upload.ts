/**
 * API Endpoint: POST /api/architect-packs/upload
 * 
 * Upload architectural drawing pack (PDF) for AI analysis
 * 
 * Request body:
 * - filename: string
 * - mimeType: string (must be 'application/pdf')
 * - base64Data: string (base64-encoded PDF)
 * - quoteId?: string (optional link to quote)
 * 
 * Response:
 * - packId: string
 * - filename: string
 * - fileHash: string (SHA256)
 * - uploadedAt: string (ISO timestamp)
 * - status: 'pending' | 'analyzing' | 'complete' | 'error'
 */

import { Request, Response } from 'express';
import { prisma } from '../../db';
import crypto from 'crypto';

// Helper to calculate SHA256 hash of file content
function calculateFileHash(base64Data: string): string {
  const buffer = Buffer.from(base64Data, 'base64');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Validate file type
function validatePDF(mimeType: string, filename: string): boolean {
  const validMimeTypes = ['application/pdf'];
  const validExtensions = ['.pdf'];
  
  const hasValidMime = validMimeTypes.includes(mimeType.toLowerCase());
  const hasValidExt = validExtensions.some(ext => 
    filename.toLowerCase().endsWith(ext)
  );
  
  return hasValidMime && hasValidExt;
}

export async function uploadArchitectPack(req: Request, res: Response) {
  try {
    const { filename, mimeType, base64Data, quoteId } = req.body;
    const tenantId = req.auth?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No tenant ID found'
      });
    }

    // Validate required fields
    if (!filename || !mimeType || !base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: filename, mimeType, base64Data'
      });
    }

    // Validate file type
    if (!validatePDF(mimeType, filename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only PDF files are supported.'
      });
    }

    // Validate base64 data
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid base64Data format'
      });
    }

    // Calculate file hash for caching
    const fileHash = calculateFileHash(base64Data);

    // Check for existing pack with same hash
    const existingPack = await prisma.architectPack.findFirst({
      where: {
        tenantId,
        fileHash
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // If pack with same hash exists, return it (cached)
    if (existingPack && existingPack.analyses.length > 0) {
      return res.json({
        success: true,
        cached: true,
        pack: {
          packId: existingPack.id,
          filename: existingPack.filename,
          fileHash: existingPack.fileHash,
          uploadedAt: existingPack.createdAt.toISOString(),
          status: 'complete',
          analysisId: existingPack.analyses[0].id
        }
      });
    }

    // Validate quote exists if quoteId provided
    if (quoteId) {
      const quote = await prisma.quote.findFirst({
        where: {
          id: quoteId,
          tenantId
        }
      });

      if (!quote) {
        return res.status(404).json({
          success: false,
          error: 'Quote not found or access denied'
        });
      }
    }

    // Create new architect pack
    const pack = await prisma.architectPack.create({
      data: {
        tenantId,
        filename,
        mime: mimeType,
        base64Data,
        fileHash
      }
    });

    return res.status(201).json({
      success: true,
      cached: false,
      pack: {
        packId: pack.id,
        filename: pack.filename,
        fileHash: pack.fileHash,
        uploadedAt: pack.createdAt.toISOString(),
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error uploading architect pack:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error uploading architect pack',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
