/**
 * Phase 7: Data Migration & Backfill
 * 
 * Migrates existing quotes to canonical ConfiguredProduct schema
 * Handles legacy questionnaire responses and custom fields
 */

import { PrismaClient } from '@prisma/client';
import { stdout } from 'process';

const prisma = new PrismaClient();

interface MigrationStats {
  totalQuotes: number;
  migratedQuotes: number;
  skippedQuotes: number;
  errorsEncountered: string[];
  startTime: Date;
  endTime: Date;
  duration: string;
}

/**
 * Get or create attributes for a tenant from existing questionnaire fields
 */
async function ensureAttributesForTenant(tenantId: string): Promise<string> {
  console.log(`[${tenantId}] Creating legacy mappings for existing fields...`);

  // Get all unique field keys used in this tenant's responses
  const uniqueFields = await prisma.$queryRaw`
    SELECT DISTINCT f.key, f.fieldLabel
    FROM "QuestionnaireField" f
    INNER JOIN "QuestionnaireResponse" r ON r.id = ANY(
      SELECT DISTINCT "questionnaireResponseId"
      FROM "QuestionnaireAnswer"
      WHERE f.id = "fieldId"
    )
    INNER JOIN "Quote" q ON q.id = r."quoteId"
    WHERE q."tenantId" = ${tenantId}
    LIMIT 100
  ` as any[];

  let attributeCount = 0;

  for (const field of uniqueFields || []) {
    // Check if attribute already exists
    const existing = await prisma.attribute.findFirst({
      where: {
        tenantId,
        code: field.key
      }
    });

    if (!existing) {
      await prisma.attribute.create({
        data: {
          tenantId,
          code: field.key,
          name: field.fieldLabel || field.key,
          description: `Auto-migrated from legacy field: ${field.key}`,
          attributeType: 'text', // Default type, can be overridden
          isActive: true
        }
      });
      attributeCount++;
    }
  }

  console.log(`[${tenantId}] Created ${attributeCount} new attributes`);
  return tenantId;
}

/**
 * Backfill existing quote responses to configuredProduct
 */
async function backfillQuoteResponse(
  responseId: string,
  tenantId: string
): Promise<{
  success: boolean;
  quoteId?: string;
  lineCount?: number;
  error?: string;
}> {
  try {
    // Get response with answers and quote
    const response = await prisma.questionnaireResponse.findUnique({
      where: { id: responseId },
      include: {
        answers: {
          include: { field: true }
        },
        quote: {
          include: { lines: true }
        }
      }
    });

    if (!response || !response.quote) {
      return {
        success: false,
        error: 'Response or quote not found'
      };
    }

    const quote = response.quote;
    const selections: Record<string, any> = {};
    const provenance: Record<string, string> = {};

    // Build selections from answers
    for (const answer of response.answers) {
      const fieldKey = answer.field.key;
      selections[fieldKey] = answer.value;
      provenance[fieldKey] = 'legacy-questionnaire';
    }

    // Update each quote line's configuredProduct
    let updatedLineCount = 0;

    for (const line of quote.lines) {
      const config = (line.configuredProduct as any) || {};

      // Only update if not already populated (preserve canonical data)
      if (!config.selections) {
        const updated = {
          ...config,
          selections,
          provenance,
          migratedAt: new Date().toISOString(),
          migrationSource: 'questionnaire-response'
        };

        await prisma.quoteLine.update({
          where: { id: line.id },
          data: { configuredProduct: updated }
        });

        updatedLineCount++;
      }
    }

    console.log(
      `  ✓ Migrated response ${responseId.slice(0, 8)}... to ${updatedLineCount} lines`
    );

    return {
      success: true,
      quoteId: quote.id,
      lineCount: updatedLineCount
    };
  } catch (e: any) {
    console.error(`  ✗ Failed to backfill response ${responseId}:`, e?.message);
    return {
      success: false,
      error: e?.message
    };
  }
}

/**
 * Migrate all quotes for a tenant
 */
