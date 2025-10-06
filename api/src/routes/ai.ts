// api/src/routes/ai.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { openai } from "../ai";

const r = Router();

r.post("/chat", async (req, res) => {
  const auth = req.auth;
  if (!auth) return res.status(401).json({ error: "unauthorized" });

  const { question } = req.body || {};
  if (!question) return res.json({ answer: "Please ask a question." });

  // Example fast path
  if (/sales.*month/i.test(question)) {
    const rows: Array<{ total: number | string | null }> = await prisma.$queryRawUnsafe(
      `SELECT SUM(COALESCE("valueGBP",0)) AS total
       FROM "Opportunity"
       WHERE "tenantId"='${auth.tenantId}' AND "wonAt" IS NOT NULL
       AND date_trunc('month',"wonAt") = date_trunc('month', now())`
    );
    const total = rows?.[0]?.total ?? 0;
    return res.json({ answer: `Sales this month: £${total}` });
  }

  // Fallback to OpenAI
  const messages = [
    { role: "system" as const, content: "You are Joinery AI. Answer briefly in UK English." },
    { role: "user" as const, content: String(question) }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages
  });

  const text = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn’t answer that.";
  res.json({ answer: text });
});

export default r;