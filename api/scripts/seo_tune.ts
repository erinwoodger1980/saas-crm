#!/usr/bin/env tsx
/**
 * SEO Tuning Script
 * 
 * Fetches top-performing search queries from Google Search Console
 * and automatically updates tenant keywords + meta titles for better rankings.
 * 
 * Schedule: Weekly (every Monday after keyword sync)
 * 
 * Usage:
 * tsx scripts/seo_tune.ts [--tenant-id <id>] [--dry-run]
 */

import minimist from 'minimist';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const prisma = new PrismaClient();

interface SearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Args {
  tenantId?: string;
  dryRun?: boolean;
}

async function getSearchConsoleClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const authClient = await auth.getClient();
  const webmasters = google.webmasters({ version: 'v3', auth: authClient as any });
  
  return webmasters;
}

async function fetchTopQueries(siteUrl: string, tenantSlug: string): Promise<SearchConsoleQuery[]> {
  try {
    const webmasters = await getSearchConsoleClient();
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                operator: 'contains',
                expression: tenantSlug
              }
            ]
          }
        ],
        rowLimit: 50,
        startRow: 0
      }
    });

    return (response.data.rows || []).map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }));
  } catch (error: any) {
    console.error(`Failed to fetch Search Console data:`, error.message);
    return [];
  }
}

async function updateTenantSEO(
  tenantId: string,
  queries: SearchConsoleQuery[],
  dryRun: boolean
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      keywords: true,
      serviceAreas: true
    }
  });

  if (!tenant) {
    console.error(`Tenant not found: ${tenantId}`);
    return;
  }

  // Extract high-performing queries (position <= 20, clicks > 5)
  const goodQueries = queries.filter(q => q.position <= 20 && q.clicks >= 5);
  
  // Extract emerging queries (position 21-50, impressions > 100)
  const emergingQueries = queries.filter(
    q => q.position > 20 && q.position <= 50 && q.impressions >= 100
  );

  if (goodQueries.length === 0 && emergingQueries.length === 0) {
    console.log(`   No actionable queries found for ${tenant.name}`);
    return;
  }

  // Update keywords with top performers
  const newKeywords = [
    ...goodQueries.map(q => q.query),
    ...emergingQueries.slice(0, 10).map(q => q.query),
    ...(tenant.keywords || [])
  ];

  // Deduplicate and limit to top 50
  const uniqueKeywords = Array.from(new Set(newKeywords))
    .slice(0, 50);

  // Generate optimized meta title using top query
  const topQuery = goodQueries[0]?.query || emergingQueries[0]?.query;
  const optimizedTitle = topQuery
    ? `${topQuery} | ${tenant.name} | ${tenant.serviceAreas?.[0] || 'UK'}`
    : undefined;

  console.log(`\n   📊 SEO Updates for ${tenant.name}:`);
  console.log(`      - Added ${uniqueKeywords.length - (tenant.keywords?.length || 0)} new keywords`);
  if (topQuery) {
    console.log(`      - Top query: "${topQuery}" (Position: ${goodQueries[0]?.position || emergingQueries[0]?.position})`);
  }

  if (dryRun) {
    console.log(`   🔍 DRY RUN - Changes not applied`);
    console.log(`      Keywords: ${uniqueKeywords.slice(0, 10).join(', ')}...`);
    if (optimizedTitle) {
      console.log(`      Suggested title: ${optimizedTitle}`);
    }
  } else {
    // Update tenant keywords
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        keywords: uniqueKeywords,
        updatedAt: new Date()
      }
    });

    // Update landing page meta title if exists
    const landingTenant = await prisma.landingTenant.findUnique({
      where: { tenantId },
      include: {
        content: {
          where: { published: true },
          orderBy: { publishedAt: 'desc' },
          take: 1
        }
      }
    });

    if (landingTenant && landingTenant.content[0] && optimizedTitle) {
      // Create new draft with optimized headline
      await prisma.landingTenantContent.create({
        data: {
          landingTenantId: landingTenant.id,
          headline: optimizedTitle,
          subhead: landingTenant.content[0].subhead,
          urgency: landingTenant.content[0].urgency,
          guarantees: landingTenant.content[0].guarantees,
          priceFromText: landingTenant.content[0].priceFromText,
          priceRange: landingTenant.content[0].priceRange,
          leadMagnet: landingTenant.content[0].leadMagnet,
          serviceAreas: landingTenant.content[0].serviceAreas,
          published: false // Keep as draft for review
        }
      });

      console.log(`   ✅ Created draft with optimized headline`);
    }
  }
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  
  const args: Args = {
    tenantId: argv['tenant-id'] || argv.tenantId,
    dryRun: argv['dry-run'] || argv.dryRun || false
  };

  console.log('\n🔍 SEO Tuning from Search Console Data');
  console.log('========================================\n');

  if (args.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be applied\n');
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || 'sc-domain:joineryai.app';

  // Get tenants to process
  let tenants;
  
  if (args.tenantId) {
    tenants = await prisma.tenant.findMany({
      where: { id: args.tenantId },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
  } else {
    tenants = await prisma.tenant.findMany({
      where: {
        landingTenant: {
          isNot: null
        }
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
  }

  if (tenants.length === 0) {
    console.log('ℹ️  No tenants with landing pages found');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${tenants.length} tenant(s) to analyze\n`);

  const results = {
    total: tenants.length,
    updated: 0,
    skipped: 0,
    errors: [] as Array<{ tenantId: string; error: string }>
  };

  // Process each tenant
  for (const tenant of tenants) {
    console.log(`\n📈 Analyzing: ${tenant.name}`);
    console.log('─'.repeat(60));

    try {
      const queries = await fetchTopQueries(siteUrl, tenant.slug);

      if (queries.length === 0) {
        console.log('   ⊘ No Search Console data available');
        results.skipped++;
        continue;
      }

      await updateTenantSEO(tenant.id, queries, args.dryRun || false);
      results.updated++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.errors.push({ tenantId: tenant.id, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`Total tenants: ${results.total}`);
  console.log(`✅ Updated: ${results.updated}`);
  console.log(`⊘ Skipped: ${results.skipped}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(err => {
      console.log(`   - ${err.tenantId}: ${err.error}`);
    });
  }

  console.log('\n✅ SEO tuning complete!\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
