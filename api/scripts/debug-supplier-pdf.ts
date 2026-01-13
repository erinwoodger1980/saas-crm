import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

type Args = {
  pdfPath?: string;
  uploadedFileId?: string;
  supplierHint?: string;
  currencyHint?: string;
  findName?: string;
  databaseUrl?: string;
  ocrEnabled?: boolean;
  ocrAutoWhenNoText?: boolean;
  llmEnabled?: boolean;
  templateEnabled?: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const rest = [...argv];
  while (rest.length) {
    const token = rest.shift() as string;
    if (token === "--pdf" || token === "--path") {
      args.pdfPath = rest.shift();
      continue;
    }
    if (token === "--uploaded-file-id" || token === "--file-id") {
      args.uploadedFileId = rest.shift();
      continue;
    }
    if (token === "--supplier" || token === "--supplier-hint") {
      args.supplierHint = rest.shift();
      continue;
    }
    if (token === "--currency" || token === "--currency-hint") {
      args.currencyHint = rest.shift();
      continue;
    }
    if (token === "--find-name" || token === "--find") {
      args.findName = rest.shift();
      continue;
    }
    if (token === "--database-url" || token === "--db") {
      args.databaseUrl = rest.shift();
      continue;
    }
    if (token === "--ocr") {
      args.ocrEnabled = true;
      continue;
    }
    if (token === "--no-ocr") {
      args.ocrEnabled = false;
      continue;
    }
    if (token === "--ocr-auto-when-no-text" || token === "--ocr-auto") {
      args.ocrAutoWhenNoText = true;
      continue;
    }
    if (token === "--llm") {
      args.llmEnabled = true;
      continue;
    }
    if (token === "--no-llm") {
      args.llmEnabled = false;
      continue;
    }
    if (token === "--templates") {
      args.templateEnabled = true;
      continue;
    }
    if (token === "--no-templates") {
      args.templateEnabled = false;
      continue;
    }
    if (!token.startsWith("--") && !args.pdfPath && !args.uploadedFileId) {
      // Allow positional: first non-flag is treated as file path
      args.pdfPath = token;
      continue;
    }
  }
  return args;
}

function truncate(text: string, max = 180): string {
  const s = String(text || "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function getPool(args: Args): Pool {
  const connectionString = args.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Provide --database-url <postgres_url> or set DATABASE_URL in the environment.",
    );
  }
  return new Pool({ connectionString });
}

function byteaToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value == null) return Buffer.alloc(0);
  if (typeof value === "string") {
    // node-postgres commonly returns bytea as a hex string like "\\xDEADBEEF..."
    if (value.startsWith("\\x")) {
      return Buffer.from(value.slice(2), "hex");
    }
    // Fallback: assume base64 or utf-8 (best effort)
    try {
      return Buffer.from(value, "base64");
    } catch {
      return Buffer.from(value, "utf8");
    }
  }
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value), "utf8");
}

