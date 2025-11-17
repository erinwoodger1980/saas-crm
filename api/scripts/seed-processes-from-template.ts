#!/usr/bin/env ts-node
/**
 * Copy workshop processes from a template tenant (by slug) to all tenants.
 * Usage: TEMPLATE_TENANT_SLUG=wealden-joinery pnpm tsx scripts/seed-processes-from-template.ts
 */
import prisma from "../src/db";

async function main() {
  const templateSlug = process.env.TEMPLATE_TENANT_SLUG || 'wealden-joinery';
  const template = await prisma.tenant.findFirst({ where: { slug: templateSlug } });
  if (!template) throw new Error(`Template tenant not found: ${templateSlug}`);
  const defs = await prisma.workshopProcessDefinition.findMany({ where: { tenantId: template.id } });
  if (!defs.length) {
    console.log('No processes found on template; nothing to do.');
    return;
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  let created = 0, skipped = 0;
  for (const t of tenants) {
    if (t.id === template.id) continue;
    for (const d of defs) {
      try {
        await prisma.workshopProcessDefinition.create({
          data: {
            tenantId: t.id,
            code: d.code,
            name: d.name,
            sortOrder: d.sortOrder ?? 0,
            requiredByDefault: d.requiredByDefault ?? true,
            estimatedHours: d.estimatedHours,
            isColorKey: d.isColorKey ?? false,
            assignmentGroup: d.assignmentGroup || null,
          }
        });
        created++;
      } catch (e: any) {
        if (e?.code === 'P2002') { skipped++; } else throw e;
      }
    }
  }
  console.log(`Done. Created: ${created}, Skipped: ${skipped}. From template: ${templateSlug}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
