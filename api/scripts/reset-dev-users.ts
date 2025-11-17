#!/usr/bin/env ts-node
/**
 * Reset or create per-tenant developer access users with a stable password.
 * Usage: pnpm tsx scripts/reset-dev-users.ts
 */
import { prisma } from "../src/prisma";
import bcrypt from "bcrypt";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } });
  const password = 'DevAccess123!';
  const passwordHash = await bcrypt.hash(password, 10);
  let created = 0;
  let updated = 0;

  for (const t of tenants) {
    const email = `dev+${t.slug}@joineryai.app`;
    const existing = await prisma.user.findFirst({ where: { tenantId: t.id, email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          tenantId: t.id,
          email,
          name: `Developer (Dev Access)`,
          role: 'owner',
          isDeveloper: true,
          signupCompleted: true,
          passwordHash,
        }
      });
      console.log(`[reset-dev-users] Created dev user ${email} for tenant ${t.slug}`);
      created++;
    } else {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
      console.log(`[reset-dev-users] Updated password for dev user ${email} (tenant ${t.slug})`);
      updated++;
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}. Password => DevAccess123!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
