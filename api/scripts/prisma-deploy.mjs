#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
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

const prismaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const migrationsDir = path.join(prismaDir, 'migrations');

const migrationsToResolve = [
  '20251020150829_reinit',
  '20251021173644_early_adopter_feedback',
];

for (const migrationName of migrationsToResolve) {
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

  const sqlFilePath = path.join(migrationsDir, migrationName, 'migration.sql');
  if (existsSync(sqlFilePath)) {
    console.log(`Executing migration script for "${migrationName}" to align database schema...`);
    await run('npx', ['prisma', 'db', 'execute', '--schema', schemaPath, '--file', sqlFilePath]);
  } else {
    console.warn(
      `Skipping execution for "${migrationName}" because ${sqlFilePath} could not be found.`,
    );
  }

  const appliedExitCode = await run(
    'npx',
    ['prisma', 'migrate', 'resolve', '--applied', migrationName, '--schema', schemaPath],
    { ignoreFailure: true },
  );

  if (appliedExitCode === 0) {
    console.log(`Marked migration "${migrationName}" as applied.`);
  }
}

console.log('Running prisma migrate deploy...');
await run('npx', ['prisma', 'migrate', 'deploy', '--schema', schemaPath]);
