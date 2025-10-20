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

async function runPrisma(args, options) {
  return run('npx', ['prisma', ...args, '--schema', schemaPath], options);
}

const resetBeforeDeploy = ['1', 'true', 'yes'].includes((process.env.PRISMA_RESET_BEFORE_DEPLOY ?? '').toLowerCase());
const resetOnFailure = ['1', 'true', 'yes'].includes((process.env.PRISMA_RESET_ON_FAIL ?? '1').toLowerCase());

async function maybeReset(label) {
  console.warn(`[prisma] ${label} (all data will be lost).`);
  await runPrisma(['migrate', 'reset', '--force', '--skip-seed']);
}

if (resetBeforeDeploy) {
  await maybeReset('resetting schema before deploy');
}

try {
  console.log('Running prisma migrate deploy...');
  await runPrisma(['migrate', 'deploy']);
} catch (error) {
  console.error('[prisma] migrate deploy failed:', error.message ?? error);

  if (!resetOnFailure) {
    console.error('[prisma] automatic reset on failure is disabled.');
    process.exit(1);
  }

  await maybeReset('resetting schema after failed deploy');

  try {
    console.log('Running prisma migrate deploy after reset...');
    await runPrisma(['migrate', 'deploy']);
  } catch (retryError) {
    console.error('[prisma] deploy failed even after schema reset:', retryError.message ?? retryError);
    process.exit(1);
  }
}
