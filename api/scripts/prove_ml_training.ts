import "dotenv/config";
import path from "path";
import fs from "fs/promises";
import fetch, { Blob, FormData, type RequestInit } from "node-fetch";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { setTimeout as delay } from "timers/promises";

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

async function fetchJson(url: string, init: RequestInit, label: string) {
  const attempts = 3;
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let json: any = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }
      if (!res.ok && attempt < attempts && res.status >= 500) {
        await delay(300 * Math.pow(2, attempt - 1));
        continue;
      }
      return { res, json };
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      await delay(300 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error(`${label} failed: ${lastError?.message || lastError}`);
}

async function ensureQuote(prisma: PrismaClient, apiBase: string, headers: Record<string, string>, tenantId: string) {
  const existingQuoteId = optionalEnv("QUOTE_ID");
  if (existingQuoteId) return existingQuoteId;

  const title = optionalEnv("QUOTE_TITLE") || `ML Verification ${new Date().toISOString()}`;
  const body = JSON.stringify({ title });
  const { res, json } = await fetchJson(`${apiBase}/quotes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
  }, "create quote");
  if (!res.ok) {
    throw new Error(`Failed to create quote: ${res.status} ${JSON.stringify(json)}`);
  }
  const quoteId = String(json?.id ?? "");
  if (!quoteId) {
    throw new Error("Quote creation succeeded but id missing in response");
  }
  console.log(`🆕 Created quote ${quoteId} (${title})`);
  return quoteId;
}

async function uploadPdf(apiBase: string, quoteId: string, headers: Record<string, string>, pdfPath: string) {
  const buffer = await fs.readFile(pdfPath);
  const form = new FormData();
  form.append("files", new Blob([buffer]), path.basename(pdfPath));
  const { res, json } = await fetchJson(`${apiBase}/quotes/${quoteId}/files`, {
    method: "POST",
    headers,
    body: form as any,
  }, "upload pdf");
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${JSON.stringify(json)}`);
  }
  console.log(`✅ Uploaded ${path.basename(pdfPath)} (${buffer.length} bytes)`);
}

async function parseQuote(apiBase: string, quoteId: string, headers: Record<string, string>) {
  const url = new URL(`${apiBase}/quotes/${quoteId}/parse`);
  url.searchParams.set("async", "0");
  const { res, json } = await fetchJson(url.toString(), {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }, "parse quote");
  if (!res.ok) {
    throw new Error(`Parse failed: ${res.status} ${JSON.stringify(json)}`);
  }
  console.log("✅ Quote parse triggered", json?.summaries?.length ? `${json.summaries.length} summaries` : "");
}

async function waitForParsedLines(prisma: PrismaClient, tenantId: string, quoteId: string, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  while (Date.now() < deadline) {
    lastCount = await prisma.parsedSupplierLine.count({ where: { tenantId, quoteId } });
    if (lastCount > 0) {
      console.log(`✅ Parsed ${lastCount} supplier lines`);
      return lastCount;
    }
    await delay(2000);
  }
  throw new Error(`Timed out waiting for ParsedSupplierLine rows (last count ${lastCount})`);
}

async function triggerTraining(apiBase: string, headers: Record<string, string>) {
  const start = Date.now();
  const { res, json } = await fetchJson(`${apiBase}/ml/train`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "supplier_estimator" }),
  }, "trigger training");
  if (!res.ok) {
    throw new Error(`Training trigger failed: ${res.status} ${JSON.stringify(json)}`);
  }
  console.log(`✅ Training triggered (datasetCount=${json?.datasetCount ?? "?"})`);
  return { startedAt: new Date(start - 1000), payload: json };
}

async function waitForTrainingRun(prisma: PrismaClient, tenantId: string, startedAt: Date, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await prisma.trainingRun.findFirst({
      where: {
        model: "supplier_estimator",
        OR: [{ tenantId }, { tenantId: null }],
        createdAt: { gte: startedAt },
      },
      orderBy: { createdAt: "desc" },
    });
    if (run) {
      console.log(`✅ TrainingRun ${run.id} status=${run.status}`);
      return run;
    }
    await delay(2000);
  }
  throw new Error("Timed out waiting for TrainingRun record");
}

