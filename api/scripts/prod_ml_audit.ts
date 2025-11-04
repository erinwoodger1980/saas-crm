import "dotenv/config";
import fetch, { Blob, FormData, type RequestInit, type Response } from "node-fetch";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import path from "path";
import jwt from "jsonwebtoken";
import { setTimeout as delay } from "timers/promises";
import fs from "fs/promises";

const CHECKS = [
  "ML health/version",
  "API health",
  "Parse endpoint",
  "ParsedSupplierLine persisted",
  "Parser InferenceEvent persisted",
  "Estimate endpoint",
  "Estimate persisted",
  "Estimator InferenceEvent persisted",
  "Production model + metrics found",
  "Cleanup complete",
] as const;

type CheckLabel = (typeof CHECKS)[number];

type CheckResult = { label: CheckLabel; result: "PASS" | "FAIL"; detail?: string };

const results = new Map<CheckLabel, CheckResult>();

function record(label: CheckLabel, result: "PASS" | "FAIL", detail?: string) {
  results.set(label, { label, result, detail });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBase(url: string): string {
  return url.replace(/\/$/, "");
}

async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<{ response: Response; json: any }> {
  const attempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      const text = await res.text();
      let parsed: any = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (!res.ok && attempt < attempts && res.status >= 500) {
        await delay(200 * Math.pow(2, attempt - 1));
        continue;
      }
      return { response: res, json: parsed };
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt === attempts) break;
      await delay(200 * Math.pow(2, attempt - 1));
    }
  }

  throw new Error(`${label} failed: ${lastError?.message || lastError}`);
}

function sha256(...chunks: Array<string | Buffer>): string {
  const hash = crypto.createHash("sha256");
  for (const chunk of chunks) {
    if (Buffer.isBuffer(chunk)) {
      hash.update(chunk);
    } else if (typeof chunk === "string") {
      hash.update(chunk);
    } else if (chunk != null) {
      hash.update(String(chunk));
    }
  }
  return hash.digest("hex");
}

function hasMetrics(metrics: any): boolean {
  if (!metrics || typeof metrics !== "object") return false;
  return Object.keys(metrics).length > 0;
}

function formatTable(): string {
  const rows = CHECKS.map((label) => results.get(label) ?? { label, result: "FAIL" as const, detail: "not run" });
  const maxLabel = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
  const header = `${"Check".padEnd(maxLabel + 2)}Result  Detail`;
  const lines = rows.map((row) => {
    const detail = row.detail ? String(row.detail) : "";
    return `${row.label.padEnd(maxLabel + 2)}${row.result.padEnd(7)}${detail}`;
  });
  return [header, ...lines].join("\n");
}

