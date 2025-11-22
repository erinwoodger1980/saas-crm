#!/usr/bin/env node
// Skip during emergency deploys or when disabled for build speed
if (process.env.PRISMA_MIGRATE_SKIP === '1' || process.env.SKIP_PRISMA_POSTINSTALL === '1') {
  console.log('[prisma-postinstall] Skipping postinstall Prisma operations');
  process.exit(0);
}

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, { ignoreFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0 || (ignoreFailure && code !== 0)) {
        resolve(code ?? 0);
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
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
], { ignoreFailure: true });

console.log('[prisma-postinstall] Resolving failed landing slug migration if present...');
await run('npx', [
  'prisma',
  'migrate',
  'resolve',
  '--rolled-back',
  '20251110_remove_landing_slug',
  '--schema',
  schemaPath,
], { ignoreFailure: true });

console.log('[prisma-postinstall] (Skipped migrate deploy here; handled in Render preDeployCommand)');
