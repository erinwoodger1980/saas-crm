import type { SupplierParseResult } from "../types/parse";

const ML_BASE = (process.env.ML_PARSER_URL || process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");

function getMlUpstreamAuthHeaders(): Record<string, string> {
  const raw =
    process.env.ML_AUTH_TOKEN ||
    process.env.ML_BEARER_TOKEN ||
    process.env.ML_API_KEY ||
    process.env.ML_KEY ||
    "";
  const token = String(raw || "").trim();
  if (!token) return {};

  const bearer = token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
  return {
    Authorization: bearer,
    // Some upstreams expect an API key header instead of (or in addition to) Bearer.
    "x-api-key": token,
  };
}

const DEFAULT_TIMEOUT = (() => {
  const raw = Number(process.env.ML_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return Math.min(Math.max(raw, 5000), 25000);
  return process.env.NODE_ENV === "production" ? 15000 : 20000;
})();

export type MlCallSuccess = {
  ok: true;
  status: number;
  data: any;
  tookMs: number;
};

export type MlCallFailure = {
  ok: false;
  status: number;
  error: string;
  detail?: any;
  tookMs: number;
};

export type MlCallResult = MlCallSuccess | MlCallFailure;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const cleanup = () => clearTimeout(timer);
  return { controller, cleanup } as const;
}

async function parseJsonResponse(resp: Response) {
  const text = await resp.text();
  if (!text) return { data: null, raw: "" };
  try {
    return { data: JSON.parse(text), raw: text };
  } catch {
    return { data: { raw: text }, raw: text };
  }
}

async function callMlEndpoint(endpoint: string, init: RequestInit, timeoutMs?: number): Promise<MlCallResult> {
  const ms = Math.min(Math.max(timeoutMs ?? DEFAULT_TIMEOUT, 5000), 25000);
  const { controller, cleanup } = withTimeout(ms);
  const started = Date.now();
  try {
    const mergedHeaders = new Headers(init.headers);
    const authHeaders = getMlUpstreamAuthHeaders();
    if (authHeaders.Authorization && !mergedHeaders.has("Authorization")) {
      mergedHeaders.set("Authorization", authHeaders.Authorization);
    }
    if (authHeaders["x-api-key"] && !mergedHeaders.has("x-api-key") && !mergedHeaders.has("X-API-Key")) {
      mergedHeaders.set("x-api-key", authHeaders["x-api-key"]);
    }

    const resp = await fetch(`${ML_BASE}${endpoint}`, {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
    });
    const { data } = await parseJsonResponse(resp);
    const tookMs = Date.now() - started;
    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        error: typeof (data as any)?.error === "string" ? (data as any).error : "ml_error",
        detail: data,
        tookMs,
      };
    }
    return { ok: true, status: resp.status, data, tookMs };
  } catch (err: any) {
    const tookMs = Date.now() - started;
    const message = err?.name === "AbortError" ? `timeout_${ms}ms` : err?.message || String(err);
    return { ok: false, status: 0, error: message, tookMs };
  } finally {
    cleanup();
  }
}

export async function callMlWithSignedUrl(opts: {
  url: string;
  filename?: string | null;
  quotedAt?: string | null;
  timeoutMs?: number;
  headers?: Record<string, string>;
}): Promise<MlCallResult> {
  if (!opts.url) {
    return { ok: false, status: 400, error: "missing_url", tookMs: 0 };
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  return callMlEndpoint(
    "/parse-quote",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: opts.url,
        filename: opts.filename ?? undefined,
        quotedAt: opts.quotedAt ?? undefined,
      }),
    },
    opts.timeoutMs,
  );
}

export async function callMlWithUpload(opts: {
  buffer: Buffer;
  filename: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  endpoint?: string;
}): Promise<MlCallResult> {
  const headers = {
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  const form = new FormData();
  const safeName = opts.filename || "supplier-quote.pdf";
  const bytes = new Uint8Array(opts.buffer.byteLength);
  bytes.set(opts.buffer);
  const blob = new Blob([bytes], { type: "application/pdf" });
  form.append("file", blob, safeName);
  return callMlEndpoint(
    opts.endpoint || "/parse-quote-upload",
    {
      method: "POST",
      headers,
      body: form,
    },
    opts.timeoutMs,
  );
}

export function normaliseMlPayload(raw: any): SupplierParseResult {
  const payload = raw && typeof raw === "object" && raw.parsed ? raw.parsed : raw;
  const linesCandidates: any[] = [];
  if (Array.isArray(payload?.lines)) linesCandidates.push(payload.lines);
  if (Array.isArray(payload?.items)) linesCandidates.push(payload.items);
  if (Array.isArray(payload?.line_items)) linesCandidates.push(payload.line_items);
  if (Array.isArray(payload?.rows)) linesCandidates.push(payload.rows);
  if (Array.isArray(payload?.table)) linesCandidates.push(payload.table);
  if (payload?.table && Array.isArray(payload.table?.rows)) linesCandidates.push(payload.table.rows);

  const firstLines = linesCandidates.find((arr) => Array.isArray(arr) && arr.length > 0) || [];

  const normalisedLines = firstLines.map((ln: any) => ({
    description: String(ln?.description || ln?.item || ln?.name || "Line"),
    qty: typeof ln?.qty === "number" ? ln.qty : typeof ln?.quantity === "number" ? ln.quantity : undefined,
    unit: typeof ln?.unit === "string" ? ln.unit : undefined,
    costUnit:
      typeof ln?.unit_price === "number"
        ? ln.unit_price
        : typeof ln?.unitPrice === "number"
        ? ln.unitPrice
        : typeof ln?.price === "number"
        ? ln.price
        : typeof ln?.unit_cost === "number"
        ? ln.unit_cost
        : undefined,
    sellUnit:
      typeof ln?.sellUnit === "number"
        ? ln.sellUnit
        : typeof ln?.sell_unit === "number"
        ? ln.sell_unit
        : undefined,
    lineTotal:
      typeof ln?.line_total === "number"
        ? ln.line_total
        : typeof ln?.total === "number"
        ? ln.total
        : typeof ln?.lineTotal === "number"
        ? ln.lineTotal
        : undefined,
  }));

  const detectedTotals = (() => {
    const obj = payload?.detected_totals || raw?.detected_totals;
    if (!obj) return undefined;
    if (Array.isArray(obj)) {
      const [subtotal, delivery, estimated_total] = obj.map((v) => (typeof v === "number" ? v : undefined));
      return { subtotal, delivery, estimated_total };
    }
    if (typeof obj === "object") {
      return {
        subtotal: typeof obj.subtotal === "number" ? obj.subtotal : undefined,
        delivery: typeof obj.delivery === "number" ? obj.delivery : undefined,
        estimated_total: typeof obj.estimated_total === "number" ? obj.estimated_total : undefined,
      };
    }
    return undefined;
  })();

  const currency = String(payload?.currency || raw?.currency || "GBP");
  const supplier = typeof payload?.supplier === "string" ? payload.supplier : typeof raw?.supplier === "string" ? raw.supplier : undefined;
  const confidence =
    typeof payload?.confidence === "number"
      ? payload.confidence
      : typeof raw?.confidence === "number"
      ? raw.confidence
      : undefined;

  const warnings: string[] = [];
  if (!firstLines.length) warnings.push("ML did not return any line items");

  return {
    currency,
    supplier,
    lines: normalisedLines,
    detected_totals: detectedTotals,
    confidence,
    warnings: warnings.length ? warnings : undefined,
  };
}
