import path from "path";
import { parseSupplierPdf } from "../services/pdf/parseSupplier";
import { qualityScore } from "../services/pdf/textExtract";

(async () => {
  const smoke = process.env.PARSE_SMOKE_PDF || "fixtures/smoke_supplier_quote.pdf";
  const file = path.isAbsolute(smoke) ? smoke : path.join(process.cwd(), "api", smoke);
  const out = await parseSupplierPdf(file, { ocrEnabled: true, llmEnabled: false, maxPages: 2 });
  if (!out?.lines?.length) throw new Error("Smoke parse produced no lines");
  const sample = out.lines.slice(0, 50).join(" ");
  const q = qualityScore(sample);
  if (!q.ok) throw new Error(`Low quality parse: ${JSON.stringify(q)}`);
  console.log("[parse-smoke] OK", { lines: out.lines.length, stages: out.stages, q });
})().catch((e) => {
  console.error("[parse-smoke] FAIL", e);
  process.exit(1);
});
