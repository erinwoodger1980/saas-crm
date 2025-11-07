#!/usr/bin/env tsx
/**
 * Test Google Ads API connectivity
 * Validates environment variables and lists accessible customers
 *
 * Usage:
 *   pnpm --filter api tsx scripts/test_google_ads.ts
 */

import { listAccessibleCustomers, getMccCustomerId } from '../src/lib/googleAds';

async function main() {
  console.log('Testing Google Ads API connectivity...\n');

  // Check environment variables
  const requiredEnvs = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'LOGIN_CUSTOMER_ID',
  ];

  console.log('Environment variables:');
  const missing: string[] = [];
  for (const key of requiredEnvs) {
    const value = process.env[key];
    if (!value) {
      console.log(`  ❌ ${key}: NOT SET`);
      missing.push(key);
    } else {
      const masked = key.includes('SECRET') || key.includes('TOKEN')
        ? value.substring(0, 8) + '...'
        : value;
      console.log(`  ✓ ${key}: ${masked}`);
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('\n✓ All environment variables set\n');

  // Get MCC customer ID
  try {
    const mccId = getMccCustomerId();
    console.log(`MCC Customer ID: ${mccId}\n`);
  } catch (error: any) {
    console.error(`❌ Error getting MCC ID: ${error.message}`);
    process.exit(1);
  }

  // List accessible customers
  try {
    console.log('Fetching accessible customer accounts...');
    const customers = await listAccessibleCustomers();

    if (customers.length === 0) {
      console.log('  No customer accounts found (MCC may be new)');
    } else {
      console.log(`  Found ${customers.length} accessible customer(s):\n`);
      customers.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
    }

    console.log('\n✓ Google Ads API test successful!');
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ API test failed: ${error.message}`);
    if (error.failure) {
      console.error('\nPartial failure details:', JSON.stringify(error.failure, null, 2));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
