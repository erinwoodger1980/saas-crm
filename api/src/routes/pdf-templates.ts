/**
 * PDF Template Routes
 * 
 * App-wide PDF layout templates for quote parsing
 * Not tenant-scoped - available across all tenants
 */

import { Router, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

/**
 * GET /pdf-templates
 * List all PDF layout templates
 */
router.get('/', async (req: any, res: Response) => {
  try {
    const templates = await prisma.pdfLayoutTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        supplierProfileId: true,
        fileHash: true,
        pageCount: true,
        createdAt: true,
        updatedAt: true,
        // Don't include full annotations in list view
      },
    });

    res.json({ ok: true, items: templates });
  } catch (error: any) {
    console.error('[GET /pdf-templates] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch templates',
      detail: error?.message 
    });
  }
});

/**
 * GET /pdf-templates/:id
 * Get single template with full annotations
 */
router.get('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.pdfLayoutTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Template not found' 
      });
    }

    res.json({ ok: true, item: template });
  } catch (error: any) {
    console.error('[GET /pdf-templates/:id] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch template',
      detail: error?.message 
    });
  }
});

/**
 * POST /pdf-templates
 * Create new PDF layout template
 */
router.post('/', async (req: any, res: Response) => {
  try {
    const { name, description, supplierProfileId, fileHash, pageCount, annotations } = req.body;

    // Validation
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: 'name is required and must be a string' 
      });
    }

    if (!Array.isArray(annotations)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'annotations must be an array' 
      });
    }

    // Create template
    const template = await prisma.pdfLayoutTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        supplierProfileId: supplierProfileId || null,
        fileHash: fileHash || null,
        pageCount: pageCount || null,
        annotations: annotations,
      },
    });

    console.log('[POST /pdf-templates] Created template:', {
      id: template.id,
      name: template.name,
      supplierProfileId: template.supplierProfileId,
      annotationCount: annotations.length,
    });

    res.status(201).json({ ok: true, item: template });
  } catch (error: any) {
    console.error('[POST /pdf-templates] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to create template',
      detail: error?.message 
    });
  }
});

/**
 * PATCH /pdf-templates/:id
 * Update existing template
 */
router.patch('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, supplierProfileId, fileHash, pageCount, annotations } = req.body;

    // Check template exists
    const existing = await prisma.pdfLayoutTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Template not found' 
      });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (supplierProfileId !== undefined) updateData.supplierProfileId = supplierProfileId || null;
    if (fileHash !== undefined) updateData.fileHash = fileHash || null;
    if (pageCount !== undefined) updateData.pageCount = pageCount || null;
    if (annotations !== undefined) {
      if (!Array.isArray(annotations)) {
        return res.status(400).json({ 
          ok: false, 
          error: 'annotations must be an array' 
        });
      }
      updateData.annotations = annotations;
    }

    const template = await prisma.pdfLayoutTemplate.update({
      where: { id },
      data: updateData,
    });

    console.log('[PATCH /pdf-templates/:id] Updated template:', {
      id: template.id,
      name: template.name,
    });

    res.json({ ok: true, item: template });
  } catch (error: any) {
    console.error('[PATCH /pdf-templates/:id] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to update template',
      detail: error?.message 
    });
  }
});

/**
 * DELETE /pdf-templates/:id
 * Delete template
 */
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    // Check template exists
    const existing = await prisma.pdfLayoutTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Template not found' 
      });
    }

    await prisma.pdfLayoutTemplate.delete({
      where: { id },
    });

    console.log('[DELETE /pdf-templates/:id] Deleted template:', {
      id,
      name: existing.name,
    });

    res.json({ ok: true, message: 'Template deleted' });
  } catch (error: any) {
    console.error('[DELETE /pdf-templates/:id] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to delete template',
      detail: error?.message 
    });
  }
});

export default router;
