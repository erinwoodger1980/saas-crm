import type { ExtractionSummary } from "./extract";
import type { SupplierParseResult } from "../../types/parse";
import { cleanText, inferCurrency, parseMoney } from "./normalize";
import { assessDescriptionQuality } from "./quality";
import sharp from "sharp";
import crypto from "crypto";
import os from "os";
import path from "path";
import fs from "fs";

export interface OcrReplacement {
  rowIndex: number;
  description: string;
  quality: number;
}

export interface OcrFallbackResult {
  replacements: OcrReplacement[];
  parse?: SupplierParseResult;
  warnings?: string[];
  stage: "tesseract" | "unavailable";
}

export interface OcrLinesResult {
  lines: string[];
  pagesAttempted: number;
  rendererUsed: "sharp" | "puppeteer" | null;
  renderErrors: string[];
  warnings: string[];
  tookMs: number;
  stage: "tesseract" | "unavailable";
}

function formatErr(err: any): string {
  return String(err?.message || err || "unknown_error");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

async function downscalePngForOcr(png: Buffer): Promise<Buffer> {
  const maxPixels = (() => {
    const raw = Number(process.env.OCR_MAX_PIXELS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    // Keep under ~3MP to avoid OOM/slow OCR on small instances.
    return 3_000_000;
  })();
  const maxWidth = (() => {
    const raw = Number(process.env.OCR_MAX_WIDTH);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return 1800;
  })();

  try {
    const meta = await sharp(png).metadata();
    const w = Number(meta.width || 0);
    const h = Number(meta.height || 0);
    if (!w || !h) return png;

    const pixels = w * h;
    const needsDownscale = pixels > maxPixels || w > maxWidth;
    const base = sharp(png).grayscale().normalize().sharpen();
    if (!needsDownscale) {
      return base.toBuffer();
    }

    // Scale to satisfy both pixel and width caps.
    const scaleByPixels = Math.sqrt(maxPixels / pixels);
    const scaleByWidth = maxWidth / w;
    const scale = Math.min(1, scaleByPixels, scaleByWidth);
    const newW = Math.max(1, Math.floor(w * scale));

    return base
      .resize({ width: newW, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  } catch {
    // Best-effort only.
    return png;
  }
}

async function renderPdfPageToPngViaSharp(pdfBuffer: Buffer, pageIndex: number, density: number): Promise<Buffer> {
  // sharp supports selecting a single page of a PDF via the `page` option.
  // If pageIndex is out of range it will throw.
  return sharp(pdfBuffer, { density, page: pageIndex }).png({ quality: 85 }).toBuffer();
}

async function renderPdfFirstPageToPngViaPuppeteer(pdfBuffer: Buffer): Promise<Buffer> {
  // Dynamically load puppeteer + chromium fallback to avoid hard crashes if dependencies differ by env.
  let puppeteer: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    puppeteer = require("puppeteer");
  } catch (e: any) {
    throw new Error(`puppeteer_missing: ${formatErr(e)}`);
  }

  const tmpDir = os.tmpdir();
  const tmpName = `ocr-${crypto.randomBytes(8).toString("hex")}.pdf`;
  const tmpPath = path.join(tmpDir, tmpName);

  await fs.promises.writeFile(tmpPath, pdfBuffer);

  let browser: any;
  try {
    const viewport = {
      width: (() => {
        const raw = Number(process.env.OCR_VIEWPORT_WIDTH);
        if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
        return 1200;
      })(),
      height: (() => {
        const raw = Number(process.env.OCR_VIEWPORT_HEIGHT);
        if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
        return 1600;
      })(),
      deviceScaleFactor: (() => {
        const raw = Number(process.env.OCR_DEVICE_SCALE);
        if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(4, raw));
        return 1;
      })(),
    };
    const resolvedExec = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
    const execPath = resolvedExec || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: viewport,
    });
  } catch (firstErr: any) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chromium = require("@sparticuz/chromium");
    const viewport = chromium.defaultViewport ?? { width: 1200, height: 1600, deviceScaleFactor: 1 };
    const execPath2 = await chromium.executablePath();
    browser = await puppeteer.launch({
      headless: chromium.headless !== undefined ? chromium.headless : true,
      executablePath: execPath2,
      args: chromium.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: viewport,
    });
  }

  try {
    const page = await browser.newPage();
    const fileUrl = `file://${tmpPath}`;

    try {
      await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 15000 });
    } catch {
      await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    }

    // Give the PDF viewer a moment to paint.
    const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // Puppeteer versions differ; avoid relying on waitForTimeout.
    if (typeof page.waitForTimeout === "function") {
      await page.waitForTimeout(800);
    } else if (typeof page.waitFor === "function") {
      // Older Puppeteer.
      await page.waitFor(800);
    } else {
      await sleep(800);
    }
    // NOTE: Do NOT use fullPage for PDFs; it can generate extremely tall images
    // (multiple pages in a single scroll) which can OOM-kill small instances.
    await page.evaluate(() => {
      try {
        window.scrollTo(0, 0);
      } catch {}
    });

    // Optional zoom: can significantly improve OCR on scanned cutlists.
    const zoom = Number(process.env.OCR_PUPPETEER_ZOOM);
    if (Number.isFinite(zoom) && zoom > 1) {
      await page.evaluate((z: number) => {
        try {
          (document.body as any).style.zoom = String(z);
        } catch {}
      }, zoom);
      const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(250);
    }

    const png = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(png);
  } finally {
    try {
      await browser.close();
    } catch {}
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
  }
}

