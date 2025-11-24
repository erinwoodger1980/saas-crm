#!/usr/bin/env tsx
/**
 * Seed LAJ Joinery production tenant with material costs
 * Run this on production after deployment
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmi57aof70000itdhlazqjki7'; // LAJ Joinery production tenant

async function main() {
  console.log('Starting LAJ Joinery material cost import...');
  
  // Check if materials already exist
  const existingCount = await prisma.materialItem.count({
    where: { tenantId: TENANT_ID }
  });
  
  if (existingCount > 100) {
    console.log(`Materials already imported (${existingCount} found). Skipping.`);
    return;
  }
  
  console.log('Materials need to be imported. Please run the Python script:');
  console.log(`python3 import-material-costs.py ${TENANT_ID}`);
  console.log('\nMake sure to set DATABASE_URL to production database URL first:');
  console.log('export DATABASE_URL="postgresql://..."');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
