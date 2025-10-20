#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, { ignoreFailure = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        const error = new Error(`${command} ${args.join(' ')} exited via signal ${signal}`);
        if (ignoreFailure) {
          console.warn('[warn]', error.message);
          resolve(code ?? 0);
        } else {
          reject(error);
        }
        return;
      }

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

function prismaArgs(...args) {
  return ['prisma', ...args, '--schema', schemaPath];
}

async function runPrisma(args, options) {
  return run('npx', prismaArgs(...args), options);
}

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

async function deployWithFallback() {
  try {
    console.log('Running prisma migrate deploy...');
    await runPrisma(['migrate', 'deploy']);
    return true;
  } catch (error) {
    console.error('[prisma] initial deploy failed:', error.message ?? error);
    return false;
  }
}

if (!(await deployWithFallback())) {
  console.warn('[prisma] resetting schema before retrying deploy');
  try {
    await runPrisma(['migrate', 'reset', '--force', '--skip-seed']);
  } catch (error) {
    console.error('[prisma] reset failed:', error.message ?? error);
    process.exitCode = 1;
    process.exit();
  }

  if (!(await deployWithFallback())) {
    console.error('[prisma] deploy failed even after reset.');
    process.exitCode = 1;
  }
}