function splitOcrTextIntoLines(text: string): string[] {
  return String(text || "")
    .split(/\r?\n+/g)
    .map((ln) => cleanText(ln))
    .map((ln) => ln.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function buildParseFromOcrLines(lines: string[], currencyHint?: string): SupplierParseResult | null {
  const parsedLines: SupplierParseResult["lines"] = [];

  const shouldSkip = (text: string): boolean => {
    const lower = text.toLowerCase();
    // Boilerplate / headers / carry-forward lines that frequently OCR well but aren't items.
    if (/(date of quotation|quotation date|validity|terms|conditions|lead time|order confirmation)/i.test(lower)) return true;
    if (/(carried forward|brought forward)/i.test(lower)) return true;
    // Totals and page references are handled elsewhere too, but be safe.
    if (/\b(subtotal|total|grand total|vat|tax|page)\b/i.test(lower)) return true;
    return false;
  };

  const isLikelyDeliveryLine = (text: string): boolean => {
    const lower = text.toLowerCase();
    return /(\bdelivery\b|\bcarriage\b|\bshipping\b|\bfreight\b|\bcourier\b|\btransport\b)/i.test(lower);
  };

  for (const raw of lines) {
    const line = cleanText(raw);
    if (!line || line.length < 6) continue;

    if (shouldSkip(line)) continue;

    // Require something money-like, otherwise OCR output is too noisy (dates, weights, etc).
    // Exception: delivery/carriage lines are useful even when OCR drops currency symbols/decimals.
    const hasCurrencySymbol = /[£€$]/.test(line);
    const hasDecimalMoney = /\b\d{1,6}\.\d{2}\b/.test(line);
    const deliveryLike = isLikelyDeliveryLine(line);
    if (!deliveryLike && !hasCurrencySymbol && !hasDecimalMoney) continue;

    // Heuristic: keep only lines that look like items with at least one numeric
    if (!/[0-9]/.test(line)) continue;
    if (/\b(subtotal|total|grand total|vat|tax|page)\b/i.test(line)) continue;

    // Try to interpret trailing monetary columns.
    const numbers = (line.match(/[-+]?\d[\d,]*\.?\d*/g) || [])
      .map((t) => parseMoney(t))
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (!numbers.length) continue;

    const lineTotal = numbers[numbers.length - 1];
    const maybeCostUnit = numbers.length >= 2 ? numbers[numbers.length - 2] : undefined;

    // Extract qty as the first small-ish integer-ish number in the line.
    // For delivery/carriage style lines, OCR often returns only a single amount;
    // treat that as a single-quantity line item.
    let qty: number | undefined;
    if (deliveryLike && numbers.length === 1) {
      qty = 1;
    } else {
      for (const n of numbers) {
        const asInt = Math.round(n);
        if (Math.abs(n - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
          qty = asInt;
          break;
        }
      }
    }

    const derivedCostUnit =
      typeof qty === "number" && qty > 0 && typeof lineTotal === "number" && lineTotal > 0
        ? lineTotal / qty
        : undefined;

    const normaliseMoneyCandidate = (candidate: number | undefined): number | undefined => {
      if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) return undefined;
      // If candidate is wildly large, OCR likely dropped a decimal (e.g. 168068 for 1680.68).
      // Try dividing by 100 and check whether it agrees with derivedCostUnit.
      if (candidate >= 10_000 && derivedCostUnit && derivedCostUnit > 0) {
        const scaled = candidate / 100;
        const rel = Math.abs(scaled - derivedCostUnit) / derivedCostUnit;
        if (Number.isFinite(rel) && rel < 0.06) return Math.round(scaled * 100) / 100;
      }
      return candidate;
    };

    // Description: take the prefix before the first number token.
    const firstNumIdx = line.search(/[-+]?\d/);
    const description = cleanText(firstNumIdx > 0 ? line.slice(0, firstNumIdx) : line)
      .replace(/[|]+/g, " ")
      .trim();

    const quality = assessDescriptionQuality(description);
    if (quality.gibberish || quality.score < 0.55) continue;

    let costUnit = normaliseMoneyCandidate(typeof maybeCostUnit === "number" ? maybeCostUnit : undefined);
    // If costUnit still looks implausible, fall back to derivedCostUnit.
    if (derivedCostUnit && derivedCostUnit > 0 && derivedCostUnit < 100_000) {
      const roundedDerived = Math.round(derivedCostUnit * 100) / 100;
      if (!costUnit) {
        costUnit = roundedDerived;
      } else {
        const rel = Math.abs(costUnit - derivedCostUnit) / derivedCostUnit;
        if (Number.isFinite(rel) && rel > 0.25) {
          costUnit = roundedDerived;
        }
      }
    }

    parsedLines.push({
      description,
      qty,
      costUnit,
      lineTotal: typeof lineTotal === "number" && lineTotal > 0 ? Math.round(lineTotal * 100) / 100 : undefined,
    });
  }

  if (parsedLines.length < 1) return null;

  return {
    currency: currencyHint || "GBP",
    lines: parsedLines,
    confidence: Math.min(0.9, 0.4 + parsedLines.length * 0.03),
    warnings: ["OCR fallback used (local tesseract)"]
  };
}

export async function runOcrFallback(
  buffer: Buffer,
  extraction: ExtractionSummary,
): Promise<OcrFallbackResult | null> {
  const ocrStartedAt = Date.now();
  let tesseract: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    tesseract = require("tesseract.js");
  } catch {
    return {
      replacements: [],
      warnings: [
        "OCR fallback unavailable: tesseract.js dependency is not installed in this environment.",
      ],
      stage: "unavailable",
    };
  }

  if (!tesseract?.createWorker) {
    return {
      replacements: [],
      warnings: ["OCR fallback unavailable: tesseract.js worker factory missing."],
      stage: "unavailable",
    };
  }

  // Only attempt OCR when structured extraction looks poor.
  // Note: some garbled PDFs still look "alphanumeric" (e.g. UUUUUU...) so we add entropy checks.
  const sampleRows = extraction.rows.slice(0, 40);
  const rowNeedsHelp = sampleRows.some((row) => {
    const text = String(row.normalized || row.text || "");
    if (!text) return false;
    const q = assessDescriptionQuality(text);
    return q.gibberish || q.score < 0.6 || q.dominantCharRatio > 0.6;
  });
  const rawSample = String(extraction.rawText || "").slice(0, 4000);
  const overall = assessDescriptionQuality(rawSample);
  const needsHelp = rowNeedsHelp || overall.gibberish || overall.score < 0.6 || overall.dominantCharRatio > 0.6;
  if (!needsHelp) {
    return {
      replacements: [],
      warnings: ["OCR fallback skipped: structured extraction already high confidence."],
      stage: "unavailable",
    };
  }

  let worker: any;
  try {
    // tesseract.js v7: createWorker(langs='eng', oem?, options?, config?)
    // Passing an options object as the first arg will crash (langsArr.map is not a function).
    const enableTesseractLogs =
      String(process.env.TESSERACT_LOGS ?? "false").toLowerCase() === "true";
    worker = await tesseract.createWorker("eng", undefined, {
      // Must be a function if provided; tesseract.js calls it directly.
      logger: enableTesseractLogs ? (m: any) => console.log("[tesseract]", m) : () => {},
      // Ensure library-level errors don't throw uncaught exceptions.
      errorHandler: () => {},
    });
  } catch (err: any) {
    const msg = `OCR fallback unavailable: tesseract worker init failed (${formatErr(err)}).`;
    console.warn("[runOcrFallback]", msg);
    return { replacements: [], warnings: [msg], stage: "tesseract" };
  }

  try {
    // v7 workers come pre-loaded; load/loadLanguage/initialize are not needed.

    const density = (() => {
      const raw = Number(process.env.OCR_RENDER_DENSITY);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 130;
    })();

    const maxPages = (() => {
      const raw = Number(process.env.OCR_MAX_PAGES);
      if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(6, Math.floor(raw)));
      const fallback = Number(process.env.PARSER_MAX_PAGES);
      if (Number.isFinite(fallback) && fallback > 0) return Math.max(1, Math.min(6, Math.floor(fallback)));
      return 2;
    })();

    const maxTotalMs = (() => {
      const raw = Number(process.env.OCR_MAX_TOTAL_MS);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 55_000;
    })();

    const recognizeTimeoutMs = (() => {
      const raw = Number(process.env.OCR_RECOGNIZE_TIMEOUT_MS);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 35_000;
    })();

    const ocrDebug = String(process.env.OCR_DEBUG ?? "false").toLowerCase() === "true";

    console.log("[runOcrFallback] starting", {
      pdfBytes: buffer.length,
      density,
      maxPages,
      maxTotalMs,
      recognizeTimeoutMs,
    });

    // Tesseract configuration tuned for tabular invoices/quotes.
    try {
      await worker.setParameters({
        // PSM 6 = assume a single uniform block of text.
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
        // Helps when rendering density isn't high.
        user_defined_dpi: String(Math.max(200, Math.min(400, Math.floor(density * 2))))
      });
    } catch {}

    const startedAt = Date.now();
    const aggregatedLines: string[] = [];
    const renderErrors: string[] = [];
    let pagesAttempted = 0;
    let rendererUsed: "sharp" | "puppeteer" | null = null;
    let sharpPdfUnsupported = false;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      if (Date.now() - startedAt > maxTotalMs) break;

      let png: Buffer | null = null;
      try {
        if (!sharpPdfUnsupported) {
          png = await renderPdfPageToPngViaSharp(buffer, pageIndex, density);
          rendererUsed = "sharp";
        }
      } catch (e: any) {
        // If sharp can't render beyond page 0, stop trying further pages.
        const msg = formatErr(e);
        renderErrors.push(`sharp[p${pageIndex}]: ${msg}`);
        if (/unsupported image format/i.test(msg)) {
          // Common when sharp/libvips lacks PDF support in this environment.
          sharpPdfUnsupported = true;
        }
        if (pageIndex === 0) {
          try {
            png = await renderPdfFirstPageToPngViaPuppeteer(buffer);
            rendererUsed = "puppeteer";
          } catch (e2: any) {
            renderErrors.push(`puppeteer[p0]: ${formatErr(e2)}`);
          }
        }
      }

      if (!png) {
        // If we fail to render a later page, don't keep looping.
        if (pageIndex > 0) break;
        continue;
      }

      pagesAttempted += 1;
      png = await downscalePngForOcr(png);

      if (ocrDebug) {
        console.log("[runOcrFallback] page rendered", {
          pageIndex,
          renderer: rendererUsed,
          pngBytes: png.length,
          elapsedMs: Date.now() - startedAt,
        });
      }

      const rec: any = await withTimeout<any>(worker.recognize(png), recognizeTimeoutMs, "ocr_timeout");
      const ocrText = String(rec?.data?.text || "");
      const lines = splitOcrTextIntoLines(ocrText);
      aggregatedLines.push(...lines);

      if (ocrDebug) {
        console.log("[runOcrFallback] page OCR complete", {
          pageIndex,
          textChars: ocrText.length,
          addedLines: lines.length,
          totalLines: aggregatedLines.length,
          elapsedMs: Date.now() - startedAt,
        });
      }

      // Early stop once we have enough potentially-parseable lines.
      if (aggregatedLines.length >= 250) break;
    }

    if (!aggregatedLines.length) {
      const msg = `OCR fallback unavailable: no OCR text extracted (${renderErrors.join(" | ") || "unknown"}).`;
      console.warn("[runOcrFallback]", msg);
      return { replacements: [], warnings: [msg], stage: "tesseract" };
    }

    if (rendererUsed) {
      console.log("[runOcrFallback] OCR complete", {
        renderer: rendererUsed,
        pagesAttempted,
        lines: aggregatedLines.length,
        tookMs: Date.now() - startedAt,
      });
    }

    const currency = inferCurrency(extraction.rawText || "");
    const parse = buildParseFromOcrLines(aggregatedLines, currency);
    if (!parse) {
      return {
        replacements: [],
        warnings: ["OCR fallback ran but did not yield parseable line items."],
        stage: "tesseract",
      };
    }

    return {
      replacements: [],
      parse,
      warnings: [
        ...(parse.warnings ?? []),
        `OCR pages scanned: ${pagesAttempted}`,
        `OCR tookMs: ${Date.now() - startedAt}`,
      ],
      stage: "tesseract",
    };
  } catch (err: any) {
    return {
      replacements: [],
      warnings: [`OCR fallback failed: ${formatErr(err)}. Structured parser output retained.`],
      stage: "tesseract",
    };
  } finally {
    try {
      await worker.terminate();
    } catch {}

    console.log("[runOcrFallback] finished", { tookMs: Date.now() - ocrStartedAt });
  }
}

