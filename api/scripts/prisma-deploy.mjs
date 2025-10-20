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

if (!process.env.SHADOW_DATABASE_URL) {
  console.warn(
    'SHADOW_DATABASE_URL is not set; falling back to DATABASE_URL for this deploy run. ' +
      'Configure SHADOW_DATABASE_URL with an empty Render database to avoid migration conflicts.',
  );
  process.env.SHADOW_DATABASE_URL = process.env.DATABASE_URL;
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

console.log('Running prisma migrate deploy...');
await run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
