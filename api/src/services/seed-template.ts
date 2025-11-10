// Service to initialize new tenants with seed template data from Wealden Joinery
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WEALDEN_SLUG = 'wealden'; // Use Wealden Joinery as the template

export async function initializeTenantWithSeedData(tenantId: string) {
  try {
    console.log(`🌱 Initializing tenant ${tenantId} with Wealden Joinery seed data...`);

    // Find Wealden Joinery tenant
    const wealdenTenant = await prisma.tenant.findUnique({
      where: { slug: WEALDEN_SLUG },
      include: {
        leadFieldDefs: true,
        tasks: true,
        automationRules: true
      }
    });

    if (!wealdenTenant) {
      console.warn(`⚠️  Wealden Joinery tenant not found. Skipping seed data initialization.`);
      return {
        success: false,
        message: 'Template tenant not found'
      };
    }

    let copiedItems = 0;

    // Copy questionnaire fields
    if (wealdenTenant.leadFieldDefs && wealdenTenant.leadFieldDefs.length > 0) {
      for (const field of wealdenTenant.leadFieldDefs) {
        await prisma.leadFieldDef.create({
          data: {
            tenantId,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            config: field.config as any,
            sortOrder: field.sortOrder
          }
        });
        copiedItems++;
      }
      console.log(`✅ Copied ${wealdenTenant.leadFieldDefs.length} questionnaire fields`);
    }

    // Copy task templates (only uncompleted templates)
    if (wealdenTenant.tasks && wealdenTenant.tasks.length > 0) {
      const templateTasks = wealdenTenant.tasks.filter(t => 
        !t.completedAt && t.relatedType === 'OTHER'
      );
      
      for (const task of templateTasks) {
        await prisma.task.create({
          data: {
            tenantId,
            title: task.title,
            description: task.description,
            dueAt: task.dueAt,
            priority: task.priority,
            status: 'OPEN',
            relatedType: 'OTHER',
            relatedId: null,
            autocreated: false
          }
        });
        copiedItems++;
      }
      if (templateTasks.length > 0) {
        console.log(`✅ Copied ${templateTasks.length} task templates`);
      }
    }

    // Copy automation rules
    if (wealdenTenant.automationRules && wealdenTenant.automationRules.length > 0) {
      const activeRules = wealdenTenant.automationRules.filter(r => r.enabled);
      
      for (const rule of activeRules) {
        await prisma.automationRule.create({
          data: {
            tenantId,
            name: rule.name,
            enabled: true,
            trigger: rule.trigger as any,
            conditions: rule.conditions as any,
            actions: rule.actions as any
          }
        });
        copiedItems++;
      }
      if (activeRules.length > 0) {
        console.log(`✅ Copied ${activeRules.length} automation rules`);
      }
    }

    console.log(`✅ Successfully initialized tenant ${tenantId} with ${copiedItems} items from Wealden Joinery`);

    return {
      success: true,
      questionnaireFields: wealdenTenant.leadFieldDefs?.length || 0,
      tasks: wealdenTenant.tasks?.filter(t => !t.completedAt && t.relatedType === 'OTHER').length || 0,
      automationRules: wealdenTenant.automationRules?.filter(r => r.enabled).length || 0,
      totalItems: copiedItems
    };

  } catch (error) {
    console.error(`❌ Failed to initialize tenant ${tenantId} with seed data:`, error);
    throw error;
  }
}

export async function ensureSeedTemplateExists() {
  try {
    const wealdenTenant = await prisma.tenant.findUnique({
      where: { slug: WEALDEN_SLUG }
    });

    if (!wealdenTenant) {
      console.log('⚠️  Wealden Joinery template tenant not found. Please ensure Wealden tenant exists.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to ensure seed template exists:', error);
    return false;
  }
}