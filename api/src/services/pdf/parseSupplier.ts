import path from "path";
import { extractWithPdfjs, qualityScore } from "./textExtract";
import { ocrImageBuffers } from "./ocr";

export type Parsed = { lines: string[]; stages: string[]; meta?: any };

type Options = { ocrEnabled?: boolean; llmEnabled?: boolean; maxPages?: number };

function shouldEnableOcr(explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  const envValue =
    process.env.OCR_ENABLED ??
    process.env.PARSER_OCR_ENABLED ??
    process.env.PARSER_OCR ??
    process.env.PARSER_ENABLE_OCR;
  if (envValue == null) return true;
  return String(envValue).toLowerCase() !== "false";
}

async function rasterizePageToPng(filePath: string, pageNum: number, scale = 2): Promise<Buffer> {
  const normalized = filePath.replace(/\\/g, "/");
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style><div id="host"></div><script type="module">
    import * as pdfjs from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/legacy/build/pdf.mjs';
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.js';
    const url = ${JSON.stringify(`file://${normalized}`)};
    const pdf = await pdfjs.getDocument({url, isEvalSupported:false}).promise;
    const page = await pdf.getPage(${pageNum});
    const op = await page.getOperatorList();
    const svgGfx = new pdfjs.SVGGraphics(page.commonObjs, page.objs);
    const svg = await svgGfx.getSVG(op, page.getViewport({scale:${scale}}));
    document.body.appendChild(svg);
  </script>`;

  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = (await page.screenshot({ fullPage: true })) as Buffer;
    return buf;
  } finally {
    await browser.close();
  }
}

export async function parseSupplierPdf(filePath: string, opts: Options = {}): Promise<Parsed> {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const stages: string[] = [];

  const pages = await extractWithPdfjs(resolved, opts.maxPages);
  stages.push("pdfjs-text");

  const results: string[] = [];

  for (const page of pages) {
    const quality = qualityScore(page.raw);
    if (quality.ok) {
      results.push(page.raw);
      continue;
    }

    if (!shouldEnableOcr(opts.ocrEnabled)) {
      results.push(page.raw);
      continue;
    }

    stages.push(`ocr-page-${page.page}`);
    const raster = await rasterizePageToPng(resolved, page.page, 2);
    const text = await ocrImageBuffers([raster], process.env.TESSERACT_LANG || "eng");
    results.push(text.trim() ? text : page.raw);
  }

  const lines = results
    .join("\n\n")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return { lines, stages, meta: { pages: pages.length } };
}
