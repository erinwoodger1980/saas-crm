/**
 * Ely window cutlist regression check (deterministic).
 *
 * Run with:
 *   npx tsx web/src/lib/scene/__tests__/ely-window-cutlist.test.ts
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolveProductComplete } from '../resolve-product';
import { windowElyHiPerformanceFlushOvoloTemplate } from '../templates/window-ely-hp-flush-ovolo';

type Baseline = {
  items: Array<{
    name: string;
    shoulderLengthMm: number;
    quantity: number;
  }>;
};

function loadBaseline(): Baseline {
  const baselinePath = path.resolve(
    __dirname,
    '../../../../../docs/ely/ely-cutlist-baseline-1800x1070.json',
  );
  const raw = fs.readFileSync(baselinePath, 'utf8');
  return JSON.parse(raw) as Baseline;
}

function normName(input: string): string {
  return String(input || '').trim().toLowerCase();
}

function approxEqual(a: number, b: number, tol = 0.6): boolean {
  return Math.abs(a - b) <= tol;
}

(async () => {
  const baseline = loadBaseline();
  const product = await resolveProductComplete(windowElyHiPerformanceFlushOvoloTemplate);

  const expected = baseline.items.map((it) => ({
    name: normName(it.name),
    lengthMm: it.shoulderLengthMm,
    quantity: it.quantity,
  }));

  const actual = product.cutList
    .filter((c) => c.meta?.kind === 'profileExtrusion')
    .map((c) => ({
      name: normName(c.componentName),
      lengthMm: Number(c.lengthMm),
      quantity: Number(c.quantity),
    }));

  const errors: string[] = [];

  for (const exp of expected) {
    const match = actual.find((a) =>
      a.name === exp.name && a.quantity === exp.quantity && approxEqual(a.lengthMm, exp.lengthMm),
    );
    if (!match) {
      const candidates = actual
        .filter((a) => a.name === exp.name)
        .map((a) => `${a.lengthMm}mm x${a.quantity}`)
        .join(', ');
      errors.push(`Missing: ${exp.name} ${exp.lengthMm}mm x${exp.quantity} (have: ${candidates || 'none'})`);
    }
  }

  if (errors.length) {
    console.error('\n❌ Ely cutlist baseline mismatch');
    for (const e of errors) console.error(`- ${e}`);

    console.error('\nActual cutlist (profileExtrusion):');
    for (const a of actual) console.error(`- ${a.name}: ${a.lengthMm}mm x${a.quantity}`);

    process.exit(1);
  }

  console.log('\n✅ Ely cutlist matches baseline (per window)');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
