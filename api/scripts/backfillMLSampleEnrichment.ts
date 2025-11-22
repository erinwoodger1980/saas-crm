#!/usr/bin/env tsx
// api/scripts/backfillMLSampleEnrichment.ts
// Backfill textChars, estimatedTotal, currency for existing MLTrainingSample rows with fileId but null enrichment.

import path from 'path';
import { computeFallbackStats } from '../src/lib/pdf/extractQuote';
import { prisma } from '../src/db';

async function main() {
  console.log('[backfill] Starting ML sample enrichment backfill...');
  
  const candidates = await prisma.mLTrainingSample.findMany({
    where: {
      fileId: { not: null },
      OR: [
        { textChars: null },
        { estimatedTotal: null },
        { currency: null }
      ]
    },
    select: { id: true, fileId: true, textChars: true, estimatedTotal: true, currency: true },
  });

  console.log(`[backfill] Found ${candidates.length} samples to process.`);
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const sample of candidates) {
    processed++;
    if (!sample.fileId) {
      skipped++;
      continue;
    }

    try {
      const file = await prisma.uploadedFile.findUnique({
        where: { id: sample.fileId },
        select: { path: true }
      });
      if (!file) {
        console.warn(`[backfill] File not found for sample ${sample.id}, fileId ${sample.fileId}`);
        skipped++;
        continue;
      }

      const absPath = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
      const stats = await computeFallbackStats(absPath);

      const updateData: any = {};
      if (sample.textChars == null && stats.textChars != null) updateData.textChars = stats.textChars;
      if (sample.estimatedTotal == null && stats.estimatedTotal != null) updateData.estimatedTotal = stats.estimatedTotal;
      if (sample.currency == null && stats.currency != null) updateData.currency = stats.currency;

      if (Object.keys(updateData).length > 0) {
        await prisma.mLTrainingSample.update({
          where: { id: sample.id },
          data: updateData
        });
        updated++;
        console.log(`[backfill] Updated sample ${sample.id}: ${JSON.stringify(updateData)}`);
      } else {
        skipped++;
      }
    } catch (e: any) {
      console.error(`[backfill] Failed to process sample ${sample.id}:`, e?.message || e);
      skipped++;
    }
  }

  console.log(`[backfill] Complete. Processed: ${processed}, Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[backfill] Fatal error:', e);
  process.exit(1);
});
