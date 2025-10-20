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

function envEnabled(value, defaultValue = true) {
  const normalized = (value ?? (defaultValue ? '1' : '0')).toString().trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be set before running migrations.');
  process.exit(1);
}

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');
const migrationName = '20251020150829_reinit';

const resetBeforeDeploy = envEnabled(process.env.PRISMA_RESET_BEFORE_DEPLOY, true);
const resetOnFail = envEnabled(process.env.PRISMA_RESET_ON_FAIL, true);

async function dropPublicSchema() {
  console.warn('[prisma] Dropping public schema before running migrations. All data will be lost.');
  await run('npx', ['prisma', 'db', 'execute', '--schema', schemaPath, '--command', 'DROP SCHEMA IF EXISTS "public" CASCADE;']);
  await run('npx', ['prisma', 'db', 'execute', '--schema', schemaPath, '--command', 'CREATE SCHEMA "public";']);
}

async function resolveFailedMigration() {
  console.log(`Checking for failed Prisma migration "${migrationName}"...`);
  const resolveExitCode = await run(
    'npx',
    ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schemaPath],
    { ignoreFailure: true },
  );

  if (resolveExitCode === 0) {
    console.log(`Marked migration "${migrationName}" as rolled back.`);
  } else {
    console.log(
      `No failed migrations named "${migrationName}" were found or the migration was already resolved (exit code ${resolveExitCode}).`,
    );
  }
}

async function runDeploy(label = 'prisma migrate deploy') {
  console.log(`Running ${label}...`);
  await run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
}

if (resetBeforeDeploy) {
  await dropPublicSchema();
} else {
  await resolveFailedMigration();
}

try {
  await runDeploy();
} catch (error) {
  if (!resetBeforeDeploy && resetOnFail) {
    console.error(`[prisma] ${error.message ?? error}. Retrying after destructive reset.`);
    await dropPublicSchema();
    await runDeploy('prisma migrate deploy after reset');
  } else {
    console.error('[prisma] migrate deploy failed.', error);
    process.exit(1);
  }
}
