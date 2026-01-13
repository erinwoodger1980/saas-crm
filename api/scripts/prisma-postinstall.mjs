#!/usr/bin/env node
// Skip during emergency deploys or when disabled for build speed
if (process.env.PRISMA_MIGRATE_SKIP === '1' || process.env.SKIP_PRISMA_POSTINSTALL === '1') {
  console.log('[prisma-postinstall] Skipping postinstall Prisma operations');
  process.exit(0);
}

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, { ignoreFailure = false, suppressIfMatches = [] } = {}) {
  return new Promise((resolve, reject) => {
    const capture = suppressIfMatches.length > 0;
    const child = spawn(command, args, {
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: false,
    });

    let out = '';
    let err = '';
    if (capture) {
      child.stdout?.on('data', (d) => { out += String(d); });
      child.stderr?.on('data', (d) => { err += String(d); });
    }

    child.on('exit', (code) => {
      const exitCode = code ?? 0;
      if (exitCode === 0) return resolve(exitCode);

      const combined = `${out}\n${err}`.trim();
      const shouldSuppress = suppressIfMatches.some((pattern) => {
        try {
          return typeof pattern === 'string' ? combined.includes(pattern) : pattern.test(combined);
        } catch {
          return false;
        }
      });

      if (ignoreFailure || shouldSuppress) {
        if (shouldSuppress) {
          console.log('[prisma-postinstall] Migration resolve no-op (not applied); continuing.');
        }
        return resolve(exitCode);
      }

      if (capture && combined) {
        // Re-emit output for debugging in non-suppressed failure cases.
        console.error(combined);
      }
      return reject(new Error(`${command} ${args.join(' ')} exited with code ${exitCode}`));
    });

    child.on('error', (error) => {
      if (ignoreFailure) {
        console.warn(`[warn] Failed to launch ${command}:`, error.message);
        resolve(0);
      } else {
        reject(error);
      }
    });
  });
}

if (!process.env.DATABASE_URL) {
  console.log('[prisma-postinstall] Skipping Prisma migrations because DATABASE_URL is not set.');
  process.exit(0);
}

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'prisma',
  'schema.prisma',
);

console.log('[prisma-postinstall] Resolving rolled-back early adopter migration if present...');
await run('npx', [
  'prisma',
  'migrate',
  'resolve',
  '--rolled-back',
  '20251021173644_early_adopter_feedback',
  '--schema',
  schemaPath,
], {
  ignoreFailure: true,
  suppressIfMatches: [
    /Error:\s*P3011/i,
    /20251021173644_early_adopter_feedback/i,
    /was never applied to the database/i,
  ],
});

console.log('[prisma-postinstall] Resolving failed landing slug migration if present...');
await run('npx', [
  'prisma',
  'migrate',
  'resolve',
  '--rolled-back',
  '20251110_remove_landing_slug',
  '--schema',
  schemaPath,
], {
  ignoreFailure: true,
  suppressIfMatches: [
    /Error:\s*P3011/i,
    /20251110_remove_landing_slug/i,
    /was never applied to the database/i,
  ],
});

console.log('[prisma-postinstall] (Skipped migrate deploy here; handled in Render preDeployCommand)');
