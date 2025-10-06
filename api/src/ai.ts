// api/src/ai.ts
import OpenAI from "openai";
import { env } from "./env";

/** Singleton OpenAI client */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/** Helper used by Gmail/lead summary code */
export async function summarizeEmail(subject: string, body: string): Promise<string> {
  const prompt = `Summarise this email into 1–2 short sentences for a CRM card.

Subject: ${subject}

Body:
${body}
`;
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}