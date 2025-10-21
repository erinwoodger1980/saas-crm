// api/src/routes/events.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

/** Utility to dedupe “generated” tasks for a lead */
function isTaskTableMissing(err: any) {
  if (!err) return false;
  if (err.code === "P2021") return true;
  const msg = typeof err.message === "string" ? err.message : "";
  return msg.includes("Task") && msg.includes("does not exist");
}

async function ensureTaskOnce(opts: {
  tenantId: string;
  title: string;
  relatedType: "LEAD" | "QUOTE";
  relatedId: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueInDays?: number;
  metaKey?: string; // stable key for idempotency
}) {
  const { tenantId, title, relatedType, relatedId, priority = "MEDIUM", dueInDays = 0, metaKey } =
    opts;

  try {
    // If we pass a metaKey, use it to dedupe
    const existing = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType,
        relatedId,
        ...(metaKey ? { meta: { path: ["key"], equals: metaKey } as any } : {}),
        title,
      },
    });
    if (existing) return existing;

    const dueAt =
      dueInDays > 0 ? new Date(Date.now() + dueInDays * 24 * 3600 * 1000) : undefined;

    return await prisma.task.create({
      data: {
        tenantId,
        title,
        relatedType,
        relatedId,
        priority,
        dueAt,
        meta: metaKey ? ({ key: metaKey } as any) : ({} as any),
      },
    });
  } catch (err) {
    if (isTaskTableMissing(err)) {
      console.warn(`[events] Task table missing – skipping ensureTaskOnce for "${title}"`);
      return null;
    }
    throw err;
  }
}

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
    switch (e.type) {
      case "LEAD_CREATED": {
        // Create “Review enquiry”
        await ensureTaskOnce({
          tenantId: e.tenantId,
          title: "Review enquiry",
          relatedType: "LEAD",
          relatedId: e.leadId,
          priority: "MEDIUM",
          dueInDays: 0,
          metaKey: `lead:${e.leadId}:review-enquiry`,
        });
        break;
      }

      case "QUESTIONNAIRE_SUBMITTED": {
        await ensureTaskOnce({
          tenantId: e.tenantId,
          title: "Review questionnaire",
          relatedType: "LEAD",
          relatedId: e.leadId,
          priority: "MEDIUM",
          dueInDays: 0,
          metaKey: `lead:${e.leadId}:review-questionnaire`,
        });
        break;
      }

      case "LEAD_STATUS_CHANGED": {
        const to = (e.to || "").toUpperCase();
        if (to === "READY_TO_QUOTE" || to === "QUALIFIED") {
          await ensureTaskOnce({
            tenantId: e.tenantId,
            title: "Create quote",
            relatedType: "LEAD",
            relatedId: e.leadId,
            priority: "HIGH",
            dueInDays: 1,
            metaKey: `lead:${e.leadId}:create-quote`,
          });
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
          await ensureTaskOnce({
            tenantId: e.tenantId,
            title: "Follow up on quote",
            relatedType: "LEAD",
            relatedId: leadId,
            priority: "MEDIUM",
            dueInDays: 3,
            metaKey: `lead:${leadId}:followup-quote`,
          });
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