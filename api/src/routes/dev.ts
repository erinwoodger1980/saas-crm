import { Router } from "express";
import { prisma } from "../prisma";
import dayjs from "dayjs";

const r = Router();

r.post("/seed-data", async (req, res) => {
  const a = (req as any).auth; if (!a) return res.status(401).json({ error: "unauthorized" });

  // 3 leads
  const leads = await prisma.$transaction([
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Acme Windows", email: "acme@example.com", status: "QUALIFIED" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Wealden Joinery", email: "wealden@example.com", status: "QUALIFIED" } }),
    prisma.lead.create({ data: { tenantId: a.tenantId, createdById: a.userId, contactName: "Landmark Timber", email: "landmark@example.com", status: "CONTACTED" } }),
  ]);

  // 3 opportunities (2 won this month, 1 open)
  const now = dayjs();
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[0].id, title: "Sash Windows (10 units)", valueGBP: 18000, stage: "WON", wonAt: now.subtract(2, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[1].id, title: "Doors & Frames (6 units)", valueGBP: 12500, stage: "WON", wonAt: now.subtract(10, "day").toDate() }
  });
  await prisma.opportunity.create({
    data: { tenantId: a.tenantId, leadId: leads[2].id, title: "Shopfit Counter", valueGBP: 9500, stage: "NEGOTIATE" }
  });

  res.json({ ok: true, leads: leads.map(l=>l.id) });
});

export default r;
