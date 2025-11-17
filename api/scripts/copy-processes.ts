#!/usr/bin/env ts-node
/**
 * Copy workshop processes from one tenant to another.
 * Usage:
 *   pnpm tsx api/scripts/copy-processes.ts --fromSlug wealden-joinery --toName "Demo Tenant" --replace
 */
import prisma from "../src/db";

function parseArgs() {
  const args = process.argv.slice(2);
  const o: Record<string, string|boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i+1] && !args[i+1].startsWith("--") ? args[++i] : "true";
      o[key] = val === "true" ? true : val === "false" ? false : val;
    }
  }
  return o as { fromSlug?: string; toSlug?: string; fromName?: string; toName?: string; replace?: boolean };
}

async function main() {
  const { fromSlug, toSlug, fromName, toName, replace } = parseArgs();
  const fromTenant = fromSlug
    ? await prisma.tenant.findFirst({ where: { slug: fromSlug } })
    : await prisma.tenant.findFirst({ where: { name: fromName || "Wealden Joinery" } });
  const toTenant = toSlug
    ? await prisma.tenant.findFirst({ where: { slug: toSlug } })
    : await prisma.tenant.findFirst({ where: { name: toName || "Demo Tenant" } });

  if (!fromTenant) throw new Error("from tenant not found");
  if (!toTenant) throw new Error("to tenant not found");
  if (fromTenant.id === toTenant.id) throw new Error("from and to are the same tenant");

  const defs = await prisma.workshopProcessDefinition.findMany({ where: { tenantId: fromTenant.id } });
  let created = 0, updated = 0, skipped = 0;
  for (const d of defs) {
    const existing = await prisma.workshopProcessDefinition.findFirst({ where: { tenantId: toTenant.id, code: d.code } });
    if (!existing) {
      await prisma.workshopProcessDefinition.create({
        data: {
          tenantId: toTenant.id,
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
    } else if (replace) {
      await prisma.workshopProcessDefinition.update({
        where: { id: existing.id },
        data: {
          name: d.name,
          sortOrder: d.sortOrder ?? 0,
          requiredByDefault: d.requiredByDefault ?? true,
          estimatedHours: d.estimatedHours,
          isColorKey: d.isColorKey ?? false,
          assignmentGroup: d.assignmentGroup || null,
        }
      });
      updated++;
    } else {
      skipped++;
    }
  }
  console.log(`Copied from ${fromTenant.slug} to ${toTenant.slug}. Created=${created} Updated=${updated} Skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
