/*
 * Local PDF parsing helper.
 * Usage:
 *   pnpm tsx scripts/parse-pdfs-local.ts /path/to/file1.pdf [/path/to/file2.pdf ...]
 *
 * Reads each PDF, extracts raw text via pdf-parse, and runs basic supplier parse fallback + normalization.
 * This does NOT hit the live API; it's for local inspection before ML upload.
 */
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { fallbackParseSupplierPdf } from '../src/lib/pdf/fallback';
import { buildSupplierParse } from '../src/lib/pdf/parser';
import { parseSupplierPdf } from '../src/lib/supplier/parse';
import { descriptionQualityScore } from '../src/lib/pdf/quality';

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Provide one or more PDF file paths.');
    process.exit(1);
  }

  for (const f of files) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) {
      console.error(`[skip] File not found: ${abs}`);
      continue;
    }
    const buffer = fs.readFileSync(abs);
    console.log(`\n=== Parsing: ${abs} (${buffer.length} bytes) ===`);
    try {
      // Raw text extract
      const parsed = await pdfParse(buffer);
      const rawText = parsed.text;
      console.log(`Raw text length: ${rawText.length}`);

      // Attempt structured supplier parse (hybrid -> fallback)
      let hybridResult: any = null;
      try {
        hybridResult = await parseSupplierPdf(buffer, { maxPages: 6 });
      } catch (e) {
        console.warn('[warn] hybrid parse failed, will attempt fallback:', (e as any)?.message || e);
      }

      let fallbackResult: any = null;
      try {
        fallbackResult = await fallbackParseSupplierPdf(buffer);
      } catch (e) {
        console.warn('[warn] fallback parse failed:', (e as any)?.message || e);
      }

      const chosen = hybridResult?.lines?.length ? hybridResult : fallbackResult;
      if (!chosen) {
        console.log('[result] No lines extracted by either parser.');
        continue;
      }

      const lines = chosen.lines || [];
      console.log(`Extracted lines: ${lines.length}`);
      const sample = lines.slice(0, 8).map((l: any) => ({ desc: l.description, qty: l.qty, unit: l.unitCost, total: l.lineTotal }));
      console.table(sample);

      // Quality scoring
      const quality = descriptionQualityScore(lines.map((l: any) => String(l.description || '')));
      console.log('Description quality score:', quality);

      // Aggregate totals if present
      const totalComputed = lines.reduce((sum: number, l: any) => {
        const v = typeof l.lineTotal === 'number' ? l.lineTotal : parseFloat(String(l.lineTotal || '0').replace(/[^0-9.]/g, ''));
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      console.log('Aggregate line total (approx):', totalComputed.toFixed(2));

    } catch (err) {
      console.error('[error] Failed to parse PDF:', (err as any)?.message || err);
    }
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
