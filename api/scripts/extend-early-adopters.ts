const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const targetDate = new Date("2026-01-31T23:59:59.999Z");

    // Find tenants that have at least one early adopter user
    const tenants = await prisma.tenant.findMany({
      where: {
        clientAccounts: { some: {} }, // keep select light; we'll cross-check via users
      },
      select: { id: true, trialEndsAt: true },
    });

    let updatedCount = 0;
    for (const t of tenants) {
      const hasEarly = await prisma.user.findFirst({
        where: { tenantId: t.id, isEarlyAdopter: true },
        select: { id: true },
      });
      if (hasEarly) {
        await prisma.tenant.update({
          where: { id: t.id },
          data: { trialEndsAt: targetDate },
        });
        updatedCount++;
      }
    }

    console.log(`Extended trials for ${updatedCount} tenants to ${targetDate.toISOString()}`);
  } catch (e) {
    console.error("Failed to extend early adopter trials:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
