#!/usr/bin/env node

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
  console.error('DATABASE_URL must be set before running migrations.');
  process.exit(1);
}

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');
const migrationName = '20251020150829_reinit';

console.log(`Checking for failed Prisma migration "${migrationName}"...`);

const resolveExitCode = await run(
  'npx',
  ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schemaPath],
  { ignoreFailure: true },
);

if (resolveExitCode !== 0) {
  console.log(
    `No failed migrations named "${migrationName}" were found or the migration was already resolved (exit code ${resolveExitCode}).`,
  );
} else {
  console.log(`Marked migration "${migrationName}" as rolled back.`);
}

const resetToggle = (process.env.PRISMA_RESET_ON_FAIL ?? '1').toLowerCase();

async function deployOnce(label = 'prisma migrate deploy') {
  try {
    console.log(`Running ${label}...`);
    await run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
    return true;
  } catch (error) {
    console.error(`[prisma] ${label} failed:`, error.message ?? error);
    return false;
  }
}

if (await deployOnce()) {
  process.exit(0);
}

if (resetToggle === '0' || resetToggle === 'false' || resetToggle === 'no') {
  console.error(
    '[prisma] migrate deploy failed and automatic reset is disabled (set PRISMA_RESET_ON_FAIL to enable).',
  );
  process.exit(1);
}

console.warn('[prisma] resetting schema before retrying deploy (all data will be lost).');

try {
  await run('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--schema', schemaPath]);
} catch (error) {
  console.error('[prisma] reset failed:', error.message ?? error);
  process.exit(1);
}

if (!(await deployOnce('prisma migrate deploy after reset'))) {
  console.error('[prisma] deploy failed even after schema reset.');
  process.exit(1);
}
