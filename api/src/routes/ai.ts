// api/src/routes/ai.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { aiRespond } from "../ai";

const r = Router();

r.post("/chat", async (req, res) => {
  const auth = req.auth;
  if (!auth) return res.status(401).json({ error: "unauthorized" });

  const { question } = req.body || {};
  if (!question) return res.json({ answer: "Please ask a question." });

  // Example quick SQL answer: "sales this month?"
  if (/sales.*month/i.test(question)) {
    const rows: Array<{ total: number | null }> = await prisma.$queryRawUnsafe(
      `SELECT SUM(COALESCE("valueGBP",0)) AS total
       FROM "Opportunity"
       WHERE "tenantId"='${auth.tenantId}' AND "wonAt" IS NOT NULL
       AND date_trunc('month',"wonAt") = date_trunc('month', now())`
    );
    return res.json({ answer: `Sales this month: £${rows?.[0]?.total ?? 0}` });
  }

  // Fallback to AI
  const system = "You are Joinery AI. Answer briefly in UK English.";
  const user = `Question: ${question}`;
  const text = await aiRespond({ system, user });
  res.json({ answer: text });
});

export default r;