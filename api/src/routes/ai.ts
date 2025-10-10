// api/src/routes/ai.ts
import { Router } from "express";
import { prisma } from "../prisma";
import openai from "../ai";

const r = Router();

type SumRow = { total: number | null };

r.post("/chat", async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.json({ answer: "Please ask a question." });
    }

    // Example quick metric: "sales this month?"
    if (/sales.*month/i.test(question)) {
      const rows = await prisma.$queryRaw<SumRow[]>`
        SELECT SUM(COALESCE("valueGBP", 0)) AS total
        FROM "Opportunity"
        WHERE "tenantId" = ${auth.tenantId}
          AND "wonAt" IS NOT NULL
          AND date_trunc('month',"wonAt") = date_trunc('month', now())
      `;
      const total = rows?.[0]?.total ?? 0;
      return res.json({ answer: `Sales this month: £${total}` });
    }

    // Fallback to OpenAI
    const system = "You are Joinery AI. Answer briefly in UK English.";
    const user = `Question: ${question}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    });

    const text = resp.choices[0]?.message?.content?.trim() ?? "No response.";
    return res.json({ answer: text });
  } catch (err: any) {
    console.error("[/ai/chat] error:", err);
    return res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

export default r;