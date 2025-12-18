import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

function resolveTenantId(req: any): string {
  return (
    req.auth?.tenantId ||
    req.user?.tenantId ||
    (req.headers["x-tenant-id"] as string) ||
    (req as any).tenantId ||
    ""
  );
}

// GET /standard-field-mappings - List all mappings for tenant with optional filters
router.get("/", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const { productTypeId, standardField, isActive } = req.query;

    const where: any = { tenantId };
    if (productTypeId) where.productTypeId = productTypeId;
    if (standardField) where.standardField = standardField;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const mappings = await prisma.standardFieldMapping.findMany({
      where,
      include: {
        productType: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ productTypeId: "asc" }, { standardField: "asc" }],
    });

    res.json(mappings);
  } catch (e: any) {
    console.error("[standard-field-mappings.list] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

// GET /standard-field-mappings/:id - Get a specific mapping
router.get("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const mapping = await prisma.standardFieldMapping.findUnique({
      where: { id: req.params.id },
      include: {
        productType: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!mapping || mapping.tenantId !== tenantId) {
      return res.status(404).json({ error: "mapping_not_found" });
    }

    res.json(mapping);
  } catch (e: any) {
    console.error("[standard-field-mappings.get] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

// POST /standard-field-mappings - Create a new mapping
const createMappingSchema = z.object({
  productTypeId: z.string().min(1),
  standardField: z.string().min(1),
  questionCode: z.string().optional(),
  attributeCode: z.string().optional(),
  transformExpression: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.any().optional(),
});

router.post("/", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const body = createMappingSchema.parse(req.body);

    const mapping = await prisma.standardFieldMapping.create({
      data: {
        tenantId,
        productTypeId: body.productTypeId,
        standardField: body.standardField,
        questionCode: body.questionCode,
        attributeCode: body.attributeCode,
        transformExpression: body.transformExpression,
        isActive: body.isActive,
        metadata: body.metadata,
      },
      include: {
        productType: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    res.json(mapping);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "duplicate_mapping", detail: e.message });
    }
    console.error("[standard-field-mappings.create] Error:", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// PATCH /standard-field-mappings/:id - Update a mapping
const updateMappingSchema = z.object({
  questionCode: z.string().optional(),
  attributeCode: z.string().optional(),
  transformExpression: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.any().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const patch = updateMappingSchema.parse(req.body);

    // Verify tenant ownership
    const exists = await prisma.standardFieldMapping.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: "mapping_not_found" });

    const mapping = await prisma.standardFieldMapping.update({
      where: { id },
      data: {
        questionCode: patch.questionCode,
        attributeCode: patch.attributeCode,
        transformExpression: patch.transformExpression,
        isActive: patch.isActive,
        metadata: patch.metadata,
      },
      include: {
        productType: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    res.json(mapping);
  } catch (e: any) {
    console.error("[standard-field-mappings.update] Error:", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// DELETE /standard-field-mappings/:id - Delete a mapping
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;

    // Verify tenant ownership
    const exists = await prisma.standardFieldMapping.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: "mapping_not_found" });

    await prisma.standardFieldMapping.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[standard-field-mappings.delete] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

export default router;
