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
  lineStandard?: Record<string, any> | null;
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
  clientQuoteFiles?: SupplierFileDto[];
  notes?: string | null;
  proposalPdfUrl?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  quoteSourceType?: string | null;
  supplierProfileId?: string | null;
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
  startedAt?: string | null;
  finishedAt?: string | null;
  quality?: "ok" | "poor" | null;
  fallbackScored?: {
    kept?: number | null;
    discarded?: number | null;
  };
  template?: TemplateParseMetaDto | null;
};

export type TemplateParseMetaDto = {
  id?: string | null;
  name?: string | null;
  supplierProfileId?: string | null;
  matchedRows?: number | null;
  annotationCount?: number | null;
  matchedAnnotations?: number | null;
  method?: "template" | "template_failed" | string | null;
  reason?: string | null;
};

export type PdfTemplateSummary = {
  id: string;
  name: string;
  description?: string | null;
  supplierProfileId?: string | null;
  pageCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  annotationCount?: number | null;
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

export type QuestionnairePriceResponse = {
  ok: boolean;
  method: "questionnaire";
  total: number;
  breakdown?: Record<string, any>;
  confidence?: number;
};

// Minimal client-side shape for PricingConfig (mirrors backend)
export type PricingConfigInput = Partial<{
  defaultLabourCostPerDoor: number;
  defaultOverheadPercentOnCost: number;
  targetMarginPercentOnSell: number;
  defaultMaterialMarkupPercent: number;
}>;

export type ProcessQuoteResponse =
  | {
      ok: true;
      filename?: string | null;
      quotedAt?: string | null;
      quote_type: "supplier";
      supplier_parsed?: Record<string, any>;
      client_quote: {
        currency?: string | null;
        markup_percent?: number | null;
        vat_percent?: number | null;
        subtotal?: number | null;
        vat_amount?: number | null;
        grand_total?: number | null;
        lines: Array<{
          description: string;
          qty: number;
          unit_price: number;
          total: number;
          unit_price_marked_up: number;
          total_marked_up: number;
        }>;
      };
    }
  | {
      ok: true;
      filename?: string | null;
      quotedAt?: string | null;
      quote_type: "client";
      training_candidate: Record<string, any>;
    }
  | {
      ok: true;
      filename?: string | null;
      quotedAt?: string | null;
      quote_type: "unknown";
      raw_text_length?: number;
      message?: string;
    };

export type QuestionnaireField = {
  key: string;
  label: string;
  group?: string | null;
  description?: string | null;
  type?: "text" | "textarea" | "select" | "number" | "date" | "source" | "file";
  options?: string[];
  askInQuestionnaire?: boolean;
  internalOnly?: boolean;
  required?: boolean;
  sortOrder?: number;
};

export async function fetchQuote(quoteId: string): Promise<QuoteDto> {
  if (!quoteId) throw new Error("quoteId required");
  const quote = await apiFetch<QuoteDto>(`/quotes/${encodeURIComponent(quoteId)}`);
  return quote;
}

export async function fetchParsedLines(quoteId: string): Promise<{ lines: ParsedLineDto[]; imageUrlMap: Record<string, string> }> {
  if (!quoteId) throw new Error("quoteId required");
  try {
    const response = await apiFetch<{ lines: ParsedLineDto[]; imageUrlMap: Record<string, string> } | ParsedLineDto[]>(`/quotes/${encodeURIComponent(quoteId)}/lines`);
    
    // Handle new format with imageUrlMap
    if (response && typeof response === 'object' && 'lines' in response && 'imageUrlMap' in response) {
      return { lines: response.lines || [], imageUrlMap: response.imageUrlMap || {} };
    }
    
    // Handle old format (array of lines)
    if (Array.isArray(response)) {
      return { lines: response, imageUrlMap: {} };
    }
    
    return { lines: [], imageUrlMap: {} };
  } catch (err: any) {
    if (err?.status === 404) {
      const quote = await fetchQuote(quoteId);
      return { lines: Array.isArray(quote?.lines) ? quote.lines ?? [] : [], imageUrlMap: {} };
    }
    throw err;
  }
}

export async function uploadSupplierPdf(quoteId: string, file: File): Promise<void> {
  if (!quoteId || !file) throw new Error("quoteId and file required");
  const fd = new FormData();
  fd.append("files", file);
  await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/files`, {
    method: "POST",
    body: fd as any,
  } as any);
}

export async function uploadClientQuotePdf(quoteId: string, file: File): Promise<void> {
  if (!quoteId || !file) throw new Error("quoteId and file required");
  const fd = new FormData();
  fd.append("files", file);
  await apiFetch(`/quotes/${encodeURIComponent(quoteId)}/client-quote-files`, {
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

export async function fillLineStandardFromParsed(quoteId: string): Promise<{ ok: boolean; updated: number; inferredAny: number }> {
  if (!quoteId) throw new Error("quoteId required");
  const res = await apiFetch<{ ok: boolean; updated: number; inferredAny: number }>(
    `/quotes/${encodeURIComponent(quoteId)}/lines/fill-standard-from-parsed`,
    { method: "POST" },
  );
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

/**
 * Price a quote using questionnaire-based costing via POST /quotes/:id/price with method "questionnaire".
 * Returns totals and a breakdown suitable for UI display.
 */
export async function priceQuoteFromQuestionnaire(
  quoteId: string,
): Promise<QuestionnairePriceResponse> {
  if (!quoteId) throw new Error("quoteId required");
  const res = await apiFetch<QuestionnairePriceResponse>(
    `/quotes/${encodeURIComponent(quoteId)}/price`,
    {
      method: "POST",
      json: { method: "questionnaire" },
    },
  );
  return res;
}

/**
 * Price a single door context for a given quote via Door Pricing Engine.
 * Persists a quote line and returns breakdown and totals.
 */
export async function priceDoorForQuote(
  quoteId: string,
  context: Record<string, any>,
  config?: PricingConfigInput,
): Promise<{
  ok: boolean;
  quoteId: string;
  results: Array<{
    lineId: string;
    unitPrice: number;
    lineTotal: number;
    currency: string;
    breakdown: any;
    unpricedMaterials?: any[];
  }>;
  total: number;
}> {
  if (!quoteId) throw new Error("quoteId required");
  const body: any = {
    lines: [{ context }],
  };
  if (config && Object.keys(config).length) body.config = config;
  return apiFetch(`/quotes/${encodeURIComponent(quoteId)}/price-door`, {
    method: "POST",
    json: body,
  });
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
  payload: Partial<{ qty: number | null; unitPrice: number | null; meta: Record<string, any>; lineStandard: Record<string, any> }>,
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

/** Create a manual quote line */
export async function createQuoteLine(
  quoteId: string,
  payload: { description: string; quantity?: number; unitPrice?: number; notes?: string | null },
): Promise<{ ok: boolean; line: ParsedLineDto }>
{
  if (!quoteId) throw new Error("quoteId required");
  const body: any = {
    description: payload.description,
    quantity: typeof payload.quantity === 'number' ? payload.quantity : 1,
    unitPrice: typeof payload.unitPrice === 'number' ? payload.unitPrice : 0,
  };
  if (typeof payload.notes === 'string') body.notes = payload.notes;
  return apiFetch(`/quotes/${encodeURIComponent(quoteId)}/lines`, {
    method: 'POST',
    json: body,
  });
}

export async function processQuoteFromUrl(params: {
  url: string;
  filename?: string | null;
  quotedAt?: string | null;
  markupPercent?: number;
  vatPercent?: number;
  markupDelivery?: boolean;
  amalgamateDelivery?: boolean;
  clientDeliveryGBP?: number;
  clientDeliveryDescription?: string;
}): Promise<ProcessQuoteResponse> {
  if (!params?.url) throw new Error("url required");
  const body: Record<string, any> = {
    url: params.url,
  };
  if (params.filename) body.filename = params.filename;
  if (params.quotedAt) body.quotedAt = params.quotedAt;
  if (typeof params.markupPercent === "number") body.markupPercent = params.markupPercent;
  if (typeof params.vatPercent === "number") body.vatPercent = params.vatPercent;
  if (typeof params.markupDelivery === "boolean") body.markupDelivery = params.markupDelivery;
  if (typeof params.amalgamateDelivery === "boolean") body.amalgamateDelivery = params.amalgamateDelivery;
  if (typeof params.clientDeliveryGBP === "number") body.clientDeliveryGBP = params.clientDeliveryGBP;
  if (typeof params.clientDeliveryDescription === "string") body.clientDeliveryDescription = params.clientDeliveryDescription;
  return apiFetch<ProcessQuoteResponse>(`/ml/process-quote`, {
    method: "POST",
    json: body,
  });
}

export async function processQuoteFromFile(
  quoteId: string,
  file: SupplierFileDto,
  opts: { markupPercent?: number; vatPercent?: number; markupDelivery?: boolean; amalgamateDelivery?: boolean; clientDeliveryGBP?: number; clientDeliveryDescription?: string } = {},
): Promise<ProcessQuoteResponse> {
  if (!quoteId) throw new Error("quoteId required");
  if (!file?.id) throw new Error("file.id required");
  const signed = await apiFetch<{ url: string }>(
    `/quotes/${encodeURIComponent(quoteId)}/files/${encodeURIComponent(file.id)}/signed`,
  );
  if (!signed?.url) throw new Error("Unable to sign file URL");
  return processQuoteFromUrl({
    url: signed.url,
    filename: file.name || undefined,
    markupPercent: opts.markupPercent,
    vatPercent: opts.vatPercent,
    markupDelivery: opts.markupDelivery,
    amalgamateDelivery: opts.amalgamateDelivery,
    clientDeliveryGBP: opts.clientDeliveryGBP,
    clientDeliveryDescription: opts.clientDeliveryDescription,
  });
}

export async function saveClientQuoteLines(
  quoteId: string,
  clientQuote: NonNullable<Extract<ProcessQuoteResponse, { quote_type: "supplier" }>['client_quote']>,
  options: { replace?: boolean } = {},
): Promise<{ ok: boolean; created: number; totalGBP: number; currency: string }>
{
  if (!quoteId) throw new Error("quoteId required");
  if (!clientQuote || !Array.isArray(clientQuote.lines)) throw new Error("clientQuote with lines required");
  const body: any = { clientQuote };
  if (typeof options.replace === 'boolean') body.replace = options.replace;
  return apiFetch(`/quotes/${encodeURIComponent(quoteId)}/lines/save-processed`, {
    method: 'POST',
    json: body,
  });
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
      const typeRaw = typeof item?.type === "string" && item.type.trim() ? item.type.trim() : "text";
      const allowed = ["text", "textarea", "select", "number", "date", "source", "file"];
      const type = allowed.includes(typeRaw) ? typeRaw : "text";
      return {
        key,
        label,
        type: type as any,
        group:
          (typeof item?.group === "string" && item.group.trim()) ||
          (typeof item?.section === "string" && item.section.trim()) ||
          null,
        description:
          (typeof item?.description === "string" && item.description.trim()) ||
          (typeof item?.helpText === "string" && item.helpText.trim()) ||
          null,
        options: Array.isArray(item?.options) ? item.options.map((o: any) => String(o || "").trim()).filter(Boolean) : undefined,
        askInQuestionnaire: item?.askInQuestionnaire !== false,
        internalOnly: item?.internalOnly === true,
        required: item?.required === true,
      } as QuestionnaireField;
    })
    .filter(Boolean) as QuestionnaireField[];
}

export type QuoteSourceProfile = {
  id: string;
  name: string;
  type: 'supplier' | 'software';
  source?: 'static' | 'tenant' | 'global';
  tenantName?: string | null;
};

export async function fetchQuoteSourceProfiles(): Promise<QuoteSourceProfile[]> {
  return apiFetch<QuoteSourceProfile[]>('/quotes/source-profiles');
}

export async function fetchPdfTemplates(): Promise<PdfTemplateSummary[]> {
  const res = await apiFetch<{ items?: PdfTemplateSummary[] }>("/pdf-templates");
  return Array.isArray(res?.items) ? res.items : [];
}

export async function updateQuoteSource(
  quoteId: string, 
  sourceType: 'supplier' | 'software' | null,
  profileId: string | null
): Promise<QuoteDto> {
  if (!quoteId) throw new Error("quoteId required");
  return apiFetch<QuoteDto>(`/quotes/${encodeURIComponent(quoteId)}/source`, {
    method: 'PATCH',
    json: { sourceType, profileId }
  });
}
