#!/usr/bin/env node
const fs = require('fs');
// Load .env manually if DATABASE_URL not present
if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf8');
  envText.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set; cannot init Prisma');
  process.exit(1);
}
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });
(async () => {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
    console.log('Tenants:');
    tenants.forEach(t => console.log(`${t.id} | ${t.name}`));
  } catch (e) {
    console.error('Error listing tenants', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
