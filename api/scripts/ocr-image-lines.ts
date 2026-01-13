import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const filePath = args[0];
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : undefined;
  return { filePath, outPath };
}

function cleanText(input: string): string {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitIntoLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n+/g)
    .map((ln) => cleanText(ln))
    .filter(Boolean);
}

function parseTsvWords(tsv: string): Array<{
  text: string;
  confidence: number | null;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  page: number;
  block: number;
  line: number;
}> {
  const out: Array<{
    text: string;
    confidence: number | null;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    page: number;
    block: number;
    line: number;
  }> = [];

  const rows = String(tsv || "").split(/\r?\n/g);
  // header: level page_num block_num par_num line_num word_num left top width height conf text
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    const cols = row.split("\t");
    if (cols.length < 12) continue;
    const level = Number(cols[0]);
    // word-level rows are level 5 in tesseract TSV output
    if (level !== 5) continue;

    const page = Number(cols[1]);
    const block = Number(cols[2]);
    const line = Number(cols[4]);
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    const confRaw = Number(cols[10]);
    const text = cleanText(cols.slice(11).join("\t"));
    if (!text) continue;
    if (![left, top, width, height].every((n) => Number.isFinite(n))) continue;

    out.push({
      text,
      confidence: Number.isFinite(confRaw) ? confRaw : null,
      bbox: { x0: left, y0: top, x1: left + width, y1: top + height },
      page: Number.isFinite(page) ? page : 0,
      block: Number.isFinite(block) ? block : 0,
      line: Number.isFinite(line) ? line : 0,
    });
  }
  return out;
}

async function main() {
  const { filePath, outPath } = parseArgs(process.argv);
  if (!filePath) {
    console.error("Usage: pnpm --silent tsx scripts/ocr-image-lines.ts <path-to-image> [--out <path-to-json>]");
    process.exit(2);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tesseract = require("tesseract.js");
  if (!tesseract?.createWorker) {
    console.error("tesseract.js createWorker missing");
    process.exit(2);
  }

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  let img = await fs.promises.readFile(abs);

  const crop = (() => {
    const raw = String(process.env.OCR_CROP ?? "").trim();
    if (!raw) return null;
    const parts = raw.split(/[,\s]+/g).map((p) => Number(p));
    if (parts.length !== 4) return null;
    const [left, top, width, height] = parts;
    if (![left, top, width, height].every((n) => Number.isFinite(n) && n >= 0)) return null;
    if (width <= 0 || height <= 0) return null;
    return { left: Math.floor(left), top: Math.floor(top), width: Math.floor(width), height: Math.floor(height) };
  })();

  const resizeWidth = (() => {
    const raw = Number(process.env.OCR_RESIZE_WIDTH);
    if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return null;
  })();

  const preprocess = String(process.env.OCR_PREPROCESS ?? "true").toLowerCase() !== "false";
  const threshold = (() => {
    const raw = Number(process.env.OCR_THRESHOLD);
    if (Number.isFinite(raw) && raw > 0 && raw < 256) return Math.floor(raw);
    return undefined;
  })();
  if (preprocess) {
    let pipeline = sharp(img);
    if (crop) {
      pipeline = pipeline.extract(crop);
    }
    if (resizeWidth) {
      pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: false });
    }
    pipeline = pipeline.grayscale().normalize().sharpen();
    if (typeof threshold === "number") {
      pipeline = pipeline.threshold(threshold);
    }
    img = await pipeline.toBuffer();
  }

  const enableLogs = String(process.env.TESSERACT_LOGS ?? "false").toLowerCase() === "true";
  const psm = (() => {
    const raw = Number(process.env.OCR_PSM);
    if (Number.isFinite(raw) && raw >= 0 && raw <= 13) return String(Math.floor(raw));
    return "6";
  })();

  const worker = await tesseract.createWorker("eng", undefined, {
    logger: enableLogs ? (m: any) => console.log("[tesseract]", m) : () => {},
    errorHandler: () => {},
  });

  try {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: "1",
      });
    } catch {}

    const includeWords = String(process.env.OCR_INCLUDE_WORDS ?? "false").toLowerCase() === "true";
    const rec: any = await worker.recognize(
      img,
      includeWords
        ? {
            tessjs_create_tsv: "1",
            tessjs_create_hocr: "1",
          }
        : undefined,
    );
    const dataKeys = Object.keys(rec?.data || {});
    const text = String(rec?.data?.text || "");
    const lines = splitIntoLines(text);

    const tsv = includeWords ? String(rec?.data?.tsv || "") : "";
    const debugTsv = String(process.env.OCR_DEBUG_TSV ?? "false").toLowerCase() === "true";
    const tsvHead = debugTsv
      ? tsv
          .split(/\r?\n/g)
          .slice(0, 25)
          .join("\n")
      : undefined;
    const wordsRaw = includeWords ? parseTsvWords(tsv) : [];
    const maxWords = (() => {
      const raw = Number(process.env.OCR_MAX_WORDS);
      if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
      return 1500;
    })();
    const words = Array.isArray(wordsRaw) ? wordsRaw.slice(0, maxWords) : [];

      const blocksPreview = includeWords
        ? {
            blocksType: typeof rec?.data?.blocks,
            layoutBlocksType: typeof rec?.data?.layoutBlocks,
            blocksSample: Array.isArray(rec?.data?.blocks) ? rec.data.blocks.slice(0, 2) : undefined,
            layoutBlocksSample: Array.isArray(rec?.data?.layoutBlocks)
              ? rec.data.layoutBlocks.slice(0, 2)
              : undefined,
          }
        : undefined;

    const payload = {
      file: abs,
      psm,
      preprocess,
      threshold: threshold ?? null,
      dataKeys,
      tsvHead,
        blocksPreview,
      chars: text.length,
      lineCount: lines.length,
      lines,
      words: includeWords ? words : undefined,
    };

    if (outPath) {
      const absOut = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath);
      await fs.promises.mkdir(path.dirname(absOut), { recursive: true });
      await fs.promises.writeFile(absOut, JSON.stringify(payload, null, 2));
      console.log(JSON.stringify({ wrote: absOut, lineCount: lines.length, wordCount: words.length }, null, 2));
      return;
    }

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
