// api/src/routes/ai.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { openai } from "../ai";

const r = Router();

r.post("/chat", async (req, res) => {
  const auth = (req as any).auth;
  if (!auth) return res.status(401).json({ error: "unauthorized" });

  const { question } = req.body || {};
  if (!question) return res.json({ answer: "Please ask a question." });

  // Example: "sales this month?"
  if (/sales.*month/i.test(question)) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT SUM(COALESCE("valueGBP",0)) AS total
       FROM "Opportunity"
       WHERE "tenantId"='${auth.tenantId}' AND "wonAt" IS NOT NULL
       AND date_trunc('month',"wonAt") = date_trunc('month', now())`
    );
    return res.json({ answer: `Sales this month: £${rows?.[0]?.total || 0}` });
  }

  // Fallback to AI
  const system = "You are Joinery AI. Answer briefly in UK English.";
  const user = `Question: ${question}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  const text =
    resp.choices?.[0]?.message?.content?.trim() ||
    "Sorry — I couldn’t find an answer.";
  res.json({ answer: text });
});

export default r;