export async function migrateTenantsQuotes(
  tenantIds?: string[]
): Promise<MigrationStats> {
  const startTime = new Date();
  const errors: string[] = [];
  let totalQuotes = 0;
  let migratedQuotes = 0;
  let skippedQuotes = 0;

  try {
    // Determine which tenants to migrate
    const tenantsToMigrate = tenantIds || (await prisma.tenant.findMany({
      select: { id: true }
    })).map(t => t.id);

    console.log(`\n🔄 Starting ConfiguredProduct migration for ${tenantsToMigrate.length} tenant(s)\n`);

    for (const tenantId of tenantsToMigrate) {
      console.log(`\n📋 Processing tenant: ${tenantId}\n`);

      try {
        // Ensure attributes exist
        await ensureAttributesForTenant(tenantId);

        // Get all responses for this tenant that haven't been migrated
        const responses = await prisma.questionnaireResponse.findMany({
          where: {
            quote: { tenantId }
          },
          select: { id: true }
        });

        console.log(`Found ${responses.length} questionnaire responses to migrate\n`);

        let responseMigratedCount = 0;
        let responseErrorCount = 0;

        // Migrate each response
        for (const response of responses) {
          const result = await backfillQuoteResponse(response.id, tenantId);
          if (result.success) {
            responseMigratedCount++;
            migratedQuotes++;
          } else {
            responseErrorCount++;
            if (result.error) {
              errors.push(`Response ${response.id}: ${result.error}`);
            }
          }
        }

        totalQuotes += responses.length;

        console.log(`\n✅ Tenant migration complete:`);
        console.log(`   - Responses migrated: ${responseMigratedCount}`);
        console.log(`   - Errors: ${responseErrorCount}\n`);
      } catch (e: any) {
        const msg = `Tenant ${tenantId} failed: ${e?.message}`;
        console.error(`\n❌ ${msg}\n`);
        errors.push(msg);
      }
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const durationStr = `${duration}s`;

    console.log(`\n📊 Migration Summary:`);
    console.log(`   - Total quotes processed: ${totalQuotes}`);
    console.log(`   - Successfully migrated: ${migratedQuotes}`);
    console.log(`   - Skipped/errors: ${totalQuotes - migratedQuotes}`);
    console.log(`   - Duration: ${durationStr}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.slice(0, 10).forEach((e, i) => {
        console.log(`   ${i + 1}. ${e}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more`);
      }
    }

    return {
      totalQuotes,
      migratedQuotes,
      skippedQuotes: totalQuotes - migratedQuotes,
      errorsEncountered: errors,
      startTime,
      endTime,
      duration: durationStr
    };
  } catch (e: any) {
    console.error('\n💥 Migration failed:', e?.message);
    throw e;
  }
}

/**
 * Validate migration results
 */
export async function validateMigration(tenantId: string): Promise<{
  totalLines: number;
  linesWithConfiguredProduct: number;
  linesWithSelections: number;
  validationPercentage: number;
}> {
  const allLines = await prisma.quoteLine.findMany({
    where: { quote: { tenantId } },
    select: { configuredProduct: true }
  });

  let withConfig = 0;
  let withSelections = 0;

  for (const line of allLines) {
    if (line.configuredProduct) {
      withConfig++;
      const config = line.configuredProduct as any;
      if (config.selections && Object.keys(config.selections).length > 0) {
        withSelections++;
      }
    }
  }

  return {
    totalLines: allLines.length,
    linesWithConfiguredProduct: withConfig,
    linesWithSelections: withSelections,
    validationPercentage:
      allLines.length > 0 ? Math.round((withSelections / allLines.length) * 100) : 0
  };
}

/**
 * CLI entry point
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    const tenantIds = args.slice(1);

    if (command === 'validate') {
      if (tenantIds.length === 0) {
        console.error('Usage: migrate validate <tenantId> [tenantId2...]');
        process.exit(1);
      }

      console.log('\n🔍 Validating migration...\n');

      for (const tenantId of tenantIds) {
        const result = await validateMigration(tenantId);
        console.log(`Tenant ${tenantId}:`);
        console.log(`  - Total quote lines: ${result.totalLines}`);
        console.log(`  - With configuredProduct: ${result.linesWithConfiguredProduct}`);
        console.log(`  - With selections: ${result.linesWithSelections}`);
        console.log(`  - Validation: ${result.validationPercentage}%\n`);
      }
    } else {
      // Default: migrate
      const stats = await migrateTenantsQuotes(tenantIds.length > 0 ? tenantIds : undefined);

      // Optionally validate
      if (tenantIds.length > 0) {
        console.log('\n🔍 Running validation...\n');
        for (const tenantId of tenantIds) {
          const validation = await validateMigration(tenantId);
          console.log(`Validation for ${tenantId}: ${validation.validationPercentage}% complete\n`);
        }
      }
    }
  } catch (e) {
    console.error('Fatal error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { MigrationStats };
