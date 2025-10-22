#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

function run(command, args, { ignoreFailure = false, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: env ? { ...process.env, ...env } : process.env,
    });

    child.on('exit', (code) => {
      if (code === 0 || (ignoreFailure && code !== 0)) {
        resolve(code ?? 0);
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      error.spawn = { command, args };
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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.join(scriptDir, '..', 'prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const migrationsDir = path.join(prismaDir, 'migrations');

const EARLY_ADOPTER_MIGRATION = '20251021173644_early_adopter_feedback';

let prismaCliPath;
try {
  prismaCliPath = require.resolve('prisma/build/index.js');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

const prismaEnv = {
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING:
    process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING ?? '1',
};

async function runPrisma(args, { ignoreFailure = false } = {}) {
  if (prismaCliPath) {
    try {
      return await run(process.execPath, [prismaCliPath, ...args], {
        ignoreFailure,
        env: prismaEnv,
      });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return run('npx', ['prisma', ...args], {
    ignoreFailure,
    env: prismaEnv,
  });
}

async function resolveEarlyAdopterMigration() {
  console.log('[prisma-postinstall] Resolving rolled-back early adopter migration if present...');
  await runPrisma(
    ['migrate', 'resolve', '--rolled-back', EARLY_ADOPTER_MIGRATION, '--schema', schemaPath],
    { ignoreFailure: true },
  );

  const migrationDir = path.join(migrationsDir, EARLY_ADOPTER_MIGRATION);
  if (!existsSync(migrationDir)) {
    console.log(
      `[prisma-postinstall] ${EARLY_ADOPTER_MIGRATION} directory is absent locally; marking as applied to suppress re-runs.`,
    );
    await runPrisma(
      ['migrate', 'resolve', '--applied', EARLY_ADOPTER_MIGRATION, '--schema', schemaPath],
      { ignoreFailure: true },
    );
  }
}

await resolveEarlyAdopterMigration();

console.log('[prisma-postinstall] Running prisma migrate deploy...');
try {
  await runPrisma(['migrate', 'deploy', '--schema', schemaPath]);
} catch (error) {
  console.warn(
    `[prisma-postinstall] prisma migrate deploy failed (${error.message}). Marking ${EARLY_ADOPTER_MIGRATION} as applied and retrying once...`,
  );
  await runPrisma(
    ['migrate', 'resolve', '--applied', EARLY_ADOPTER_MIGRATION, '--schema', schemaPath],
    { ignoreFailure: true },
  );
  await runPrisma(['migrate', 'deploy', '--schema', schemaPath]);
}
