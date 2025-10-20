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

const truthy = new Set(['1', 'true', 'yes']);
const falsy = new Set(['0', 'false', 'no']);

function booleanFromEnv(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (truthy.has(normalized)) {
    return true;
  }
  if (falsy.has(normalized)) {
    return false;
  }
  return fallback;
}

async function runPrisma(args, options) {
  return run('npx', ['prisma', ...args, '--schema', schemaPath], options);
}

async function resolveFailedMigration() {
  console.log(`Checking for failed Prisma migration "${migrationName}"...`);

  const exitCode = await run(
    'npx',
    ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schemaPath],
    { ignoreFailure: true },
  );

  if (exitCode === 0) {
    console.log(`Marked migration "${migrationName}" as rolled back.`);
  } else {
    console.log(
      `No failed migrations named "${migrationName}" were found or the migration was already resolved (exit code ${exitCode}).`,
    );
  }
}

async function resetDatabase(reason) {
  console.warn(`[prisma] ${reason} (all data will be lost).`);
  await runPrisma(['migrate', 'reset', '--force', '--skip-seed']);
}

async function deployWithRetry({ resetBeforeDeploy, resetOnFail }) {
  if (resetBeforeDeploy) {
    await resetDatabase('resetting schema before deploy');
  }

  try {
    console.log('Running prisma migrate deploy...');
    await runPrisma(['migrate', 'deploy']);
    return;
  } catch (error) {
    console.error('[prisma] migrate deploy failed:', error.message ?? error);
  }

  if (!resetOnFail) {
    console.error('[prisma] automatic reset after failure is disabled.');
    process.exit(1);
  }

  await resetDatabase('resetting schema after failed deploy');

  try {
    console.log('Running prisma migrate deploy after reset...');
    await runPrisma(['migrate', 'deploy']);
  } catch (retryError) {
    console.error('[prisma] deploy failed even after schema reset:', retryError.message ?? retryError);
    process.exit(1);
  }
}

await resolveFailedMigration();

await deployWithRetry({
  resetBeforeDeploy: booleanFromEnv(process.env.PRISMA_RESET_BEFORE_DEPLOY, false),
  resetOnFail: booleanFromEnv(process.env.PRISMA_RESET_ON_FAIL ?? '1', true),
});
