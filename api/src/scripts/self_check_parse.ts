import path from "path";
import { parseSupplierPdf } from "../services/pdf/parseSupplier";

(async () => {
  const smoke = process.env.PARSE_SMOKE_PDF || "fixtures/smoke_supplier_quote.pdf";
  const file = path.isAbsolute(smoke) ? smoke : path.join(process.cwd(), "api", smoke);
  const out = await parseSupplierPdf(file, { ocrEnabled: true, llmEnabled: false });
  if (!out?.lines?.length) throw new Error("Smoke parse produced no lines");
  console.log("[parse-smoke] OK", { lines: out.lines.length, stages: out.stages });
})().catch((e) => {
  console.error("[parse-smoke] FAIL", e);
  process.exit(1);
});
