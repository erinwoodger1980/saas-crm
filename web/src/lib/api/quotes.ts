import { apiFetch } from "@/lib/api";

export type SupplierFileDto = {
  id: string;
  name?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
};

export type ParsedLineDto = {
  id: string;
  description?: string | null;
  qty?: number | null;
  unitPrice?: number | null;
  sellUnit?: number | null;
  sellTotal?: number | null;
  currency?: string | null;
  meta?: Record<string, any> | null;
};

export type QuoteDto = {
  id: string;
  title?: string | null;
  status?: string | null;
  tenant?: { name?: string | null } | null;
  tenantId?: string | null;
  leadId?: string | null;
  totalGBP?: number | null;
  currency?: string | null;
  meta?: Record<string, any> | null;
  lines?: ParsedLineDto[];
  questionnaireAnswers?: Record<string, any> | null;
  supplierFiles?: SupplierFileDto[];
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type ParseResponse = {
  ok?: boolean;
  async?: boolean;
  created?: number;
  warnings?: string[];
  message?: string;
  fallbackUsed?: number;
  summaries?: Array<Record<string, any>>;
  usedStages?: string[];
  confidence?: number | null;
};

export type EstimateResponse = {
  estimatedTotal?: number | null;
  predictedTotal?: number | null;
  totalGBP?: number | null;
  confidence?: number | null;
  currency?: string | null;
  modelVersionId?: string | null;
  meta?: { cacheHit?: boolean; latencyMs?: number | null } | null;
};

export type QuestionnaireField = {
  key: string;
  label: string;
  group?: string | null;
  description?: string | null;
};

export async function fetchQuote(quoteId: string): Promise<QuoteDto> {
  if (!quoteId) throw new Error("quoteId required");
  const quote = await apiFetch<QuoteDto>(`/quotes/${encodeURIComponent(quoteId)}`);
  return quote;
}

export async function fetchParsedLines(quoteId: string): Promise<ParsedLineDto[]> {
  if (!quoteId) throw new Error("quoteId required");
  try {
    const lines = await apiFetch<ParsedLineDto[]>(`/quotes/${encodeURIComponent(quoteId)}/lines`);
    if (Array.isArray(lines)) return lines;
    return [];
  } catch (err: any) {
    if (err?.status === 404) {
      const quote = await fetchQuote(quoteId);
      return Array.isArray(quote?.lines) ? quote.lines ?? [] : [];
    }
    throw err;
  }
}

export async function uploadSupplierPdf(quoteId: string, file: File | Blob): Promise<void> {
  if (!quoteId) throw new Error("quoteId required");
  const fd = new FormData();
  fd.append("files", file);
  await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/files`, {
    method: "POST",
    body: fd as any,
  } as any);
}

export async function parseSupplierPdfs(quoteId: string): Promise<ParseResponse> {
  if (!quoteId) throw new Error("quoteId required");
  const res = await apiFetch<ParseResponse>(`/quotes/${encodeURIComponent(quoteId)}/parse`, {
    method: "POST",
  });
  return res;
}

export async function generateMlEstimate(
  quoteId: string,
  options: { source?: "questionnaire" | "supplier_pdf" } = {},
): Promise<EstimateResponse> {
  if (!quoteId) throw new Error("quoteId required");
  const payload: Record<string, any> = { method: "ml" };
  if (options.source) payload.source = options.source;
  const res = await apiFetch<EstimateResponse & { cacheHit?: boolean; latencyMs?: number }>(
    `/quotes/${encodeURIComponent(quoteId)}/price`,
    {
      method: "POST",
      json: payload,
    },
  );
  const meta: EstimateResponse["meta"] = {};
  if (typeof (res as any)?.cacheHit === "boolean") {
    meta.cacheHit = Boolean((res as any).cacheHit);
  }
  if (typeof (res as any)?.latencyMs === "number") {
    meta.latencyMs = Number((res as any).latencyMs);
  }
  return {
    estimatedTotal: res?.estimatedTotal ?? res?.predictedTotal ?? res?.totalGBP ?? null,
    predictedTotal: res?.predictedTotal ?? res?.estimatedTotal ?? null,
    totalGBP: res?.totalGBP ?? null,
    confidence: res?.confidence ?? null,
    currency: res?.currency ?? null,
    modelVersionId: res?.modelVersionId ?? null,
    meta,
  };
}

export async function saveQuoteMappings(
  quoteId: string,
  mappings: Array<{ lineId: string; questionKey: string | null }>,
): Promise<void> {
  if (!quoteId) throw new Error("quoteId required");
  await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/lines/map`, {
    method: "PATCH",
    json: { mappings },
  });
}

export async function updateQuoteLine(
  quoteId: string,
  lineId: string,
  payload: Partial<{ qty: number | null; unitPrice: number | null; meta: Record<string, any> }>,
): Promise<ParsedLineDto> {
  if (!quoteId) throw new Error("quoteId required");
  if (!lineId) throw new Error("lineId required");
  const updated = await apiFetch<ParsedLineDto>(
    `/quotes/${encodeURIComponent(quoteId)}/lines/${encodeURIComponent(lineId)}`,
    {
      method: "PATCH",
      json: payload,
    },
  );
  return updated;
}

export function normalizeQuestionnaireFields(raw: any): QuestionnaireField[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.questions)
      ? raw.questions
      : [];
  return list
    .map((item: any) => {
      const key = typeof item?.key === "string" && item.key.trim() ? item.key.trim() : null;
      if (!key) return null;
      const label =
        (typeof item?.label === "string" && item.label.trim()) ||
        (typeof item?.title === "string" && item.title.trim()) ||
        key;
      return {
        key,
        label,
        group:
          (typeof item?.group === "string" && item.group.trim()) ||
          (typeof item?.section === "string" && item.section.trim()) ||
          null,
        description:
          (typeof item?.description === "string" && item.description.trim()) ||
          (typeof item?.helpText === "string" && item.helpText.trim()) ||
          null,
      } as QuestionnaireField;
    })
    .filter(Boolean) as QuestionnaireField[];
}
