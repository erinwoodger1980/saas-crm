// api/src/services/pdf/parseSupplier.ts
import { callMlWithUpload, normaliseMlPayload } from "../../lib/ml";
import type { SupplierParseResult } from "../../types/parse";
import fs from "fs";
import path from "path";

export type ParseResult = { lines: string[]; stages?: string[] };

/**
 * Parse a supplier PDF using the ML service.
 * This is the real implementation that calls the deployed ML parser.
 */
export async function parseSupplierPdf(
  filePath: string,
  opts: { ocrEnabled?: boolean; llmEnabled?: boolean } = {}
): Promise<ParseResult> {
  const isProd = process.env.NODE_ENV === "production";
  const ML_URL = process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "";
  
  // Fail fast in production if ML service is not configured
  if (isProd && (!ML_URL || ML_URL.includes("localhost") || ML_URL.includes("127.0.0.1"))) {
    throw new Error("ML_URL must be configured with a production URL (not localhost) in production environment");
  }
  
  if (!ML_URL) {
    throw new Error("ML_URL environment variable is not set - ML parsing service is not configured");
  }

  try {
    // Read the PDF file
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`);
    }
    
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    
    // Call ML service to parse the PDF
    const result = await callMlWithUpload({
      buffer,
      filename,
      timeoutMs: 25000,
      headers: {
        "X-OCR-Enabled": opts.ocrEnabled ? "true" : "false",
        "X-LLM-Enabled": opts.llmEnabled ? "true" : "false",
      },
    });
    
    if (!result.ok) {
      throw new Error(`ML parsing failed: ${result.error}${result.detail ? " - " + JSON.stringify(result.detail) : ""}`);
    }
    
    // Normalize the ML response
    const parsed = normaliseMlPayload(result.data);
    
    // Convert to the expected ParseResult format
    const lines = parsed.lines.map((ln: SupplierParseResult['lines'][number]) => {
      const parts = [];
      if (ln.description) parts.push(ln.description);
      if (ln.qty) parts.push(`Qty: ${ln.qty}`);
      if (ln.costUnit) parts.push(`Unit: £${ln.costUnit}`);
      if (ln.lineTotal) parts.push(`Total: £${ln.lineTotal}`);
      return parts.join(" | ");
    });
    
    const stages = parsed.usedStages || ["ml_parse"];
    
    return { lines, stages };
  } catch (err: any) {
    console.error(`[parseSupplierPdf] Failed to parse ${filePath}:`, err?.message || err);
    throw err;
  }
}
