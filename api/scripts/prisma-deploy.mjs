#!/usr/bin/env node
import { spawn } from 'node:child_process';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited via signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function runPrisma(args) {
  await run('npx', ['prisma', ...args], { env: process.env });
}

async function main() {
  try {
    await runPrisma(['migrate', 'deploy']);
    return;
  } catch (error) {
    console.error('[prisma] initial deploy failed:', error.message ?? error);
  }

  console.warn('[prisma] resetting schema before retrying deploy');
  try {
    await runPrisma(['migrate', 'reset', '--force', '--skip-seed']);
  } catch (error) {
    console.error('[prisma] reset failed:', error.message ?? error);
    process.exitCode = 1;
    return;
  }

  try {
    await runPrisma(['migrate', 'deploy']);
  } catch (error) {
    console.error('[prisma] deploy failed even after reset:', error.message ?? error);
    process.exitCode = 1;
  }
}

await main();