async function loadBuffer(args: Args): Promise<{ buffer: Buffer; label: string }> {
  if (args.pdfPath) {
    const abs = path.isAbsolute(args.pdfPath) ? args.pdfPath : path.join(process.cwd(), args.pdfPath);
    const buffer = await fs.promises.readFile(abs);
    return { buffer, label: abs };
  }

  if (args.uploadedFileId) {
    const pool = getPool(args);
    try {
      const res = await pool.query(
        'SELECT id, name, path, "mimeType", "sizeBytes", content FROM "UploadedFile" WHERE id = $1 LIMIT 1',
        [args.uploadedFileId],
      );
      const row = res.rows?.[0];
      if (!row) {
        throw new Error(`UploadedFile not found: ${args.uploadedFileId}`);
      }
      const buffer = byteaToBuffer(row.content);
      if (!buffer.length) {
        throw new Error(
          `UploadedFile.content is empty for ${args.uploadedFileId} (name=${row.name || ""}, mime=${row.mimeType || ""}, path=${row.path || ""}). ` +
            "This upload was stored as a disk path only; to debug/parse from DB, re-upload with UPLOADS_STORE_IN_DB enabled.",
        );
      }
      return {
        buffer,
        label: `UploadedFile:${row.id} (${row.name || "(unnamed)"}, ${row.sizeBytes || buffer.length} bytes)`,
      };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  throw new Error("Provide either a PDF path (positional or --pdf) or --uploaded-file-id <id>");
}

async function listMatches(args: Args): Promise<void> {
  const query = String(args.findName || "").trim();
  if (!query) throw new Error("--find-name requires a non-empty string");

  const pool = getPool(args);
  try {
    const res = await pool.query(
      'SELECT id, name, "quoteId", "mimeType", "sizeBytes", "uploadedAt", path FROM "UploadedFile" WHERE name ILIKE $1 ORDER BY "uploadedAt" DESC LIMIT 25',
      [`%${query}%`],
    );
    const rows = res.rows ?? [];

    console.log(`\n=== UploadedFile matches for: ${query} ===`);
    if (!rows.length) {
      console.log("No matches found.");
      return;
    }
    for (const row of rows) {
      const uploadedAt = row.uploadedAt ? new Date(row.uploadedAt).toISOString() : "";
      console.log(
        `${row.id} | ${row.sizeBytes ?? "?"} bytes | ${uploadedAt} | quoteId=${row.quoteId ?? ""} | ${row.name ?? ""}`,
      );
    }
    console.log("\nTip: re-run with --uploaded-file-id <id> to parse one of these.");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function main() {
  // Make OpenAI irrelevant for this script.
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "disabled";

  const args = parseArgs(process.argv.slice(2));

  if (args.findName) {
    await listMatches(args);
    return;
  }

  const { buffer, label } = await loadBuffer(args);

  const supplierHint = args.supplierHint;
  const currencyHint = args.currencyHint || "GBP";

  const { extractStructuredText } = await import("../src/lib/pdf/extract");
  const { buildSupplierParse } = await import("../src/lib/pdf/parser");
  const { assessDescriptionQuality } = await import("../src/lib/pdf/quality");
  const { parseSupplierPdf } = await import("../src/lib/supplier/parse");

  console.log("\n=== Input ===");
  console.log({ label, bytes: buffer.length, supplierHint: supplierHint ?? null, currencyHint });

  console.log("\n=== Stage A: extractStructuredText ===");
  const extraction = extractStructuredText(buffer);
  console.log({
    rows: extraction.rows.length,
    glyphQuality: extraction.glyphQuality,
    unicodeMapSize: extraction.unicodeMapSize,
    warnings: extraction.warnings ?? [],
  });
  console.log("\nSample rows:");
  extraction.rows.slice(0, 15).forEach((row, idx) => {
    console.log(
      `${String(idx + 1).padStart(2, "0")} q=${row.quality.toFixed(2)} :: ${truncate(row.normalized, 220)}`,
    );
  });

  console.log("\n=== Stage A: buildSupplierParse ===");
  const { result: stageAResult, metadata } = buildSupplierParse(extraction);
  console.log({
    lines: stageAResult.lines.length,
    detectedTotals: stageAResult.detected_totals ?? null,
    currency: stageAResult.currency,
    supplier: stageAResult.supplier ?? null,
    metadata: {
      glyphQuality: metadata.glyphQuality,
      descriptionQuality: metadata.descriptionQuality,
      lowConfidence: metadata.lowConfidence,
      warnings: metadata.warnings ?? [],
    },
    warnings: stageAResult.warnings ?? [],
  });
  console.log("\nSample parsed lines (Stage A):");
  stageAResult.lines.slice(0, 20).forEach((ln, idx) => {
    const q = assessDescriptionQuality(String(ln.description || ""));
    console.log(
      `${String(idx + 1).padStart(2, "0")} score=${q.score.toFixed(2)} gib=${q.gibberish ? "yes" : "no"} :: ${truncate(
        ln.description,
        220,
      )} | qty=${ln.qty ?? ""} unit=${ln.unit ?? ""} costUnit=${ln.costUnit ?? ""} lineTotal=${ln.lineTotal ?? ""}`,
    );
  });

  console.log("\n=== Full parseSupplierPdf (templates/OCR/LLM disabled) ===");
  const templateEnabled = args.templateEnabled ?? false;
  const ocrEnabled = args.ocrEnabled ?? false;
  const ocrAutoWhenNoText = args.ocrAutoWhenNoText ?? false;
  const llmEnabled = args.llmEnabled ?? false;

  const full = await parseSupplierPdf(buffer, {
    supplierHint,
    currencyHint,
    templateEnabled,
    ocrEnabled,
    ocrAutoWhenNoText,
    llmEnabled,
  });
  console.log({
    usedStages: (full as any).usedStages ?? null,
    confidence: (full as any).confidence ?? null,
    lines: full.lines.length,
    supplier: full.supplier ?? null,
    currency: full.currency,
    detectedTotals: full.detected_totals ?? null,
    warnings: full.warnings ?? [],
  });

  console.log("\nSample parsed lines (full):");
  full.lines.slice(0, 25).forEach((ln, idx) => {
    const q = assessDescriptionQuality(String(ln.description || ""));
    console.log(
      `${String(idx + 1).padStart(2, "0")} score=${q.score.toFixed(2)} gib=${q.gibberish ? "yes" : "no"} :: ${truncate(
        ln.description,
        220,
      )} | qty=${ln.qty ?? ""} unit=${ln.unit ?? ""} costUnit=${ln.costUnit ?? ""} lineTotal=${ln.lineTotal ?? ""}`,
    );
  });
}

main().catch((err) => {
  console.error("\n❌ debug-supplier-pdf failed:");
  console.error(err?.stack || err);
  process.exit(1);
});
