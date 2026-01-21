import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const tenantId = process.argv[2];
  const value = process.argv[3] ?? "true";
  if (!tenantId) {
    console.error("Usage: tsx api/scripts/set_coaching_flag.ts <tenantId> [true|false]");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  try {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { isGroupCoachingMember: value === "true" },
      select: { id: true, name: true, isGroupCoachingMember: true },
    });
    console.log("Updated tenant:", updated);
  } catch (e: any) {
    console.error("Failed to update tenant:", e?.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
