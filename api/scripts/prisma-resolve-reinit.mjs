#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');
const migrationName = '20251020150829_reinit';

console.log(`Marking migration "${migrationName}" as rolled back using schema at ${schemaPath}...`);

const child = spawn('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName, '--schema', schemaPath], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log(`Successfully resolved migration "${migrationName}".`);
    process.exit(0);
  }

  console.error(`Prisma exited with code ${code}.`);
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to launch Prisma CLI:', error.message);
  process.exit(1);
});
