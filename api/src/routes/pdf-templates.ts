/**
 * PDF Template Routes
 * 
 * App-wide PDF layout templates for quote parsing
 * Not tenant-scoped - available across all tenants
 */

import { Router, Response } from "express";
import { PdfAnnotationLabel, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { normaliseAnnotations, shouldFallbackPdfTemplateQuery } from "../lib/pdf/layoutTemplates";

const router = Router();

type IncomingAnnotation = {
  id?: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  rowId?: string | null;
};

type AnnotationWrite = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: PdfAnnotationLabel;
  rowId?: string | null;
};

// Allow broader synonyms from frontend / legacy tools.
const LABEL_INPUTS: Record<string, PdfAnnotationLabel> = {
  joinery_image: PdfAnnotationLabel.JOINERY_IMAGE,
  image: PdfAnnotationLabel.JOINERY_IMAGE,
  photo: PdfAnnotationLabel.JOINERY_IMAGE,
  img: PdfAnnotationLabel.JOINERY_IMAGE,
  description: PdfAnnotationLabel.DESCRIPTION,
  desc: PdfAnnotationLabel.DESCRIPTION,
  qty: PdfAnnotationLabel.QTY,
  quantity: PdfAnnotationLabel.QTY,
  unit_cost: PdfAnnotationLabel.UNIT_COST,
  unit_price: PdfAnnotationLabel.UNIT_COST,
  unit: PdfAnnotationLabel.UNIT_COST,
  unit_cost_gbp: PdfAnnotationLabel.UNIT_COST,
  unit_price_gbp: PdfAnnotationLabel.UNIT_COST,
  price_each: PdfAnnotationLabel.UNIT_COST,
  price: PdfAnnotationLabel.UNIT_COST,
  line_total: PdfAnnotationLabel.LINE_TOTAL,
  total: PdfAnnotationLabel.LINE_TOTAL,
  total_gbp: PdfAnnotationLabel.LINE_TOTAL,
  line_total_gbp: PdfAnnotationLabel.LINE_TOTAL,
  amount: PdfAnnotationLabel.LINE_TOTAL,
  delivery_row: PdfAnnotationLabel.DELIVERY_ROW,
  delivery: PdfAnnotationLabel.DELIVERY_ROW,
  shipping: PdfAnnotationLabel.DELIVERY_ROW,
  freight: PdfAnnotationLabel.DELIVERY_ROW,
  carriage: PdfAnnotationLabel.DELIVERY_ROW,
  header_logo: PdfAnnotationLabel.HEADER_LOGO,
  logo: PdfAnnotationLabel.HEADER_LOGO,
  ignore: PdfAnnotationLabel.IGNORE,
};

// Keep the primary select set intentionally minimal for maximum backward compatibility.
// Older production deployments may lack optional columns (pageCount, meta, createdByUserId).
// We compute annotationCount lazily in serializeTemplate if available.
const listSelect = {
  id: true,
  name: true,
  description: true,
  supplierProfileId: true,
  createdAt: true,
  updatedAt: true,
  // Note: pageCount & _count intentionally omitted; unsafe on older schemas.
} as const;

const annotationOrderBy: Prisma.PdfLayoutAnnotationOrderByWithRelationInput[] = [
  { page: "asc" },
  { y: "asc" },
  { x: "asc" },
];

const detailSelect: Prisma.PdfLayoutTemplateSelect = {
  ...listSelect,
  annotations: {
    orderBy: annotationOrderBy,
  },
};

/**
 * GET /pdf-templates
 * List all PDF layout templates
 */
router.get("/", async (_req: any, res: Response) => {
  try {
    const templates = await fetchTemplateSummaries();
    res.json({ ok: true, items: templates });
  } catch (error: any) {
    console.error("[GET /pdf-templates] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch templates",
      detail: error?.message,
    });
  }
});

/**
 * GET /pdf-templates/:id
 * Get single template with full annotations
 */
router.get("/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.pdfLayoutTemplate.findUnique({
      where: { id },
      select: detailSelect,
    });

    if (!template) {
      return res.status(404).json({
        ok: false,
        error: "Template not found",
      });
    }

    res.json({ ok: true, item: serializeTemplate(template, true) });
  } catch (error: any) {
    console.error("[GET /pdf-templates/:id] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch template",
      detail: error?.message,
    });
  }
});

