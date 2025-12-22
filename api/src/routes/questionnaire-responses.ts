// api/src/routes/questionnaire-responses.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { logOrderFlow } from "../lib/order-flow-log";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * GET /questionnaire-responses/quote/:quoteId
 * Get questionnaire response for a specific quote
 * Includes all answers with field definitions
 */
router.get("/quote/:quoteId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.quoteId);

    // Verify quote ownership
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    const response = await prisma.questionnaireResponse.findUnique({
      where: { quoteId },
      include: {
        answers: {
          include: {
            field: true,
          },
        },
      },
    });

    if (!response) {
      return res.json({ response: null, answers: [] });
    }

    return res.json({
      response: {
        id: response.id,
        quoteId: response.quoteId,
        completedAt: response.completedAt,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      },
      answers: response.answers.map((a: any) => ({
        id: a.id,
        fieldId: a.fieldId,
        field: a.field,
        value: a.value,
      })),
    });
  } catch (e: any) {
    console.error("[GET /questionnaire-responses/quote/:quoteId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /questionnaire-responses/quote/:quoteId
 * Save or update questionnaire answers for a quote
 * Body: { answers: [{ fieldId, value }], completed?: boolean }
 */
router.post("/quote/:quoteId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.quoteId);
  const { answers, completed = false, questionnaireId } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers array required" });
    }

    // Verify quote ownership
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    // Verify all fieldIds belong to tenant
    const fieldIds = answers.map((a) => a.fieldId).filter(Boolean);
    if (fieldIds.length > 0) {
      const fields = await prisma.questionnaireField.findMany({
        where: { id: { in: fieldIds }, tenantId },
      });
      if (fields.length !== fieldIds.length) {
        return res.status(400).json({ error: "invalid field ids" });
      }
    }

    // Find or create response
    let response = await prisma.questionnaireResponse.findUnique({
      where: { quoteId },
    });

    // Ensure we have a questionnaireId: prefer explicit, else active template
    let qId: string | null = questionnaireId || null;
    if (!qId) {
      const active = await prisma.questionnaire.findFirst({ where: { tenantId, isActive: true }, select: { id: true } });
      qId = active?.id || null;
    }
    if (!qId) {
      return res.status(400).json({ error: "no_active_questionnaire" });
    }

    if (!response) {
      response = await prisma.questionnaireResponse.create({
        data: {
          tenantId,
          quoteId,
          questionnaireId: qId,
          completedAt: completed ? new Date() : null,
        },
      });
    } else if (completed && !response.completedAt) {
      response = await prisma.questionnaireResponse.update({
        where: { id: response.id },
        data: { completedAt: new Date() },
      });
    }

    // Upsert answers (update existing or create new)
    const savedAnswers = [];
    for (const { fieldId, value } of answers) {
      if (!fieldId) continue;

      const answer = await prisma.questionnaireAnswer.upsert({
        where: {
          responseId_fieldId: {
            responseId: response.id,
            fieldId,
          },
        },
        create: {
          responseId: response.id,
          fieldId,
          value: value != null ? value : Prisma.JsonNull,
        },
        update: {
          value: value != null ? value : Prisma.JsonNull,
        },
      });
      savedAnswers.push(answer);
    }

    const payload = {
      tenantId,
      quoteId,
      responseId: response.id,
      leadId: quote.leadId,
      savedAnswers: savedAnswers.length,
    };

    logOrderFlow("questionnaire_saved", payload);
    if (completed) {
      logOrderFlow("questionnaire_completed", payload);
    }

    return res.json({
      ok: true,
      response: {
        id: response.id,
        quoteId: response.quoteId,
        completedAt: response.completedAt,
      },
      saved: savedAnswers.length,
    });
  } catch (e: any) {
    console.error("[POST /questionnaire-responses/quote/:quoteId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /questionnaire-responses/quote/:quoteId
 * Delete questionnaire response and all answers for a quote
 */
router.delete("/quote/:quoteId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.quoteId);

    // Verify quote ownership
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    const response = await prisma.questionnaireResponse.findUnique({
      where: { quoteId },
    });

    if (!response) {
      return res.json({ ok: true, deleted: false });
    }

    // Delete cascade will handle answers
    await prisma.questionnaireResponse.delete({
      where: { id: response.id },
    });

    return res.json({ ok: true, deleted: true });
  } catch (e: any) {
    console.error("[DELETE /questionnaire-responses/quote/:quoteId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
