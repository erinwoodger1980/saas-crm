const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Try to get database connection info from env
require('dotenv').config({ path: './.env.local' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse PostgreSQL connection string
const match = dbUrl.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)\?/);
if (!match) {
  console.error('Invalid DATABASE_URL format');
  process.exit(1);
}

console.log('Attempting to query LAJ Joinery lookup tables...\n');
console.log('Note: This requires a local PostgreSQL client or remote access.');
console.log('DATABASE_URL indicates:');
console.log(`  Host: ${match[3]}`);
console.log(`  Port: ${match[4]}`);
console.log(`  Database: ${match[5]}`);
