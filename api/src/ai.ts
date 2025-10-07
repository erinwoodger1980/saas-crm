// api/src/ai.ts
import OpenAI from 'openai';
import { env } from './env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || undefined, // allow empty in dev to avoid throw
});

export default openai;

export async function summarizeEmail(subject: string, body: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    // Safe fallback so dev doesn’t crash without a key
    return `Subject: ${subject || '(no subject)'} — summary unavailable (no OPENAI_API_KEY).`;
  }
  const prompt = `Summarise this email into 1–2 short sentences for a CRM card.\n\nSubject: ${subject}\n\nBody:\n${body}\n`;
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  return resp.choices[0]?.message?.content?.trim() ?? '';
}