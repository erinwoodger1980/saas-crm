import fs from "fs";
import path from "path";
import assert from "assert";
async function main() {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key";
  const file = path.join(__dirname, "../fixtures/supplier-sample.pdf");
  const buffer = await fs.promises.readFile(file);
  const { parseSupplierPdf } = await import("../src/lib/supplier/parse");
  const parsed = await parseSupplierPdf(buffer, { supplierHint: "Acme Joinery", currencyHint: "GBP" });

  assert(parsed.lines.length >= 2, "Expected at least two lines");

  const product = parsed.lines.find((ln) => /oak door/i.test(ln.description));
  assert(product, "Expected Oak Door line");
  assert(Math.abs((product.qty ?? 0) - 1) < 0.01, "Oak Door quantity should be 1");
  assert(Math.abs((product.lineTotal ?? 0) - 4321.86) < 1, "Oak Door total ≈ 4321.86");

  const delivery = parsed.lines.find((ln) => /delivery/i.test(ln.description));
  assert(delivery, "Expected delivery line");
  assert(Math.abs((delivery.lineTotal ?? 0) - 990.01) < 1, "Delivery total ≈ 990.01");

  assert(parsed.detected_totals?.estimated_total, "Expected estimated total");
  assert(Math.abs((parsed.detected_totals?.estimated_total ?? 0) - 5311.87) < 1, "Estimated total ≈ 5311.87");

  const gibberish = /[a-z]{4,}/i.test(product.description);
  assert(gibberish, "Product description should contain words");

  console.log("✅ Supplier parser test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
