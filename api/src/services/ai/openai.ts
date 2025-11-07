import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY env not configured");
  }
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export async function createChatCompletion(prompt: string, model?: string): Promise<string> {
  const client = getOpenAIClient();
  const effectiveModel = (model || process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  const response = await client.chat.completions.create({
    model: effectiveModel,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const first = response.choices?.[0]?.message?.content;
  if (!first || !first.trim()) {
    throw new Error("OpenAI returned empty response");
  }
  return first.trim();
}