function formatCountRow(rows: Array<{ count: bigint | number }>): number {
  if (!rows.length) return 0;
  const value = rows[0].count;
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

async function main() {
  const API_BASE = requireEnv("API_BASE").replace(/\/$/, "");
  const ML_URL = requireEnv("ML_URL").replace(/\/$/, "");
  const DATABASE_URL = requireEnv("DATABASE_URL");
  const TENANT_ID = requireEnv("TENANT_ID");
  const PDF_PATH = optionalEnv("PDF_PATH") || path.resolve(__dirname, "../fixtures/15.10.25 Woodger – Woodleys.pdf");

  try {
    await fs.access(PDF_PATH);
  } catch (err) {
    throw new Error(`PDF not found at ${PDF_PATH}. Provide PDF_PATH env to override.`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
    if (!tenant) throw new Error(`Tenant ${TENANT_ID} not found`);

    const authHeader = optionalEnv("AUTH_JWT");
    let headers: Record<string, string> = {};
    if (authHeader) {
      headers.Authorization = `Bearer ${authHeader}`;
    } else {
      const secret = optionalEnv("APP_JWT_SECRET");
      if (!secret) throw new Error("Provide AUTH_JWT or APP_JWT_SECRET to authenticate API calls");
      const user = await prisma.user.findFirst({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: "asc" } });
      if (!user) throw new Error(`No user found for tenant ${TENANT_ID}`);
      const token = jwt.sign(
        { tenantId: TENANT_ID, userId: user.id, email: user.email, role: user.role || "user", purpose: "prove_ml_training" },
        secret,
        { expiresIn: "30m" },
      );
      headers.Authorization = `Bearer ${token}`;
    }

    const quoteId = await ensureQuote(prisma, API_BASE, headers, TENANT_ID);
    await uploadPdf(API_BASE, quoteId, headers, PDF_PATH);
    await parseQuote(API_BASE, quoteId, headers);
    await waitForParsedLines(prisma, TENANT_ID, quoteId);

    const { startedAt } = await triggerTraining(API_BASE, headers);
    await waitForTrainingRun(prisma, TENANT_ID, startedAt);

    const statusUrl = new URL(`${API_BASE}/ml/status`);
    const statusRes = await fetchJson(statusUrl.toString(), { method: "GET", headers }, "ml status");
    if (!statusRes.res.ok) {
      throw new Error(`Failed to fetch ml/status: ${statusRes.res.status}`);
    }
    const statusJson = statusRes.json as any;
    console.log("\n🧪 ML Status Snapshot:");
    console.log(JSON.stringify(statusJson, null, 2));

    const [mlSamples, trainingRuns, parsedLines] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "MLTrainingSample"`,
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "TrainingRun"`,
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "ParsedSupplierLine"`,
    ]);

    console.log("\n📊 Database Counts:");
    console.log(`MLTrainingSample: ${formatCountRow(mlSamples)}`);
    console.log(`TrainingRun: ${formatCountRow(trainingRuns)}`);
    console.log(`ParsedSupplierLine: ${formatCountRow(parsedLines)}`);

    const estimator = statusJson?.estimator ?? {};
    const confidence = estimator?.modelConfidence ?? statusJson?.modelConfidence ?? null;
    console.log("\n📈 Estimator Metrics:");
    console.log(`Recent samples (14d): ${statusJson?.recentSamples14d ?? estimator?.recentSamples14d ?? "unknown"}`);
    console.log(`Model confidence: ${confidence != null ? confidence : "unknown"}`);
    if (estimator?.lastTrainingRun?.metrics) {
      console.log("Last training run metrics:");
      console.log(JSON.stringify(estimator.lastTrainingRun.metrics, null, 2));
    }
    if (estimator?.productionModel?.metrics) {
      console.log("Production model metrics:");
      console.log(JSON.stringify(estimator.productionModel.metrics, null, 2));
    }

    console.log("\n✅ Proof complete. ML service: ", ML_URL);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ prove_ml_training failed", err);
  process.exit(1);
});
