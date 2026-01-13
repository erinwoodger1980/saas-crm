import fs from "node:fs";
import path from "node:path";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: pnpm tsx api/scripts/debug-pdf-rows.ts <path-to-pdf>");
    process.exit(2);
  }

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const buf = await fs.promises.readFile(abs);

  const { extractStructuredText } = await import("../src/lib/pdf/extract");
  const extracted = await extractStructuredText(buf);

  console.log(JSON.stringify({
    file: abs,
    pages: extracted.pages,
    rows: extracted.rows.length,
    sample: extracted.rows.slice(0, 60),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
