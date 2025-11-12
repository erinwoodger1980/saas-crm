#!/usr/bin/env node
/**
 * run-migrations-and-report.mjs
 * Safe wrapper to deploy Prisma migrations and emit a JSON summary.
 * Intended for Render deploy hooks or manual runs.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function run(cmd) {
  try {
    const out = execSync(cmd, { stdio: 'pipe' }).toString();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e?.stdout?.toString() || '', err: e?.message || String(e) };
  }
}

const steps = [];
steps.push({ step: 'prisma generate', ...run('npx prisma generate') });
steps.push({ step: 'deploy migrations', ...run('npx prisma migrate deploy') });

// Quick check: does Holiday table exist? (Optional diagnostic)
let holidayCheck = null;
try {
  const url = process.env.DATABASE_URL;
  if (url && url.includes('postgres')) {
    // Basic psql probe if psql available
    const res = run("psql $DATABASE_URL -c 'SELECT to_regclass(\"public.Holiday\") as holiday_table' 2>/dev/null");
    holidayCheck = res;
  }
} catch {}

const summary = { timestamp: new Date().toISOString(), steps, holidayCheck };
fs.writeFileSync('migration-report.json', JSON.stringify(summary, null, 2));
console.log('=== Migration Summary ===');
console.log(JSON.stringify(summary, null, 2));
