import { readFileSync } from 'fs';

// Parse .env.local
const envFile = readFileSync('../.env.local', 'utf8');
const envLines = envFile.split('\n');
let dbUrl = '';

for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.replace('DATABASE_URL="', '').replace('"', '');
    break;
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

console.log('Connected database URL found');
console.log('\nTo check LAJ Joinery lookup tables, you can:');
console.log('\n1. Use the web UI - go to /settings/lookup-tables and filter by tenant');
console.log('\n2. Check the Render logs for the API');
console.log('\n3. Access the database directly via pgAdmin or similar');
console.log('\nDo you want to:');
console.log('  A) Check what happened to the lookup table data (possible deletion)?');
console.log('  B) Restore/reseed the lookup tables?');
console.log('  C) Query the API endpoint directly?');
