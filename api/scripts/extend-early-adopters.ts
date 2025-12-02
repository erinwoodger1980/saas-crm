const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const targetDate = new Date("2026-01-31T23:59:59.999Z");

    // Extend all tenants to end of January 2026
    const result = await prisma.tenant.updateMany({
      data: { trialEndsAt: targetDate },
    });

    console.log(`Extended trials for ${result.count} tenants to ${targetDate.toISOString()}`);
  } catch (e) {
    console.error("Failed to extend early adopter trials:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
