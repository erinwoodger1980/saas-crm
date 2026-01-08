/**
 * Migration Script: FollowUpLog → Task
 * 
 * Converts all existing FollowUpLog records into Task records with:
 * - taskType = FOLLOW_UP
 * - communicationType = EMAIL
 * - autoCompleted = true (historical data)
 * - Preserves all metadata
 * 
 * LeadInteraction records are NOT migrated (website analytics only).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateFollowUps() {
  console.log('🔄 Starting FollowUpLog → Task migration...');
  
  try {
    // Get all FollowUpLog records
    const followUpLogs = await prisma.followUpLog.findMany({
      orderBy: { sentAt: 'asc' }
    });

    console.log(`📊 Found ${followUpLogs.length} FollowUpLog records to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const log of followUpLogs) {
      try {
        // Check if already migrated
        const existing = await prisma.task.findFirst({
          where: { followUpLogId: log.id }
        });

        if (existing) {
          console.log(`⏭️  Skipping already migrated: ${log.id}`);
          continue;
        }

        // Create Task from FollowUpLog
        await prisma.task.create({
          data: {
            tenantId: log.tenantId,
            title: log.subject,
            description: log.body,
            relatedType: 'LEAD',
            relatedId: log.leadId,
            status: 'DONE', // Historical follow-ups are completed
            priority: 'MEDIUM',
            dueAt: log.scheduledFor || log.sentAt,
            completedAt: log.sentAt,
            autocreated: true,
            
            // Task Type fields
            taskType: 'FOLLOW_UP',
            
            // Communication fields
            communicationType: 'EMAIL',
            communicationChannel: log.channel,
            communicationDirection: 'OUTBOUND',
            communicationNotes: `Variant: ${log.variant}${log.provider ? `, Provider: ${log.provider}` : ''}${log.messageId ? `, Message ID: ${log.messageId}` : ''}`,
            emailMessageId: log.messageId || undefined,
            followUpLogId: log.id,
            
            // Auto-completion tracking
            autoCompleted: true,
            completedBy: null, // Historical data - unknown
            
            // Metadata preservation
            meta: {
              migrated: true,
              migratedFrom: 'FollowUpLog',
              migratedAt: new Date().toISOString(),
              originalData: {
                variant: log.variant,
                opened: log.opened,
                replied: log.replied,
                converted: log.converted,
                delayDays: log.delayDays,
                provider: log.provider,
                threadId: log.threadId,
                metadata: log.metadata
              }
            },
            
            createdAt: log.sentAt,
            updatedAt: log.sentAt
          }
        });

        successCount++;
        
        if (successCount % 100 === 0) {
          console.log(`✅ Migrated ${successCount} records...`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating FollowUpLog ${log.id}:`, error);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total FollowUpLogs: ${followUpLogs.length}`);
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️  Already migrated: ${followUpLogs.length - successCount - errorCount}`);

    // Verify migration
    const migratedTasks = await prisma.task.count({
      where: { taskType: 'FOLLOW_UP' }
    });

    console.log(`\n🔍 Verification: ${migratedTasks} FOLLOW_UP tasks exist in database`);

    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  NOTE: FollowUpLog table is still intact. Consider deprecating but keeping for audit purposes.');
    console.log('⚠️  NOTE: LeadInteraction records were NOT migrated (website analytics only).');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateFollowUps()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
