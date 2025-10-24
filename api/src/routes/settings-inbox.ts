// api/src/routes/settings-inbox.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { getAccessTokenForTenant } from "../services/gmail";

const router = Router();
const TENANT_INTERVALS: Record<string, NodeJS.Timeout> = {};

function getAuth(req: any) {
  return { tenantId: req.auth?.tenantId as string | undefined };
}

// Stub importer — replace with your real Gmail importer when ready
async function importInbox(_accessToken: string, _opts: { max: number }) {
  // TODO: implement import logic and create EmailIngest rows
  return { imported: 0 };
}

/**
 * GET  /settings/inbox
 * returns {enabled:boolean, lastRun:Date|null}
 */
router.get("/", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  res.json({
    enabled: !!s?.inboxWatchEnabled,
    lastRun: s?.inboxLastRun ?? null,
  });
});

/**
 * POST /settings/inbox/toggle
 * body:{enabled:boolean}
 */
router.post("/toggle", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const enabled = !!req.body?.enabled;

  // Persist preference to DB (these fields exist in your schema)
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { inboxWatchEnabled: enabled, inboxLastRun: null },
    create: {
      tenantId,
      slug: `${tenantId.slice(0, 8)}`, // placeholder if row doesn't exist yet
      brandName: "Your Brand",
      inboxWatchEnabled: enabled,
      inboxLastRun: null,
    },
  });

  // Clear existing interval if any
  if (TENANT_INTERVALS[tenantId]) {
    clearInterval(TENANT_INTERVALS[tenantId]);
    delete TENANT_INTERVALS[tenantId];
  }

  // Start/stop watcher
  if (enabled) {
    TENANT_INTERVALS[tenantId] = setInterval(async () => {
      try {
        const token = await getAccessTokenForTenant(tenantId);
        await importInbox(token, { max: 20 });
        await prisma.tenantSettings.update({
          where: { tenantId },
          data: { inboxLastRun: new Date() },
        });
      } catch (e) {
        console.error("[inbox-watch]", e);
      }
    }, 10 * 60 * 1000); // every 10 min
  }

  res.json({ ok: true, enabled });
});

/**
 * POST /settings/inbox/recall
 * body: { recallFirst?: boolean, neverMiss?: boolean }
 * Stores the flag in TenantSettings.inbox JSON.
 */
router.post("/recall", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const recallFirst = req.body && typeof req.body.recallFirst === "boolean" ? req.body.recallFirst : undefined;
  const neverMiss = req.body && typeof req.body.neverMiss === "boolean" ? req.body.neverMiss : undefined;
  if (recallFirst === undefined && neverMiss === undefined) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const existing = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { inbox: true, slug: true, brandName: true } });
  const inbox = { ...(existing?.inbox as any) };
  if (recallFirst !== undefined) inbox.recallFirst = recallFirst;
  if (neverMiss !== undefined) inbox.neverMiss = neverMiss;

  const updated = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { inbox },
    create: {
      tenantId,
      slug: existing?.slug || tenantId.slice(0, 8),
      brandName: existing?.brandName || "Your Brand",
      inbox,
    },
    select: { inbox: true },
  });

  res.json({ ok: true, inbox: updated.inbox });
});

export default router;
