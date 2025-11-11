// Service to initialize new tenants with seed template data from Demo Tenant
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEMPLATE_SLUG = 'demo-tenant'; // Use Demo Tenant as the template (contains questionnaire from acme.test)

export async function initializeTenantWithSeedData(tenantId: string) {
  try {
    console.log(`🌱 Initializing tenant ${tenantId} with Demo Tenant seed data...`);

    // Find Demo Tenant (template)
    const templateTenant = await prisma.tenant.findUnique({
      where: { slug: TEMPLATE_SLUG },
      include: {
        leadFieldDefs: true,
        tasks: true,
        automationRules: true
      }
    });

    if (!templateTenant) {
      console.warn(`⚠️  Demo Tenant template not found. Skipping seed data initialization.`);
      return {
        success: false,
        message: 'Template tenant not found'
      };
    }

    let copiedItems = 0;

    // Copy questionnaire fields
    if (templateTenant.leadFieldDefs && templateTenant.leadFieldDefs.length > 0) {
      for (const field of templateTenant.leadFieldDefs) {
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
      console.log(`✅ Copied ${templateTenant.leadFieldDefs.length} questionnaire fields`);
    }

    // Copy task templates (only uncompleted templates)
    if (templateTenant.tasks && templateTenant.tasks.length > 0) {
      const templateTasks = templateTenant.tasks.filter((t: any) => 
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
    if (templateTenant.automationRules && templateTenant.automationRules.length > 0) {
      const activeRules = templateTenant.automationRules.filter((r: any) => r.enabled);
      
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

    console.log(`✅ Successfully initialized tenant ${tenantId} with ${copiedItems} items from Demo Tenant`);

    return {
      success: true,
      questionnaireFields: templateTenant.leadFieldDefs?.length || 0,
      tasks: templateTenant.tasks?.filter((t: any) => !t.completedAt && t.relatedType === 'OTHER').length || 0,
      automationRules: templateTenant.automationRules?.filter((r: any) => r.enabled).length || 0,
      totalItems: copiedItems
    };

  } catch (error) {
    console.error(`❌ Failed to initialize tenant ${tenantId} with seed data:`, error);
    throw error;
  }
}

export async function ensureSeedTemplateExists() {
  try {
    const templateTenant = await prisma.tenant.findUnique({
      where: { slug: TEMPLATE_SLUG }
    });

    if (!templateTenant) {
      console.log('⚠️  Demo Tenant template not found. Please ensure demo-tenant exists.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to ensure seed template exists:', error);
    return false;
  }
}