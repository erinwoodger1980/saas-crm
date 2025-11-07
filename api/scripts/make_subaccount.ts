#!/usr/bin/env tsx
/**
 * Create a Google Ads sub-account for a tenant
 *
 * Usage:
 *   pnpm --filter api tsx scripts/make_subaccount.ts -- --slug wealden --name "Wealden Joinery Ads"
 */

import { PrismaClient } from '@prisma/client';
import { createSubAccount } from '../src/services/ads/tenants';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let slug: string | undefined;
  let name: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[i + 1];
      i++;
    }
  }

  if (!slug) {
    console.error('Usage: pnpm --filter api tsx scripts/make_subaccount.ts -- --slug <slug> [--name <name>]');
    console.error('\nExample:');
    console.error('  pnpm --filter api tsx scripts/make_subaccount.ts -- --slug wealden --name "Wealden Joinery Ads"');
    process.exit(1);
  }

  console.log(`Creating Google Ads sub-account for tenant: ${slug}\n`);

  try {
    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!tenant) {
      console.error(`❌ Tenant not found: ${slug}`);
      process.exit(1);
    }

    console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

    // Check if already has ads config
    const existing = await prisma.tenantAdsConfig.findUnique({
      where: { tenantId: tenant.id },
    });

    if (existing) {
      console.log(`\n⚠️  Tenant already has Google Ads account: ${existing.googleAdsCustomerId}`);
      console.log(`   Status: ${existing.status}`);
      console.log(`   Created: ${existing.createdAt}`);
      process.exit(0);
    }

    // Create sub-account
    const accountName = name || `${tenant.name} Ads`;
    console.log(`\nCreating sub-account: "${accountName}"`);

    const customerId = await createSubAccount(tenant.id, accountName);

    console.log(`\n✓ Sub-account created successfully!`);
    console.log(`  Customer ID: ${customerId}`);
    console.log(`  Tenant ID: ${tenant.id}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Bootstrap a campaign:`);
    console.log(`     pnpm --filter api tsx scripts/bootstrap_campaign.ts -- --slug ${slug} --url <landing-url> --postcode <postcode>`);
    console.log(`  2. View in Google Ads UI:`);
    console.log(`     https://ads.google.com/aw/accounts?account=${customerId.replace(/-/g, '')}`);

    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.failure) {
      console.error('\nPartial failure details:', JSON.stringify(error.failure, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
