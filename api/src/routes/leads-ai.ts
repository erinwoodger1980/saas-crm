import { Router } from "express";
import { prisma } from "../prisma";

/**
 * Minimal schema (no migration needed right now) — we will store
 * feedback in EmailIngest and/or a tiny table later if you like.
 *
 * For now:
 * - When you confirm a lead, we mark the related EmailIngest row processed + link leadId (if provided)
 * - When you reject, we mark processed + store a small JSON note so we can learn later
 *
 * Body shape:
 * {
 *   provider: "gmail" | "local" | "outlook",
 *   messageId?: string,        // email id that triggered it (optional but recommended)
 *   leadId?: string,           // lead you're confirming/rejecting (optional for reject)
 *   isLead: boolean,           // true = confirm, false = reject
 *   reason?: string,           // free-text reason (optional)
 *   snapshot?: any             // optional payload (subject, body, parsed fields, etc.)
 * }
 */

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

/** POST /leads/ai/feedback */
router.post("/feedback", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const { provider = "gmail", messageId, leadId, isLead, reason, snapshot } = req.body || {};
  if (typeof isLead !== "boolean") {
    return res.status(400).json({ error: "isLead boolean is required" });
  }

  try {
    // If we have an email messageId, record learning signal on EmailIngest
    if (messageId) {
      // upsert EmailIngest so we log the decision and avoid reprocessing
      await prisma.emailIngest.upsert({
        where: {
          tenantId_provider_messageId: { tenantId, provider, messageId },
        },
        update: {
          processedAt: new Date(),
          leadId: leadId ?? undefined,
          userLabelIsLead: isLead,
          userLabeledAt: new Date(),
        },
        create: {
          tenantId,
          provider,
          messageId,
          processedAt: new Date(),
          leadId: leadId ?? null,
          userLabelIsLead: isLead,
          userLabeledAt: new Date(),
        },
      });

      // Also persist/update a training example for this message
      try {
        // Prefer provided snapshot; else try to look up the EmailMessage row
        let subject: string | null = snapshot?.subject ?? null;
        let from: string | null = snapshot?.from ?? null;
        let body: string | null = snapshot?.body ?? null;
        let snippet: string | null = snapshot?.snippet ?? null;

        if (!subject || !body) {
          const em = await prisma.emailMessage.findFirst({
            where: { tenantId, provider, messageId },
            select: { subject: true, bodyText: true, fromEmail: true, snippet: true },
          });
          if (em) {
            subject = subject ?? (em.subject || null);
            body = body ?? (em.bodyText || null);
            from = from ?? (em.fromEmail || null);
            snippet = snippet ?? (em.snippet || null);
          }
        }

        await prisma.leadTrainingExample.upsert({
          where: { tenantId_provider_messageId: { tenantId, provider, messageId } as any },
          update: {
            label: isLead ? "accepted" : "rejected",
            extracted: {
              subject: subject || undefined,
              snippet: snippet || undefined,
              from: from || undefined,
              body: (body || "").slice(0, 4000),
              reason: reason || null,
              leadId: leadId ?? null,
            },
          },
          create: {
            tenantId,
            provider,
            messageId,
            label: isLead ? "accepted" : "rejected",
            extracted: {
              subject: subject || undefined,
              snippet: snippet || undefined,
              from: from || undefined,
              body: (body || "").slice(0, 4000),
              reason: reason || null,
              leadId: leadId ?? null,
            },
          },
        } as any);
      } catch (e) {
        console.error("[leads-ai] failed to upsert training example:", e);
      }
    }

    // Optionally tag the Lead with a small flag so UI can reflect it quickly
    if (leadId) {
      // Merge a training flag into lead.custom without clobbering other keys
      const existing = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
      if (existing) {
        const custom = Object.assign({}, (existing.custom as any) || {});
        custom.aiFeedback = {
          isLead,
          reason: reason || null,
          at: new Date().toISOString(),
        };
        await prisma.lead.update({
          where: { id: leadId },
          data: { custom },
        });
      }
    }

    // (Optional) persist a separate training row later. Keeping it light now.

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads-ai] feedback error:", e);
    return res.status(500).json({ error: e?.message || "feedback failed" });
  }
});

export default router;
