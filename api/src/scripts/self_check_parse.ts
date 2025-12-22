import path from "path";
import { parseSupplierPdf } from "../services/pdf/parseSupplier";
import fs from "fs";

(async () => {
  // Skip test if ML_URL is not configured (e.g., in CI without ML service)
  const ML_URL = process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "";
  if (!ML_URL) {
    console.log("[parse-smoke] SKIP - ML_URL not configured, skipping PDF parse test");
    process.exit(0);
  }

  // Look for test PDF in multiple possible locations
  const smoke = process.env.PARSE_SMOKE_PDF || "fixtures/smoke_supplier_quote.pdf";
  const possiblePaths = [
    path.isAbsolute(smoke) ? smoke : null,
    path.join(process.cwd(), smoke),
    path.join(process.cwd(), "api", smoke),
    path.join(__dirname, "..", "..", smoke),
    // Fallback to supplier-sample.pdf if smoke file doesn't exist
    path.join(process.cwd(), "fixtures/supplier-sample.pdf"),
    path.join(process.cwd(), "api/fixtures/supplier-sample.pdf"),
  ].filter(Boolean) as string[];

  let file: string | null = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      file = testPath;
      break;
    }
  }

  if (!file) {
    console.log("[parse-smoke] SKIP - No test PDF found, skipping smoke test");
    process.exit(0);
  }

  console.log(`[parse-smoke] Testing with: ${file}`);
  const out = await parseSupplierPdf(file, { ocrEnabled: true, llmEnabled: false });
  if (!out?.lines?.length) throw new Error("Smoke parse produced no lines");
  console.log("[parse-smoke] OK", { lines: out.lines.length, stages: out.stages });
})().catch((e) => {
  console.error("[parse-smoke] FAIL", e);
  process.exit(1);
});
