#!/usr/bin/env tsx
/**
 * Migrate task playbook to automation rules
 * 
 * This script converts the old task playbook system into the new automation rules.
 * Run with: pnpm tsx scripts/migrate-playbook-to-automations.ts [tenantId]
 * 
 * If no tenantId is provided, migrates all tenants.
 */

import { prisma } from '../src/prisma';
import { DEFAULT_TASK_PLAYBOOK, normalizeTaskPlaybook, UiStatus, TaskRecipe, ManualTaskKey } from '../src/task-playbook';

// Map playbook statuses to automation triggers
const STATUS_TO_TRIGGER_MAP: Record<UiStatus, { newValue: string; description: string }> = {
  NEW_ENQUIRY: { newValue: 'NEW_ENQUIRY', description: 'When a new enquiry is created' },
  INFO_REQUESTED: { newValue: 'INFO_REQUESTED', description: 'When enquiry moves to Info Requested' },
  DISQUALIFIED: { newValue: 'DISQUALIFIED', description: 'When enquiry is disqualified' },
  REJECTED: { newValue: 'REJECTED', description: 'When enquiry is rejected' },
  READY_TO_QUOTE: { newValue: 'READY_TO_QUOTE', description: 'When enquiry is ready to quote' },
  ESTIMATE: { newValue: 'ESTIMATE', description: 'When enquiry moves to estimate stage' },
  QUOTE_SENT: { newValue: 'QUOTE_SENT', description: 'When quote is sent' },
  WON: { newValue: 'WON', description: 'When opportunity is won' },
  LOST: { newValue: 'LOST', description: 'When opportunity is lost' },
  COMPLETED: { newValue: 'COMPLETED', description: 'When project is completed' },
};

function recipeToAutomationRule(
  recipe: TaskRecipe,
  status: UiStatus,
  tenantId: string,
  createdById?: string
) {
  const trigger = STATUS_TO_TRIGGER_MAP[status];
  
  return {
    tenantId,
    name: `[Migrated] ${recipe.title} (${status})`,
    enabled: recipe.active !== false,
    trigger: {
      type: 'STATUS_CHANGED',
      entityType: 'LEAD',
      newValue: trigger.newValue,
    },
    conditions: null,
    actions: [
      {
        type: 'CREATE_TASK',
        taskTitle: recipe.title,
        taskDescription: recipe.description || null,
        taskType: 'MANUAL',
        priority: recipe.priority || 'MEDIUM',
        relatedTo: recipe.relatedType || 'LEAD',
        dueAtCalculation: {
          type: 'RELATIVE_TO_FIELD',
          fieldName: 'createdAt',
          offsetDays: recipe.dueInDays || 0,
        },
        rescheduleOnTriggerChange: false,
        taskInstanceKey: `playbook_${recipe.id}_{leadId}`,
        assignToRole: recipe.autoAssign === 'ACTOR' ? 'lead_owner' : undefined,
      },
    ],
    createdById,
  };
}

async function migrateTenant(tenantId: string) {
  console.log(`\n📦 Migrating tenant: ${tenantId}`);
  
  // Load tenant settings to get playbook
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { taskPlaybook: true },
  });

  const playbook = normalizeTaskPlaybook(settings?.taskPlaybook as any);
  
  // Count existing automation rules
  const existingRules = await prisma.automationRule.findMany({
    where: { 
      tenantId,
      name: { startsWith: '[Migrated]' }
    },
  });

  if (existingRules.length > 0) {
    console.log(`⚠️  Found ${existingRules.length} existing migrated rules. Skipping tenant.`);
    return { skipped: true, count: 0 };
  }

  let count = 0;

  // Migrate status-based recipes
  for (const [status, recipes] of Object.entries(playbook.status) as [UiStatus, TaskRecipe[]][]) {
    for (const recipe of recipes) {
      if (!recipe || !recipe.title) continue;
      
      try {
        const rule = recipeToAutomationRule(recipe, status, tenantId);
        await prisma.automationRule.create({ data: rule as any });
        console.log(`  ✅ Created: ${recipe.title} (${status})`);
        count++;
      } catch (error) {
        console.error(`  ❌ Failed to create automation for ${recipe.title}:`, error);
      }
    }
  }

  // Note: Manual recipes are not migrated as they are triggered manually,
  // not automatically. They can be created on-demand through the UI if needed.
  console.log(`  ℹ️  Skipped ${Object.keys(playbook.manual).length} manual recipes (trigger manually through UI)`);

  console.log(`✅ Migrated ${count} playbook tasks to automation rules for tenant ${tenantId}`);
  return { skipped: false, count };
}

async function main() {
  const tenantIdArg = process.argv[2];

  if (tenantIdArg) {
    // Migrate specific tenant
    console.log(`🔄 Migrating playbook to automations for tenant: ${tenantIdArg}`);
    await migrateTenant(tenantIdArg);
  } else {
    // Migrate all tenants
    console.log(`🔄 Migrating playbook to automations for ALL tenants`);
    
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    console.log(`Found ${tenants.length} tenants to migrate\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      console.log(`\n--- ${tenant.name} (${tenant.id}) ---`);
      const result = await migrateTenant(tenant.id);
      if (result.skipped) {
        totalSkipped++;
      } else {
        totalMigrated += result.count;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total automations created: ${totalMigrated}`);
    console.log(`   Tenants skipped: ${totalSkipped}`);
    console.log(`   Tenants migrated: ${tenants.length - totalSkipped}`);
  }

  console.log(`\n✅ Migration complete!`);
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
