// api/src/routes/questionnaire-fields.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { seedStandardFieldsForTenant } from "../lib/seedStandardFields";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * GET /questionnaire-fields
 * List all questionnaire fields for tenant (sorted by sortOrder)
 */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const includeInactive = req.query.includeInactive === "true";
    const includeStandard = req.query.includeStandard === "true";
    const scope = req.query.scope as string | undefined;

    let where: any = { tenantId };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (scope) {
      where.scope = scope;
    }
    // If includeStandard, fetch all standard fields for tenant (active or hidden)
    if (includeStandard) {
      // Get all standard fields for tenant, regardless of isActive/isHidden
      const standardWhere: any = { tenantId, isStandard: true };
      if (scope) {
        standardWhere.scope = scope;
      }
      const standardFields = await prisma.questionnaireField.findMany({
        where: standardWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      // Get all non-standard fields (respect isActive)
      const customFields = await prisma.questionnaireField.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      // Merge, dedupe by id
      const allFields = [...standardFields, ...customFields].filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
      return res.json(allFields);
    } else {
      const fields = await prisma.questionnaireField.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return res.json(fields);
    }
  } catch (e: any) {
    console.error("[GET /questionnaire-fields] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /questionnaire-fields
 * Create a new questionnaire field
 * Body: { key, label, type, required?, placeholder?, helpText?, config?, sortOrder?, costingInputKey? }
 */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const {
      key,
      label,
      type,
      required = false,
      placeholder,
      helpText,
      config,
      sortOrder = 0,
      costingInputKey,
      isActive = true,
      questionnaireId: incomingQuestionnaireId,
      productTypes,
    } = req.body;

    if (!key || !label || !type) {
      return res.status(400).json({ error: "key, label, and type are required" });
    }

    // Normalize & validate type against enum (accept lowercase input for convenience)
    const validTypes = ["TEXT", "NUMBER", "SELECT", "BOOLEAN", "TEXTAREA", "DATE"];
    const normalizedType = String(type).trim().toUpperCase();
    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({ error: `invalid type. Must be one of: ${validTypes.join(", ")}` });
    }

    // Resolve questionnaire (either provided or default). We ensure a questionnaire exists so all fields are scoped.
    let questionnaireId = incomingQuestionnaireId as string | undefined;
    if (questionnaireId) {
      const exists = await prisma.questionnaire.findFirst({ where: { id: questionnaireId, tenantId } });
      if (!exists) {
        return res.status(404).json({ error: "questionnaire_not_found" });
      }
    } else {
      const existingQuestionnaire = await prisma.questionnaire.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (existingQuestionnaire) {
        questionnaireId = existingQuestionnaire.id;
      } else {
        const created = await prisma.questionnaire.create({
          data: {
            tenantId,
            name: "Default Questionnaire",
            description: "Auto-created to scope questionnaire fields",
          },
        });
        questionnaireId = created.id;
      }
    }

    // Check for duplicate key (tenant scoped legacy uniqueness retained for backwards compatibility)
    const existing = await prisma.questionnaireField.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (existing) {
      return res.status(409).json({ error: "field with this key already exists" });
    }

    const { scope } = req.body;

    const field = await prisma.questionnaireField.create({
      data: {
        tenantId,
        questionnaireId: questionnaireId!,
        key,
        label,
        type: normalizedType as any, // Prisma enum
        required,
        placeholder,
        helpText,
        config: config || undefined,
        sortOrder: Number(sortOrder) || 0,
        costingInputKey: costingInputKey || null,
        scope: scope || "item",
        isActive,
        productTypes: Array.isArray(productTypes) ? productTypes : [],
      },
    });

    return res.json(field);
  } catch (e: any) {
    console.error("[POST /questionnaire-fields] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PUT /questionnaire-fields/:id
 * Update an existing questionnaire field
 */
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);

    const existing = await prisma.questionnaireField.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "field not found" });
    }

    const {
      label,
      type,
      required,
      placeholder,
      helpText,
      config,
      sortOrder,
      costingInputKey,
      isActive,
      scope,
      questionnaireId: newQuestionnaireId,
      productTypes,
    } = req.body;

    // Validate type if provided
    let normalizedType: string | undefined = undefined;
    if (type !== undefined) {
      const validTypes = ["TEXT", "NUMBER", "SELECT", "BOOLEAN", "TEXTAREA", "DATE"];
      normalizedType = String(type).trim().toUpperCase();
      if (!validTypes.includes(normalizedType)) {
        return res.status(400).json({ error: `invalid type. Must be one of: ${validTypes.join(", ")}` });
      }
    }

    // Optional questionnaire reassignment (rare). Validate ownership if provided.
    let questionnaireUpdate: { questionnaireId?: string } = {};
    if (newQuestionnaireId) {
      const q = await prisma.questionnaire.findFirst({ where: { id: newQuestionnaireId, tenantId } });
      if (!q) return res.status(404).json({ error: "questionnaire_not_found" });
      questionnaireUpdate.questionnaireId = q.id;
    }

    const updated = await prisma.questionnaireField.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(normalizedType !== undefined && { type: normalizedType as any }),
        ...(required !== undefined && { required }),
        ...(placeholder !== undefined && { placeholder }),
        ...(helpText !== undefined && { helpText }),
        ...(config !== undefined && { config }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        ...(costingInputKey !== undefined && { costingInputKey }),
        ...(scope !== undefined && { scope }),
        ...(isActive !== undefined && { isActive }),
        ...(productTypes !== undefined && { productTypes: Array.isArray(productTypes) ? productTypes : [] }),
        ...questionnaireUpdate,
      },
    });

    return res.json(updated);
  } catch (e: any) {
    console.error("[PUT /questionnaire-fields/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /questionnaire-fields/:id
 * Soft delete (set isActive = false) or hard delete a questionnaire field
 * Query param: ?hard=true for hard delete
 */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const hard = req.query.hard === "true";

    const existing = await prisma.questionnaireField.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ error: "field not found" });
    }

    if (hard) {
      // Hard delete - will cascade to answers via foreign key
      await prisma.questionnaireField.delete({ where: { id } });
      return res.json({ ok: true, deleted: true });
    } else {
      // Soft delete - preserve data but hide from active use
      const updated = await prisma.questionnaireField.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({ ok: true, field: updated });
    }
  } catch (e: any) {
    console.error("[DELETE /questionnaire-fields/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /questionnaire-fields/reorder
 * Batch update sortOrder for multiple fields
 * Body: { fields: [{ id, sortOrder }] }
 */
router.post("/reorder", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const { fields } = req.body;

    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: "fields array required" });
    }

    // Update each field's sortOrder in a transaction
    await prisma.$transaction(
      fields.map(({ id, sortOrder }) =>
        prisma.questionnaireField.updateMany({
          where: { id, tenantId },
          data: { sortOrder: Number(sortOrder) || 0 },
        })
      )
    );

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[POST /questionnaire-fields/reorder] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /questionnaire-fields/seed-standard
 * Seed standard questionnaire fields for the current tenant
 * This is useful for existing tenants that were created before standard fields were added
 */
router.post("/seed-standard", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    
    const result = await seedStandardFieldsForTenant(tenantId);
    
    return res.json({
      ok: true,
      ...result,
    });
  } catch (e: any) {
    console.error("[POST /questionnaire-fields/seed-standard] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

export default router;
