import fs from "node:fs";
import path from "node:path";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const filePath = args[0];
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const modeIdx = args.indexOf("--mode");
  const mode = modeIdx >= 0 ? (args[modeIdx + 1] as string | undefined) : undefined;
  return { filePath, outPath, mode };
}

async function main() {
  const { filePath, outPath, mode } = parseArgs(process.argv);
  if (!filePath) {
    console.error(
      "Usage: pnpm --silent tsx scripts/ocr-pdf-lines.ts <path-to-pdf> [--out <path-to-json>] [--mode json|text]",
    );
    process.exit(2);
  }

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const buf = await fs.promises.readFile(abs);

  const { extractStructuredText } = await import("../src/lib/pdf/extract");
  const { ocrPdfToLines } = await import("../src/lib/pdf/ocrFallback");

  const extracted = await extractStructuredText(buf);
  const hasTextLayer = (extracted?.rows?.length ?? 0) > 0 || String(extracted?.rawText ?? "").trim().length > 0;

  let result:
    | {
        file: string;
        source: "text-layer";
        pages: number;
        rows: number;
        lines: string[];
      }
    | {
        file: string;
        source: "ocr";
        pages: number;
        rows: number;
        lines: string[];
        meta: unknown;
      };

  if (hasTextLayer) {
    const lines = (extracted.rows || [])
      .map((r: any) => String(r?.normalized || r?.text || "").trim())
      .filter(Boolean);

    result = {
      file: abs,
      source: "text-layer",
      pages: extracted.pages,
      rows: extracted.rows.length,
      lines,
    };
  } else {
    const ocr = await ocrPdfToLines(buf);
    result = {
      file: abs,
      source: "ocr",
      pages: extracted.pages,
      rows: extracted.rows.length,
      lines: ocr.lines,
      meta: {
        pagesAttempted: ocr.pagesAttempted,
        rendererUsed: ocr.rendererUsed,
        renderErrors: ocr.renderErrors,
        warnings: ocr.warnings,
        tookMs: ocr.tookMs,
        stage: ocr.stage,
      },
    };
  }

  const outputMode = (mode || (outPath ? "json" : "text")).toLowerCase();

  if (outPath) {
    const absOut = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath);
    await fs.promises.mkdir(path.dirname(absOut), { recursive: true });
    await fs.promises.writeFile(absOut, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ wrote: absOut, lineCount: result.lines.length, source: result.source }, null, 2));
    return;
  }

  if (outputMode === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // text
  console.log(`# ${result.source} lines for ${abs}`);
  for (const ln of result.lines) console.log(ln);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
