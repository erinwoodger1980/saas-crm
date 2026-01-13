import type { ExtractionSummary } from "./extract";
import type { SupplierParseResult } from "../../types/parse";
import { cleanText, inferCurrency, parseMoney } from "./normalize";
import { assessDescriptionQuality } from "./quality";
import sharp from "sharp";

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
  const needsHelp = extraction.rows.some((row) => row.quality < 0.55);
  if (!needsHelp) {
    return {
      replacements: [],
      warnings: ["OCR fallback skipped: structured extraction already high confidence."],
      stage: "unavailable",
    };
  }

  const worker = await tesseract.createWorker({ logger: undefined });

  try {
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    // Render the first page to an image and OCR that.
    // This avoids the "OCR the already-garbled text" problem and works for scanned PDFs.
    let ocrText = "";
    try {
      const png = await sharp(_buffer, { density: 220 })
        .png({ quality: 90 })
        .toBuffer();
      const rec = await worker.recognize(png);
      ocrText = String(rec?.data?.text || "");
    } catch (e: any) {
      // If sharp can't render PDFs in this environment, we can't do local OCR.
      return {
        replacements: [],
        warnings: [
          `OCR fallback unavailable: PDF rendering failed (${e?.message || e}).`,
        ],
        stage: "tesseract",
      };
    }

    await worker.terminate();

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
    try {
      await worker.terminate();
    } catch {}
    return {
      replacements: [],
      warnings: [
        `OCR fallback failed: ${err?.message || err}. Structured parser output retained.`,
      ],
      stage: "tesseract",
    };
  }
}
