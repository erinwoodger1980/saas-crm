#!/usr/bin/env tsx
/**
 * Bootstrap a complete Search campaign for a tenant
 *
 * Usage:
 *   pnpm --filter api tsx scripts/bootstrap_campaign.ts -- \
 *     --slug wealden-joinery \
 *     --url https://www.joineryai.app/tenant/wealden-joinery/landing \
 *     --postcode "TN22 1AA" \
 *     --radius 50 \
 *     --budget 10 \
 *     --city "Sussex"
 */

import { PrismaClient } from '@prisma/client';
import { bootstrapSearchCampaign, gbpToMicros } from '../src/services/ads/bootstrap';
import { getTenantCustomerId } from '../src/services/ads/tenants';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let slug: string | undefined;
  let url: string | undefined;
  let postcode: string | undefined;
  let radius = 50;
  let budget = 10;
  let city = 'Sussex';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === '--postcode' && args[i + 1]) {
      postcode = args[i + 1];
      i++;
    } else if (args[i] === '--radius' && args[i + 1]) {
      radius = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--budget' && args[i + 1]) {
      budget = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--city' && args[i + 1]) {
      city = args[i + 1];
      i++;
    }
  }

  if (!slug || !url || !postcode) {
    console.error('Usage: pnpm --filter api tsx scripts/bootstrap_campaign.ts -- \\');
    console.error('  --slug <slug> --url <landing-url> --postcode <postcode> \\');
    console.error('  [--radius <miles>] [--budget <gbp>] [--city <city>]');
    console.error('\nExample:');
    console.error('  pnpm --filter api tsx scripts/bootstrap_campaign.ts -- \\');
    console.error('    --slug wealden-joinery \\');
    console.error('    --url https://www.joineryai.app/tenant/wealden-joinery/landing \\');
    console.error('    --postcode "TN22 1AA" \\');
    console.error('    --radius 50 \\');
    console.error('    --budget 10 \\');
    console.error('    --city "Sussex"');
    process.exit(1);
  }

  console.log('Bootstrapping Google Ads campaign...\n');
  console.log(`  Tenant slug: ${slug}`);
  console.log(`  Landing URL: ${url}`);
  console.log(`  Postcode: ${postcode}`);
  console.log(`  Radius: ${radius} miles`);
  console.log(`  Daily budget: £${budget}`);
  console.log(`  City: ${city}\n`);

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

    // Get customer ID
    const customerId = await getTenantCustomerId(tenant.id);
    if (!customerId) {
      console.error(`\n❌ Tenant does not have a Google Ads account`);
      console.error(`   Run: pnpm --filter api tsx scripts/make_subaccount.ts -- --slug ${slug}`);
      process.exit(1);
    }

    console.log(`Google Ads customer ID: ${customerId}\n`);

    // Convert budget to micros
    const dailyBudgetMicros = gbpToMicros(budget);

    // Bootstrap campaign
    console.log('Creating campaign resources...');
    const result = await bootstrapSearchCampaign({
      tenantId: tenant.id,
      customerId,
      landingUrl: url,
      postcode,
      radiusMiles: radius,
      dailyBudget: dailyBudgetMicros,
      city,
    });

    console.log(`\n✓ Campaign bootstrap complete!\n`);
    console.log('Resources created:');
    console.log(`  Budget: ${result.budgetResourceName}`);
    console.log(`  Campaign: ${result.campaignResourceName}`);
    console.log(`  Ad Group: ${result.adGroupResourceName}`);
    console.log(`  Ads: ${result.adResourceNames.length} responsive search ads`);
    console.log(`  Keywords: ${result.keywordResourceNames.length} keywords`);
    console.log(`  Sitelinks: ${result.sitelinkResourceNames.length} sitelink extensions`);

    console.log(`\n⚠️  Campaign is PAUSED by default`);
    console.log(`   Enable it in the Google Ads UI after review:\n`);
    console.log(`   https://ads.google.com/aw/campaigns?account=${customerId.replace(/-/g, '')}`);

    console.log(`\nNext steps:`);
    console.log(`  1. Review campaign settings in Google Ads UI`);
    console.log(`  2. Add conversion tracking if needed`);
    console.log(`  3. Enable the campaign when ready`);
    console.log(`  4. Monitor performance and adjust bids`);

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
