#!/usr/bin/env tsx
/**
 * Quick test script to verify isFireDoorManufacturer can be saved
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 Testing isFireDoorManufacturer flag...\n');

  // Find LAJ Joinery tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'laj-joinery' }
  });

  if (!tenant) {
    console.log('❌ LAJ Joinery tenant not found');
    return;
  }

  console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);

  // Find or create settings
  let settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id }
  });

  if (!settings) {
    console.log('   Creating new settings...');
    settings = await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        slug: 'laj-joinery',
        brandName: 'LAJ Joinery',
        isFireDoorManufacturer: true,
      }
    });
  }

  console.log(`\nCurrent isFireDoorManufacturer: ${settings.isFireDoorManufacturer}`);

  // Toggle the flag
  const newValue = !settings.isFireDoorManufacturer;
  console.log(`Updating to: ${newValue}...`);

  const updated = await prisma.tenantSettings.update({
    where: { tenantId: tenant.id },
    data: { isFireDoorManufacturer: newValue }
  });

  console.log(`✅ Updated successfully: ${updated.isFireDoorManufacturer}`);

  // Verify
  const verified = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { isFireDoorManufacturer: true }
  });

  console.log(`\n🔍 Verification: ${verified?.isFireDoorManufacturer}`);
  
  if (verified?.isFireDoorManufacturer === newValue) {
    console.log('✅ SUCCESS: Flag can be saved and persists correctly!\n');
  } else {
    console.log('❌ FAILED: Flag did not persist\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