async function main() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be 'production' for the production audit");
  }

  const API_BASE = normalizeBase(requireEnv("API_BASE"));
  const ML_URL = normalizeBase(requireEnv("ML_URL"));
  const DATABASE_URL = requireEnv("DATABASE_URL");
  const TENANT_ID = requireEnv("TENANT_ID");
  const OPENAI_API_KEY = optionalEnv("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    console.warn("⚠️ OPENAI_API_KEY is not set. Ensure downstream LLM calls do not require it for this tenant.");
  }

  const mlHost = new URL(ML_URL).hostname.toLowerCase();
  if (/test|staging|local|dev/.test(mlHost)) {
    throw new Error(`ML_URL host appears non-production: ${mlHost}`);
  }

  const secondaryMlKeys = Object.keys(process.env).filter((key) => key !== "ML_URL" && /ML_URL/i.test(key));
  for (const key of secondaryMlKeys) {
    const value = process.env[key];
    if (value && value.trim() && value.trim() !== ML_URL) {
      throw new Error(`Found secondary ML URL env (${key}); aborting to avoid wrong target.`);
    }
  }

  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  let auditQuoteId: string | null = null;
  let auditFileId: string | null = null;
  let parserInputHash: string | null = null;
  let estimatorInputHash: string | null = null;
  const auditId = `audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  console.log(`🔍 Starting production ML audit: ${auditId}`);

  let fatalError: any = null;
  const pdfPath = path.resolve(__dirname, "../fixtures/supplier-sample.pdf");
  const pdfBuffer = await fs.readFile(pdfPath);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
    if (!tenant) {
      throw new Error(`Tenant ${TENANT_ID} not found in production database`);
    }

    const auditUser = await prisma.user.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: "asc" } });
    if (!auditUser) {
      throw new Error(`No user found for tenant ${TENANT_ID}`);
    }

    const existingJwt = optionalEnv("AUDIT_JWT");
    let authToken = existingJwt;
    if (!authToken) {
      const secret = optionalEnv("AUDIT_JWT_SECRET") || optionalEnv("APP_JWT_SECRET");
      if (!secret) {
        throw new Error("Provide AUDIT_JWT or APP_JWT_SECRET to authenticate audit requests");
      }
      authToken = jwt.sign(
        {
          userId: auditUser.id,
          tenantId: TENANT_ID,
          email: auditUser.email,
          role: auditUser.role || "user",
          purpose: "prod_ml_audit",
          auditId,
        },
        secret,
        { expiresIn: "15m" },
      );
    }

    const authHeaders: Record<string, string> = { Authorization: `Bearer ${authToken}` };

    try {
      const { response: healthRes, json: healthJson } = await fetchWithRetry(`${ML_URL}/health`, { method: "GET", headers: authHeaders }, "ML health");
      if (!healthRes.ok || !healthJson || typeof healthJson !== "object") {
        throw new Error(`ML health endpoint returned ${healthRes.status}`);
      }
      const { response: versionRes, json: versionJson } = await fetchWithRetry(`${ML_URL}/version`, { method: "GET", headers: authHeaders }, "ML version");
      if (!versionRes.ok || !versionJson || typeof versionJson !== "object") {
        throw new Error(`ML version endpoint returned ${versionRes.status}`);
      }
      console.log("✅ ML health/version OK", { health: healthJson, version: versionJson });
      record("ML health/version", "PASS");
    } catch (err: any) {
      record("ML health/version", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const { response } = await fetchWithRetry(`${API_BASE}/healthz`, { method: "GET" }, "API health");
      if (!response.ok) {
        throw new Error(`API healthz returned ${response.status}`);
      }
      record("API health", "PASS");
    } catch (err: any) {
      record("API health", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const { response: quoteRes, json: quoteJson } = await fetchWithRetry(
        `${API_BASE}/quotes`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", "X-Audit-Id": auditId },
          body: JSON.stringify({ title: `Audit Quote ${auditId}` }),
        },
        "Create quote",
      );
      if (!quoteRes.ok || !quoteJson?.id) {
        throw new Error(`Failed to create quote: status ${quoteRes.status}`);
      }
      auditQuoteId = String(quoteJson.id);
      console.log(`🧾 Created audit quote ${auditQuoteId}`);
    } catch (err: any) {
      record("Parse endpoint", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const uploadAttempts = 3;
      let uploadJson: any = null;
      for (let attempt = 1; attempt <= uploadAttempts; attempt++) {
        try {
          const form = new FormData();
          form.append("files", new Blob([pdfBuffer], { type: "application/pdf" }), `${auditId}.pdf`);
          form.append("auditId", auditId);
          const res = await fetch(`${API_BASE}/quotes/${auditQuoteId}/files`, { method: "POST", headers: authHeaders, body: form as any });
          const text = await res.text();
          uploadJson = text ? JSON.parse(text) : {};
          if (!res.ok) {
            throw new Error(`status ${res.status}: ${text}`);
          }
          break;
        } catch (err: any) {
          if (attempt === uploadAttempts) throw err;
          await delay(200 * Math.pow(2, attempt - 1));
        }
      }
      if (!uploadJson?.files?.[0]?.id) {
        throw new Error("Upload response missing file id");
      }
      auditFileId = String(uploadJson.files[0].id);
      console.log(`📎 Uploaded supplier file ${auditFileId}`);
    } catch (err: any) {
      record("Parse endpoint", "FAIL", err?.message || String(err));
      throw err;
    }

    let parseSummary: any = null;
    try {
      const { response: parseRes, json: parseJson } = await fetchWithRetry(
        `${API_BASE}/quotes/${auditQuoteId}/parse?async=0`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", "X-Audit-Id": auditId },
          body: JSON.stringify({ auditId }),
        },
        "Parse quote",
      );
      if (!parseRes.ok || !parseJson?.ok) {
        throw new Error(`Parse endpoint returned ${parseRes.status}`);
      }
      if (!Array.isArray(parseJson?.summaries) || parseJson.summaries.length === 0) {
        throw new Error("Parse response missing summaries");
      }
      parseSummary = parseJson;
      record("Parse endpoint", "PASS");
    } catch (err: any) {
      record("Parse endpoint", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      const parsedLines = await prisma.parsedSupplierLine.findMany({ where: { tenantId: TENANT_ID, quoteId: auditQuoteId!, createdAt: { gte: cutoff } } });
      if (!parsedLines.length) {
        throw new Error("No ParsedSupplierLine rows found for audit quote");
      }
      record("ParsedSupplierLine persisted", "PASS");
    } catch (err: any) {
      record("ParsedSupplierLine persisted", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      if (!auditFileId) throw new Error("Missing uploaded file id");
      parserInputHash = sha256(TENANT_ID, ":", auditQuoteId!, ":", auditFileId, ":", Buffer.from(pdfBuffer));
      const parserEvent = await prisma.inferenceEvent.findFirst({
        where: { tenantId: TENANT_ID, model: "supplier_parser", inputHash: parserInputHash },
        orderBy: { createdAt: "desc" },
      });
      if (!parserEvent) {
        throw new Error("No InferenceEvent recorded for supplier_parser");
      }
      if (parserEvent.latencyMs == null) {
        throw new Error("supplier_parser latencyMs missing");
      }
      record("Parser InferenceEvent persisted", "PASS");
    } catch (err: any) {
      record("Parser InferenceEvent persisted", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const { response: estimateRes, json: estimateResp } = await fetchWithRetry(
        `${API_BASE}/quotes/${auditQuoteId}/price`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", "X-Audit-Id": auditId },
          body: JSON.stringify({ method: "ml", inputType: "supplier_pdf", auditId }),
        },
        "Estimate quote",
      );
      if (!estimateRes.ok || !estimateResp?.ok) {
        throw new Error(`Estimate endpoint returned ${estimateRes.status}`);
      }
      if (typeof estimateResp?.predictedTotal !== "number" || estimateResp.predictedTotal <= 0) {
        throw new Error("Estimate response missing predictedTotal");
      }
      record("Estimate endpoint", "PASS");
    } catch (err: any) {
      record("Estimate endpoint", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000);
      const estimateRow = await prisma.estimate.findFirst({
        where: { tenantId: TENANT_ID, quoteId: auditQuoteId! },
        orderBy: { createdAt: "desc" },
      });
      if (!estimateRow) {
        throw new Error("No Estimate row recorded");
      }
      if (estimateRow.createdAt < cutoff) {
        throw new Error("Estimate row is older than expected");
      }
      if (!estimateRow.modelVersionId) {
        throw new Error("Estimate modelVersionId missing");
      }
      record("Estimate persisted", "PASS");
    } catch (err: any) {
      record("Estimate persisted", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const parsedForHash = await prisma.parsedSupplierLine.findMany({
        where: { tenantId: TENANT_ID, quoteId: auditQuoteId! },
        select: { rawText: true, qty: true, costUnit: true, lineTotal: true, currency: true, supplier: true },
        orderBy: { createdAt: "asc" },
      });
      estimatorInputHash = sha256(
        TENANT_ID,
        ":",
        auditQuoteId!,
        ":",
        "supplier_pdf",
        ":",
        JSON.stringify(parsedForHash ?? {}),
      );
      const estimatorEvent = await prisma.inferenceEvent.findFirst({
        where: { tenantId: TENANT_ID, model: "supplier_estimator", inputHash: estimatorInputHash },
        orderBy: { createdAt: "desc" },
      });
      if (!estimatorEvent) {
        throw new Error("No InferenceEvent recorded for supplier_estimator");
      }
      if (estimatorEvent.latencyMs == null) {
        throw new Error("supplier_estimator latencyMs missing");
      }
      record("Estimator InferenceEvent persisted", "PASS");
    } catch (err: any) {
      record("Estimator InferenceEvent persisted", "FAIL", err?.message || String(err));
      throw err;
    }

    try {
      const { response: statusRes, json: statusJson } = await fetchWithRetry(
        `${API_BASE}/ml/status?scope=global`,
        { method: "GET", headers: authHeaders },
        "ML status",
      );
      if (!statusRes.ok || !statusJson?.ok) {
        throw new Error(`ML status endpoint returned ${statusRes.status}`);
      }
      const models: Array<any> = Array.isArray(statusJson.models) ? statusJson.models : [];
      const estimator = models.find((m) => m?.model === "supplier_estimator");
      if (!estimator) {
        throw new Error("supplier_estimator model not reported");
      }
      if (!hasMetrics(estimator.metrics)) {
        throw new Error("supplier_estimator metrics missing");
      }
      record("Production model + metrics found", "PASS");
    } catch (err: any) {
      record("Production model + metrics found", "FAIL", err?.message || String(err));
      throw err;
    }
  } catch (err) {
    fatalError = err;
  } finally {
    try {
      if (auditQuoteId) {
        const hashes = [parserInputHash, estimatorInputHash].filter((v): v is string => Boolean(v));
        const deletes = [
          prisma.trainingInsights.deleteMany({ where: { tenantId: TENANT_ID, inputSummary: { contains: `quote:${auditQuoteId}` } } }),
          prisma.quoteLine.deleteMany({ where: { quoteId: auditQuoteId! } }),
          prisma.parsedSupplierLine.deleteMany({ where: { tenantId: TENANT_ID, quoteId: auditQuoteId! } }),
          prisma.estimate.deleteMany({ where: { tenantId: TENANT_ID, quoteId: auditQuoteId! } }),
          prisma.uploadedFile.deleteMany({ where: { tenantId: TENANT_ID, quoteId: auditQuoteId! } }),
        ];
        if (hashes.length) {
          deletes.push(prisma.inferenceEvent.deleteMany({ where: { tenantId: TENANT_ID, inputHash: { in: hashes } } }));
        }
        await prisma.$transaction(deletes);
        await prisma.quote.deleteMany({ where: { tenantId: TENANT_ID, id: auditQuoteId } });
      }
      record("Cleanup complete", "PASS");
    } catch (err: any) {
      record("Cleanup complete", "FAIL", err?.message || String(err));
      if (!fatalError) fatalError = err;
    }
    await prisma.$disconnect();
  }

  console.log("\n=== Production ML Audit Summary ===");
  console.log(formatTable());
  const allPass = CHECKS.every((label) => results.get(label)?.result === "PASS");
  if (fatalError || !allPass) {
    console.error("\n❌ Production ML audit failed.");
    process.exit(1);
  }
  console.log("\n✅ Production ML audit passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Audit crashed:", err?.message || err);
  process.exit(1);
});
