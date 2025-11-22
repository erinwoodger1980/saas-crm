import { computeCostUsd, OpenAIResult } from '../ai/openai';

interface VisionTelemetry {
  ts: number;
  route: string;
  model?: string;
  ms: number;
  cached: boolean;
  costUsd?: number;
  usage?: { prompt: number; completion: number; total: number };
  error?: string;
  source?: 'ai' | 'heuristic' | 'depth';
}

const buffer: VisionTelemetry[] = [];
const MAX = 500;

export function recordVisionTelemetry(t: VisionTelemetry) {
  buffer.push(t);
  if (buffer.length > MAX) buffer.shift();
  // Lightweight console log for now
  if (process.env.VISION_TELEMETRY_LOG === '1') {
    console.log('[vision telemetry]', JSON.stringify(t));
  }
}

export function getVisionTelemetry(): VisionTelemetry[] { return buffer.slice(); }

export function buildAiTelemetry(startMs: number, cached: boolean, result?: OpenAIResult, error?: any) {
  const ms = Date.now() - startMs;
  recordVisionTelemetry({
    ts: Date.now(),
    route: 'analyze-photo',
    model: result?.model,
    ms,
    cached,
    costUsd: computeCostUsd(result?.usage),
    usage: result?.usage ? { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens, total: result.usage.total_tokens } : undefined,
    error: error ? (error.message || String(error)).slice(0,200) : undefined,
    source: 'ai',
  });
}
