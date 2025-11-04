import type { ExtractionSummary } from "./extract";
import { cleanText, scoreAlphaNumericQuality } from "./normalize";

export interface OcrReplacement {
  rowIndex: number;
  description: string;
  quality: number;
}

export interface OcrFallbackResult {
  replacements: OcrReplacement[];
  warnings?: string[];
  stage: "tesseract" | "unavailable";
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

  // Placeholder implementation: when OCR is available we run it against joined lines to salvage descriptions.
  // We confine OCR usage to cases where structured extraction produced low quality descriptions.
  const targetRows = extraction.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.quality < 0.45 && /[0-9]/.test(row.normalized));

  if (!targetRows.length) {
    return {
      replacements: [],
      warnings: ["OCR fallback skipped: structured extraction already high confidence."],
      stage: "unavailable",
    };
  }

  const worker = await tesseract.createWorker({
    logger: undefined,
  });

  try {
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const replacements: OcrReplacement[] = [];
    for (const { row, index } of targetRows) {
      const text = await worker.recognize(row.normalized);
      const candidate = cleanText(text.data?.text || "");
      if (!candidate) continue;
      const quality = scoreAlphaNumericQuality(candidate);
      if (quality <= row.quality) continue;
      replacements.push({ rowIndex: index, description: candidate, quality });
    }

    await worker.terminate();

    if (!replacements.length) {
      return {
        replacements: [],
        warnings: ["OCR fallback produced no higher-confidence replacements."],
        stage: "tesseract",
      };
    }

    return { replacements, stage: "tesseract" };
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
