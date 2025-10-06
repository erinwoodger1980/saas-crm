import { Router } from "express";
import { prisma } from "../prisma";
import openai from "../ai";

const r = Router();

r.post("/chat", async (req, res) => {
  const auth = (req as any).auth as { tenantId?: string } | undefined;
  if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

  const { question } = (req.body ?? {}) as { question?: string };
  if (!question?.trim()) return res.json({ answer: "Please ask a question." });

  // Quick built-in: “sales this month?”
  if (/sales.*month/i.test(question)) {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM("valueGBP"),0)::numeric AS total
      FROM "Opportunity"
      WHERE "tenantId"='${auth.tenantId}'
        AND "wonAt" IS NOT NULL
        AND date_trunc('month',"wonAt") = date_trunc('month', now())
    `)) as Array<{ total: number }>;
    const total = rows?.[0]?.total ?? 0;
    return res.json({ answer: `Sales this month: £${total}` });
  }

  // Fallback to OpenAI
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are Joinery AI. Answer briefly in UK English." },
        { role: "user", content: question },
      ],
      temperature: 0.2,
    });
    const text =
      completion.choices[0]?.message?.content?.trim() || "Sorry — no answer.";
    return res.json({ answer: text });
  } catch (e: any) {
    console.error("[/ai/chat] openai error:", e?.message || e);
    return res.status(500).json({ error: "AI request failed" });
  }
});

export default r;