/**
 * POST /pdf-templates
 * Create new PDF layout template
 */
router.post("/", async (req: any, res: Response) => {
  try {
    const { name, description, supplierProfileId, pageCount, annotations, meta } = req.body ?? {};

    // Validation
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: 'name is required and must be a string' 
      });
    }

    if (!supplierProfileId || typeof supplierProfileId !== "string") {
      return res.status(400).json({
        ok: false,
        error: "supplierProfileId is required",
      });
    }

    if (!Array.isArray(annotations) || !annotations.length) {
      return res.status(400).json({
        ok: false,
        error: "annotations must be a non-empty array",
      });
    }

    const annotationWrites = prepareAnnotationWrites(annotations);
    if (!annotationWrites.length) {
      return res.status(422).json({
        ok: false,
        error: "No valid annotations recognised (check labels)",
        received: annotations.length,
      });
    }

    // Prepare data object - all fields are optional except core ones
    const createDataBase: Prisma.PdfLayoutTemplateCreateInput = {
      name: name.trim(),
      description: description?.trim() || null,
      supplierProfileId: supplierProfileId.trim(),
      pageCount: Number.isFinite(Number(pageCount)) ? Number(pageCount) : null,
      annotations: {
        createMany: {
          data: annotationWrites,
        },
      },
      ...(typeof meta === "object" && meta !== null && { meta }),
    };

    // If a template already exists for supplierProfileId, treat this POST as replace/update (upsert semantics).
    const existing = await prisma.pdfLayoutTemplate.findUnique({ where: { supplierProfileId: supplierProfileId.trim() } });
    if (existing) {
      // Transaction: delete old annotations, update template core fields, insert new annotations.
      const updated = await prisma.$transaction(async (tx) => {
        await tx.pdfLayoutTemplate.update({
          where: { id: existing.id },
          data: {
            name: createDataBase.name,
            description: createDataBase.description,
            pageCount: createDataBase.pageCount,
            meta: (createDataBase as any).meta ?? existing.meta ?? undefined,
          },
        });
        await tx.pdfLayoutAnnotation.deleteMany({ where: { templateId: existing.id } });
        await tx.pdfLayoutAnnotation.createMany({
          data: annotationWrites.map((ann) => ({ ...ann, templateId: existing.id })),
        });
        return tx.pdfLayoutTemplate.findUnique({ where: { id: existing.id }, select: detailSelect });
      });
      console.log("[POST /pdf-templates] Upsert: replaced existing template", { id: updated?.id, supplierProfileId });
      return res.status(200).json({ ok: true, item: serializeTemplate(updated, true), upsert: true });
    }

    // Attempt create; fallback retry without createdByUserId if column missing.
    let createData: Prisma.PdfLayoutTemplateCreateInput = { ...createDataBase };
    if (req.auth?.userId) {
      (createData as any).createdByUserId = req.auth.userId; // tentative; may fail in legacy schema
    }

    const recognisedLabels = new Set(annotationWrites.map(a => a.label));
    console.log("[POST /pdf-templates] Creating template with data:", {
      name: createData.name,
      supplierProfileId: createData.supplierProfileId,
      annotationCount: annotationWrites.length,
      recognisedLabelCount: recognisedLabels.size,
      recognisedLabels: Array.from(recognisedLabels),
      hasUserId: !!req.auth?.userId,
      hasMeta: !!createData.meta,
      pageCount: createData.pageCount,
    });

    let template: any;
    try {
      template = await prisma.pdfLayoutTemplate.create({ data: createData, select: detailSelect });
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (/createdbyuserid/.test(msg) && /unknown column|does not exist|no such column/.test(msg)) {
        console.warn("[POST /pdf-templates] Legacy schema detected (no createdByUserId). Retrying without field.");
        const retryData = { ...createData };
        delete (retryData as any).createdByUserId;
        template = await prisma.pdfLayoutTemplate.create({ data: retryData, select: detailSelect });
      } else if (/pagecount/.test(msg) && /unknown column|does not exist|no such column/.test(msg)) {
        console.warn("[POST /pdf-templates] Legacy schema detected (no pageCount). Retrying without field.");
        const retryData = { ...createData };
        delete (retryData as any).pageCount;
        template = await prisma.pdfLayoutTemplate.create({ data: retryData, select: detailSelect });
      } else if (/meta/.test(msg) && /unknown column|does not exist|no such column/.test(msg)) {
        console.warn("[POST /pdf-templates] Legacy schema detected (no meta). Retrying without field.");
        const retryData = { ...createData };
        delete (retryData as any).meta;
        template = await prisma.pdfLayoutTemplate.create({ data: retryData, select: detailSelect });
      } else {
        throw err;
      }
    }

    console.log("[POST /pdf-templates] Successfully created template:", {
      id: template.id,
      name: template.name,
      supplierProfileId: template.supplierProfileId,
    });

    res.status(201).json({ ok: true, item: serializeTemplate(template, true) });
  } catch (error: any) {
    console.error("[POST /pdf-templates] Error creating template:", {
      error: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
      receivedAnnotationCount: Array.isArray(req.body?.annotations) ? req.body.annotations.length : null,
      firstAnnotation: Array.isArray(req.body?.annotations) && req.body.annotations.length ? req.body.annotations[0] : null,
    });
    const isUnique = error?.code === "P2002";
    const msg = String(error?.message || '').toLowerCase();
    const missingTable = /relation .* does not exist|no such table|unknown table/.test(msg);
    res.status(isUnique ? 409 : 500).json({
      ok: false,
      error: isUnique
        ? "Template already exists (replaced on POST)"
        : missingTable
          ? "PDF template table missing - run migrations"
          : "Failed to create template",
      detail: error?.message,
      code: error?.code,
      hint: missingTable ? "Run: prisma migrate deploy (server)" : undefined,
    });
  }
});

