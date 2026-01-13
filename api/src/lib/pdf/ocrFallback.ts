import type { ExtractionSummary } from "./extract";
import type { SupplierParseResult } from "../../types/parse";
import { cleanText, inferCurrency, parseMoney } from "./normalize";
import { assessDescriptionQuality } from "./quality";
import sharp from "sharp";
import crypto from "crypto";
import os from "os";
import path from "path";
import fs from "fs";

export interface OcrReplacement {
  rowIndex: number;
  description: string;
  quality: number;
}

export interface OcrFallbackResult {
  replacements: OcrReplacement[];
  parse?: SupplierParseResult;
  warnings?: string[];
  stage: "tesseract" | "unavailable";
}

function formatErr(err: any): string {
  return String(err?.message || err || "unknown_error");
}

async function renderPdfFirstPageToPngViaPuppeteer(pdfBuffer: Buffer): Promise<Buffer> {
  // Dynamically load puppeteer + chromium fallback to avoid hard crashes if dependencies differ by env.
  let puppeteer: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    puppeteer = require("puppeteer");
  } catch (e: any) {
    throw new Error(`puppeteer_missing: ${formatErr(e)}`);
  }

  const tmpDir = os.tmpdir();
  const tmpName = `ocr-${crypto.randomBytes(8).toString("hex")}.pdf`;
  const tmpPath = path.join(tmpDir, tmpName);

  await fs.promises.writeFile(tmpPath, pdfBuffer);

  let browser: any;
  try {
    const resolvedExec = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
    const execPath = resolvedExec || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1400, height: 1800, deviceScaleFactor: 2 },
    });
  } catch (firstErr: any) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chromium = require("@sparticuz/chromium");
    const execPath2 = await chromium.executablePath();
    browser = await puppeteer.launch({
      headless: chromium.headless !== undefined ? chromium.headless : true,
      executablePath: execPath2,
      args: chromium.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport ?? { width: 1400, height: 1800, deviceScaleFactor: 2 },
    });
  }

  try {
    const page = await browser.newPage();
    const fileUrl = `file://${tmpPath}`;

    try {
      await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 15000 });
    } catch {
      await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    }

    // Give the PDF viewer a moment to paint.
    await page.waitForTimeout(800);

    const png = await page.screenshot({ type: "png", fullPage: true });
    return Buffer.from(png);
  } finally {
    try {
      await browser.close();
    } catch {}
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
  }
}

function splitOcrTextIntoLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n+/g)
    .map((ln) => cleanText(ln))
    .map((ln) => ln.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function buildParseFromOcrLines(lines: string[], currencyHint?: string): SupplierParseResult | null {
  const parsedLines: SupplierParseResult["lines"] = [];

  for (const raw of lines) {
    const line = cleanText(raw);
    if (!line || line.length < 6) continue;

    // Heuristic: keep only lines that look like items with at least one numeric
    if (!/[0-9]/.test(line)) continue;
    if (/\b(subtotal|total|grand total|vat|tax|page)\b/i.test(line)) continue;

    // Try to interpret trailing monetary columns.
    const numbers = (line.match(/[-+]?\d[\d,]*\.?\d*/g) || [])
      .map((t) => parseMoney(t))
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (!numbers.length) continue;

    const lineTotal = numbers[numbers.length - 1];
    const maybeCostUnit = numbers.length >= 2 ? numbers[numbers.length - 2] : undefined;

    // Extract qty as the first small-ish integer-ish number in the line.
    let qty: number | undefined;
    for (const n of numbers) {
      const asInt = Math.round(n);
      if (Math.abs(n - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
        qty = asInt;
        break;
      }
    }

    // Description: take the prefix before the first number token.
    const firstNumIdx = line.search(/[-+]?\d/);
    const description = cleanText(firstNumIdx > 0 ? line.slice(0, firstNumIdx) : line)
      .replace(/[|]+/g, " ")
      .trim();

    const quality = assessDescriptionQuality(description);
    if (quality.gibberish || quality.score < 0.55) continue;

    parsedLines.push({
      description,
      qty,
      costUnit: typeof maybeCostUnit === "number" && maybeCostUnit > 0 ? maybeCostUnit : undefined,
      lineTotal: typeof lineTotal === "number" && lineTotal > 0 ? lineTotal : undefined,
    });
  }

  if (parsedLines.length < 1) return null;

  return {
    currency: currencyHint || "GBP",
    lines: parsedLines,
    confidence: Math.min(0.9, 0.4 + parsedLines.length * 0.03),
    warnings: ["OCR fallback used (local tesseract)"]
  };
}

export async function runOcrFallback(
  _buffer: Buffer,
  extraction: ExtractionSummary,
): Promise<OcrFallbackResult | null> {
  let tesseract: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    tesseract = require("tesseract.js");
  } catch {
    return {
      replacements: [],
      warnings: [
        "OCR fallback unavailable: tesseract.js dependency is not installed in this environment.",
      ],
      stage: "unavailable",
    };
  }

  if (!tesseract?.createWorker) {
    return {
      replacements: [],
      warnings: ["OCR fallback unavailable: tesseract.js worker factory missing."],
      stage: "unavailable",
    };
  }

  // Only attempt OCR when structured extraction looks poor.
  // Note: some garbled PDFs still look "alphanumeric" (e.g. UUUUUU...) so we add entropy checks.
  const sampleRows = extraction.rows.slice(0, 40);
  const rowNeedsHelp = sampleRows.some((row) => {
    const text = String(row.normalized || row.text || "");
    if (!text) return false;
    const q = assessDescriptionQuality(text);
    return q.gibberish || q.score < 0.6 || q.dominantCharRatio > 0.6;
  });
  const rawSample = String(extraction.rawText || "").slice(0, 4000);
  const overall = assessDescriptionQuality(rawSample);
  const needsHelp = rowNeedsHelp || overall.gibberish || overall.score < 0.6 || overall.dominantCharRatio > 0.6;
  if (!needsHelp) {
    return {
      replacements: [],
      warnings: ["OCR fallback skipped: structured extraction already high confidence."],
      stage: "unavailable",
    };
  }

  let worker: any;
  try {
    // tesseract.js v7: createWorker(langs='eng', oem?, options?, config?)
    // Passing an options object as the first arg will crash (langsArr.map is not a function).
    const enableTesseractLogs =
      String(process.env.TESSERACT_LOGS ?? "false").toLowerCase() === "true";
    worker = await tesseract.createWorker("eng", undefined, {
      // Must be a function if provided; tesseract.js calls it directly.
      logger: enableTesseractLogs ? (m: any) => console.log("[tesseract]", m) : () => {},
      // Ensure library-level errors don't throw uncaught exceptions.
      errorHandler: () => {},
    });
  } catch (err: any) {
    const msg = `OCR fallback unavailable: tesseract worker init failed (${formatErr(err)}).`;
    console.warn("[runOcrFallback]", msg);
    return { replacements: [], warnings: [msg], stage: "tesseract" };
  }

  try {
    // v7 workers come pre-loaded; load/loadLanguage/initialize are not needed.

    // Render the first page to an image and OCR that.
    // This avoids the "OCR the already-garbled text" problem and works for scanned PDFs.
    let png: Buffer | null = null;
    const renderErrors: string[] = [];
    try {
      png = await sharp(_buffer, { density: 220 }).png({ quality: 90 }).toBuffer();
    } catch (e: any) {
      renderErrors.push(`sharp: ${formatErr(e)}`);
      try {
        png = await renderPdfFirstPageToPngViaPuppeteer(_buffer);
      } catch (e2: any) {
        renderErrors.push(`puppeteer: ${formatErr(e2)}`);
      }
    }

    if (!png) {
      const msg = `OCR fallback unavailable: PDF rendering failed (${renderErrors.join(" | ") || "unknown"}).`;
      console.warn("[runOcrFallback]", msg);
      return {
        replacements: [],
        warnings: [msg],
        stage: "tesseract",
      };
    }

    const rec = await worker.recognize(png);
    const ocrText = String(rec?.data?.text || "");

    const lines = splitOcrTextIntoLines(ocrText);
    const currency = inferCurrency(extraction.rawText || "");
    const parse = buildParseFromOcrLines(lines, currency);
    if (!parse) {
      return {
        replacements: [],
        warnings: ["OCR fallback ran but did not yield parseable line items."],
        stage: "tesseract",
      };
    }

    return {
      replacements: [],
      parse,
      warnings: parse.warnings,
      stage: "tesseract",
    };
  } catch (err: any) {
    return {
      replacements: [],
      warnings: [`OCR fallback failed: ${formatErr(err)}. Structured parser output retained.`],
      stage: "tesseract",
    };
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}
