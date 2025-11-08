import fetch from 'node-fetch';

export interface ChatMessage { role: 'system'|'user'|'assistant'; content: string }
export interface OpenAIUsage { prompt_tokens: number; completion_tokens: number; total_tokens: number }
export interface OpenAIResult { text: string; usage?: OpenAIUsage; model: string }

const IN_PRICE = 0.15 / 1_000_000; // $ per token (1M pricing scaled)
const OUT_PRICE = 0.60 / 1_000_000;

export async function send(model: string, messages: ChatMessage[], opts?: { temperature?: number; max_tokens?: number }): Promise<OpenAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');
  const body = {
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.max_tokens ?? 2048,
  };
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`openai http ${resp.status}: ${txt.slice(0,400)}`);
  }
  const json: any = await resp.json();
  const text = (json?.choices?.[0]?.message?.content || '').trim();
  const usage: OpenAIUsage | undefined = json?.usage ? {
    prompt_tokens: json.usage.prompt_tokens,
    completion_tokens: json.usage.completion_tokens,
    total_tokens: json.usage.total_tokens,
  } : undefined;
  return { text, usage, model: body.model };
}

export function computeCostUsd(u?: OpenAIUsage): number {
  if (!u) return 0;
  return +(u.prompt_tokens * IN_PRICE + u.completion_tokens * OUT_PRICE).toFixed(6);
}
