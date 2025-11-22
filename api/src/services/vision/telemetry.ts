import { computeCostUsd, OpenAIResult } from '../ai/openai';
import { prisma } from '../../prisma';

export interface VisionTelemetry {
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

export async function recordVisionTelemetry(t: VisionTelemetry) {
  buffer.push(t);
  if (buffer.length > MAX) buffer.shift();
  // Lightweight console log for now
  if (process.env.VISION_TELEMETRY_LOG === '1') {
    console.log('[vision telemetry]', JSON.stringify(t));
  }
  if (process.env.VISION_TELEMETRY_PERSIST === '1') {
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS vision_telemetry (
          id SERIAL PRIMARY KEY,
          ts TIMESTAMPTZ NOT NULL,
          route TEXT NOT NULL,
          model TEXT,
          ms INT NOT NULL,
          cached BOOLEAN NOT NULL,
          costUsd DOUBLE PRECISION,
          prompt_tokens INT,
          completion_tokens INT,
          total_tokens INT,
          source TEXT,
          error TEXT
        );`
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO vision_telemetry (ts, route, model, ms, cached, costUsd, prompt_tokens, completion_tokens, total_tokens, source, error)
         VALUES (to_timestamp($1/1000.0), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        t.ts, t.route, t.model || null, t.ms, t.cached, t.costUsd || null, t.usage?.prompt || null, t.usage?.completion || null, t.usage?.total || null, t.source || null, t.error || null
      );
    } catch (e: any) {
      if (process.env.VISION_TELEMETRY_LOG === '1') console.warn('[vision telemetry persist failed]', e?.message);
    }
  }
}

export function getVisionTelemetry(): VisionTelemetry[] { return buffer.slice(); }

export async function buildAiTelemetry(startMs: number, cached: boolean, result?: OpenAIResult, error?: any) {
  const ms = Date.now() - startMs;
  await recordVisionTelemetry({
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

export async function getPersistedVisionTelemetry(limit = 100) {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT ts, route, model, ms, cached, costUsd, prompt_tokens, completion_tokens, total_tokens, source, error
       FROM vision_telemetry ORDER BY id DESC LIMIT $1`,
      limit
    );
    return rows.map(r => ({
      ts: new Date(r.ts).getTime(),
      route: r.route,
      model: r.model || undefined,
      ms: r.ms,
      cached: r.cached,
      costUsd: r.costusd || r.costUsd,
      usage: (r.prompt_tokens || r.completion_tokens || r.total_tokens) ? {
        prompt: r.prompt_tokens,
        completion: r.completion_tokens,
        total: r.total_tokens,
      } : undefined,
      source: r.source || undefined,
      error: r.error || undefined,
    })) as VisionTelemetry[];
  } catch (e) {
    return [];
  }
}
