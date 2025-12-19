// api/src/routes/fields.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { STANDARD_FIELDS } from "../lib/standardQuestionnaireFields";
import { Prisma } from "@prisma/client";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Uppercase enum values must match schema QuestionnaireFieldType
const QuestionnaireFieldTypeEnum = z.enum([
  "TEXT",
  "NUMBER",
  "SELECT",
  "BOOLEAN",
  "TEXTAREA",
  "DATE",
]);

// Deprecated: `order` kept for backwards compatibility. Primary field is `sortOrder`.
const createFieldSchema = z.object({
  questionnaireId: z.string().min(1, "Questionnaire ID is required").optional(), // Optional - will auto-find/create
  label: z.string().min(1, "Label is required").max(255),
  type: QuestionnaireFieldTypeEnum,
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().default(false),
  // Accept either legacy `order` or new `sortOrder`; default to 0.
  order: z.number().int().default(0).optional(),
  sortOrder: z.number().int().default(0).optional(),
  costingInputKey: z.string().max(255).optional().nullable(),
  scope: z.string().optional(),
});

const updateFieldSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  type: QuestionnaireFieldTypeEnum.optional(),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().optional(),
  order: z.number().int().optional(), // legacy
  sortOrder: z.number().int().optional(), // new
  costingInputKey: z.string().max(255).optional().nullable(),
  scope: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * GET /fields
 * List all questionnaire fields for the tenant
 * Query params: ?questionnaireId=xxx (optional filter)
 */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const questionnaireId = req.query.questionnaireId as string | undefined;
    const scope = req.query.scope as string | undefined;

    // Auto-upsert standard fields (idempotent). Ensures they appear across UIs without running seed script.
    // Skip when explicit ?skipEnsureStandard=1 passed (escape hatch for bulk operations)
    const skipEnsure = String(req.query.skipEnsureStandard || "").toLowerCase() === "1";
    if (!skipEnsure) {
      // Find active questionnaire (create if missing)
      let questionnaire = await prisma.questionnaire.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (!questionnaire) {
        questionnaire = await prisma.questionnaire.create({
          data: {
            tenantId,
            name: "Default Questionnaire",
            description: "Auto-created for standard ML fields",
            isActive: true,
          },
        });
      }

      const existing = await prisma.questionnaireField.findMany({
        where: { tenantId, isStandard: true },
        select: { key: true },
      });
      const existingKeys = new Set(existing.map((f) => f.key));
      const toCreate = STANDARD_FIELDS.filter((f) => !existingKeys.has(f.key));
      if (toCreate.length) {
        for (const f of toCreate) {
          try {
            await prisma.questionnaireField.create({
              data: {
                tenantId,
                questionnaireId: questionnaire.id,
                key: f.key,
                label: f.label,
                type: f.type,
                options: f.options ? f.options : undefined,
                required: f.required,
                sortOrder: f.sortOrder,
                order: f.sortOrder,
                scope: f.scope,
                costingInputKey: f.costingInputKey || null,
                helpText: f.helpText || null,
                placeholder: f.placeholder || null,
                isStandard: true,
                isHidden: false,
                requiredForCosting: !!f.costingInputKey,
              },
            });
          } catch (e: any) {
            if (e?.code !== "P2002") {
              console.warn("[fields] create standard field failed", f.key, e?.message || e);
            }
          }
        }
      }

      // Hide & neutralize deprecated legacy standard fields (retain answers, remove from UI & costing)
      const DEPRECATED_KEYS = [
        "window_style",
        "num_windows",
        "num_doors",
        "premium_hardware",
        "custom_finish",
        "door_height_mm",
        "door_width_mm",
        "final_width_mm",
        "final_height_mm",
        "installation_date",
      ];
      if (DEPRECATED_KEYS.length) {
        await prisma.questionnaireField.updateMany({
          where: { tenantId, key: { in: DEPRECATED_KEYS } },
          data: { isHidden: true, costingInputKey: null },
        });
      }

      // Ensure new unified quantity field exists (was num_windows / num_doors previously)
      // If both old quantity fields existed without new one, create or unhide the new one
      const quantityField = await prisma.questionnaireField.findFirst({
        where: { tenantId, key: "quantity" },
      });
      if (!quantityField) {
        try {
          await prisma.questionnaireField.create({
            data: {
              tenantId,
              questionnaireId: questionnaire.id,
              key: "quantity",
              label: "Quantity",
              type: "NUMBER",
              required: false,
              sortOrder: 205,
              order: 205,
              costingInputKey: "quantity",
              isStandard: true,
              isHidden: false,
              requiredForCosting: true,
            },
          });
        } catch (e: any) {
          if (e?.code !== "P2002") {
            console.warn("[fields] create quantity field failed", e?.message || e);
          }
        }
      }
    }

    const fields = await prisma.questionnaireField.findMany({
      where: {
        tenantId,
        ...(questionnaireId && { questionnaireId }),
        ...(scope && { scope }),
      },
      // Prefer sortOrder; fall back to legacy order for older rows if any.
      orderBy: [
        { sortOrder: "asc" },
        { order: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        questionnaire: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return res.json(fields);
  } catch (error) {
    console.error("[GET /fields] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /fields
 * Create a new questionnaire field with auto-generated key
 */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;

    // Validate request body
  const validatedData = createFieldSchema.parse(req.body);

  // Resolve unifiedSort: prefer explicit sortOrder, else legacy order, else 0.
  const unifiedSort = (validatedData.sortOrder ?? validatedData.order ?? 0) as number;

    // Get or create questionnaire
    let questionnaire;
    if (validatedData.questionnaireId) {
      // Validate questionnaire belongs to tenant
      questionnaire = await prisma.questionnaire.findFirst({
        where: {
          id: validatedData.questionnaireId,
          tenantId,
        },
      });
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
    } else {
      // Auto-find or create default questionnaire for tenant
      questionnaire = await prisma.questionnaire.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (!questionnaire) {
        questionnaire = await prisma.questionnaire.create({
          data: {
            tenantId,
            name: "Default Questionnaire",
            description: "Auto-created for custom fields",
            isActive: true,
          },
        });
      }
    }

    // Validate SELECT type has options
    if (validatedData.type === "SELECT" && !validatedData.options?.length) {
      return res.status(400).json({ error: "SELECT type requires at least one option" });
    }

    // Auto-generate stable key from label
    const baseKey = slugify(validatedData.label);
    let key = baseKey;
    let suffix = 1;

    // Ensure key uniqueness within questionnaire
    while (
      await prisma.questionnaireField.findUnique({
        where: {
          questionnaireId_key: {
            questionnaireId: questionnaire.id,
            key,
          },
        },
      })
    ) {
      key = `${baseKey}_${suffix}`;
      suffix++;
    }

    // Create field
    const field = await prisma.questionnaireField.create({
      data: {
        tenantId,
        questionnaireId: questionnaire.id,
        key,
        label: validatedData.label,
        type: validatedData.type,
        options: validatedData.options ? validatedData.options : undefined,
        required: validatedData.required,
        order: unifiedSort, // keep legacy column synced
        sortOrder: unifiedSort,
        costingInputKey: validatedData.costingInputKey || null,
        scope: validatedData.scope || "public", // Default scope
      },
      include: {
        questionnaire: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json(field);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues,
      });
    }

    console.error("[POST /fields] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /fields/:id
 * Update a questionnaire field
 */
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const fieldId = req.params.id as string;

    // Validate request body
    const validatedData = updateFieldSchema.parse(req.body);

    const hasSortProvided = validatedData.sortOrder !== undefined;
    const hasOrderProvided = validatedData.order !== undefined;
    // Determine target unified sort if either field provided
    const unifiedSort = hasSortProvided
      ? validatedData.sortOrder
      : hasOrderProvided
        ? validatedData.order
        : undefined;

    // Check field exists and belongs to tenant
    const existingField = await prisma.questionnaireField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    if (!existingField) {
      return res.status(404).json({ error: "Field not found" });
    }

    // Validate SELECT type has options if type is being changed or options updated
  const finalType = validatedData.type ?? existingField.type;
    const finalOptions =
      validatedData.options !== undefined ? validatedData.options : existingField.options;

    if (finalType === "SELECT" && !finalOptions) {
      return res.status(400).json({ error: "SELECT type requires options" });
    }

    // Update field
    const field = await prisma.questionnaireField.update({
      where: { id: fieldId },
      data: {
        ...(validatedData.label && { label: validatedData.label }),
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.options !== undefined && { options: validatedData.options ?? undefined }),
        ...(validatedData.required !== undefined && { required: validatedData.required }),
        ...(unifiedSort !== undefined && { order: unifiedSort, sortOrder: unifiedSort }),
        ...(validatedData.costingInputKey !== undefined && {
          costingInputKey: validatedData.costingInputKey,
        }),
        ...(validatedData.scope && { scope: validatedData.scope }),
      },
      include: {
        questionnaire: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.json(field);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues,
      });
    }

    console.error("[PATCH /fields/:id] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /fields/:id
 * Delete a questionnaire field (with safeguard for existing answers)
 */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const fieldId = req.params.id as string;
    const hard = String(req.query.hard || "").toLowerCase() === "true";

    // Determine developer privilege
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    const isDeveloper = !!user?.isDeveloper;

    // Check field exists and belongs to tenant
    const existingField = await prisma.questionnaireField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    if (!existingField) {
      return res.status(404).json({ error: "Field not found" });
    }

    // Check if field has any answers
    const answerCount = await prisma.questionnaireAnswer.count({ where: { fieldId } });

    if (answerCount > 0 && !(hard && isDeveloper)) {
      return res.status(409).json({
        error: "Cannot delete field with existing answers",
        answerCount,
      });
    }

    // If hard delete requested by developer, remove answers first
    if (answerCount > 0 && hard && isDeveloper) {
      await prisma.questionnaireAnswer.deleteMany({ where: { fieldId } });
    }

    // Delete field
    await prisma.questionnaireField.delete({ where: { id: fieldId } });

    return res.json({ success: true });
  } catch (error) {
    console.error("[DELETE /fields/:id] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /fields/migrate-standard-fields
 * Migration endpoint to sync new standard fields and remove deprecated ones
 * Based on joineryai_questionnaire_fields.csv updates
 */
router.post("/migrate-standard-fields", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;

    // Fields to delete based on CSV
    const FIELDS_TO_DELETE = [
      "door_height_mm",
      "door_width_mm", 
      "final_width_mm",
      "final_height_mm",
      "installation_date"
    ];

    // Delete deprecated fields
    const deletedResult = await prisma.questionnaireField.deleteMany({
      where: {
        tenantId,
        key: { in: FIELDS_TO_DELETE }
      }
    });

    // Get existing standard fields
    const existing = await prisma.questionnaireField.findMany({
      where: { tenantId, isStandard: true },
      select: { key: true, id: true },
    });
    const existingKeys = new Set(existing.map((f) => f.key));

    // Get or create default questionnaire
    let questionnaire = await prisma.questionnaire.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!questionnaire) {
      questionnaire = await prisma.questionnaire.create({
        data: {
          tenantId,
          name: "Default Questionnaire",
          description: "Auto-created for standard ML fields",
          isActive: true,
        },
      });
    }

    // Create new standard fields that don't exist yet
    const toCreate = STANDARD_FIELDS.filter((f) => !existingKeys.has(f.key));
    let createdCount = 0;

    for (const f of toCreate) {
      try {
        await prisma.questionnaireField.create({
          data: {
            tenantId,
            questionnaireId: questionnaire.id,
            key: f.key,
            label: f.label,
            type: f.type,
            options: f.options ? f.options : undefined,
            required: f.required,
            sortOrder: f.sortOrder,
            order: f.sortOrder,
            scope: f.scope,
            costingInputKey: f.costingInputKey || null,
            helpText: f.helpText || null,
            placeholder: f.placeholder || null,
            isStandard: true,
            isHidden: false,
            requiredForCosting: !!f.costingInputKey,
          },
        });
        createdCount++;
      } catch (e: any) {
        if (e?.code !== "P2002") {
          console.warn("[fields/migrate] create standard field failed", f.key, e?.message || e);
        }
      }
    }

    // Update existing standard fields to ensure correct scope/properties
    // This ensures fields like material tracking dates are marked as standard for all tenants
    for (const standardField of STANDARD_FIELDS) {
      if (existingKeys.has(standardField.key)) {
        try {
          await prisma.questionnaireField.updateMany({
            where: {
              tenantId,
              key: standardField.key
            },
            data: {
              isStandard: true,
              isHidden: false,
              label: standardField.label,
              type: standardField.type,
              options: standardField.options ? standardField.options : undefined,
              sortOrder: standardField.sortOrder,
              scope: standardField.scope,
              costingInputKey: standardField.costingInputKey || null,
              helpText: standardField.helpText || null,
              placeholder: standardField.placeholder || null,
              requiredForCosting: !!standardField.costingInputKey,
            }
          });
        } catch (e: any) {
          console.warn("[fields/migrate] update standard field failed", standardField.key, e?.message || e);
        }
      }
    }

    return res.json({
      success: true,
      deleted: deletedResult.count,
      created: createdCount,
      updated: existingKeys.size,
      fieldsDeleted: FIELDS_TO_DELETE,
      message: `Migrated standard fields: deleted ${deletedResult.count}, created ${createdCount} new fields, updated ${existingKeys.size} existing fields`
    });
  } catch (error) {
    console.error("[POST /fields/migrate-standard-fields] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /seed-standard
 * Seed standard questionnaire fields for the current tenant
 * This is useful for existing tenants that were created before standard fields were added
 */
router.post("/seed-standard", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    
    // Import the seed function
    const { seedStandardFieldsForTenant } = await import("../lib/seedStandardFields");
    const result = await seedStandardFieldsForTenant(tenantId);
    
    return res.json({
      ok: true,
      ...result,
    });
  } catch (e: any) {
    console.error("[POST /fields/seed-standard] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

export default router;