/**
 * OCR a PDF into plain text lines.
 *
 * This is intended for scripts and non-quote OCR use-cases (e.g. cutlists).
 * It shares the same rendering/Tesseract settings and safety caps as `runOcrFallback`.
 */
export async function ocrPdfToLines(buffer: Buffer): Promise<OcrLinesResult> {
  const startedAt = Date.now();

  let tesseract: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    tesseract = require("tesseract.js");
  } catch {
    return {
      lines: [],
      pagesAttempted: 0,
      rendererUsed: null,
      renderErrors: [],
      warnings: ["OCR unavailable: tesseract.js dependency is not installed."],
      tookMs: Date.now() - startedAt,
      stage: "unavailable",
    };
  }

  if (!tesseract?.createWorker) {
    return {
      lines: [],
      pagesAttempted: 0,
      rendererUsed: null,
      renderErrors: [],
      warnings: ["OCR unavailable: tesseract.js worker factory missing."],
      tookMs: Date.now() - startedAt,
      stage: "unavailable",
    };
  }

  let worker: any;
  try {
    const enableTesseractLogs =
      String(process.env.TESSERACT_LOGS ?? "false").toLowerCase() === "true";
    worker = await tesseract.createWorker("eng", undefined, {
      logger: enableTesseractLogs ? (m: any) => console.log("[tesseract]", m) : () => {},
      errorHandler: () => {},
    });
  } catch (err: any) {
    return {
      lines: [],
      pagesAttempted: 0,
      rendererUsed: null,
      renderErrors: [],
      warnings: [`OCR unavailable: tesseract worker init failed (${formatErr(err)}).`],
      tookMs: Date.now() - startedAt,
      stage: "tesseract",
    };
  }

  const density = (() => {
    const raw = Number(process.env.OCR_RENDER_DENSITY);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return 130;
  })();

  const maxPages = (() => {
    const raw = Number(process.env.OCR_MAX_PAGES);
    if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.min(12, Math.floor(raw)));
    const fallback = Number(process.env.PARSER_MAX_PAGES);
    if (Number.isFinite(fallback) && fallback > 0) return Math.max(1, Math.min(12, Math.floor(fallback)));
    return 2;
  })();

  const maxTotalMs = (() => {
    const raw = Number(process.env.OCR_MAX_TOTAL_MS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return 55_000;
  })();

  const recognizeTimeoutMs = (() => {
    const raw = Number(process.env.OCR_RECOGNIZE_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return 35_000;
  })();

  const ocrDebug = String(process.env.OCR_DEBUG ?? "false").toLowerCase() === "true";

  const aggregatedLines: string[] = [];
  const renderErrors: string[] = [];
  let pagesAttempted = 0;
  let rendererUsed: "sharp" | "puppeteer" | null = null;
  let sharpPdfUnsupported = false;

  try {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
        user_defined_dpi: String(Math.max(200, Math.min(400, Math.floor(density * 2)))),
      });
    } catch {}

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      if (Date.now() - startedAt > maxTotalMs) break;

      let png: Buffer | null = null;
      try {
        if (!sharpPdfUnsupported) {
          png = await renderPdfPageToPngViaSharp(buffer, pageIndex, density);
          rendererUsed = "sharp";
        }
      } catch (e: any) {
        const msg = formatErr(e);
        renderErrors.push(`sharp[p${pageIndex}]: ${msg}`);
        if (/unsupported image format/i.test(msg)) {
          sharpPdfUnsupported = true;
        }

        if (pageIndex === 0) {
          try {
            png = await renderPdfFirstPageToPngViaPuppeteer(buffer);
            rendererUsed = "puppeteer";
          } catch (e2: any) {
            renderErrors.push(`puppeteer[p0]: ${formatErr(e2)}`);
          }
        }
      }

      if (!png) {
        if (pageIndex > 0) break;
        continue;
      }

      pagesAttempted += 1;
      png = await downscalePngForOcr(png);

      if (ocrDebug) {
        console.log("[ocrPdfToLines] page rendered", {
          pageIndex,
          renderer: rendererUsed,
          pngBytes: png.length,
          elapsedMs: Date.now() - startedAt,
        });
      }

      const rec: any = await withTimeout<any>(worker.recognize(png), recognizeTimeoutMs, "ocr_timeout");
      const ocrText = String(rec?.data?.text || "");
      const lines = splitOcrTextIntoLines(ocrText);
      aggregatedLines.push(...lines);

      if (ocrDebug) {
        console.log("[ocrPdfToLines] page OCR complete", {
          pageIndex,
          textChars: ocrText.length,
          addedLines: lines.length,
          totalLines: aggregatedLines.length,
          elapsedMs: Date.now() - startedAt,
        });
      }

      // Early stop when we have a reasonable amount of text.
      if (aggregatedLines.length >= 1200) break;
    }

    const warnings: string[] = [];
    if (!aggregatedLines.length) {
      warnings.push(`OCR produced no text (${renderErrors.join(" | ") || "unknown"}).`);
    }
    if (rendererUsed) {
      warnings.push(`OCR renderer: ${rendererUsed}`);
    }
    warnings.push(`OCR pages scanned: ${pagesAttempted}`);

    return {
      lines: aggregatedLines,
      pagesAttempted,
      rendererUsed,
      renderErrors,
      warnings,
      tookMs: Date.now() - startedAt,
      stage: "tesseract",
    };
  } catch (err: any) {
    return {
      lines: aggregatedLines,
      pagesAttempted,
      rendererUsed,
      renderErrors,
      warnings: [`OCR failed: ${formatErr(err)}`],
      tookMs: Date.now() - startedAt,
      stage: "tesseract",
    };
  } finally {
    try {
      await worker.terminate();
    } catch {}
  }
}