/**
 * PATCH /pdf-templates/:id
 * Update existing template
 */
router.patch("/:id", async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, supplierProfileId, pageCount, annotations, meta } = req.body ?? {};

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
    if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : existing.name;
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;
    if (supplierProfileId !== undefined) {
      if (supplierProfileId && typeof supplierProfileId === "string") {
        updateData.supplierProfileId = supplierProfileId.trim();
      } else {
        return res.status(400).json({ ok: false, error: "supplierProfileId must be a string" });
      }
    }
    if (pageCount !== undefined) {
      updateData.pageCount = Number.isFinite(Number(pageCount)) ? Number(pageCount) : null;
    }
    if (meta !== undefined) {
      if (meta && typeof meta === "object") {
        updateData.meta = meta;
      } else if (meta === null) {
        updateData.meta = null;
      }
    }

  let annotationWrites: AnnotationWrite[] | undefined;
    if (annotations !== undefined) {
      if (!Array.isArray(annotations)) {
        return res.status(400).json({ ok: false, error: "annotations must be an array" });
      }
      if (!annotations.length) {
        return res.status(400).json({ ok: false, error: "annotations cannot be empty" });
      }
      annotationWrites = prepareAnnotationWrites(annotations);
      if (!annotationWrites.length) {
        return res.status(400).json({ ok: false, error: "annotations array did not contain valid entries" });
      }
    }

    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.pdfLayoutTemplate.update({ where: { id }, data: updateData });
      if (annotationWrites) {
        await tx.pdfLayoutAnnotation.deleteMany({ where: { templateId: id } });
        await tx.pdfLayoutAnnotation.createMany({
          data: annotationWrites.map((ann) => ({ ...ann, templateId: id })),
        });
      }
      return tx.pdfLayoutTemplate.findUnique({ where: { id }, select: detailSelect });
    });

    console.log("[PATCH /pdf-templates/:id] Updated template:", {
      id: template?.id,
      name: template?.name,
    });

    res.json({ ok: true, item: serializeTemplate(template, true) });
  } catch (error: any) {
    console.error("[PATCH /pdf-templates/:id] Error:", error);
    const isUnique = error?.code === "P2002";
    res.status(isUnique ? 409 : 500).json({
      ok: false,
      error: isUnique ? "Supplier profile already has a template" : "Failed to update template",
      detail: error?.message,
    });
  }
});

/**
 * DELETE /pdf-templates/:id
 * Delete template
 */
