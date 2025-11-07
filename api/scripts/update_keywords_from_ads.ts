#!/usr/bin/env tsx
/**
 * Cron job: Update keyword performance from Google Ads API
 * 
 * Schedule: Weekly (every Monday)
 * 
 * Usage:
 * tsx scripts/update_keywords_from_ads.ts [--tenant-id <id>]
 */

import minimist from 'minimist';
import { PrismaClient } from '@prisma/client';
import { createGoogleAdsClient } from '../src/lib/google-ads';
import { createAdsOptimizer } from '../src/lib/ads-optimizer';

const prisma = new PrismaClient();

interface Args {
  tenantId?: string;
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  
  const args: Args = {
    tenantId: argv['tenant-id'] || argv.tenantId,
  };

  console.log('\n🔄 Google Ads Keyword Performance Update');
  console.log('=========================================\n');

  // Initialize Google Ads client
  const adsClient = createGoogleAdsClient();
  
  if (!adsClient) {
    console.error('❌ Google Ads API not configured');
    console.error('   Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN');
    process.exit(1);
  }

  // Get tenants to process
  let tenants;
  
  if (args.tenantId) {
    console.log(`📍 Processing single tenant: ${args.tenantId}\n`);
    tenants = await prisma.tenant.findMany({
      where: { id: args.tenantId },
      select: {
        id: true,
        name: true,
        googleAdsCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
  } else {
    console.log('📍 Processing all tenants with Google Ads configured\n');
    tenants = await prisma.tenant.findMany({
      where: {
        googleAdsCustomerId: { not: null },
        googleAdsRefreshToken: { not: null },
      },
      select: {
        id: true,
        name: true,
        googleAdsCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
  }

  if (tenants.length === 0) {
    console.log('ℹ️  No tenants with Google Ads configuration found');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${tenants.length} tenant(s) to process\n`);

  const results = {
    total: tenants.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ tenantId: string; error: string }>,
  };

  // Process each tenant
  for (const tenant of tenants) {
    console.log(`\n📊 Processing: ${tenant.name} (${tenant.id})`);
    console.log('─'.repeat(60));

    try {
      // Update keyword performance
      const result = await adsClient.updateTenantKeywordPerformance(tenant.id);

      if (result.success === false) {
        if (result.reason === 'no_ads_config') {
          console.log('   ⊘ Skipped: No Google Ads configuration');
          results.skipped++;
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
          results.failed++;
          results.errors.push({ tenantId: tenant.id, error: result.error || 'Unknown error' });
        }
        continue;
      }

      console.log(`   ✅ Success`);
      console.log(`      - Keywords updated: ${result.keywordCount}`);
      console.log(`      - Active keywords: ${result.activeKeywordCount}`);
      console.log(`      - Underperforming: ${result.underperformingCount}`);

      // Generate optimization suggestions
      console.log('\n   🎯 Generating optimization suggestions...');
      const optimizer = createAdsOptimizer(adsClient);
      const suggestions = await optimizer.generateOptimizationSuggestions(tenant.id);

      if (suggestions.length > 0) {
        await optimizer.saveSuggestions(tenant.id, suggestions);
        console.log(`      - Created ${suggestions.length} suggestions`);
        
        // Show top 3 suggestions
        const topSuggestions = suggestions.slice(0, 3);
        topSuggestions.forEach((sug, idx) => {
          console.log(`      ${idx + 1}. ${sug.keyword} → ${sug.suggestedFor}: "${sug.newText.substring(0, 60)}..."`);
        });
      } else {
        console.log('      - No suggestions generated (insufficient data)');
      }

      results.successful++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ tenantId: tenant.id, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 Summary');
  console.log('='.repeat(60));
  console.log(`Total tenants: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⊘ Skipped: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(err => {
      console.log(`   - ${err.tenantId}: ${err.error}`);
    });
  }

  console.log('\n✅ Keyword performance update complete!\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
