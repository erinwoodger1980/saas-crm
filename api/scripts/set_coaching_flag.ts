import { PrismaClient } from "@prisma/client";

async function main() {
  const tenantId = process.argv[2];
  const value = process.argv[3] ?? "true";
  if (!tenantId) {
    console.error("Usage: tsx api/scripts/set_coaching_flag.ts <tenantId> [true|false]");
    process.exit(1);
  }
  const prisma = new PrismaClient();
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
  }
}

main();