router.delete("/:id", async (req: any, res: Response) => {
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

    await prisma.pdfLayoutTemplate.delete({ where: { id } });

    console.log("[DELETE /pdf-templates/:id] Deleted template:", { id, name: existing.name });

    res.json({ ok: true, message: "Template deleted" });
  } catch (error: any) {
    console.error("[DELETE /pdf-templates/:id] Error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to delete template",
      detail: error?.message,
    });
  }
});

export default router;

async function fetchTemplateSummaries(): Promise<any[]> {
  const forceFallback = process.env.ALWAYS_USE_PDF_TEMPLATE_FALLBACK === '1';
  if (!forceFallback) {
    try {
      const templates = await prisma.pdfLayoutTemplate.findMany({
        orderBy: { createdAt: "desc" },
        select: listSelect,
      });
      return templates.map((tpl) => serializeTemplate(tpl));
    } catch (error: any) {
      // Broaden fallback condition: any "Unknown column" or missing relation errors.
      const msg = String(error?.message || '').toLowerCase();
      const canFallback =
        forceFallback ||
        shouldFallbackPdfTemplateQuery(error) ||
        /unknown column|does not exist|no such column|relation .* does not exist/.test(msg);
      if (!canFallback) {
        throw error; // propagate genuine errors
      }
      console.warn("[GET /pdf-templates] Primary query failed, attempting raw fallback:", error?.message);
    }
  }

  // Raw fallback query (works with very old schema variants)
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    name: string;
    description: string | null;
    supplierProfileId: string | null;
    pageCount: number | null;
    createdAt: Date;
    updatedAt: Date;
    annotationCount: number;
  }>>(`
    SELECT tpl."id",
           tpl."name",
           tpl."description",
           tpl."supplierProfileId",
           tpl."pageCount",
           tpl."createdAt",
           tpl."updatedAt",
           COUNT(ann."id")::int AS "annotationCount"
    FROM "PdfLayoutTemplate" tpl
    LEFT JOIN "PdfLayoutAnnotation" ann ON ann."templateId" = tpl."id"
    GROUP BY tpl."id",
             tpl."name",
             tpl."description",
             tpl."supplierProfileId",
             tpl."pageCount",
             tpl."createdAt",
             tpl."updatedAt"
    ORDER BY tpl."createdAt" DESC
  `);

  return rows.map((row) =>
    serializeTemplate({
      id: row.id,
      name: row.name,
      description: row.description,
      supplierProfileId: row.supplierProfileId,
      pageCount: row.pageCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      _count: { annotations: Number(row.annotationCount) || 0 },
      createdByUser: null,
    }),
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function prepareAnnotationWrites(entries: IncomingAnnotation[]): AnnotationWrite[] {
  const writes: AnnotationWrite[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const label = normalizeAnnotationLabel(entry.label);
    if (!label) continue;
    const page = Number(entry.page ?? 1);
    const x = clamp01(Number(entry.x));
    const y = clamp01(Number(entry.y));
    const width = clamp01(Number(entry.width));
    const height = clamp01(Number(entry.height));
    if (!Number.isFinite(page)) continue;

    const write: AnnotationWrite = {
      page: page || 1,
      x,
      y,
      width,
      height,
      label,
    };

    if (entry.rowId && typeof entry.rowId === "string") {
      const trimmed = entry.rowId.trim().slice(0, 64);
      write.rowId = trimmed || null;
    } else {
      write.rowId = null;
    }

    writes.push(write);
  }
  return writes;
}

function normalizeAnnotationLabel(label: unknown): PdfAnnotationLabel | null {
  if (typeof label !== "string") return null;
  const key = label.trim().toLowerCase().replace(/\s+/g, "_");
  return LABEL_INPUTS[key] ?? null;
}

function serializeTemplate(record: any, includeAnnotations = false) {
  if (!record) return record;
  const base = {
    id: record.id,
    name: record.name,
    description: record.description,
    supplierProfileId: record.supplierProfileId,
    pageCount: record.pageCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    annotationCount: record._count?.annotations ?? record.annotations?.length ?? 0,
    createdBy: record.createdByUser
      ? {
          id: record.createdByUser.id,
          name: record.createdByUser.name,
          email: record.createdByUser.email,
        }
      : undefined,
  } as Record<string, any>;

  if (includeAnnotations) {
    base.annotations = normaliseAnnotations(record.annotations ?? []);
    if (record.meta && typeof record.meta === "object") {
      base.meta = record.meta;
    }
  }

  return base;
}
