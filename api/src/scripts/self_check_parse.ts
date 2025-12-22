import path from "path";
import { parseSupplierPdf } from "../services/pdf/parseSupplier";

(async () => {
  // Skip test if ML_URL is not configured (e.g., in CI without ML service)
  const ML_URL = process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "";
  if (!ML_URL) {
    console.log("[parse-smoke] SKIP - ML_URL not configured, skipping PDF parse test");
    process.exit(0);
  }

  const smoke = process.env.PARSE_SMOKE_PDF || "fixtures/smoke_supplier_quote.pdf";
  const file = path.isAbsolute(smoke) ? smoke : path.join(process.cwd(), smoke);
  const out = await parseSupplierPdf(file, { ocrEnabled: true, llmEnabled: false });
  if (!out?.lines?.length) throw new Error("Smoke parse produced no lines");
  console.log("[parse-smoke] OK", { lines: out.lines.length, stages: out.stages });
})().catch((e) => {
  console.error("[parse-smoke] FAIL", e);
  process.exit(1);
});
