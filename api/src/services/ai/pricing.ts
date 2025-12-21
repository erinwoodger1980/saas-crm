export type AIModelPricing = {
  input_per_1m: number; // USD per 1M input tokens
  output_per_1m: number; // USD per 1M output tokens
};

// Default pricing table (USD per 1M tokens). Adjust as needed.
export const AI_PRICING: Record<string, AIModelPricing> = {
  'gpt-4o': { input_per_1m: 5, output_per_1m: 15 },
  'gpt-4o-mini': { input_per_1m: 0.15, output_per_1m: 0.60 },
  'gpt-4.1': { input_per_1m: 10, output_per_1m: 30 },
  'gpt-4.1-mini': { input_per_1m: 0.3, output_per_1m: 1.2 },
};

export const DEFAULT_MODEL_PRICING: AIModelPricing = { input_per_1m: 10, output_per_1m: 30 };

export function getModelPricing(model: string): AIModelPricing {
  return AI_PRICING[model] || DEFAULT_MODEL_PRICING;
}

export function estimateTokensFromText(text?: string): number {
  if (!text) return 0;
  return Math.max(0, Math.ceil(text.length / 4));
}

export function estimateTokensFromCounts(opts: { chars?: number; images?: number; pdfPages?: number }): number {
  const { chars = 0, images = 0, pdfPages = 0 } = opts;
  const textTokens = Math.ceil(chars / 4);
  // Heuristic: 500 tokens per image, 1000 tokens per PDF page if no text
  const imageTokens = images * 500;
  const pdfTokens = pdfPages * 1000;
  return Math.max(0, textTokens + imageTokens + pdfTokens);
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  const usd = (inputTokens * (pricing.input_per_1m / 1_000_000)) + (outputTokens * (pricing.output_per_1m / 1_000_000));
  return +usd.toFixed(6);
}

export function convertUsdToGbp(usd: number, rate?: number): number {
  const r = rate && rate > 0 ? rate : parseFloat(process.env.AI_USD_TO_GBP ?? '0.79');
  return +(usd * r).toFixed(6);
}
