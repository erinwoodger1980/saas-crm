// api/src/routes/questions.ts
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

// GET /questions - List all questions for tenant with optional filters
router.get("/", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const { attributeCode, isStandard, isActive } = req.query;

    const where: any = { tenantId };
    if (attributeCode) where.attributeCode = attributeCode;
    if (isStandard !== undefined) where.isActive = isStandard === "true";
    if (isActive !== undefined) where.isActive = isActive === "true";

    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    });

    res.json(questions);
  } catch (e: any) {
    console.error("[questions.list] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

// GET /questions/:id - Get a specific question
router.get("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
    });

    if (!question || question.tenantId !== tenantId) {
      return res.status(404).json({ error: "question_not_found" });
    }

    res.json(question);
  } catch (e: any) {
    console.error("[questions.get] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

// POST /questions - Create a new question
const createQuestionSchema = z.object({
  attributeCode: z.string().min(1),
  label: z.string().min(1),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  controlType: z.string().default("input"), // 'input', 'select', 'radio', 'checkbox', 'slider', 'date', 'textarea'
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  metadata: z.any().optional(),
});

router.post("/", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const body = createQuestionSchema.parse(req.body);

    const question = await prisma.question.create({
      data: {
        tenantId,
        attributeCode: body.attributeCode,
        label: body.label,
        helpText: body.helpText,
        placeholder: body.placeholder,
        controlType: body.controlType,
        displayOrder: body.displayOrder,
        isActive: body.isActive,
        metadata: body.metadata,
      },
    });

    res.json(question);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "duplicate_question", detail: e.message });
    }
    console.error("[questions.create] Error:", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// PATCH /questions/:id - Update a question
const updateQuestionSchema = z.object({
  label: z.string().min(1).optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  controlType: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  metadata: z.any().optional(),
});

router.patch("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const patch = updateQuestionSchema.parse(req.body);

    // Verify tenant ownership
    const exists = await prisma.question.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: "question_not_found" });

    const question = await prisma.question.update({
      where: { id },
      data: {
        label: patch.label,
        helpText: patch.helpText,
        placeholder: patch.placeholder,
        controlType: patch.controlType,
        displayOrder: patch.displayOrder,
        isActive: patch.isActive,
        metadata: patch.metadata,
      },
    });

    res.json(question);
  } catch (e: any) {
    console.error("[questions.update] Error:", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// DELETE /questions/:id - Delete a question
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;

    // Verify tenant ownership
    const exists = await prisma.question.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: "question_not_found" });

    await prisma.question.delete({
      where: { id },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[questions.delete] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

export default router;
