import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/** Quick mount check (GET /leads) */
router.get("/", (_req, res) => res.json({ ok: true, where: "/leads root" }));

/** Pull tenant/user from JWT that server.ts decoded into req.auth */
function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

/* -------------------- FIELD DEFINITIONS -------------------- */
router.get("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const defs = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
  res.json(defs);
});

router.post("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const {
    id,
    key,
    label,
    type = "text",
    required = false,
    config,
    sortOrder = 0,
  } = req.body;
  if (!key || !label) {
    return res.status(400).json({ error: "key and label required" });
  }

  const data = { tenantId, key, label, type, required, config, sortOrder };

  const def = id
    ? await prisma.leadFieldDef.update({ where: { id }, data })
    : await prisma.leadFieldDef.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: data,
        create: data,
      });

  res.json(def);
});

/* -------------------- GROUPED (Kanban columns) -------------------- */
/* IMPORTANT: define BEFORE "/:id" so "grouped" isn't treated as an id */
router.get("/grouped", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const items = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: [{ capturedAt: "desc" }],
  });

  const grouped: Record<"NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED", any[]> = {
    NEW: [],
    CONTACTED: [],
    QUALIFIED: [],
    DISQUALIFIED: [],
  };
  for (const l of items) grouped[l.status as keyof typeof grouped]?.push(l);

  res.json(grouped);
});

/* ------------------------- LEADS CRUD ------------------------- */
router.post("/", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const {
    contactName,
    email,
    status = "NEW",
    custom = {},
    nextAction,
    nextActionAt,
  } = req.body;
  if (!contactName) return res.status(400).json({ error: "contactName required" });

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName,
      email,
      status,
      nextAction,
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
      custom,
    },
  });

  res.json(lead);
});

router.patch("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { id } = req.params;
  const { contactName, email, status, nextAction, nextActionAt, custom } = req.body;

  try {
    const updated = await prisma.lead.updateMany({
      where: { id, tenantId },
      data: {
        contactName,
        email,
        status,
        nextAction,
        nextActionAt:
          nextActionAt === undefined ? undefined : nextActionAt ? new Date(nextActionAt) : null,
        custom,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "not found" });
    }

    // return the latest row
    const fresh = await prisma.lead.findFirst({ where: { id, tenantId } });
    return res.json(fresh);
  } catch (err: any) {
    console.error("[leads PATCH] failed:", err);
    return res.status(500).json({ error: "update failed" });
  }
});

/* ------------------------ READ ONE (modal) ------------------------ */
/* Returns details for the modal: { lead, fields } */
router.get("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId },
  });
  if (!lead) return res.status(404).json({ error: "not found" });

  const fields = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  res.json({ lead, fields });
});

/* ------------------------ DEMO SEED (optional) ------------------------ */
/* Hit once to create a couple of field defs + a demo lead with custom data */
router.post("/seed-demo", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "company" } },
    update: {},
    create: { tenantId, key: "company", label: "Company", type: "text", required: false, sortOrder: 1 },
  });
  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "phone" } },
    update: {},
    create: { tenantId, key: "phone", label: "Phone", type: "text", required: false, sortOrder: 2 },
  });

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: "Taylor Example",
      email: "taylor@example.com",
      status: "NEW",
      nextAction: "Intro call",
      nextActionAt: new Date(),
      custom: { company: "Acme Co", phone: "+1 555 0100" },
    },
  });

  res.json({ ok: true, lead });
});

export default router;