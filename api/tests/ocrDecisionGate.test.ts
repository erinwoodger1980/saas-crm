import { describe, it, expect } from "@jest/globals";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { extractStructuredText } from "../src/lib/pdf/extract";
import { shouldUseOcr } from "../src/lib/supplier/ocrDecisionGate";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/pdfs");

function loadFixture(filename: string): Buffer {
  const fp = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(fp)) {
    console.warn(`Missing fixture: ${fp}`);
    return Buffer.from([]);
  }
  return fs.readFileSync(fp);
}

async function extractRawTextByPageViaPdfJs(buf: Buffer, maxPages = 2): Promise<string[]> {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  const standardFontDataUrl = (() => {
    try {
      const pkgPath = require.resolve("pdfjs-dist/package.json");
      const fontsDir = path.join(path.dirname(pkgPath), "standard_fonts/");
      return pathToFileURL(fontsDir).href;
    } catch {
      return undefined;
    }
  })();

  const doc = await pdfjsLib
    .getDocument({
      data,
      ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
    })
    .promise;

  const pages: string[] = [];
  const pageCount = Math.max(0, Math.min(maxPages, Number(doc?.numPages || 0)));
  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    pages.push(
      (tc?.items || [])
        .map((it: any) => String(it?.str || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim(),
    );
  }

  try {
    await doc.destroy();
  } catch {}

  return pages;
}

describe("OCR decision gate", () => {
  it("returns false for text-based quote PDFs", async () => {
    const buf = loadFixture("text-based-quote-fixture.pdf");
    if (buf.length === 0) return;

    const extraction = extractStructuredText(buf);
    const rawTextByPage = await extractRawTextByPageViaPdfJs(buf);

    expect(shouldUseOcr(extraction, rawTextByPage)).toBe(false);
  });

  it("returns true for scan/empty PDFs", async () => {
    const buf = loadFixture("scan-empty-fixture.pdf");
    if (buf.length === 0) return;

    const extraction = extractStructuredText(buf);
    const rawTextByPage = await extractRawTextByPageViaPdfJs(buf);

    expect(shouldUseOcr(extraction, rawTextByPage)).toBe(true);
  });
});
