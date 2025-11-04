import type { SupplierParseResult } from "../../types/parse";
import { extractStructuredText } from "./extract";
import { buildSupplierParse } from "./parser";
import { runOcrFallback } from "./ocrFallback";
import { combineWarnings, summariseConfidence } from "./normalize";

export async function fallbackParseSupplierPdf(buffer: Buffer): Promise<SupplierParseResult> {
  const extraction = extractStructuredText(buffer);
  const { result: structuredResult, metadata } = buildSupplierParse(extraction);

  const warnings = new Set<string>();
  if (structuredResult.warnings) structuredResult.warnings.forEach((w) => warnings.add(w));
  if (metadata.warnings) metadata.warnings.forEach((w) => warnings.add(w));

  let finalLines = structuredResult.lines.map((line) => ({ ...line }));
  let stageUsed: "structured" | "ocr" = "structured";

  if (metadata.lowConfidence) {
    const ocr = await runOcrFallback(buffer, extraction);
    if (ocr) {
      if (ocr.warnings) ocr.warnings.forEach((w) => warnings.add(w));
      if (ocr.replacements.length) {
        const replacementsByRow = new Map(ocr.replacements.map((item) => [item.rowIndex, item]));
        finalLines = finalLines.map((line, index) => {
          const region = metadata.lineRegions[index];
          if (!region) return line;
          const replacement = replacementsByRow.get(region.rowIndex);
          if (!replacement) return line;
          return { ...line, description: replacement.description };
        });
        stageUsed = ocr.stage === "tesseract" ? "ocr" : stageUsed;
      }
    }
  }

  const result: SupplierParseResult = {
    ...structuredResult,
    lines: finalLines,
    warnings: undefined,
    confidence: summariseConfidence(finalLines),
  };

  const combined = combineWarnings(structuredResult.warnings, metadata.warnings, Array.from(warnings));
  if (combined?.length) {
    result.warnings = combined;
  }

  const stageNote =
    stageUsed === "ocr"
      ? "Structured parser augmented with OCR replacements."
      : "Structured parser used without OCR augmentation.";
  if (result.warnings) result.warnings.push(stageNote);
  else result.warnings = [stageNote];

  return result;
}
