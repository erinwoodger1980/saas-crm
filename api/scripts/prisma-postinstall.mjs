#!/usr/bin/env node

import { spawn } from 'node:child_process';
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
const schemaPath = path.join(scriptDir, '..', 'prisma', 'schema.prisma');

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

console.log('[prisma-postinstall] Resolving rolled-back early adopter migration if present...');
await runPrisma(
  ['migrate', 'resolve', '--rolled-back', '20251021173644_early_adopter_feedback', '--schema', schemaPath],
  { ignoreFailure: true },
);

console.log('[prisma-postinstall] Running prisma migrate deploy...');
await runPrisma(['migrate', 'deploy', '--schema', schemaPath]);
