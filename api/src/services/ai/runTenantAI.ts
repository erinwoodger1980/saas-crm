import OpenAI from 'openai';
import { prisma } from '../../db';
import { randomUUID } from 'crypto';
import { convertUsdToGbp, estimateCostUsd, estimateTokensFromCounts, estimateTokensFromText, getModelPricing } from './pricing';

export type AIInputType = 'text' | 'image' | 'pdf' | 'audio' | 'other';

export interface TenantAIInput {
  type: AIInputType;
  text?: string;
  imagesCount?: number;
  pdfPageCount?: number;
  inputChars?: number;
}

export interface RunTenantAIParams<T> {
  tenantId: string;
  featureKey: string;
  model: string;
  input: TenantAIInput;
  meta?: {
    requestId?: string;
    inputChars?: number;
    outputText?: string;
    outputChars?: number;
    exchangeRateOverride?: number;
  };
  execute: (client: OpenAI) => Promise<T>;
}

export interface TenantAIUsageResult<T> {
  result: T;
  usage: {
    requestId: string;
    tenantId: string;
    featureKey: string;
    model: string;
    inputType: AIInputType;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    estimatedCostGbp: number;
  };
}

function getTokenCountsFromResponse(response: any, fallbackInputTokens: number, fallbackOutputTokens: number): { inputTokens: number; outputTokens: number } {
  const usage = response?.usage;
  const inputTokens = usage?.prompt_tokens ?? fallbackInputTokens;
  const outputTokens = usage?.completion_tokens ?? fallbackOutputTokens;
  return { inputTokens, outputTokens };
}

function deriveRequestId(meta?: { requestId?: string }): string {
  return meta?.requestId || randomUUID();
}

function currentMonth(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

async function persistUsage(opts: {
  tenantId: string;
  featureKey: string;
  model: string;
  inputType: AIInputType;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  estimatedCostGbp: number;
  requestId: string;
  metadata?: Record<string, any>;
}) {
  const month = currentMonth();
  await prisma.$transaction([
    prisma.tenantAIUsageEvent.create({
      data: {
        tenantId: opts.tenantId,
        featureKey: opts.featureKey,
        model: opts.model,
        inputType: opts.inputType,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        estimatedCostUsd: opts.estimatedCostUsd,
        estimatedCostGbp: opts.estimatedCostGbp,
        currencyRate: opts.estimatedCostUsd === 0 ? 0 : +(opts.estimatedCostGbp / opts.estimatedCostUsd).toFixed(6),
        requestId: opts.requestId,
        metadata: opts.metadata ?? undefined,
      }
    }),
    prisma.tenantAIUsageMonthly.upsert({
      where: { tenantId_month: { tenantId: opts.tenantId, month } },
      create: {
        tenantId: opts.tenantId,
        month,
        totalCostUsd: opts.estimatedCostUsd,
        totalCostGbp: opts.estimatedCostGbp,
        totalInputTokens: opts.inputTokens,
        totalOutputTokens: opts.outputTokens,
      },
      update: {
        totalCostUsd: { increment: opts.estimatedCostUsd },
        totalCostGbp: { increment: opts.estimatedCostGbp },
        totalInputTokens: { increment: opts.inputTokens },
        totalOutputTokens: { increment: opts.outputTokens },
      }
    })
  ]);
}

function logDev(opts: {
  tenantId: string;
  featureKey: string;
  model: string;
  estimatedCostUsd: number;
  estimatedCostGbp: number;
  inputTokens: number;
  outputTokens: number;
  requestId: string;
}) {
  const serverDebug = process.env.DEBUG_AI_COSTS === 'true';
  if (!serverDebug) return;
  // Single-line log for easy grep
  console.log(
    `[AI_COST] tenant=${opts.tenantId} feature=${opts.featureKey} model=${opts.model} est=$${opts.estimatedCostUsd.toFixed(6)} (£${opts.estimatedCostGbp.toFixed(6)}) inputTokens=${opts.inputTokens} outputTokens=${opts.outputTokens} requestId=${opts.requestId}`
  );
}

export async function runTenantAI<T>(params: RunTenantAIParams<T>): Promise<TenantAIUsageResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const requestId = deriveRequestId(params.meta);
  const client = new OpenAI({ apiKey });

  const inputChars = params.meta?.inputChars ?? params.input.text?.length ?? 0;
  const fallbackInputTokens = estimateTokensFromCounts({
    chars: inputChars,
    images: params.input.imagesCount,
    pdfPages: params.input.pdfPageCount,
  });

  // Execute AI call
  const response: any = await params.execute(client);

  // Derive output text length if we can
  const outputText = params.meta?.outputText ?? response?.choices?.[0]?.message?.content ?? '';
  const outputChars = params.meta?.outputChars ?? (typeof outputText === 'string' ? outputText.length : 0);
  const fallbackOutputTokens = estimateTokensFromText(outputText || '');

  const { inputTokens, outputTokens } = getTokenCountsFromResponse(response, fallbackInputTokens, fallbackOutputTokens);

  const costUsd = estimateCostUsd(params.model, inputTokens, outputTokens);
  const costGbp = convertUsdToGbp(costUsd, params.meta?.exchangeRateOverride);

  await persistUsage({
    tenantId: params.tenantId,
    featureKey: params.featureKey,
    model: params.model,
    inputType: params.input.type,
    inputTokens,
    outputTokens,
    estimatedCostUsd: costUsd,
    estimatedCostGbp: costGbp,
    requestId,
    metadata: {
      imagesCount: params.input.imagesCount,
      pdfPageCount: params.input.pdfPageCount,
    },
  });

  logDev({
    tenantId: params.tenantId,
    featureKey: params.featureKey,
    model: params.model,
    estimatedCostUsd: costUsd,
    estimatedCostGbp: costGbp,
    inputTokens,
    outputTokens,
    requestId,
  });

  return {
    result: response,
    usage: {
      requestId,
      tenantId: params.tenantId,
      featureKey: params.featureKey,
      model: params.model,
      inputType: params.input.type,
      inputTokens,
      outputTokens,
      estimatedCostUsd: costUsd,
      estimatedCostGbp: costGbp,
    },
  };
}

export async function getTenantMonthToDateSpend(tenantId: string): Promise<{ month: string; totalCostUsd: number; totalCostGbp: number; totalInputTokens: number; totalOutputTokens: number }> {
  const month = currentMonth();
  const row = await prisma.tenantAIUsageMonthly.findUnique({ where: { tenantId_month: { tenantId, month } } });
  return {
    month,
    totalCostUsd: row?.totalCostUsd ?? 0,
    totalCostGbp: row?.totalCostGbp ?? 0,
    totalInputTokens: row?.totalInputTokens ?? 0,
    totalOutputTokens: row?.totalOutputTokens ?? 0,
  };
}
