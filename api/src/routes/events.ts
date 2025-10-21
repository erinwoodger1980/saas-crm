// api/src/routes/events.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { ensureTaskFromRecipe, loadTaskPlaybook } from "../task-playbook";

const router = Router();

const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("LEAD_CREATED"),
    tenantId: z.string(),
    leadId: z.string(),
  }),
  z.object({
    type: z.literal("LEAD_STATUS_CHANGED"),
    tenantId: z.string(),
    leadId: z.string(),
    from: z.string().optional(),
    to: z.string(),
    actorId: z.string().optional(),
  }),
  z.object({
    type: z.literal("QUESTIONNAIRE_SUBMITTED"),
    tenantId: z.string(),
    leadId: z.string(),
    // anything else useful (answers, timestamp)
  }),
  z.object({
    type: z.literal("QUOTE_SENT"),
    tenantId: z.string(),
    quoteId: z.string(),
    leadId: z.string().optional(), // allow lookup
    actorId: z.string().optional(),
  }),
]);

router.post("/ingest", async (req, res) => {
  const e = EventSchema.parse(req.body);

  try {
    const playbook = await loadTaskPlaybook(e.tenantId);
    switch (e.type) {
      case "LEAD_CREATED": {
        const recipes = playbook.status.NEW_ENQUIRY || [];
        for (const recipe of recipes) {
          await ensureTaskFromRecipe({
            tenantId: e.tenantId,
            recipe,
            relatedId: e.leadId,
            relatedType: recipe.relatedType ?? "LEAD",
            uniqueKey: `${recipe.id}:${e.leadId}`,
          });
        }
        break;
      }

      case "QUESTIONNAIRE_SUBMITTED": {
        const recipe = playbook.manual["questionnaire_followup"];
        if (recipe) {
          await ensureTaskFromRecipe({
            tenantId: e.tenantId,
            recipe,
            relatedId: e.leadId,
            relatedType: recipe.relatedType ?? "LEAD",
            uniqueKey: `${recipe.id}:${e.leadId}`,
          });
        }
        break;
      }

      case "LEAD_STATUS_CHANGED": {
        const to = (e.to || "").toUpperCase();
        const map: Record<string, keyof typeof playbook.status> = {
          NEW: "NEW_ENQUIRY",
          NEW_ENQUIRY: "NEW_ENQUIRY",
          CONTACTED: "INFO_REQUESTED",
          INFO_REQUESTED: "INFO_REQUESTED",
          QUALIFIED: "READY_TO_QUOTE",
          READY_TO_QUOTE: "READY_TO_QUOTE",
          QUOTE_SENT: "QUOTE_SENT",
          REJECTED: "REJECTED",
          DISQUALIFIED: "DISQUALIFIED",
          WON: "WON",
          LOST: "LOST",
        };
        const target = map[to];
        if (target) {
          const recipes = playbook.status[target] || [];
          for (const recipe of recipes) {
            await ensureTaskFromRecipe({
              tenantId: e.tenantId,
              recipe,
              relatedId: e.leadId,
              relatedType: recipe.relatedType ?? "LEAD",
              uniqueKey: `${recipe.id}:${e.leadId}`,
            });
          }
        }
        break;
      }

      case "QUOTE_SENT": {
        // Ensure we have a leadId (if not, try to fetch from quote)
        let leadId = e.leadId;
        if (!leadId) {
          const q = await prisma.quote.findUnique({
            where: { id: e.quoteId },
            select: { leadId: true },
          });
          leadId = q?.leadId || undefined;
        }
        if (leadId) {
          const recipes = playbook.status.QUOTE_SENT || [];
          for (const recipe of recipes) {
            await ensureTaskFromRecipe({
              tenantId: e.tenantId,
              recipe,
              relatedId: leadId,
              relatedType: recipe.relatedType ?? "LEAD",
              uniqueKey: `${recipe.id}:${leadId}`,
            });
          }
        }
        break;
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[events] failed:", err);
    res.status(500).json({ error: err?.message || "events failed" });
  }
});

export default router;