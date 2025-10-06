// api/src/ai.ts
import OpenAI from "openai";
import { env } from "./env";

/** Singleton OpenAI client (named export only to avoid default-export confusion) */
export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/** Tiny helper to get a short text reply */
export async function aiRespond(opts: {
  system?: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const { system, user, temperature = 0.2 } = opts;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature,
  });

  return resp.choices[0]?.message?.content?.trim() ?? "";
}

/** Optional helper used by Gmail/lead summary code */
export async function summarizeEmail(subject: string, body: string): Promise<string> {
  const prompt = `Summarise this email into 1–2 short sentences for a CRM card.\n\nSubject: ${subject}\n\nBody:\n${body}\n`;
  return aiRespond({ user: prompt, temperature: 0.2 });
}